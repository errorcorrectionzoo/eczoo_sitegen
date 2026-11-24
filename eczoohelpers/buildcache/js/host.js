// The host functions of the WebAssembly module (src/lib.rs): the file
// system of cachette over the synchronous functions of node:fs, the lock
// table of the process, the clock and the dispatch of reports.
//
// The module dist/buildcache.js imports this file (`raw_module` in
// src/lib.rs), so it is loaded once per JavaScript realm, and its lock table
// is shared by every manager of the realm.
//
// Each file-system function follows the contract of the trait of cachette
// that it implements (CacheFs and ManagerFs, cachette 0.1.0, src/fs/mod.rs),
// and mirrors cachette's StdFs where the contract leaves a choice. A
// function that fails throws a string, the message of the error in
// cachette's form ("Failed to <action> ‘<path>’: <cause>"), which the Rust
// side turns into an FsError. Paths use `/` as the separator; Node.js
// accepts it on every platform.

import fs from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';


/** The message of a failed operation, in cachette's form. */
function failure(action, path, error) {
    const cause = (error && error.message) ? error.message : String(error);
    return `Failed to ${action} ‘${path}’: ${cause}`;
}

/** Runs `fn`; any exception becomes a message string (see above). */
function guarded(action, path, fn) {
    try {
        return fn();
    } catch (error) {
        if (typeof error === 'string') {
            throw error;
        }
        throw failure(action, path, error);
    }
}

function isNotFound(error) {
    return error != null && error.code === 'ENOENT';
}

/** Creates the folder of `path` and its parents, where they are missing. */
function createFolders(path) {
    const dir = nodePath.dirname(path);
    if (dir === '.' || dir === '' || dir === path) {
        return;
    }
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
        throw failure('create the folder of', path, error);
    }
}


// --- CacheFs -------------------------------------------------------------------

/** The content of the file, or undefined when no file is at `path`. */
export function hostRead(path) {
    return guarded('read', path, () => {
        try {
            return fs.readFileSync(path);
        } catch (error) {
            if (isNotFound(error)) {
                return undefined;
            }
            throw error;
        }
    });
}

/** Creates or replaces the file (not durable, not atomic). */
export function hostWrite(path, bytes) {
    return guarded('write', path, () => {
        createFolders(path);
        fs.writeFileSync(path, bytes);
    });
}

/** Appends to the file, created when absent (not durable). */
export function hostAppend(path, bytes) {
    return guarded('append to', path, () => {
        createFolders(path);
        fs.appendFileSync(path, bytes);
    });
}

/**
 * Replaces the content of the file durably and all or nothing: writes a
 * temporary file beside it (`._NAME.tmp`, a fixed name as in cachette's
 * StdFs, so that a file left by a crash is overwritten by the next
 * replacement), carries over the permissions of the replaced file, syncs it
 * to the disk, renames it over the target, and syncs the folder (best
 * effort: some file systems and Windows do not support it). Two callers must
 * not replace the same path at the same time; cachette replaces a file only
 * under a lock that excludes the other writers.
 */
export function hostAtomicReplace(path, bytes) {
    return guarded('replace', path, () => {
        createFolders(path);
        const dir = nodePath.dirname(path) || '.';
        const tmp = nodePath.join(dir, `._${nodePath.basename(path)}.tmp`);
        let mode;
        try {
            mode = fs.statSync(path).mode & 0o7777;
        } catch {
            mode = undefined;
        }
        try {
            const fd = fs.openSync(tmp, 'w');
            try {
                if (mode !== undefined) {
                    try {
                        fs.fchmodSync(fd, mode);
                    } catch {
                        // as StdFs: the permissions are carried over when possible
                    }
                }
                fs.writeFileSync(fd, bytes);
                fs.fsyncSync(fd);
            } finally {
                fs.closeSync(fd);
            }
            fs.renameSync(tmp, path);
        } catch (error) {
            try {
                fs.unlinkSync(tmp);
            } catch {
                // nothing to clean up
            }
            throw error;
        }
        try {
            const dfd = fs.openSync(dir, 'r');
            try {
                fs.fsyncSync(dfd);
            } finally {
                fs.closeSync(dfd);
            }
        } catch {
            // best effort, as StdFs: the rename has happened
        }
    });
}

/** Renames a file, replacing a file at `to`; an error when `from` is absent or not a file. */
export function hostRename(from, to) {
    const message = (cause) => `Failed to rename ‘${from}’ to ‘${to}’: ${cause}`;
    let stat;
    try {
        stat = fs.statSync(from);
    } catch {
        stat = undefined;  // fs.renameSync reports a missing `from`
    }
    if (stat !== undefined && !stat.isFile()) {
        throw message(`‘${from}’ is not a file`);
    }
    try {
        fs.renameSync(from, to);
    } catch (error) {
        throw message(error && error.message ? error.message : String(error));
    }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * The entries directly inside the folder, as `F<name>` (file), `D<name>`
 * (folder) or `L<name>` (symbolic link, whatever it points to; never
 * followed). An absent folder has no entries; the empty path is the current
 * folder. As in StdFs, an entry of another kind (a socket, ...) and a name
 * that is not valid UTF-8 are left out.
 */
export function hostList(dir) {
    return guarded('list folder', dir, () => {
        let entries;
        try {
            entries = fs.readdirSync(dir === '' ? '.' : dir,
                                     { withFileTypes: true, encoding: 'buffer' });
        } catch (error) {
            if (isNotFound(error)) {
                return [];
            }
            throw error;
        }
        const out = [];
        for (const entry of entries) {
            let name;
            try {
                name = utf8.decode(entry.name);
            } catch {
                continue;
            }
            // Dirent does not follow a symbolic link.
            if (entry.isSymbolicLink()) {
                out.push(`L${name}`);
            } else if (entry.isFile()) {
                out.push(`F${name}`);
            } else if (entry.isDirectory()) {
                out.push(`D${name}`);
            }
        }
        return out;
    });
}

/**
 * `[size, modified]` of the file (following a symbolic link, as StdFs),
 * the modification time in whole milliseconds since the Unix epoch (a time
 * before the epoch as 0), or undefined when no file is at `path`. An error
 * when something other than a file is at `path`.
 */
export function hostStat(path) {
    return guarded('read the metadata of', path, () => {
        let stat;
        try {
            stat = fs.statSync(path, { bigint: true });
        } catch (error) {
            if (isNotFound(error)) {
                return undefined;
            }
            throw error;
        }
        if (!stat.isFile()) {
            throw failure('read the metadata of', path, 'not a file');
        }
        const modified = stat.mtimeNs < 0n ? 0 : Number(stat.mtimeNs / 1000000n);
        return new Float64Array([ Number(stat.size), modified ]);
    });
}

/**
 * Sets the modification time of the file to `atMs` (milliseconds since the
 * epoch; a time before the epoch as the epoch). Does nothing when no file is
 * at `path`. The time is set to the middle of its millisecond: Node.js
 * passes times as floating-point seconds and truncates them, so that the
 * exact millisecond could read back one less; half a millisecond is far
 * above the rounding error. The access time is kept.
 */
export function hostSetModified(path, atMs) {
    return guarded('set the modification time of', path, () => {
        let stat;
        try {
            stat = fs.statSync(path);
        } catch (error) {
            if (isNotFound(error)) {
                return;
            }
            throw error;
        }
        if (!stat.isFile()) {
            throw failure('set the modification time of', path, 'not a file');
        }
        const ms = Math.max(0, atMs);
        try {
            fs.utimesSync(path, stat.atime, (ms + 0.5) / 1000);
        } catch (error) {
            if (isNotFound(error)) {
                return;
            }
            throw error;
        }
    });
}

/**
 * Removes the file or the symbolic link (the link itself, never what it
 * points to). Does nothing when nothing is at `path`.
 */
export function hostRemove(path) {
    return guarded('remove', path, () => {
        try {
            if (process.platform === 'win32') {
                // A symbolic link to a folder is a folder entry on Windows.
                const stat = fs.lstatSync(path, { throwIfNoEntry: false });
                if (stat !== undefined && stat.isSymbolicLink()) {
                    try {
                        fs.unlinkSync(path);
                    } catch {
                        fs.rmdirSync(path);
                    }
                    return;
                }
            }
            fs.unlinkSync(path);
        } catch (error) {
            if (isNotFound(error)) {
                return;
            }
            throw error;
        }
    });
}


// --- ManagerFs -----------------------------------------------------------------

/**
 * Removes the folder when it is empty; does nothing when nothing is at
 * `path`. An error when the folder is not empty, when a file or a symbolic
 * link is at `path` (rmdir does not follow a link), and for the empty path.
 */
export function hostRemoveFolder(path) {
    if (path === '') {
        throw failure('remove folder', path, 'the empty path is the current folder');
    }
    return guarded('remove folder', path, () => {
        try {
            fs.rmdirSync(path);
        } catch (error) {
            if (isNotFound(error)) {
                return;
            }
            throw error;
        }
    });
}


// --- Locks ---------------------------------------------------------------------
//
// Node.js has no file locks: the locks live in this table, which excludes the
// lock operations of this JavaScript realm on one file from each other, with
// the rules of ManagerFs (any number of shared guards, or one exclusive
// guard). A lock is held on a file, by its identity (device and inode
// numbers), not on a path, as a lock of the operating system: a file that
// replaces a removed lock file at the same path has locks of its own. Each
// guard keeps its file open, so that the identity is not reused while the
// guard exists. Opening the file and registering the lock happen in one step
// of the single thread, so the guard always holds the lock of the file that
// is at the path when the lock is taken (the check after acquiring that
// CacheFs asks for). There is no exclusion between processes: one process at
// a time may use a cache folder.

/** For each locked file identity: `{ exclusive: true }` or `{ shared: n }`. */
const heldLocks = new Map();
/** For each guard number: `{ fileId, fd }`. */
const guards = new Map();
let nextGuard = 1;

function fileIdentity(fd, path) {
    const stat = fs.fstatSync(fd, { bigint: true });
    if (stat.ino === 0n) {
        // A file system without inode numbers: the path stands for the file.
        return `path:${nodePath.resolve(path)}`;
    }
    return `${stat.dev}:${stat.ino}`;
}

function newGuardNumber() {
    for (;;) {
        const id = nextGuard;
        nextGuard = nextGuard >= 0xffffffff ? 1 : nextGuard + 1;
        if (!guards.has(id)) {
            return id;
        }
    }
}

/**
 * Takes a lock on the file at `path`, created when absent (its folder must
 * exist), without waiting. Answers the number of the new guard (at least 1),
 * or 0 when another guard holds a lock that excludes this one: an exclusive
 * lock excludes every other guard on the file, a shared lock only an
 * exclusive one.
 */
export function hostLock(path, exclusive) {
    return guarded('lock', path, () => {
        let fd;
        try {
            fd = fs.openSync(path, 'a');
        } catch (error) {
            throw failure('open the lock file', path, error);
        }
        let fileId;
        try {
            fileId = fileIdentity(fd, path);
        } catch (error) {
            fs.closeSync(fd);
            throw error;
        }
        const held = heldLocks.get(fileId);
        if (held !== undefined && (exclusive || held.exclusive)) {
            fs.closeSync(fd);
            return 0;
        }
        if (exclusive) {
            heldLocks.set(fileId, { exclusive: true, shared: 0 });
        } else {
            heldLocks.set(fileId, { exclusive: false, shared: (held?.shared ?? 0) + 1 });
        }
        const id = newGuardNumber();
        guards.set(id, { fileId, fd });
        return id;
    });
}

/** Releases the lock of the guard `id`. Never throws. */
export function hostUnlock(id) {
    const guard = guards.get(id);
    if (guard === undefined) {
        return;
    }
    guards.delete(id);
    const held = heldLocks.get(guard.fileId);
    if (held !== undefined) {
        if (held.exclusive || held.shared <= 1) {
            heldLocks.delete(guard.fileId);
        } else {
            held.shared -= 1;
        }
    }
    try {
        fs.closeSync(guard.fd);
    } catch {
        // the lock is released in the table; nothing else to do
    }
}

/** The number of guards that exist, for the tests. */
export function heldGuardCount() {
    return guards.size;
}


// --- Clock, reports, panics ----------------------------------------------------

export function hostNow() {
    return Date.now();
}

/** The callbacks that receive the reports of each manager, by number. */
const reporters = new Map();
let nextReporter = 1;

/**
 * The reporter of a manager opened without `onReport`: warnings and errors
 * to console.warn, informational reports ignored.
 */
export function defaultReporter(report) {
    if (report.severity === 'information') {
        return;
    }
    console.warn(`buildcache: ${report.severity} (${report.kind}): ${report.message}`);
}

/** Registers `callback` for the reports of one manager; answers its number. */
export function registerReporter(callback) {
    const id = nextReporter;
    nextReporter += 1;
    reporters.set(id, callback);
    return id;
}

export function unregisterReporter(id) {
    reporters.delete(id);
}

/**
 * Passes one report to the callback registered under `id` (the default
 * reporter once it is unregistered). An exception of the callback is written
 * to the console and not passed on: it would unwind through the WebAssembly
 * module, which is in the middle of an operation.
 */
export function hostReport(id, severity, kind, message, cache, version, folder) {
    const report = {
        severity,
        kind,
        message,
        cache: cache ?? null,
        version: version ?? null,
        folder: folder ?? null,
    };
    const callback = reporters.get(id) ?? defaultReporter;
    try {
        callback(report);
    } catch (error) {
        console.error('buildcache: the onReport callback threw an error:', error);
    }
}

export function hostPanic(message) {
    try {
        console.error(`buildcache: panic in the WebAssembly module (a bug): ${message}`);
    } catch {
        // nothing more can be done
    }
}
