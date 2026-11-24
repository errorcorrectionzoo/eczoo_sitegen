import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.sitelib.init_headless_graph_exporter');

import { CodeGraphSvgExporter } from '@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js';
import { openCacheManager } from '@errorcorrectionzoo/buildcache';


//
// The cache of the code graph SVGs.
//
// The key of a graph is the SHA-256 hash of the key data that the exporter
// computes for it (its visible subgraph, the options and the browser, see
// prepareLoadedEczCodeGraph()), together with a fingerprint of the code that
// renders it (the page's bundle, the exporter module and the version of
// puppeteer) and the key version below.  Increase the key version when the
// meaning of the key changes in a way that the code fingerprint does not see.
//
const GRAPH_SVG_CACHE_KEY_VERSION = 1;

const graph_svg_cache_declaration = {
    name: 'eczoo.codegraph.svg',
    version: 1,
    stableIdleLifetimeDays: 60,
    defaultCostMs: 1000,
};
const graph_svg_cache_blob_name = 'graph.svg';
const graph_svg_cache_size_limit_bytes = 1024 * 1024 * 1024; // 1 GiB

// at most this many reports of the cache are written to the console in a
// build (they are all counted)
const max_printed_cache_reports_per_build = 10;


/**
 * Opens the cache manager of the graph SVG cache on the folder `rootDir` (an
 * absolute path).  Call it once per process.  Returns null, after a warning,
 * when the manager cannot be opened; the build then runs without the cache.
 */
export function open_graph_svg_cache_manager({ rootDir })
{
    let manager = null;
    try {
        manager = openCacheManager({
            rootDir,
            sizeLimitBytes: graph_svg_cache_size_limit_bytes,
            onReport: _onCacheReport,
        });
    } catch (error) {
        console.warn(
            `graph SVG cache: could not open the cache in ‘${rootDir}’, the graphs are `
            + `rendered without it:`, error
        );
        return null;
    }
    // records the uses of the values read if the process ends without closing
    // the manager (a failed build, a watch session); closing is idempotent
    process.on('exit', () => {
        try {
            manager.close();
        } catch (error) {
            console.warn(`graph SVG cache: could not close the cache:`, error);
        }
    });
    debug(`Opened the graph SVG cache manager on ${manager.rootDir}`);
    return manager;
}

/**
 * Closes a cache manager opened by open_graph_svg_cache_manager().
 */
export function close_graph_svg_cache_manager(manager)
{
    try {
        manager.close();
    } catch (error) {
        console.warn(`graph SVG cache: could not close the cache:`, error);
    }
}

/**
 * Runs the maintenance of the graph SVG cache (at most once a day: removes the
 * values that were not used for 60 days, and data beyond the size limit).
 * Never throws, a failure only warns.
 */
export function maintain_graph_svg_cache(manager)
{
    let outcome;
    try {
        outcome = manager.maintain();
    } catch (error) {
        console.warn(
            `graph SVG cache: the maintenance of the cache failed: ${error?.message ?? error}`
        );
        debug(`Graph SVG cache maintenance error: `, error);
        return;
    }
    debug(`Graph SVG cache maintenance: `, outcome);
    if (outcome.failures?.length) {
        console.warn(
            `graph SVG cache: the maintenance of the cache had failures: `
            + outcome.failures.join('; ')
        );
    }
    if (outcome.status === 'done') {
        const removedValues = (outcome.instances ?? []).reduce(
            (sum, instance) => sum + (instance.removedValues ?? 0), 0
        );
        let sizeInfo = '';
        if (outcome.size?.kind === 'measured') {
            sizeInfo = `; ${_formatMiB(outcome.size.totalBytes)} in use, limit `
                + `${_formatMiB(outcome.size.limitBytes)}`;
        }
        console.log(
            `graph SVG cache: maintenance done, ${removedValues} values removed${sizeInfo}`
        );
    }
}


/**
 * Starts the headless code graph exporter (a Chrome instance) and returns an
 * object with the methods that the build uses: loadEcZooDbData(data),
 * compileLoadedEczCodeGraph(options) (same options and result as the
 * exporter's method; the SVG comes from the cache when it is there), done()
 * (shuts the exporter down and closes the cache), and summaryLine().
 *
 * Options:
 * - `cacheManager`: a manager from open_graph_svg_cache_manager(), or null
 *   for no cache;
 * - `cacheMode`: '1' (use the cache), '0' (neither read nor write it),
 *   'refresh' (render every graph and store it), 'verify' (render every
 *   graph, compare it with the cached SVG and report each mismatch, store the
 *   missing and mismatching ones).
 *
 * Call it once per build: it opens the cache for the build, done() closes it
 * (which records the uses of the values read).
 */
export async function init_headless_graph_exporter({ cacheManager = null, cacheMode = '1' } = {})
{
    let exporter = null;
    try {

        exporter = new CodeGraphSvgExporter({
            autoCloseMs: 25 * 60 * 1000, // 25 minutes
        });

        await exporter.setup();

    } catch (error) {
        console.error('Failed to initialize the SVG code graph exporter!');
        console.error(error);
        //throw new Error(`Failed to initialize the SVG code graph exporter.`);
        console.error('process.exit now');
        process.exit(101); // otherwise it looks like we end up with pending promises ...
    }

    return new CachingCodeGraphSvgExporter({ exporter, cacheManager, cacheMode });
}


// ---------------------------------------------------------------------------


// reports of the cache: counted, and written to the console up to a number of
// them per build
const _cacheReportState = {
    count: 0,
    errorCount: 0,
    printedThisBuild: 0,
};

function _onCacheReport(report)
{
    if (report.severity === 'information') {
        debug(`graph SVG cache: (${report.kind}) ${report.message}`);
        return;
    }
    _cacheReportState.count += 1;
    if (report.severity === 'error') {
        _cacheReportState.errorCount += 1;
    }
    if (_cacheReportState.printedThisBuild < max_printed_cache_reports_per_build) {
        console.warn(`graph SVG cache: ${report.severity} (${report.kind}): ${report.message}`);
    } else if (_cacheReportState.printedThisBuild === max_printed_cache_reports_per_build) {
        console.warn(`graph SVG cache: further cache reports of this build are not shown`);
    }
    _cacheReportState.printedThisBuild += 1;
}


let _codeFingerprint = null;

// A fingerprint of the code that renders the graphs, computed once per
// process: the files of the page's bundle (except the source maps), the
// exporter module, and the version of puppeteer (which selects the Chrome
// version).
function _getCodeFingerprint()
{
    if (_codeFingerprint != null) {
        return _codeFingerprint;
    }

    const exporterModulePath = fileURLToPath(
        import.meta.resolve('@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js')
    );
    const bundleDir = path.join(path.dirname(exporterModulePath), '_headless_exporter_browser_code_dist');

    const bundleFiles = _listFilesRecursively(bundleDir)
        .filter( (relPath) => ! relPath.endsWith('.map') )
        .sort( (a, b) => (a < b ? -1 : (a > b ? 1 : 0)) );
    if (bundleFiles.length === 0) {
        throw new Error(`No files found in the exporter's bundle folder ${bundleDir}`);
    }

    const require = createRequire(exporterModulePath);
    const puppeteerVersion = JSON.parse(
        fs.readFileSync(require.resolve('puppeteer/package.json'), 'utf8')
    ).version;

    const fingerprintData = {
        bundle: bundleFiles.map(
            (relPath) => [ relPath, _sha256Hex(fs.readFileSync(path.join(bundleDir, relPath))) ]
        ),
        exporterModule: _sha256Hex(fs.readFileSync(exporterModulePath)),
        puppeteerVersion,
    };
    debug(`Code fingerprint data for the graph SVG cache: `, fingerprintData);

    _codeFingerprint = _sha256Hex(_canonicalJson(fingerprintData));
    return _codeFingerprint;
}

// the files under dir (paths relative to dir, with '/' as the separator)
function _listFilesRecursively(dir, relDir = '')
{
    const result = [];
    for (const entry of fs.readdirSync(path.join(dir, relDir), { withFileTypes: true })) {
        const relPath = (relDir === '') ? entry.name : `${relDir}/${entry.name}`;
        if (entry.isDirectory()) {
            result.push(..._listFilesRecursively(dir, relPath));
        } else {
            result.push(relPath);
        }
    }
    return result;
}

function _sha256Hex(data)
{
    return crypto.createHash('sha256').update(data).digest('hex');
}

// JSON text with the keys of every object in sorted order
function _canonicalJson(value)
{
    return JSON.stringify(value, (key_, v) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const sorted = {};
            for (const k of Object.keys(v).sort()) {
                sorted[k] = v[k];
            }
            return sorted;
        }
        return v;
    });
}

function _formatMiB(bytes)
{
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

// A short description of a graph, from the options of
// compileLoadedEczCodeGraph(), for messages
function _describeGraph(options)
{
    const displayOptions = options?.displayOptions ?? {};
    const displayMode = displayOptions.displayMode ?? 'all';
    let what = '';
    if (displayMode === 'isolate-nodes') {
        what = ` of ${(displayOptions.modeIsolateNodesOptions?.nodeIds ?? []).join(', ')}`;
    } else if (displayMode === 'subset') {
        const codeIds = displayOptions.modeSubsetOptions?.codeIds ?? [];
        const shownIds = codeIds.slice(0, 4).join(', ') + (codeIds.length > 4 ? ', ...' : '');
        what = ` of ${codeIds.length} codes (${shownIds})`;
    }
    return `‘${displayMode}’ graph${what}`;
}


class CachingCodeGraphSvgExporter
{
    constructor({ exporter, cacheManager, cacheMode })
    {
        this.exporter = exporter;
        this.cacheMode = cacheMode;
        this.cacheDir = cacheManager?.rootDir ?? null;

        this.cache = null;
        this.cacheProblem = null;

        this.stats = {
            graphs: 0,
            hits: 0,
            misses: 0,
            rendered: 0,
            verifyMismatches: 0,
            stored: 0,
        };
        // the time during which at least one graph was being rendered (the
        // calls can run concurrently)
        this.graphTimeMs = 0;
        this._activeCalls = 0;
        this._activeSinceMs = null;

        _cacheReportState.printedThisBuild = 0;
        this._reportCountAtStart = _cacheReportState.count;

        if (cacheMode === '0' || cacheManager == null) {
            if (cacheMode !== '0') {
                this.cacheProblem = 'the cache could not be opened';
            }
            return;
        }

        try {
            this.codeFingerprint = _getCodeFingerprint();
            const cache = cacheManager.openValuesCache(graph_svg_cache_declaration);
            if (cache.hasCache()) {
                this.cache = cache;
            } else {
                cache.close();
                this._disableCache(`the cache could not be opened in ‘${this.cacheDir}’`);
            }
        } catch (error) {
            this._disableCache(`the cache could not be opened in ‘${this.cacheDir}’`, error);
        }
    }

    _disableCache(reason, error)
    {
        if (this.cacheProblem == null) {
            if (error !== undefined) {
                console.warn(`graph SVG cache: ${reason}, the graphs are rendered without it:`, error);
            } else {
                console.warn(`graph SVG cache: ${reason}, the graphs are rendered without it`);
            }
            this.cacheProblem = reason;
        }
        if (this.cache != null) {
            const cache = this.cache;
            this.cache = null;
            try {
                cache.close();
            } catch (closeError) {
                debug(`Could not close the graph SVG cache: `, closeError);
            }
        }
    }

    async loadEcZooDbData(eczoodbData)
    {
        return await this.exporter.loadEcZooDbData(eczoodbData);
    }

    async compileLoadedEczCodeGraph(options)
    {
        this.stats.graphs += 1;
        this._activeCalls += 1;
        if (this._activeCalls === 1) {
            this._activeSinceMs = performance.now();
        }
        try {
            if (this.cache == null) {
                this.stats.rendered += 1;
                return await this.exporter.compileLoadedEczCodeGraph(options);
            }
            return await this._compileWithCache(options);
        } finally {
            this._activeCalls -= 1;
            if (this._activeCalls === 0) {
                this.graphTimeMs += performance.now() - this._activeSinceMs;
                this._activeSinceMs = null;
            }
        }
    }

    async _compileWithCache(options)
    {
        const { handle, keyData } = await this.exporter.prepareLoadedEczCodeGraph(options);

        let compiled = false;
        try {

            const key = _sha256Hex(_canonicalJson({
                keyVersion: GRAPH_SVG_CACHE_KEY_VERSION,
                code: this.codeFingerprint,
                keyData,
            }));

            let cachedSvgBytes = null;
            let cachedRecord = null;
            if (this.cacheMode !== 'refresh') {
                const found = this._cacheCall( (cache) => cache.get(key) );
                if (found != null) {
                    cachedSvgBytes = found.blobs?.[graph_svg_cache_blob_name] ?? null;
                    cachedRecord = found.record;
                    if (cachedSvgBytes == null) {
                        console.warn(
                            `graph SVG cache: the cached value of the ${_describeGraph(options)} `
                            + `(key ${key}) has no SVG, it is rendered again`
                        );
                    }
                }
                if (cachedSvgBytes != null) {
                    this.stats.hits += 1;
                } else {
                    this.stats.misses += 1;
                }
            }

            if (cachedSvgBytes != null && this.cacheMode === '1') {
                debug(`Graph SVG cache hit for the ${_describeGraph(options)}, key ${key}`);
                try {
                    await this.exporter.releasePreparedEczCodeGraph(handle);
                } catch (error) {
                    console.warn(`graph SVG cache: could not release a prepared graph:`, error);
                }
                compiled = true; // (released)
                return Buffer.from(cachedSvgBytes).toString('utf8');
            }

            const compileStartMs = performance.now();
            compiled = true; // (compilePreparedEczCodeGraph() frees the graph, even on failure)
            const svgData = await this.exporter.compilePreparedEczCodeGraph(handle);
            const compileMs = performance.now() - compileStartMs;
            this.stats.rendered += 1;

            const svgBytes = Buffer.from(svgData, 'utf8');

            if (cachedSvgBytes != null) {
                // verify mode
                if (svgBytes.equals(Buffer.from(cachedSvgBytes))) {
                    debug(`Graph SVG cache: verified the ${_describeGraph(options)}, key ${key}`);
                    return svgData;
                }
                this.stats.verifyMismatches += 1;
                console.error(
                    `graph SVG cache: VERIFY MISMATCH: the SVG of the ${_describeGraph(options)} `
                    + `(key ${key}) differs from the cached one (rendered now: ${svgBytes.length} `
                    + `bytes; cached: ${cachedSvgBytes.length} bytes, stored `
                    + `${cachedRecord?.createdAt ?? '(unknown)'}).  The cache key misses something `
                    + `that the SVG depends on, or the rendering is not deterministic.  The cache `
                    + `entry is replaced.`
                );
            }

            const record = {
                graph: _describeGraph(options).slice(0, 200),
                displayMode: options?.displayOptions?.displayMode ?? null,
                fitWidth: options?.fitWidth ?? null,
                compileMs: Math.round(compileMs),
                createdAt: new Date().toISOString(),
            };
            const errorCountBefore = _cacheReportState.errorCount;
            const stored = this._cacheCall( (cache) => {
                cache.put(key, record, {
                    blobs: { [graph_svg_cache_blob_name]: svgBytes },
                    costMs: compileMs,
                });
                return true;
            } );
            if (stored && _cacheReportState.errorCount === errorCountBefore) {
                this.stats.stored += 1;
            } else if (stored) {
                // the failure was reported (put() does not throw for failures
                // of the file system)
                this._disableCache(`storing a graph in the cache in ‘${this.cacheDir}’ failed`);
            }
            debug(`Graph SVG cache: rendered the ${_describeGraph(options)} in `
                  + `${Math.round(compileMs)} ms, key ${key}`);

            return svgData;

        } finally {
            if (!compiled) {
                // an error happened before the graph was compiled or released
                try {
                    await this.exporter.releasePreparedEczCodeGraph(handle);
                } catch (error) {
                    debug(`Could not release a prepared graph: `, error);
                }
            }
        }
    }

    // Runs fn(cache); an exception disables the cache for the rest of the build
    // (with a warning) and gives null.  (Failures of the file system do not
    // throw, they are reported.)
    _cacheCall(fn)
    {
        if (this.cache == null) {
            return null;
        }
        try {
            return fn(this.cache);
        } catch (error) {
            this._disableCache(`a call to the cache failed`, error);
            return null;
        }
    }

    /**
     * Shuts the exporter down and closes the cache (which records the uses of
     * the values read).
     */
    async done()
    {
        if (this.cache != null) {
            const cache = this.cache;
            this.cache = null;
            try {
                cache.close();
            } catch (error) {
                console.warn(`graph SVG cache: could not close the cache:`, error);
            }
        }
        await this.exporter.done();
    }

    /**
     * A one-line summary of the graphs of this build.
     */
    summaryLine()
    {
        const s = this.stats;
        const seconds = (this.graphTimeMs / 1000).toFixed(1);
        if (this.cacheMode === '0') {
            return `graph SVG cache: off (ECZOO_GRAPH_SVG_CACHE=0); ${s.graphs} graphs rendered `
                + `in ${seconds} s`;
        }
        const numReports = _cacheReportState.count - this._reportCountAtStart;
        return (
            `graph SVG cache [mode ${this.cacheMode}]: ${s.graphs} graphs: ${s.hits} hits, `
            + `${s.misses} misses, ${s.verifyMismatches} verify mismatches, `
            + `${s.rendered} rendered, ${s.stored} stored; ${seconds} s in graphs`
            + (numReports > 0 ? `; ${numReports} cache warnings/errors` : '')
            + (this.cacheProblem != null ? `; cache not used (${this.cacheProblem})` : '')
            + (this.cacheDir != null ? ` [${this.cacheDir}]` : '')
        );
    }
}
