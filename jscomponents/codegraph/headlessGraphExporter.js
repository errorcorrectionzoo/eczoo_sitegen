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
        }
    }
    _fireAutoCloseTimer() {
        this._cancelAutoCloseTimer();
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
                    return match + `<style>${ importSourceSansFontsCss.replace('&', '&#x26;') }</style>`;
                }
            );
        }

        return svgData;
    }

    // ------------

    // Load the data to build a eczoo and perform all layouting etc. in the
    // Chrome/Puppeteer instance itself (looks more reliable to run layouts etc!)
    async loadEcZooDbData(eczoodbData)
    {
        debug(`loadEcZooDbData()`);

        const jsCode = `
window.eczoodbData = ${JSON.stringify(eczoodbData)};
`;
        await this.page.evaluate(jsCode);

        debug(`loaded data, it's: `, await this.page.evaluate('window.eczoodbData'));
    }

    async compileLoadedEczCodeGraph({
        graphGlobalOptions, displayOptions, updateLayoutOptions, cyStyleOptions,
        svgOptions,
        fitWidth, importSourceSansFonts,
    })
    {
        debug(`compileLoadedEczCodeGraph()`);
        
        this._cancelAutoCloseTimer();

        try {
            const prepareOptions = {
                graphGlobalOptions, displayOptions, updateLayoutOptions, cyStyleOptions
            };
            const jsCode = `
(function() {
    var prepareOptions = ${JSON.stringify(prepareOptions)};
    var eczoodbData = window.eczoodbData;
    var svgOptions = ${ JSON.stringify(svgOptions || {}) };

    if (!window.eczoodbData) {
        throw new Error("Missing eczoodbData. Did you forget to call loadEcZooDbData() on your CodeGraphSvgExporter instance?");
    }

    return window.loadAndCompileCodeGraphToSvgPromise(eczoodbData, prepareOptions, svgOptions);

})();
`;
            let result = await this.page.evaluate(jsCode);
            let { svgData } = result;
            //debug(`Result: `, result);
            debug(`compileLoadedEczCodeGraph() - evaluated compilation code and got SVG data!`);

            svgData = this._fixSvg(svgData, { fitWidth, importSourceSansFonts, });
            return svgData;

        } finally {
            this._fireAutoCloseTimer();
        }
    }
}
