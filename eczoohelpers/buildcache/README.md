# @errorcorrectionzoo/buildcache

Build caches for the zoo builder: a small WebAssembly binding of the Rust
cache library [cachette](https://crates.io/crates/cachette) (version 0.1),
for Node.js only. The site build uses it to keep the code-graph SVGs that it
renders with the headless exporter from one build to the next.

It exposes only what the builder needs: a cachette *manager* on a root
folder, and *values caches* of cachette's files engine, whose values each have
a JSON record and named binary blobs (one file per blob, which a person can
open). Maintenance removes values that have not been used for their idle
lifetime, and values beyond the size limit.

The compiled module is committed in `dist/`, so the package works after a
plain `yarn install`, with no Rust toolchain. Nothing is published to npm.

## API

```js
import { openCacheManager } from '@errorcorrectionzoo/buildcache';

const manager = openCacheManager({
    rootDir: '/path/to/_eczoo_graph_svg_cache',
    sizeLimitBytes: 512 * 1024 * 1024,   // optional; null = no limit
    onReport: (report) => { /* optional */ },
});
const cache = manager.openValuesCache({
    name: 'eczoo.codegraph.svg',   // a-z 0-9 . - _ (1 to 64 characters)
    version: 1,                    // each version has its own values
    stableIdleLifetimeDays: 60,    // removed after 60 days without use
    defaultCostMs: 2000,           // cost of a value when put() states none
});

const found = cache.get(key);      // { record, blobs: { 'graph.svg': Uint8Array } } or null
cache.put(key, record, { blobs: { 'graph.svg': svgText }, costMs: 1500 });

cache.close();                     // records the uses of the values read
const summary = manager.maintain();  // at most once a day (recorded in the root)
manager.close();                   // also closes its caches that are still open
```

- `openCacheManager({ rootDir, sizeLimitBytes, onReport })` reads and writes
  no file; the root folder is created on the first write. `sizeLimitBytes`
  omitted gives cachette's automatic limit (256 MiB for this kind of
  manager); maintenance removes data down to 80% of the limit when the total
  exceeds it.
- `cache.get(key)` answers the record (parsed JSON) and every blob as a
  `Uint8Array`, or `null`.
- `cache.put(key, record, { blobs, costMs })` stores the record (anything
  that `JSON.stringify` accepts) and the blobs (`Uint8Array`, or a string,
  stored as UTF-8), replacing the value stored under `key`. Blob names: 1 to
  64 characters among `a-z`, `0-9`, `-`, `_`, `.`, not beginning with `.`.
  `costMs` is the time it took to produce the value; maintenance prefers to
  remove values that are large, long unused and cheap.
- `cache.hasCache()` is `false` when the cache could not be opened (the
  failure was reported); `get` then answers `null` and `put` stores nothing.
- `manager.maintain({ force })` answers
  `{ status, instances, failures, size, removalsLeftOut }`, with `status`
  among `'done'`, `'notDue'`, `'busy'`, `'nothingKept'`; `force: true` runs
  even within the day.

Failures of the environment never throw: as in cachette, a read then answers
`null`, a write stores nothing, and the event is reported. A report is
`{ severity, kind, message, cache, version, folder }`, with `severity` among
`'information'`, `'warning'`, `'error'` and `kind` the name of cachette's
`ReportKind` (`'StorageFailure'`, `'DamagedValue'`, ...). Without `onReport`,
warnings and errors go to `console.warn`. Invalid arguments throw (a
`TypeError`, or an `Error` with cachette's message, for example for an
invalid cache or blob name), and so does a call on a closed cache or
manager, and `maintain()` when the run cannot be carried out at all.

## Limitations

- **Locks are in-process only.** Node.js has no file locks, so the locks
  that cachette takes are kept in a table of the process (see
  `js/host.js`), with cachette's exact shared/exclusive rules, by file
  identity. They exclude each other within one process (one JavaScript
  realm), not between processes: **only one process at a time may use a
  cache folder** (one site build at a time). Since the WebAssembly module is
  single-threaded, a lock can never wait; a lock that would have to wait
  fails with a reported `StorageFailure` instead (this does not happen in
  normal use, which the tests check).
- The `onReport` callback must not call a method of this package (such a
  call throws); an exception that it throws is written to the console.
- Node.js only (the host functions use `node:fs`).

## Layout

- `src/lib.rs`: the Rust crate (cdylib): cachette's `CacheFs`/`ManagerFs`
  over the host functions, the clock (`Date.now()`), the reporter, and the
  exports used by `index.js`.
- `js/host.js`: the host functions, over the synchronous functions of
  `node:fs`, and the lock table.
- `index.js`: the public API.
- `dist/`: the committed build (wasm-bindgen glue, `.wasm`, `BUILD_INFO.json`).
- `tools/build.mjs`: the build script.
- `test/`: the mocha tests (`yarn test`, or
  `node ../../node_modules/mocha/bin/mocha.js` in this folder).

## Rebuilding dist/

Needed only when `src/`, `Cargo.toml` or `Cargo.lock` change, for example for
a new version of cachette (`cargo update -p cachette`). Prerequisites: Rust
with the target `wasm32-unknown-unknown` (`rustup target add
wasm32-unknown-unknown`) and `wasm-pack` (`cargo install wasm-pack`). Then, in
this folder:

```sh
yarn build      # or: node tools/build.mjs
yarn test
```

The script builds with `wasm-pack build --release --target web`, maps the
build machine's paths out of the binary (`--remap-path-prefix`) and checks
that none is left, copies the glue and the `.wasm` into `dist/` (never the
`package.json` or the `*` `.gitignore` that wasm-pack writes), and records the
versions of cachette, wasm-bindgen and rustc in `dist/BUILD_INFO.json`.
Commit `dist/` with `Cargo.lock`.
