// @errorcorrectionzoo/buildcache: a small binding of the Rust cache library
// cachette (WebAssembly, Node.js only), exposing what the zoo builder needs:
// a cache manager on a root folder, and values caches of the files engine
// whose values have a JSON record and named binary blobs.
//
// See README.md for the API, the limitations (in-process locks only) and how
// to rebuild dist/.

import fs from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { initSync, WasmManager } from './dist/buildcache.js';
import { registerReporter, unregisterReporter, defaultReporter } from './js/host.js';


let initialized = false;

/** Loads the WebAssembly module synchronously, once. */
function ensureInitialized() {
    if (!initialized) {
        const bytes = fs.readFileSync(new URL('./dist/buildcache_bg.wasm', import.meta.url));
        initSync({ module: bytes });
        initialized = true;
    }
}

// One call into the WebAssembly module at a time: a call made while another
// one runs (from the onReport callback, which cachette calls in the middle of
// an operation) is refused, since it could deadlock or corrupt the state of
// the module.
let callDepth = 0;

function call(fn) {
    if (callDepth > 0) {
        throw new Error('buildcache: a method of a cache manager or cache was called while another '
                        + 'one was running (for example from the onReport callback); this is not '
                        + 'allowed');
    }
    callDepth += 1;
    try {
        return fn();
    } finally {
        callDepth -= 1;
    }
}

// The writer names of the managers: unique for each manager of this process,
// and for each process (process id and start time of the manager).
let writerCount = 0;

function newWriterName() {
    writerCount += 1;
    return `node-${process.pid}-${Date.now()}-${writerCount}`;
}

const textEncoder = new TextEncoder();


/**
 * Opens a cache manager whose root is the folder `rootDir` (created when the
 * manager first writes into it).
 *
 * Options:
 * - `rootDir` (string, required): the root folder, relative to the current
 *   folder or absolute.
 * - `sizeLimitBytes` (number or null): the total size that maintenance keeps
 *   the data under (it removes data down to 80% of the limit when it is
 *   exceeded). Omitted: cachette's automatic limit (256 MiB for this kind of
 *   manager). `null` or `Infinity`: no limit.
 * - `onReport` (function): receives each report of cachette, an object
 *   `{ severity, kind, message, cache, version, folder }`. Default: warnings
 *   and errors go to console.warn, informational reports are ignored. It must
 *   not call a method of this package.
 *
 * Throws a TypeError for invalid options, and an Error when cachette refuses
 * the configuration. Reads and writes no file.
 */
export function openCacheManager({ rootDir, sizeLimitBytes, onReport } = {}) {
    if (typeof rootDir !== 'string' || rootDir === '') {
        throw new TypeError('buildcache: openCacheManager() needs the option rootDir (a string)');
    }
    if (sizeLimitBytes !== undefined && sizeLimitBytes !== null
        && !(sizeLimitBytes === Infinity
             || (Number.isSafeInteger(sizeLimitBytes) && sizeLimitBytes >= 1))) {
        throw new TypeError('buildcache: the option sizeLimitBytes must be a positive integer, '
                            + 'null or Infinity');
    }
    if (onReport !== undefined && typeof onReport !== 'function') {
        throw new TypeError('buildcache: the option onReport must be a function');
    }
    ensureInitialized();
    // cachette's paths use `/` as the separator.
    const root = nodePath.resolve(rootDir).split(nodePath.sep).join('/');
    const sizeLimit = (sizeLimitBytes === undefined) ? undefined
        : (sizeLimitBytes === null ? Infinity : sizeLimitBytes);
    const reporterId = registerReporter(onReport ?? defaultReporter);
    let wasmManager;
    try {
        wasmManager = call( () => new WasmManager(root, newWriterName(), sizeLimit, reporterId) );
    } catch (error) {
        unregisterReporter(reporterId);
        throw error;
    }
    return new CacheManager(wasmManager, root, reporterId);
}


/** A cache manager; see openCacheManager(). */
class CacheManager {
    #wasm;
    #reporterId;
    #caches = new Set();

    constructor(wasmManager, rootDir, reporterId) {
        this.#wasm = wasmManager;
        this.#reporterId = reporterId;
        /** The absolute path of the root folder, with `/` as the separator. */
        this.rootDir = rootDir;
    }

    #live() {
        if (this.#wasm === null) {
            throw new Error('buildcache: the cache manager is closed');
        }
        return this.#wasm;
    }

    /**
     * Opens the values cache `name` of version `version` (the files engine,
     * one instance, values with blobs). Its values are stable: maintenance
     * removes a value that was not used for `stableIdleLifetimeDays` days
     * (Infinity: never). `defaultCostMs` is the cost of a value for which put()
     * states none (an estimate of the time needed to produce it again, in
     * milliseconds; maintenance prefers to remove cheap values).
     *
     * `name`: 1 to 64 characters among a-z, 0-9, `.`, `-` and `_`, neither
     * beginning nor ending with `.`. Throws a TypeError for invalid options,
     * and an Error when cachette refuses the declaration. A failure of the
     * environment does not throw: it is reported, and the cache keeps
     * nothing (hasCache() answers false).
     */
    openValuesCache({ name, version, stableIdleLifetimeDays, defaultCostMs } = {}) {
        if (typeof name !== 'string') {
            throw new TypeError('buildcache: openValuesCache() needs the option name (a string)');
        }
        if (!Number.isInteger(version) || version < 0 || version > 0xffffffff) {
            throw new TypeError('buildcache: the option version must be an integer from 0 to 2^32-1');
        }
        if (typeof stableIdleLifetimeDays !== 'number' || !(stableIdleLifetimeDays > 0)) {
            throw new TypeError('buildcache: the option stableIdleLifetimeDays must be a positive '
                                + 'number (or Infinity)');
        }
        if (typeof defaultCostMs !== 'number' || !Number.isFinite(defaultCostMs) || defaultCostMs < 0) {
            throw new TypeError('buildcache: the option defaultCostMs must be a nonnegative number');
        }
        const wasm = this.#live();
        const wasmCache = call( () => wasm.open_values_cache(name, version, stableIdleLifetimeDays,
                                                            defaultCostMs) );
        const cache = new ValuesCache(wasmCache, name, version, (c) => this.#caches.delete(c));
        this.#caches.add(cache);
        return cache;
    }

    /**
     * Starts a maintenance run, which does its work at most once a day
     * (recorded under the root), unless `force` is true. Answers a summary:
     *
     *     { status: 'done' | 'notDue' | 'busy' | 'nothingKept' | 'other',
     *       instances: [ { folder, cache, version, action, removedValues, detail } ],
     *       failures: [ string ],
     *       size: null | { kind: 'measured', limitBytes, totalBytes }
     *                  | { kind: 'noLimit' } | { kind: 'limitUnknown', message },
     *       removalsLeftOut: null | string }
     *
     * `instances` lists the instances that the run changed or left in place
     * for a stated reason; `action` is the name of cachette's InstanceAction
     * (such as 'Visited', 'RemovedEmpty', 'ReclaimedValues'), `detail` its
     * full text. Throws an Error when the run cannot be carried out as a
     * whole (the file system fails on the root); failures on single instances
     * are reported and listed instead.
     */
    maintain({ force = false } = {}) {
        const wasm = this.#live();
        return JSON.parse(call( () => wasm.maintain(Boolean(force)) ));
    }

    /**
     * Closes the caches opened from this manager that are still open, then
     * the manager. Further calls throw; closing again does nothing.
     */
    close() {
        if (this.#wasm === null) {
            return;
        }
        for (const cache of [ ...this.#caches ]) {
            cache.close();
        }
        const wasm = this.#wasm;
        this.#wasm = null;
        call( () => wasm.free() );
        unregisterReporter(this.#reporterId);
    }
}


/** A values cache; see CacheManager.openValuesCache(). */
class ValuesCache {
    #wasm;
    #onClose;

    constructor(wasmCache, name, version, onClose) {
        this.#wasm = wasmCache;
        this.#onClose = onClose;
        this.name = name;
        this.version = version;
    }

    #live() {
        if (this.#wasm === null) {
            throw new Error(`buildcache: the cache ${this.name} is closed`);
        }
        return this.#wasm;
    }

    /**
     * Whether the cache holds its store. false when the instance could not
     * be opened (the failure was reported): get() then answers null and put()
     * stores nothing.
     */
    hasCache() {
        const wasm = this.#live();
        return call( () => wasm.has_cache() );
    }

    /**
     * The value stored under `key` (a string), as `{ record, blobs }`:
     * `record` is the stored record (parsed JSON), `blobs` an object that maps
     * each blob name to its bytes (a Uint8Array). Answers null when no value
     * is stored, and also, after reporting it, when the value is damaged or
     * the file system fails. Throws only a TypeError for an invalid key.
     */
    get(key) {
        if (typeof key !== 'string') {
            throw new TypeError('buildcache: the key must be a string');
        }
        const wasm = this.#live();
        return call( () => {
            const found = wasm.get(key);
            if (found === undefined || found === null) {
                return null;
            }
            try {
                const record = JSON.parse(found.record_json());
                const blobs = {};
                found.blob_names().forEach( (name, index) => {
                    blobs[name] = found.blob(index);
                });
                return { record, blobs };
            } finally {
                found.free();
            }
        } );
    }

    /**
     * Stores the value with the record `record` (any value that
     * JSON.stringify accepts; undefined is stored as null) and the blobs
     * `blobs` under `key`, replacing the value stored under `key`.
     *
     * - `blobs`: an object that maps each blob name to its bytes, a
     *   Uint8Array (a Buffer is one), or a string, stored as UTF-8. A blob name
     *   has 1 to 64 characters among a-z, 0-9, `-`, `_` and `.`, and does not
     *   begin with `.`.
     * - `costMs`: the cost of this value (the time it took to produce, in
     *   milliseconds; rounded, at least 1 ms). Omitted: the default cost of
     *   the cache.
     *
     * Throws a TypeError or an Error for invalid input (nothing is stored).
     * A failure of the file system does not throw: it is reported, and
     * nothing is stored.
     */
    put(key, record, { blobs = {}, costMs } = {}) {
        if (typeof key !== 'string') {
            throw new TypeError('buildcache: the key must be a string');
        }
        if (blobs === null || typeof blobs !== 'object') {
            throw new TypeError('buildcache: the option blobs must be an object');
        }
        if (costMs !== undefined
            && (typeof costMs !== 'number' || !Number.isFinite(costMs) || costMs < 0)) {
            throw new TypeError('buildcache: the option costMs must be a nonnegative number');
        }
        const recordJson = JSON.stringify(record === undefined ? null : record);
        if (recordJson === undefined) {
            throw new TypeError('buildcache: the record cannot be written as JSON');
        }
        const names = [];
        const parts = [];
        for (const [ name, value ] of Object.entries(blobs)) {
            let bytes;
            if (typeof value === 'string') {
                bytes = textEncoder.encode(value);
            } else if (value instanceof Uint8Array) {
                bytes = value;
            } else {
                throw new TypeError(`buildcache: the blob ${name} must be a Uint8Array or a string`);
            }
            names.push(name);
            parts.push(bytes);
        }
        const sizes = new Uint32Array(parts.map( (bytes) => bytes.length ));
        const total = parts.reduce( (sum, bytes) => sum + bytes.length, 0 );
        const all = new Uint8Array(total);
        let offset = 0;
        for (const bytes of parts) {
            all.set(bytes, offset);
            offset += bytes.length;
        }
        const wasm = this.#live();
        call( () => wasm.put(key, recordJson, names, sizes, all, costMs) );
    }

    /**
     * Closes the cache: records the uses of the values read, so that
     * maintenance knows they are in use. Further calls throw; closing again
     * does nothing.
     */
    close() {
        if (this.#wasm === null) {
            return;
        }
        const wasm = this.#wasm;
        this.#wasm = null;
        this.#onClose(this);
        call( () => wasm.free() );
    }
}
