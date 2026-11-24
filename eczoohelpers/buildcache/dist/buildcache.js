// GENERATED FILE -- do not edit; run `yarn build` in eczoohelpers/buildcache
import { hostAppend, hostAtomicReplace, hostList, hostLock, hostPanic, hostRead, hostRemoveFolder, hostRemove, hostRename, hostReport, hostSetModified, hostStat, hostUnlock, hostWrite } from '../js/host.js';
import * as import1 from "../js/host.js"


/**
 * A value that [`WasmValuesCache::get`] found.
 */
export class WasmFound {
    static __wrap(ptr) {
        const obj = Object.create(WasmFound.prototype);
        obj.__wbg_ptr = ptr;
        WasmFoundFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmFoundFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmfound_free(ptr, 0);
    }
    /**
     * The bytes of the blob of number `index` in `blob_names()`.
     * @param {number} index
     * @returns {Uint8Array | undefined}
     */
    blob(index) {
        const ret = wasm.wasmfound_blob(this.__wbg_ptr, index);
        let v1;
        if (ret[0] !== 0) {
            v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * The names of the blobs, sorted.
     * @returns {string[]}
     */
    blob_names() {
        const ret = wasm.wasmfound_blob_names(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * The JSON text of the record.
     * @returns {string}
     */
    record_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmfound_record_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) WasmFound.prototype[Symbol.dispose] = WasmFound.prototype.free;

/**
 * A cachette manager over the file system of Node.js.
 */
export class WasmManager {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmManagerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmmanager_free(ptr, 0);
    }
    /**
     * Starts a maintenance run (`Manager::maintain`, or
     * `Manager::maintain_now` when `force`), and answers a summary of its
     * outcome as JSON text.
     * @param {boolean} force
     * @returns {string}
     */
    maintain(force) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.wasmmanager_maintain(this.__wbg_ptr, force);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Makes a manager whose root is the folder `root` (a path with `/` as
     * the separator). `writer` is the first part of the names of the store
     * objects (unique for each manager that uses the root at the same
     * time). `size_limit_bytes`: `None` for cachette's automatic limit, an
     * infinite number for no limit, otherwise a number of bytes. `reporter`
     * is the number under which `js/host.js` registered the callback that
     * receives the reports.
     * @param {string} root
     * @param {string} writer
     * @param {number | null | undefined} size_limit_bytes
     * @param {number} reporter
     */
    constructor(root, writer, size_limit_bytes, reporter) {
        const val3 = +(isLikeNone(size_limit_bytes) ? 0 : size_limit_bytes);
        const val4 = +reporter;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(root, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(writer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.wasmmanager_new(ptr0, len0, ptr1, len1, !isLikeNone(size_limit_bytes), val3, val4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WasmManagerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Opens a session on the one instance of the values cache `name` of
     * version `version`, kept by the files engine with blobs, whose values
     * are stable with an idle lifetime of `idle_lifetime_days` (infinite:
     * never) and a default cost of `default_cost_ms` milliseconds.
     *
     * Fails only for an incorrect configuration (an invalid name, lifetime
     * or cost). A failure of the environment is reported, and gives a
     * session without a cache.
     * @param {string} name
     * @param {number} version
     * @param {number} idle_lifetime_days
     * @param {number} default_cost_ms
     * @returns {WasmValuesCache}
     */
    open_values_cache(name, version, idle_lifetime_days, default_cost_ms) {
        const val2 = +version;
        const val3 = +idle_lifetime_days;
        const val4 = +default_cost_ms;
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmmanager_open_values_cache(this.__wbg_ptr, ptr0, len0, val2, val3, val4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmValuesCache.__wrap(ret[0]);
    }
}
if (Symbol.dispose) WasmManager.prototype[Symbol.dispose] = WasmManager.prototype.free;

/**
 * A session on the one instance of a values cache. Dropping it (`free()` in
 * JavaScript) closes the session: it records the uses of the values read.
 */
export class WasmValuesCache {
    static __wrap(ptr) {
        const obj = Object.create(WasmValuesCache.prototype);
        obj.__wbg_ptr = ptr;
        WasmValuesCacheFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmValuesCacheFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvaluescache_free(ptr, 0);
    }
    /**
     * The value stored under `key`, with all its blobs, or `None`.
     * @param {string} key
     * @returns {WasmFound | undefined}
     */
    get(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmvaluescache_get(this.__wbg_ptr, ptr0, len0);
        return ret === 0 ? undefined : WasmFound.__wrap(ret);
    }
    /**
     * Whether the session holds the store of its instance.
     * @returns {boolean}
     */
    has_cache() {
        const ret = wasm.wasmvaluescache_has_cache(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Stores the value with the record `record_json` (JSON text) and the
     * blobs `blob_names`, whose bytes are `blob_bytes` one after the other,
     * of the lengths `blob_sizes`, under `key`. `cost_ms`: the cost of the
     * value, or `None` for the default cost of the cache.
     *
     * Fails for invalid input (a record that is not JSON text, an invalid
     * blob name, lengths that do not add up, an invalid cost). A failure of
     * the environment is reported, and nothing is stored.
     * @param {string} key
     * @param {string} record_json
     * @param {string[]} blob_names
     * @param {Uint32Array | number[]} blob_sizes
     * @param {Uint8Array | number[]} blob_bytes
     * @param {number | null} [cost_ms]
     */
    put(key, record_json, blob_names, blob_sizes, blob_bytes, cost_ms) {
        const val6 = +(isLikeNone(cost_ms) ? 0 : cost_ms);
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4;
        try {
            ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passStringToWasm0(record_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArrayJsValueToWasm0(blob_names, wasm.__wbindgen_malloc);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passArray32ToWasm0(blob_sizes, wasm.__wbindgen_malloc);
            len3 = WASM_VECTOR_LEN;
            ptr4 = passArray8ToWasm0(blob_bytes, wasm.__wbindgen_malloc);
            len4 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr4) { wasm.__wbindgen_free(ptr4, len4 * 1, 1); }
            if (ptr3) { wasm.__wbindgen_free(ptr3, len3 * 4, 4); }
            if (ptr2) { wasm.__externref_drop_slice(ptr2, len2); wasm.__wbindgen_free(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.wasmvaluescache_put(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, !isLikeNone(cost_ms), val6);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) WasmValuesCache.prototype[Symbol.dispose] = WasmValuesCache.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_string_get_7ce8eee7fd327545: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_hostAppend_be7d2723dce2b766: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            hostAppend(getStringFromWasm0(arg0, arg1), getArrayU8FromWasm0(arg2, arg3));
        }, arguments); },
        __wbg_hostAtomicReplace_55d91c577f28eff1: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            hostAtomicReplace(getStringFromWasm0(arg0, arg1), getArrayU8FromWasm0(arg2, arg3));
        }, arguments); },
        __wbg_hostList_afcc267eb9b90bce: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = hostList(getStringFromWasm0(arg1, arg2));
            const ptr1 = passArrayJsValueToWasm0(ret, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_hostLock_06deae8d76a8ef46: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = hostLock(getStringFromWasm0(arg0, arg1), arg2 !== 0);
            return ret;
        }, arguments); },
        __wbg_hostPanic_959814347659fc41: function(arg0, arg1) {
            hostPanic(getStringFromWasm0(arg0, arg1));
        },
        __wbg_hostRead_58ddbbfc37afc7b7: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = hostRead(getStringFromWasm0(arg1, arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_hostRemoveFolder_be2b6a5089ef428a: function() { return handleError(function (arg0, arg1) {
            hostRemoveFolder(getStringFromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_hostRemove_53049a3bf8264d4b: function() { return handleError(function (arg0, arg1) {
            hostRemove(getStringFromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_hostRename_085ef7d18ebc69f4: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            hostRename(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
        }, arguments); },
        __wbg_hostReport_ec85b6bd5b685ffa: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            let v0;
            if (arg7 !== 0) {
                v0 = getStringFromWasm0(arg7, arg8);
                wasm.__wbindgen_free(arg7, arg8 * 1, 1);
            }
            let v1;
            if (arg10 !== 0) {
                v1 = getStringFromWasm0(arg10, arg11);
                wasm.__wbindgen_free(arg10, arg11 * 1, 1);
            }
            hostReport(arg0 >>> 0, getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4), getStringFromWasm0(arg5, arg6), v0, arg9 === Number.MAX_SAFE_INTEGER ? undefined : arg9, v1);
        },
        __wbg_hostSetModified_673e2773870a255e: function() { return handleError(function (arg0, arg1, arg2) {
            hostSetModified(getStringFromWasm0(arg0, arg1), arg2);
        }, arguments); },
        __wbg_hostStat_67ba62483c2c1650: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = hostStat(getStringFromWasm0(arg1, arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passArrayF64ToWasm0(ret, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_hostUnlock_ccfa683a4911d091: function(arg0) {
            hostUnlock(arg0 >>> 0);
        },
        __wbg_hostWrite_abd7bc1854747500: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            hostWrite(getStringFromWasm0(arg0, arg1), getArrayU8FromWasm0(arg2, arg3));
        }, arguments); },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./buildcache_bg.js": import0,
        "../js/host.js": import1,
    };
}

const WasmFoundFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmfound_free(ptr, 1));
const WasmManagerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmmanager_free(ptr, 1));
const WasmValuesCacheFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmvaluescache_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('buildcache_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
