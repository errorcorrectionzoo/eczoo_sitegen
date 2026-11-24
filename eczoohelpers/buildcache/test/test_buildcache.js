// Tests of the public API of @errorcorrectionzoo/buildcache (index.js).

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { openCacheManager } from '../index.js';
import { heldGuardCount, hostLock, hostUnlock } from '../js/host.js';


const SVG_CACHE = {
    name: 'eczoo.codegraph.svg',
    version: 1,
    stableIdleLifetimeDays: 60,
    defaultCostMs: 2000,
};

const INDEX_URL = new URL('../index.js', import.meta.url).href;

const decode = (bytes) => new TextDecoder().decode(bytes);

const NON_ASCII = 'Codes de Reed–Solomon — ψ ⊗ φ, «qudits», 日本語, 🧩';

/** Runs `code` (an ES module) in a child Node process; answers its standard output. */
function runChild(code, env) {
    const r = spawnSync(process.execPath, [ '--input-type=module', '-e', code ], {
        encoding: 'utf-8',
        env: { ...process.env, ...env },
    });
    assert.equal(r.status, 0, `child process failed:\n${r.stderr}`);
    return r.stdout;
}


describe('buildcache', function () {

    this.timeout(30000);

    let root;
    let reports;
    let managers;

    /** Opens a manager on `rootDir` (default: the test's root) whose reports go to `reports`. */
    function open(options = {}) {
        const manager = openCacheManager({
            rootDir: root,
            onReport: (report) => reports.push(report),
            ...options,
        });
        managers.push(manager);
        return manager;
    }

    beforeEach(function () {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildcache-test-'));
        reports = [];
        managers = [];
    });

    afterEach(function () {
        for (const manager of managers) {
            manager.close();
        }
        assert.equal(heldGuardCount(), 0, 'every lock is released');
        fs.rmSync(root, { recursive: true, force: true });
    });

    describe('values', function () {

        it('stores and reads a record with blobs, including 1 MB and non-ASCII text', function () {
            const cache = open().openValuesCache(SVG_CACHE);
            assert.equal(cache.hasCache(), true);
            const big = new Uint8Array(crypto.randomBytes(1024 * 1024));
            const svg = `<svg><text>${NON_ASCII}</text></svg>`;
            cache.put('graph:list:qubits', { title: NON_ASCII, nodes: [ 1, 2, 3 ], nested: { a: null } }, {
                blobs: { 'graph.svg': svg, 'big.bin': big, 'empty.bin': new Uint8Array(0) },
                costMs: 1234.6,
            });
            const found = cache.get('graph:list:qubits');
            assert.deepEqual(found.record, { title: NON_ASCII, nodes: [ 1, 2, 3 ], nested: { a: null } });
            assert.deepEqual(Object.keys(found.blobs).sort(), [ 'big.bin', 'empty.bin', 'graph.svg' ]);
            assert.ok(found.blobs['graph.svg'] instanceof Uint8Array);
            assert.equal(decode(found.blobs['graph.svg']), svg);
            assert.equal(found.blobs['big.bin'].length, big.length);
            assert.ok(Buffer.from(found.blobs['big.bin']).equals(Buffer.from(big)));
            assert.equal(found.blobs['empty.bin'].length, 0);
            // a key with non-ASCII text, and a value without blobs
            cache.put(NON_ASCII, 'only a record');
            assert.deepEqual(cache.get(NON_ASCII), { record: 'only a record', blobs: {} });
            cache.put('undefined record', undefined, { blobs: { 'graph.svg': 'x' } });
            assert.equal(cache.get('undefined record').record, null);
            assert.deepEqual(reports, []);
        });

        it('answers null for a missing key', function () {
            const cache = open().openValuesCache(SVG_CACHE);
            assert.equal(cache.get('nothing here'), null);
            cache.put('present', 1);
            assert.equal(cache.get('Present'), null);
            assert.equal(cache.get(''), null);
            assert.deepEqual(reports, []);
        });

        it('replaces a value, with its blobs', function () {
            const cache = open().openValuesCache(SVG_CACHE);
            cache.put('k', { v: 1 }, { blobs: { 'graph.svg': '<svg>1</svg>', 'extra.txt': 'old' } });
            cache.put('k', { v: 2 }, { blobs: { 'graph.svg': '<svg>2</svg>' } });
            const found = cache.get('k');
            assert.deepEqual(found.record, { v: 2 });
            assert.deepEqual(Object.keys(found.blobs), [ 'graph.svg' ]);
            assert.equal(decode(found.blobs['graph.svg']), '<svg>2</svg>');
            // the blob files of the replaced value are gone
            const blobFiles = fs.readdirSync(root, { recursive: true })
                .filter( (f) => /\.(graph\.svg|extra\.txt)$/.test(f) );
            assert.equal(blobFiles.length, 1, blobFiles.join(', '));
            assert.deepEqual(reports, []);
        });

        it('keeps two caches apart while both are open', function () {
            const manager = open();
            const one = manager.openValuesCache(SVG_CACHE);
            const two = manager.openValuesCache({ ...SVG_CACHE, name: 'test.other-cache' });
            const three = manager.openValuesCache({ ...SVG_CACHE, version: 2 });
            one.put('k', 'one', { blobs: { 'graph.svg': 'svg one' } });
            two.put('k', 'two', { blobs: { 'graph.svg': 'svg two' } });
            assert.equal(three.get('k'), null);
            assert.equal(one.get('k').record, 'one');
            assert.equal(two.get('k').record, 'two');
            assert.equal(decode(two.get('k').blobs['graph.svg']), 'svg two');
            two.close();
            assert.equal(one.get('k').record, 'one');
            assert.deepEqual(reports, []);
        });
    });

    describe('persistence', function () {

        it('keeps the values for a new manager in the same process', function () {
            const first = open();
            const cache = first.openValuesCache(SVG_CACHE);
            cache.put('k', { n: 1 }, { blobs: { 'graph.svg': NON_ASCII } });
            first.close();
            assert.throws( () => cache.get('k'), /closed/ );
            const second = open();
            const again = second.openValuesCache(SVG_CACHE);
            assert.deepEqual(again.get('k').record, { n: 1 });
            assert.equal(decode(again.get('k').blobs['graph.svg']), NON_ASCII);
            assert.deepEqual(reports, []);
        });

        it('keeps the values for another Node process, in both directions', function () {
            const first = open();
            first.openValuesCache(SVG_CACHE).put('from-parent', { by: 'parent' },
                                                 { blobs: { 'graph.svg': NON_ASCII } });
            first.close();
            const out = runChild(`
                import { openCacheManager } from ${JSON.stringify(INDEX_URL)};
                const problems = [];
                const manager = openCacheManager({ rootDir: process.env.BUILDCACHE_ROOT,
                                                   onReport: (r) => problems.push(r) });
                const cache = manager.openValuesCache(${JSON.stringify(SVG_CACHE)});
                const found = cache.get('from-parent');
                cache.put('from-child', { by: 'child', pid: process.pid },
                          { blobs: { 'graph.svg': new TextDecoder().decode(found.blobs['graph.svg']) + '!' } });
                manager.close();
                console.log(JSON.stringify({ record: found.record,
                                             svg: new TextDecoder().decode(found.blobs['graph.svg']),
                                             problems }));
            `, { BUILDCACHE_ROOT: root });
            const child = JSON.parse(out);
            assert.deepEqual(child, { record: { by: 'parent' }, svg: NON_ASCII, problems: [] });
            const second = open();
            const found = second.openValuesCache(SVG_CACHE).get('from-child');
            assert.equal(found.record.by, 'child');
            assert.notEqual(found.record.pid, process.pid);
            assert.equal(decode(found.blobs['graph.svg']), `${NON_ASCII}!`);
            assert.deepEqual(reports, []);
        });
    });

    describe('maintenance', function () {

        it('runs at most once a day unless forced, and summarizes its outcome', function () {
            const manager = open();
            const cache = manager.openValuesCache(SVG_CACHE);
            cache.put('k', 'v', { blobs: { 'graph.svg': '<svg/>' } });
            cache.close();
            const outcome = manager.maintain();
            assert.equal(outcome.status, 'done');
            assert.deepEqual(outcome.failures, []);
            assert.equal(outcome.size.kind, 'measured');
            assert.equal(outcome.size.limitBytes, 256 * 1024 * 1024);
            assert.ok(outcome.size.totalBytes > 0);
            const visited = outcome.instances.find( (i) => i.cache === SVG_CACHE.name );
            assert.equal(visited.action, 'Visited');
            assert.equal(visited.version, 1);
            assert.equal(visited.removedValues, 0);
            assert.equal(manager.maintain().status, 'notDue');
            assert.equal(manager.maintain({ force: true }).status, 'done');
            // the value is still there
            assert.equal(manager.openValuesCache(SVG_CACHE).get('k').record, 'v');
            assert.deepEqual(reports, []);
        });

        it('removes values to stay under the size limit', function () {
            const manager = open({ sizeLimitBytes: 100 * 1024 });
            const cache = manager.openValuesCache(SVG_CACHE);
            const keys = Array.from({ length: 10 }, (_, i) => `key-${i}`);
            for (const key of keys) {
                cache.put(key, { key }, { blobs: { 'graph.svg': new Uint8Array(30 * 1024).fill(65) } });
            }
            cache.close();
            const outcome = manager.maintain();
            assert.equal(outcome.status, 'done');
            assert.equal(outcome.size.limitBytes, 100 * 1024);
            assert.ok(outcome.size.totalBytes <= 0.8 * 100 * 1024, JSON.stringify(outcome.size));
            const reclaimed = outcome.instances.find( (i) => i.action === 'ReclaimedValues' );
            assert.ok(reclaimed && reclaimed.removedValues > 0, JSON.stringify(outcome.instances));
            const again = manager.openValuesCache(SVG_CACHE);
            const left = keys.filter( (key) => again.get(key) !== null );
            assert.equal(left.length, keys.length - reclaimed.removedValues);
            assert.ok(left.length >= 1);
            assert.deepEqual(reports, []);
        });

        it('accepts no size limit', function () {
            const manager = open({ sizeLimitBytes: null });
            manager.openValuesCache(SVG_CACHE).put('k', 'v');
            assert.deepEqual(manager.maintain().size, { kind: 'noLimit' });
        });
    });

    describe('locks in normal use', function () {

        it('never needs to wait for a lock (two managers, caches open during maintenance)', function () {
            const m1 = open();
            const m2 = open();
            const a1 = m1.openValuesCache(SVG_CACHE);
            const a2 = m2.openValuesCache(SVG_CACHE);
            const b1 = m1.openValuesCache({ ...SVG_CACHE, name: 'test.other-cache' });
            for (let i = 0; i < 200; ++i) {
                const key = `key-${i % 37}`;
                a1.put(key, { i }, { blobs: { 'graph.svg': `<svg>${i}</svg>` } });
                assert.deepEqual(a2.get(key).record, { i });
                b1.put(key, i);
                if (i % 50 === 0) {
                    assert.equal(m2.maintain({ force: true }).status, 'done');
                }
            }
            assert.equal(m1.maintain({ force: true }).status, 'done');
            a2.close();
            m2.close();
            assert.equal(m1.maintain({ force: true }).status, 'done');
            a1.close();
            assert.equal(b1.get('key-3').record, 188);
            assert.deepEqual(reports, [], JSON.stringify(reports, null, 2));
        });

        it('reports a clear failure when a lock would have to wait', function () {
            // Another guard of the process holds the root's lock exclusively,
            // as a maintenance run that removes an instance does; opening a
            // session would wait for it.
            fs.mkdirSync(path.join(root, 'v1'));
            const held = hostLock(`${root}/v1/root.lock`, true);
            let cache;
            try {
                cache = open().openValuesCache(SVG_CACHE);
            } finally {
                hostUnlock(held);
            }
            assert.equal(cache.hasCache(), false);
            assert.equal(reports.length, 1);
            assert.equal(reports[0].kind, 'StorageFailure');
            assert.match(reports[0].message,
                         /Failed to take a shared lock on .*root\.lock.*cannot wait in single-threaded WebAssembly/);
        });
    });

    describe('reports', function () {

        it('reports a damaged value, which get() answers as missing and put() replaces', function () {
            const cache = open().openValuesCache(SVG_CACHE);
            cache.put('k', 'v', { blobs: { 'graph.svg': '<svg/>' } });
            const recordFiles = fs.readdirSync(root, { recursive: true })
                .filter( (f) => /content\/[0-9a-f]{2}\/[0-9a-f]{16}\.json$/.test(f.split(path.sep).join('/')) );
            assert.equal(recordFiles.length, 1);
            fs.writeFileSync(path.join(root, recordFiles[0]), 'this is not a record');
            assert.equal(cache.get('k'), null);
            assert.equal(reports.length, 1);
            assert.equal(reports[0].kind, 'DamagedValue');
            assert.equal(reports[0].severity, 'warning');
            assert.equal(reports[0].cache, SVG_CACHE.name);
            assert.equal(reports[0].version, 1);
            assert.equal(typeof reports[0].message, 'string');
            assert.equal(typeof reports[0].folder, 'string');
            cache.put('k', 'v2', { blobs: { 'graph.svg': '<svg/>' } });
            assert.equal(cache.get('k').record, 'v2');
        });

        it('reports a failure of the file system, and the cache keeps nothing', function () {
            const file = path.join(root, 'a-file');
            fs.writeFileSync(file, 'not a folder');
            const cache = open({ rootDir: file }).openValuesCache(SVG_CACHE);
            assert.equal(cache.hasCache(), false);
            assert.ok(reports.length >= 1);
            assert.equal(reports[0].kind, 'StorageFailure');
            assert.equal(reports[0].severity, 'error');
            assert.match(reports[0].message, /a-file/);
            cache.put('k', 'v');
            assert.equal(cache.get('k'), null);
        });

        it('writes warnings and errors to console.warn without onReport', function () {
            const file = path.join(root, 'a-file');
            fs.writeFileSync(file, 'not a folder');
            const warned = [];
            const warn = console.warn;
            console.warn = (...args) => warned.push(args.join(' '));
            try {
                const manager = openCacheManager({ rootDir: file });
                managers.push(manager);
                manager.openValuesCache(SVG_CACHE);
            } finally {
                console.warn = warn;
            }
            assert.ok(warned.length >= 1);
            assert.match(warned[0], /^buildcache: error \(StorageFailure\): /);
        });

        it('refuses calls from onReport, and survives an exception of onReport', function () {
            let cache;
            const refused = [];
            const manager = open({
                onReport: (report) => {
                    reports.push(report);
                    try {
                        cache.get('other');
                    } catch (error) {
                        refused.push(error);
                    }
                    throw new Error('callback failure');
                },
            });
            cache = manager.openValuesCache(SVG_CACHE);
            cache.put('k', 'v', { blobs: { 'graph.svg': '<svg/>' } });
            const recordFile = fs.readdirSync(root, { recursive: true })
                .find( (f) => /[0-9a-f]{16}\.json$/.test(f) );
            fs.writeFileSync(path.join(root, recordFile), 'damaged');
            const errors = [];
            const error = console.error;
            console.error = (...args) => errors.push(args);
            try {
                assert.equal(cache.get('k'), null);
            } finally {
                console.error = error;
            }
            assert.equal(reports.length, 1);
            assert.equal(refused.length, 1);
            assert.match(refused[0].message, /while another one was running/);
            assert.equal(errors.length, 1);
            assert.match(String(errors[0][0]), /onReport callback threw/);
            // the cache still works
            cache.put('k', 'v3');
            assert.equal(cache.get('k').record, 'v3');
        });
    });

    describe('invalid input', function () {

        it('throws for invalid options', function () {
            assert.throws( () => openCacheManager(), TypeError );
            assert.throws( () => openCacheManager({ rootDir: root, sizeLimitBytes: 0 }), TypeError );
            assert.throws( () => openCacheManager({ rootDir: root, sizeLimitBytes: 1.5 }), TypeError );
            assert.throws( () => openCacheManager({ rootDir: root, onReport: 'x' }), TypeError );
            const manager = open();
            assert.throws( () => manager.openValuesCache({ ...SVG_CACHE, version: -1 }), TypeError );
            assert.throws( () => manager.openValuesCache({ ...SVG_CACHE, stableIdleLifetimeDays: 0 }),
                           TypeError );
            assert.throws( () => manager.openValuesCache({ ...SVG_CACHE, defaultCostMs: NaN }),
                           TypeError );
            assert.throws( () => manager.openValuesCache({ ...SVG_CACHE, name: 'Not A Name' }),
                           (e) => !(e instanceof TypeError) && /cache name/i.test(e.message) );
            // an infinite lifetime is accepted
            manager.openValuesCache({ ...SVG_CACHE, name: 'test.forever',
                                      stableIdleLifetimeDays: Infinity }).put('k', 'v');
        });

        it('throws for invalid values, and stores nothing', function () {
            const cache = open().openValuesCache(SVG_CACHE);
            assert.throws( () => cache.put('k', 'v', { blobs: { 'Graph.SVG': 'x' } }),
                           (e) => /Invalid blob name/.test(e.message) );
            assert.throws( () => cache.put('k', 'v', { blobs: { 'graph.svg': 42 } }), TypeError );
            assert.throws( () => cache.put('k', 'v', { costMs: -1 }), TypeError );
            assert.throws( () => cache.put('k', 10n), TypeError );
            assert.throws( () => cache.put(1, 'v'), TypeError );
            assert.throws( () => cache.get(1), TypeError );
            assert.equal(cache.get('k'), null);
            assert.deepEqual(reports, []);
        });

        it('throws after close, which closes the caches of a manager', function () {
            const manager = open();
            const cache = manager.openValuesCache(SVG_CACHE);
            const other = manager.openValuesCache({ ...SVG_CACHE, name: 'test.other-cache' });
            other.close();
            other.close();
            assert.throws( () => other.get('k'), /closed/ );
            manager.close();
            manager.close();
            assert.throws( () => cache.put('k', 'v'), /closed/ );
            assert.throws( () => manager.openValuesCache(SVG_CACHE), /closed/ );
            assert.throws( () => manager.maintain(), /closed/ );
        });
    });

    describe('the committed build', function () {

        it('holds no absolute path of the build machine, and states its versions', function () {
            const wasm = fs.readFileSync(new URL('../dist/buildcache_bg.wasm', import.meta.url));
            for (const marker of [ '/Users/', '/home/', 'C:\\' ]) {
                assert.equal(wasm.indexOf(marker), -1, `the binary holds ${marker}`);
            }
            const info = JSON.parse(fs.readFileSync(new URL('../dist/BUILD_INFO.json', import.meta.url),
                                                    'utf-8'));
            assert.match(info.cachette, /^0\.1\./);
            assert.equal(typeof info.wasm_bindgen, 'string');
        });
    });
});
