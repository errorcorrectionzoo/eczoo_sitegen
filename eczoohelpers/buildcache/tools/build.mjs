#!/usr/bin/env node
// Builds the WebAssembly module of this package (the Rust crate in src/) and
// writes the committed output in dist/:
//
//   dist/buildcache.js        the wasm-bindgen glue (`--target web`), which
//                             index.js initializes with `initSync`
//   dist/buildcache_bg.wasm   the module
//   dist/BUILD_INFO.json      the versions it was built with
//
// Usage (in this package's folder): yarn build   (or: node tools/build.mjs)
//
// Needed only when src/, Cargo.toml or Cargo.lock change (for example a new
// version of cachette: `cargo update -p cachette`). Prerequisites: Rust with
// the target wasm32-unknown-unknown (`rustup target add
// wasm32-unknown-unknown`), and wasm-pack (`cargo install wasm-pack`), which
// fetches the matching wasm-bindgen CLI and wasm-opt itself.
//
// rustc writes source paths into the binary (panic locations). The build
// passes `--remap-path-prefix` flags through CARGO_ENCODED_RUSTFLAGS, so that
// no absolute path of the build machine ends up in dist/, and then checks the
// binary and the glue for such paths. Rust flags given in
// CARGO_ENCODED_RUSTFLAGS or RUSTFLAGS are kept in front of these.
//
// wasm-pack writes its output (with a package.json and a `*` .gitignore) into
// target/wasm-pack/; only the files above are copied to dist/, and
// target/wasm-pack/ is removed.

import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(packageDir, 'target', 'wasm-pack');
const distDir = path.join(packageDir, 'dist');
const outName = 'buildcache';

const BANNER = '// GENERATED FILE -- do not edit; run `yarn build` in eczoohelpers/buildcache\n';

// Byte strings that betray an absolute path of the build machine.
const BUILD_PATH_MARKERS = [ '/Users/', '/home/', 'C:\\',
                             ...(os.homedir().length > 3 ? [ os.homedir() ] : []) ];

function fail(message) {
    console.error(`build: error: ${message}`);
    process.exit(1);
}

function run(cmd, args, options = {}) {
    const r = spawnSync(cmd, args, { cwd: packageDir, encoding: 'utf-8', ...options });
    if (r.error) {
        fail(`could not run \`${cmd}\`: ${r.error.message}`);
    }
    if (r.status !== 0) {
        fail(`\`${cmd} ${args.join(' ')}\` failed (exit status ${r.status})`
             + (r.stderr ? `:\n${r.stderr}` : ''));
    }
    return r.stdout ?? '';
}

function cargoHome() {
    return process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
}

/**
 * The `[from, to]` pairs of the `--remap-path-prefix` flags, shortest prefix
 * first: rustc applies the last flag that matches, so the more specific
 * prefixes come last.
 */
function remappings() {
    const sysroot = run('rustc', [ '--print', 'sysroot' ]).trim();
    if (!sysroot) {
        fail('`rustc --print sysroot` printed nothing');
    }
    const remap = new Map([
        [ os.homedir(), '~' ],
        [ cargoHome(), 'cargo-home' ],
        [ sysroot, 'rust-sysroot' ],
        [ packageDir, 'buildcache' ],
    ]);
    return [ ...remap ].sort( ([a], [b]) => a.length - b.length );
}

function existingRustflags() {
    const env = process.env;
    if (env.CARGO_ENCODED_RUSTFLAGS != null) {
        return env.CARGO_ENCODED_RUSTFLAGS === '' ? [] : env.CARGO_ENCODED_RUSTFLAGS.split('\x1f');
    }
    if (env.RUSTFLAGS != null) {
        return env.RUSTFLAGS.split(/\s+/).filter(Boolean);
    }
    return [];
}

/** Fails when `bytes` holds an absolute path of the build machine. */
function checkBuildPaths(bytes, what) {
    const found = [];
    for (const marker of BUILD_PATH_MARKERS) {
        const i = bytes.indexOf(marker);
        if (i !== -1) {
            let end = i;
            while (end < bytes.length && end - i < 160 && bytes[end] >= 0x20 && bytes[end] < 0x7f) {
                end += 1;
            }
            found.push(`\`${marker}\`, e.g. \`${bytes.toString('latin1', i, end)}\``);
        }
    }
    if (found.length) {
        fail(`${what} holds absolute paths of the build machine (add a remapping to `
             + `tools/build.mjs): ${found.join('; ')}`);
    }
}

/** The version of the package `name` in Cargo.lock. */
function lockVersion(lock, name) {
    const re = new RegExp(`\\[\\[package\\]\\]\\nname = "${name}"\\nversion = "([^"]+)"`);
    const m = re.exec(lock);
    if (m == null) {
        fail(`could not find the version of ${name} in Cargo.lock`);
    }
    return m[1];
}

// --- the build ----------------------------------------------------------------

const t0 = Date.now();
const wasmPackVersion = run('wasm-pack', [ '--version' ]).trim();
const rustcVersion = run('rustc', [ '--version' ]).trim();

const flags = [
    ...existingRustflags(),
    ...remappings().map( ([from, to]) => `--remap-path-prefix=${from}=${to}` ),
];

console.log(`build: ${wasmPackVersion}, ${rustcVersion}`);
fs.rmSync(outDir, { recursive: true, force: true });
const r = spawnSync('wasm-pack', [
    'build', packageDir, '--release', '--target', 'web', '--no-typescript',
    '--out-dir', outDir, '--out-name', outName,
], {
    cwd: packageDir,
    stdio: 'inherit',
    env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join('\x1f') },
});
if (r.error || r.status !== 0) {
    fail(`wasm-pack build failed${r.error ? `: ${r.error.message}` : ''}`);
}

const glueSrc = path.join(outDir, `${outName}.js`);
const wasmSrc = path.join(outDir, `${outName}_bg.wasm`);
for (const f of [ glueSrc, wasmSrc ]) {
    if (!fs.existsSync(f)) {
        fail(`the wasm-pack output ${path.relative(packageDir, f)} is missing`);
    }
}

const wasmBytes = fs.readFileSync(wasmSrc);
checkBuildPaths(wasmBytes, `the binary ${path.relative(packageDir, wasmSrc)}`);
const glue = fs.readFileSync(glueSrc, 'utf-8');
checkBuildPaths(Buffer.from(glue, 'utf-8'), `the glue ${path.relative(packageDir, glueSrc)}`);
if (!/^export \{[^}]*\binitSync\b/m.test(glue)) {
    fail('the glue does not export `initSync`');
}
if (!glue.includes("'../js/host.js'") && !glue.includes('"../js/host.js"')) {
    fail('the glue does not import ../js/host.js (see `raw_module` in src/lib.rs)');
}

fs.mkdirSync(distDir, { recursive: true });
// Only the files below belong in dist/; never a package.json or .gitignore
// (wasm-pack writes a `*` .gitignore, which would hide dist/ from git).
for (const stray of [ '.gitignore', 'package.json', 'README.md' ]) {
    fs.rmSync(path.join(distDir, stray), { force: true });
}
fs.writeFileSync(path.join(distDir, `${outName}.js`), BANNER + glue);
fs.writeFileSync(path.join(distDir, `${outName}_bg.wasm`), wasmBytes);

const lock = fs.readFileSync(path.join(packageDir, 'Cargo.lock'), 'utf-8');
const buildInfo = {
    cachette: lockVersion(lock, 'cachette'),
    wasm_bindgen: lockVersion(lock, 'wasm-bindgen'),
    rustc: rustcVersion,
    wasm_pack: wasmPackVersion,
    paths_remapped: true,
    wasm_size_bytes: wasmBytes.length,
    build_date: new Date().toISOString(),
};
fs.writeFileSync(path.join(distDir, 'BUILD_INFO.json'), JSON.stringify(buildInfo, null, 4) + '\n');
// The intermediate output is not kept (the repository's ESLint would lint its glue).
fs.rmSync(outDir, { recursive: true, force: true });

console.log(`build: wrote dist/ (wasm ${wasmBytes.length} bytes) in `
            + `${((Date.now() - t0) / 1000).toFixed(1)} s`);
