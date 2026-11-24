import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.codegraph.headlessGraphExporter');

//import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;


import loMerge from 'lodash/merge.js';

import puppeteer from 'puppeteer';
import sirv from 'sirv';
import http from 'http';
import { performance } from 'node:perf_hooks';

//import { getCyStyleJson } from './style.js';


// Keep "Source Sans Pro" for now, not "Source Sans 3", because otherwise I get
// issues with fonte rendering in the SVG graphic.  Tried a few things, it's
// buggy, unsure how to best fix!!
const importSourceSansFontsCss = "@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');";


const browser_code_dir = path.join(__dirname, '_headless_exporter_browser_code_dist');
const browser_code_page_path = '/_headless_exporter_browser_page.html';

class _BrowserCodeSourceServer {
    constructor()
    {
        this.sirv_fn = sirv(browser_code_dir, {});
        this.server = http.createServer(this.sirv_fn);
        this.server.on('request', (req, res_) => {
			req.once('end', () => {
				let uri = req.originalUrl || req.url;
				debug(`Internal headless browser code server request: ${uri}`);
			});
		});
        this.port = 39135;
        this.hostname = 'localhost';
    }
    async startServer()
    {
        return await new Promise( (resolve, reject) => {
            this.server.listen(this.port, this.hostname, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                debug(`Started internal headless browser code server!  Serving files in `
                      + `${browser_code_dir} on http://${this.hostname}:${this.port}/`);
                resolve({ port: this.port, hostname: this.hostname });
            });
		});
    }
    async close()
    {
        if (this.server == null) {
            return;
        }
        debug(`Closing internal headless browser code server ...`);
        await new Promise( (resolve, reject) => {
            this.server.close( (err) => {
                if (err) {
                    reject(err);
                }
                debug(`Internal headless browser code server shut down.`);
                resolve();
            });
            // run closeAllConnections immediately after close(), without waiting
            // for close to call its callback
            this.server.closeAllConnections();
            this.server = null;
        } );
    }
}


export class CodeGraphSvgExporter
{
    constructor(options)
    {
        this.browser_code_server = null;

        this.browser = null;
        this.page = null;

        this.options = loMerge({
            autoCloseMs: -1,
        }, options ?? {});
        this.autoCloseTimeoutId = null;
        // number of calls to the page in progress; the auto-close timer runs
        // only when there are none.
        this.numActivePageCalls = 0;

        // the graphs prepared in the page and not yet compiled or released:
        // handle -> the options that _fixSvg() applies to their SVG
        this.preparedGraphs = new Map();

        this.browserCodeStartupTimeoutMs = 5000;
    }

    async setup()
    {
        if (this.page != null) {
            throw new Error(`Please do not call CodeGraphSvgExporter.setup() twice!`);
        }

        //
        // Now, launch a fake browser to run cytoscape & generate svg (:/)
        //

        this.browser_code_server = new _BrowserCodeSourceServer();

        const { hostname, port } = await this.browser_code_server.startServer();

        this.browser = await puppeteer.launch({
            headless: "new",
            args: [
              `--no-sandbox`,
              `--disable-setuid-sandbox`,
            ],
            timeout: 0,
        });
        this.page = await this.browser.newPage();

        this.page.on('console', (msg) => console.log('|Puppeteer console|',  msg.text()));

        await this.page.goto(`http://${hostname}:${port}${browser_code_page_path}`);

        // wait until page has fully loaded and our initialization code has finished running
        let ready = false;
        let startTime = performance.now();
        while (!ready) {
            await new Promise( resolve => setTimeout(resolve, 200) );
            ready = await this.page.evaluate('window.finished_loading');
            let curTime = performance.now();
            if ( (curTime - startTime) > this.browserCodeStartupTimeoutMs ) {
                throw new Error(
                    `Puppeteer browser code page is still not ready after `
                    + `${this.browserCodeStartupTimeoutMs}ms, `
                    + `there might have been a problem during start-up.  Try again perhaps?`
                );
            }
        }
        debug('Puppeteer page appears to have completely finished loading now.');

        this._fireAutoCloseTimer();
    }

    async done()
    {
        // remove any existing timeout.
        this._cancelAutoCloseTimer();

        this.preparedGraphs.clear();

        if (this.browser_code_server != null) {
            await this.browser_code_server.close();
        }

        if (this.browser != null) {
            // // .close() methods appear unreliable.
            // // cf. https://github.com/puppeteer/puppeteer/issues/7922
            // debug(`Bye bye puppeteer browser page...`);
            // const childProcess = this.browser.process()
            // if (childProcess) {
            //     childProcess.kill(9)
            // }

            // Close page, if applicable
            if (this.page != null) {
                debug(`Shutting down headless puppeteer browser page...`);
                await this.page.close();
                this.page = null;
            }

            // Close browser.
            debug(`Shutting down headless puppeteer browser...`);
            await this.browser.close();
            this.browser = null;
        }

        debug(`Internal headless puppeteer browser instance completely shut down.`);
    }

    // ------------

    _cancelAutoCloseTimer() {
        if (this.autoCloseTimeoutId != null) {
            clearTimeout(this.autoCloseTimeoutId);
            this.autoCloseTimeoutId = null;
        }
    }
    _fireAutoCloseTimer() {
        this._cancelAutoCloseTimer();
        if (this.numActivePageCalls > 0) {
            // restarted when the last call in progress finishes
            return;
        }
        if (this.options.autoCloseMs && this.options.autoCloseMs > 0) {
            this.autoCloseTimeoutId = setTimeout(
                () => {
                    this.autoCloseTimeoutId = null;
                    console.log('*** timeout *** CodeGraphSvgExporter was idle for too long, shutting down.');
                    this.done();
                },
                this.options.autoCloseMs
            );
        }
    }

    // Runs fn(page), a call to the page; the auto-close timer is stopped while
    // any such call is in progress (calls may run concurrently) and started
    // again when the last one finishes.
    async _withPage(fn) {
        if (this.page == null) {
            throw new Error(
                `CodeGraphSvgExporter: no browser page, the exporter is not set up or it was `
                + `shut down (done(), or the auto-close timer)`
            );
        }
        this.numActivePageCalls += 1;
        this._cancelAutoCloseTimer();
        try {
            return await fn(this.page);
        } finally {
            this.numActivePageCalls -= 1;
            this._fireAutoCloseTimer();
        }
    }

    // ------------

    _fixSvg(svgData, { fitWidth, importSourceSansFonts })
    {
        if (fitWidth ?? false) {
            svgData = svgData.replace(
                /(<svg [^>]*)width="([^"]+)"[ \t]+height="([^"]+)"/,
                (match, starttag, width, height) => {
                    if (width < fitWidth) {
                        return match;
                    }
                    return (
                        `${starttag}viewBox="0 0 ${width} ${height}" `
                        + `width="${fitWidth}" preserveAspectRatio="xMidYMid meet"`
                    );
                }
            );
        }

        if (importSourceSansFonts ?? true) {
            // insert imports immediately after the end of the first tag
            svgData = svgData.replace(
                /(<svg [^>]*>)/,
                (match) => {
                    return match + `<style>${ importSourceSansFontsCss.replaceAll('&', '&#x26;') }</style>`;
                }
            );
        }

        return svgData;
    }

    // ------------

    // Load the data to build a eczoo and perform all layouting etc. in the
    // Chrome/Puppeteer instance itself (looks more reliable to run layouts etc!)
    //
    // The page loads the zoo from this data once, when it prepares its first
    // graph, and again after new data is loaded.
    async loadEcZooDbData(eczoodbData)
    {
        debug(`loadEcZooDbData()`);

        const jsCode = `
window.eczoodbData = ${JSON.stringify(eczoodbData)};
`;
        await this._withPage( async (page) => {
            await page.evaluate(jsCode);

            debug(`loaded data, it's: `, await page.evaluate('window.eczoodbData'));
        } );
    }

    /**
     * Builds a code graph in the page, with its subgraph selection and graph
     * filters, without laying it out.  The options are those of
     * `compileLoadedEczCodeGraph()`.
     *
     * Returns `{ handle, keyData }`: the handle of the prepared graph, to pass
     * to `compilePreparedEczCodeGraph()` or to `releasePreparedEczCodeGraph()`
     * (one of them must be called, the page keeps the graph until then); and
     * the graph's key data, a JSON-serializable value that, together with the
     * code (the page's bundle and this module), determines the graph's SVG
     * (see `_computeKeyData()` in `_headless_exporter_browser_code.js`).
     */
    async prepareLoadedEczCodeGraph({
        graphGlobalOptions, displayOptions, updateLayoutOptions, cyStyleOptions,
        svgOptions,
        fitWidth, importSourceSansFonts,
    })
    {
        debug(`prepareLoadedEczCodeGraph()`);

        const prepareOptions = {
            graphGlobalOptions, displayOptions, updateLayoutOptions, cyStyleOptions,
            svgOptions,
            fitWidth, importSourceSansFonts,
        };

        const { handle, keyData } = await this._withPage(
            (page) => page.evaluate(
                (prepareOptions) => window.prepareCodeGraph(prepareOptions),
                prepareOptions
            )
        );

        this.preparedGraphs.set(handle, { fitWidth, importSourceSansFonts });

        debug(`prepareLoadedEczCodeGraph() - prepared graph ${handle}`);

        return { handle, keyData };
    }

    /**
     * Lays out a prepared graph and exports it to SVG.  Returns the SVG data.
     * The prepared graph is released.
     */
    async compilePreparedEczCodeGraph(handle)
    {
        debug(`compilePreparedEczCodeGraph(${handle})`);

        const preparedGraph = this.preparedGraphs.get(handle);
        if (preparedGraph == null) {
            throw new Error(
                `CodeGraphSvgExporter: no prepared graph with handle ${JSON.stringify(handle)} `
                + `(it was already compiled or released?)`
            );
        }
        this.preparedGraphs.delete(handle);

        const { fitWidth, importSourceSansFonts } = preparedGraph;

        let { svgData } = await this._withPage(
            (page) => page.evaluate(
                (handle) => window.compilePreparedCodeGraph(handle),
                handle
            )
        );
        debug(`compilePreparedEczCodeGraph() - evaluated compilation code and got SVG data!`);

        svgData = this._fixSvg(svgData, { fitWidth, importSourceSansFonts, });
        return svgData;
    }

    /**
     * Releases a prepared graph that will not be compiled.
     */
    async releasePreparedEczCodeGraph(handle)
    {
        debug(`releasePreparedEczCodeGraph(${handle})`);

        if (!this.preparedGraphs.delete(handle)) {
            return;
        }
        if (this.page == null) {
            // the browser is gone, and the graph with it
            return;
        }
        await this._withPage(
            (page) => page.evaluate(
                (handle) => window.releasePreparedCodeGraph(handle),
                handle
            )
        );
    }

    async compileLoadedEczCodeGraph(options)
    {
        debug(`compileLoadedEczCodeGraph()`);

        const { handle } = await this.prepareLoadedEczCodeGraph(options);

        return await this.compilePreparedEczCodeGraph(handle);
    }
}
