//! A small WebAssembly binding of the cache library cachette, for the
//! Error Correction Zoo site builder (Node.js only).
//!
//! It exposes a cachette [`Manager`] over the file system of Node.js, and
//! sessions on values caches of the files engine, with blobs. The JavaScript
//! module `index.js` of the package wraps these exports into its public API;
//! nothing here is meant to be called directly.
//!
//! The file system, the clock and the reporter call the functions of the
//! JavaScript module `js/host.js`, which use the synchronous functions of
//! `node:fs`. The Rust types are unit structs or plain numbers, so they are
//! `Send + Sync` as cachette requires. Node.js has no file locks: `js/host.js`
//! keeps the locks in a table of the process (see [`NodeFs`]).

use std::sync::Once;
use std::time::Duration;

use cachette::{
    BlobName, BlobSelection, CacheFs, Clock, Cost, Engine, FileStat, FsEntry, FsEntryKind, FsError,
    InstanceAction, InstanceKey, MaintenanceOutcome, MaintenanceStatus, Manager, ManagerFs,
    ManagerSettings, PutOptions, Record, Report, Reporter, Severity, SizeLimit, SizeOutcome,
    Timestamp, ValueSort, ValuesCacheDeclaration, ValuesSession,
};
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

// --- The host functions (js/host.js) ---------------------------------------------

// The path is relative to the glue module in dist/, which imports it as it
// is written here.
#[wasm_bindgen(raw_module = "../js/host.js")]
extern "C" {
    #[wasm_bindgen(catch, js_name = hostRead)]
    fn host_read(path: &str) -> Result<Option<Vec<u8>>, JsValue>;

    #[wasm_bindgen(catch, js_name = hostWrite)]
    fn host_write(path: &str, bytes: &[u8]) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, js_name = hostAppend)]
    fn host_append(path: &str, bytes: &[u8]) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, js_name = hostAtomicReplace)]
    fn host_atomic_replace(path: &str, bytes: &[u8]) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, js_name = hostRename)]
    fn host_rename(from: &str, to: &str) -> Result<(), JsValue>;

    /// The entries of the folder, each as one letter for its kind (`F` a
    /// file, `D` a folder, `L` a symbolic link) followed by its name.
    #[wasm_bindgen(catch, js_name = hostList)]
    fn host_list(dir: &str) -> Result<Vec<String>, JsValue>;

    /// `[size, modified]`, the modification time in milliseconds since the
    /// Unix epoch, or `None` when no file is at the path.
    #[wasm_bindgen(catch, js_name = hostStat)]
    fn host_stat(path: &str) -> Result<Option<Vec<f64>>, JsValue>;

    #[wasm_bindgen(catch, js_name = hostSetModified)]
    fn host_set_modified(path: &str, at_ms: f64) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, js_name = hostRemove)]
    fn host_remove(path: &str) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, js_name = hostRemoveFolder)]
    fn host_remove_folder(path: &str) -> Result<(), JsValue>;

    /// Takes a lock on the file at the path, created when absent, without
    /// waiting: answers the number of the guard (at least 1), or 0 when
    /// another guard of the process holds a lock that excludes this one.
    #[wasm_bindgen(catch, js_name = hostLock)]
    fn host_lock(path: &str, exclusive: bool) -> Result<u32, JsValue>;

    /// Releases the lock of the guard. Never throws.
    #[wasm_bindgen(js_name = hostUnlock)]
    fn host_unlock(guard: u32);

    /// `Date.now()`.
    #[wasm_bindgen(js_name = hostNow)]
    fn host_now() -> f64;

    /// Passes a report to the reporter registered under the number
    /// `reporter`. Never throws.
    #[wasm_bindgen(js_name = hostReport)]
    fn host_report(
        reporter: u32,
        severity: &str,
        kind: &str,
        message: &str,
        cache: Option<String>,
        version: Option<u32>,
        folder: Option<String>,
    );

    /// Writes the message of a panic to the console. Never throws.
    #[wasm_bindgen(js_name = hostPanic)]
    fn host_panic(message: &str);
}

/// Turns the error that a host function threw (a string, see js/host.js)
/// into an [`FsError`].
fn fs_error(error: JsValue) -> FsError {
    FsError::new(
        error
            .as_string()
            .unwrap_or_else(|| String::from("Failed in the host file system: unknown error")),
    )
}

// --- The file system ---------------------------------------------------------------

/// The file system of Node.js, through the synchronous functions of
/// `node:fs` that `js/host.js` calls.
///
/// # Locks
///
/// Node.js has no file locks. The locks are kept in a table of the
/// JavaScript module `js/host.js`, by the identity of the locked file (its
/// device and inode numbers), with the exclusion rules of [`ManagerFs`]:
/// any number of shared guards, or one exclusive guard, on a file. A lock
/// file is created when it is absent, and the guard keeps it open, so that
/// its identity is not given to another file while the guard exists. The
/// locks therefore exclude each other within one process (one JavaScript
/// realm: a worker thread has a table of its own), and not between
/// processes: only one process at a time may use a cache folder.
///
/// WebAssembly here runs on one thread, so a lock operation can never wait
/// for another guard to be dropped. [`CacheFs::lock_exclusive`] and
/// [`ManagerFs::lock_shared`] answer an [`FsError`] when they would have to
/// wait; the `try_` forms answer `None`, as the traits state. Opening the
/// file and registering its lock happen in one step of the single thread, so
/// the check after acquiring that [`CacheFs::lock_exclusive`] asks for holds
/// by construction within the process.
#[derive(Clone, Copy, Debug, Default)]
struct NodeFs;

/// The guard of a lock of [`NodeFs`]: the number under which `js/host.js`
/// keeps it. Dropping it releases the lock.
#[derive(Debug)]
struct NodeGuard {
    id: u32,
}

impl Drop for NodeGuard {
    fn drop(&mut self) {
        host_unlock(self.id);
    }
}

/// Takes a lock without waiting: `Ok(None)` when another guard excludes it.
fn try_lock(path: &str, exclusive: bool) -> Result<Option<NodeGuard>, FsError> {
    match host_lock(path, exclusive).map_err(fs_error)? {
        0 => Ok(None),
        id => Ok(Some(NodeGuard { id })),
    }
}

/// Takes a lock that would wait while another guard excludes it: an error
/// in that case, since a single thread cannot wait for its own guards.
fn lock_or_fail(path: &str, exclusive: bool) -> Result<NodeGuard, FsError> {
    try_lock(path, exclusive)?.ok_or_else(|| {
        let kind = if exclusive { "an exclusive" } else { "a shared" };
        FsError::new(format!(
            "Failed to take {kind} lock on ‘{path}’: another guard of this process holds a lock \
             that excludes it, and a lock cannot wait in single-threaded WebAssembly"
        ))
    })
}

impl CacheFs for NodeFs {
    type Guard = NodeGuard;

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, FsError> {
        host_read(path).map_err(fs_error)
    }

    fn write(&self, path: &str, bytes: &[u8]) -> Result<(), FsError> {
        host_write(path, bytes).map_err(fs_error)
    }

    fn append(&self, path: &str, bytes: &[u8]) -> Result<(), FsError> {
        host_append(path, bytes).map_err(fs_error)
    }

    fn atomic_replace(&self, path: &str, bytes: &[u8]) -> Result<(), FsError> {
        host_atomic_replace(path, bytes).map_err(fs_error)
    }

    fn rename(&self, from: &str, to: &str) -> Result<(), FsError> {
        host_rename(from, to).map_err(fs_error)
    }

    fn list(&self, dir: &str) -> Result<Vec<FsEntry>, FsError> {
        let listed = host_list(dir).map_err(fs_error)?;
        let mut entries = Vec::with_capacity(listed.len());
        for item in listed {
            let mut chars = item.chars();
            let kind = match chars.next() {
                Some('F') => FsEntryKind::File,
                Some('D') => FsEntryKind::Folder,
                Some('L') => FsEntryKind::Link,
                _ => {
                    return Err(FsError::new(format!(
                        "Failed to list folder ‘{dir}’: invalid entry ‘{item}’ from the host"
                    )));
                }
            };
            entries.push(FsEntry {
                name: String::from(chars.as_str()),
                kind,
            });
        }
        Ok(entries)
    }

    fn stat(&self, path: &str) -> Result<Option<FileStat>, FsError> {
        let Some(stat) = host_stat(path).map_err(fs_error)? else {
            return Ok(None);
        };
        match stat[..] {
            [size, modified] => Ok(Some(FileStat {
                size: size as u64,
                modified: Timestamp::from_millis(modified as i64),
            })),
            _ => Err(FsError::new(format!(
                "Failed to read the metadata of ‘{path}’: invalid answer from the host"
            ))),
        }
    }

    fn set_modified(&self, path: &str, at: Timestamp) -> Result<(), FsError> {
        host_set_modified(path, at.as_millis() as f64).map_err(fs_error)
    }

    fn remove(&self, path: &str) -> Result<(), FsError> {
        host_remove(path).map_err(fs_error)
    }

    fn lock_exclusive(&self, path: &str) -> Result<NodeGuard, FsError> {
        lock_or_fail(path, true)
    }

    fn try_lock_exclusive(&self, path: &str) -> Result<Option<NodeGuard>, FsError> {
        try_lock(path, true)
    }
}

impl ManagerFs for NodeFs {
    fn lock_shared(&self, path: &str) -> Result<NodeGuard, FsError> {
        lock_or_fail(path, false)
    }

    fn try_lock_shared(&self, path: &str) -> Result<Option<NodeGuard>, FsError> {
        try_lock(path, false)
    }

    fn remove_folder(&self, path: &str) -> Result<(), FsError> {
        host_remove_folder(path).map_err(fs_error)
    }
}

// --- The clock and the reporter ----------------------------------------------------

/// The clock of JavaScript, `Date.now()`.
#[derive(Clone, Copy, Debug, Default)]
struct JsClock;

impl Clock for JsClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_millis(host_now() as i64)
    }
}

/// A reporter that passes each report to the JavaScript callback that
/// `js/host.js` registered under the number `id`.
#[derive(Clone, Copy, Debug)]
struct JsReporter {
    id: u32,
}

impl Reporter for JsReporter {
    fn report(&self, report: &Report) {
        let severity = match report.severity {
            Severity::Information => "information",
            Severity::Warning => "warning",
            Severity::Error => "error",
        };
        // The name of the variant, such as `StorageFailure`.
        let kind = format!("{:?}", report.kind);
        host_report(
            self.id,
            severity,
            &kind,
            &report.message,
            report.cache.clone(),
            report.version,
            report.folder.clone(),
        );
    }
}

static PANIC_HOOK: Once = Once::new();

/// Writes the message of a panic to the console before the module traps; a
/// panic is a bug of this crate or of cachette.
fn install_panic_hook() {
    PANIC_HOOK.call_once(|| {
        std::panic::set_hook(Box::new(|info| host_panic(&info.to_string())));
    });
}

fn js_error(message: impl std::fmt::Display) -> JsError {
    JsError::new(&message.to_string())
}

// --- The manager ---------------------------------------------------------------------

/// A cachette manager over the file system of Node.js.
#[wasm_bindgen]
pub struct WasmManager {
    manager: Manager,
}

#[wasm_bindgen]
impl WasmManager {
    /// Makes a manager whose root is the folder `root` (a path with `/` as
    /// the separator). `writer` is the first part of the names of the store
    /// objects (unique for each manager that uses the root at the same
    /// time). `size_limit_bytes`: `None` for cachette's automatic limit, an
    /// infinite number for no limit, otherwise a number of bytes. `reporter`
    /// is the number under which `js/host.js` registered the callback that
    /// receives the reports.
    #[wasm_bindgen(constructor)]
    pub fn new(
        root: String,
        writer: String,
        size_limit_bytes: Option<f64>,
        reporter: u32,
    ) -> Result<WasmManager, JsError> {
        install_panic_hook();
        let size_limit = match size_limit_bytes {
            None => SizeLimit::Automatic,
            Some(bytes) if bytes == f64::INFINITY => SizeLimit::None,
            Some(bytes) if bytes.is_finite() && bytes >= 1.0 => SizeLimit::Bytes(bytes as u64),
            Some(bytes) => return Err(js_error(format!("Invalid size limit of {bytes} bytes"))),
        };
        let settings = ManagerSettings {
            size_limit,
            writer,
            ..ManagerSettings::default()
        };
        let manager = Manager::new(NodeFs, root, settings, JsClock, JsReporter { id: reporter })
            .map_err(js_error)?;
        Ok(WasmManager { manager })
    }

    /// Opens a session on the one instance of the values cache `name` of
    /// version `version`, kept by the files engine with blobs, whose values
    /// are stable with an idle lifetime of `idle_lifetime_days` (infinite:
    /// never) and a default cost of `default_cost_ms` milliseconds.
    ///
    /// Fails only for an incorrect configuration (an invalid name, lifetime
    /// or cost). A failure of the environment is reported, and gives a
    /// session without a cache.
    pub fn open_values_cache(
        &self,
        name: String,
        version: u32,
        idle_lifetime_days: f64,
        default_cost_ms: f64,
    ) -> Result<WasmValuesCache, JsError> {
        let idle_lifetime = if idle_lifetime_days == f64::INFINITY {
            Duration::MAX
        } else if idle_lifetime_days.is_finite() && idle_lifetime_days > 0.0 {
            Duration::try_from_secs_f64(idle_lifetime_days * 24.0 * 60.0 * 60.0).map_err(js_error)?
        } else {
            return Err(js_error(format!(
                "Invalid idle lifetime of {idle_lifetime_days} days: it must be a positive number"
            )));
        };
        let declaration = ValuesCacheDeclaration {
            name: name.into(),
            version,
            engine: Engine::Files,
            blobs: true,
            sort: ValueSort::Stable { idle_lifetime },
            default_cost: cost_of(default_cost_ms)?,
            migration: None,
        };
        let key = InstanceKey::new(&()).map_err(js_error)?;
        let session = self.manager.open(&declaration, &key).map_err(js_error)?;
        Ok(WasmValuesCache { session })
    }

    /// Starts a maintenance run (`Manager::maintain`, or
    /// `Manager::maintain_now` when `force`), and answers a summary of its
    /// outcome as JSON text.
    pub fn maintain(&self, force: bool) -> Result<String, JsError> {
        let outcome = if force {
            self.manager.maintain_now()
        } else {
            self.manager.maintain()
        }
        .map_err(js_error)?;
        Ok(summary_of(&outcome).to_string())
    }
}

/// The cost of `ms` milliseconds, rounded to whole milliseconds and at least
/// 1 ms.
fn cost_of(ms: f64) -> Result<Cost, JsError> {
    if !ms.is_finite() || ms < 0.0 {
        return Err(js_error(format!("Invalid cost of {ms} ms: it must be a nonnegative number")));
    }
    Cost::from_millis((ms.round() as u64).max(1)).map_err(js_error)
}

/// The summary of a maintenance run, for JavaScript.
fn summary_of(outcome: &MaintenanceOutcome) -> Value {
    let status = match outcome.status {
        MaintenanceStatus::Done => "done",
        MaintenanceStatus::NotDue => "notDue",
        MaintenanceStatus::Busy => "busy",
        MaintenanceStatus::NothingKept => "nothingKept",
        _ => "other",
    };
    let instances: Vec<Value> = outcome
        .instances
        .iter()
        .map(|instance| {
            let detail = format!("{:?}", instance.action);
            // The name of the variant: the Debug text up to its fields.
            let action = detail
                .split(|c: char| !c.is_ascii_alphanumeric())
                .next()
                .unwrap_or("")
                .to_string();
            let removed_values = match &instance.action {
                InstanceAction::Visited { pruned: Some(pruned), .. } => Some(pruned.count),
                InstanceAction::ReclaimedValues { count, .. } => Some(*count),
                _ => None,
            };
            json!({
                "folder": instance.folder,
                "cache": instance.cache,
                "version": instance.version,
                "action": action,
                "removedValues": removed_values,
                "detail": detail,
            })
        })
        .collect();
    let size = match &outcome.size {
        None => Value::Null,
        Some(SizeOutcome::NoLimit) => json!({ "kind": "noLimit" }),
        Some(SizeOutcome::Measured { limit, total }) => {
            json!({ "kind": "measured", "limitBytes": limit, "totalBytes": total })
        }
        Some(SizeOutcome::LimitUnknown { message }) => {
            json!({ "kind": "limitUnknown", "message": message })
        }
        Some(other) => json!({ "kind": "other", "detail": format!("{other:?}") }),
    };
    json!({
        "status": status,
        "instances": instances,
        "failures": outcome.failures,
        "size": size,
        "removalsLeftOut": outcome.removals_left_out.as_ref().map(|left| format!("{left:?}")),
    })
}

// --- A values cache ------------------------------------------------------------------

/// A session on the one instance of a values cache. Dropping it (`free()` in
/// JavaScript) closes the session: it records the uses of the values read.
#[wasm_bindgen]
pub struct WasmValuesCache {
    session: ValuesSession,
}

#[wasm_bindgen]
impl WasmValuesCache {
    /// Whether the session holds the store of its instance.
    pub fn has_cache(&self) -> bool {
        self.session.has_cache()
    }

    /// The value stored under `key`, with all its blobs, or `None`.
    pub fn get(&self, key: &str) -> Option<WasmFound> {
        let found = self.session.get_with_blobs(key, BlobSelection::All)?;
        let (names, blobs) = found
            .bytes
            .into_iter()
            .map(|(name, bytes)| (String::from(name.as_str()), bytes))
            .unzip();
        Some(WasmFound {
            record_json: String::from(found.value.record.as_json()),
            names,
            blobs,
        })
    }

    /// Stores the value with the record `record_json` (JSON text) and the
    /// blobs `blob_names`, whose bytes are `blob_bytes` one after the other,
    /// of the lengths `blob_sizes`, under `key`. `cost_ms`: the cost of the
    /// value, or `None` for the default cost of the cache.
    ///
    /// Fails for invalid input (a record that is not JSON text, an invalid
    /// blob name, lengths that do not add up, an invalid cost). A failure of
    /// the environment is reported, and nothing is stored.
    pub fn put(
        &self,
        key: &str,
        record_json: String,
        blob_names: Vec<String>,
        blob_sizes: &[u32],
        blob_bytes: &[u8],
        cost_ms: Option<f64>,
    ) -> Result<(), JsError> {
        if blob_names.len() != blob_sizes.len() {
            return Err(js_error("Invalid blobs: as many names as lengths are needed"));
        }
        let record = Record::from_json(record_json).map_err(js_error)?;
        let mut blobs = Vec::with_capacity(blob_names.len());
        let mut offset = 0usize;
        for (name, &size) in blob_names.into_iter().zip(blob_sizes) {
            let end = offset + size as usize;
            let bytes = blob_bytes
                .get(offset..end)
                .ok_or_else(|| js_error("Invalid blobs: the lengths exceed the bytes given"))?;
            blobs.push((BlobName::new(name).map_err(js_error)?, bytes.to_vec()));
            offset = end;
        }
        if offset != blob_bytes.len() {
            return Err(js_error("Invalid blobs: the lengths do not add up to the bytes given"));
        }
        let options = PutOptions {
            cost: cost_ms.map(cost_of).transpose()?,
            ..PutOptions::default()
        };
        self.session.put(key, record, blobs, options);
        Ok(())
    }
}

/// A value that [`WasmValuesCache::get`] found.
#[wasm_bindgen]
pub struct WasmFound {
    record_json: String,
    names: Vec<String>,
    blobs: Vec<Vec<u8>>,
}

#[wasm_bindgen]
impl WasmFound {
    /// The JSON text of the record.
    pub fn record_json(&self) -> String {
        self.record_json.clone()
    }

    /// The names of the blobs, sorted.
    pub fn blob_names(&self) -> Vec<String> {
        self.names.clone()
    }

    /// The bytes of the blob of number `index` in `blob_names()`.
    pub fn blob(&self, index: usize) -> Option<Vec<u8>> {
        self.blobs.get(index).cloned()
    }
}
