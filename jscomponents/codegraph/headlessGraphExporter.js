import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.codegraph.headlessGraphExporter');

import fs from 'fs';
import path from 'path';

//const __filename = (new URL(import.meta.url)).pathname;
const __dirname = (new URL('.', import.meta.url)).pathname;


import loMerge from 'lodash/merge.js';

import puppeteer from 'puppeteer';

//import { getCyStyleJson } from './style.js';


// Keep "Source Sans Pro" for now, not "Source Sans 3", because otherwise I get
// issues with fonte rendering in the SVG graphic.  Tried a few things, it's
// buggy, unsure how to best fix!!
const importSourceSansFontsCss = "@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');";


const browser_code_page_url = `file://${__dirname}/_headless_exporter_browser_code_dist/_headless_exporter_browser_page.html`;



export class CodeGraphSvgExporter
{
    constructor(options)
    {
        this.browser = null;
        this.page = null;

        this.options = loMerge({
            autoCloseMs: -1,
        }, options ?? {});
        this.autoCloseTimeoutId = null;
    }

    async setup()
    {
        //
        // Now, launch a fake browser to run cytoscape & generate svg (:/)
        //

        this.browser = await puppeteer.launch({
            headless: "new",
        });
        this.page = await this.browser.newPage();

        await this.page.goto(browser_code_page_url);
        this.page.on('console', (msg) => console.log('//Puppeteer//' + msg.text()));
        this.page.on('load', () => debug('Puppeteer page appears to have loaded now.'));

        await new Promise( (resolve) => setTimeout(resolve, 5000) );

        this._fireAutoCloseTimer();
    }

    async done()
    {
        // remove any existing timeout.
        this._cancelAutoCloseTimer();

        // Close browser.
        if (this.browser != null) {
            await this.browser.close();
            this.browser = null;
        }
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

    _fixSvg(svgData, { fitWidth, embedSourceSansFonts })
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

        if (embedSourceSansFonts ?? true) {
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

        // // make sure we load the necessary browser code
        // const scriptContent = fs.readFileSync(
        //     path.join(
        //         __dirname,
        //         '_headless_exporter_browser_code_dist/_headless_exporter_browser_code.js',
        //     ),
        //     { encoding: 'utf-8' }
        // );
        // debug(`init script content = "${scriptContent.slice(0,100)}..."`);
        // // this.page.addScriptTag({
        // //     content: scriptContent
        // // });
        // await this.page.evaluate(scriptContent);

        const jsCode = `
window.eczoodbData = ${JSON.stringify(eczoodbData)};
`;
        await this.page.evaluate(jsCode);
    }

    async compileLoadedEczCodeGraph({
        displayOptions, updateLayoutOptions, cyStyleJsonOptions, svgOptions,
        fitWidth, embedSourceSansFonts,
    })
    {
        debug(`compileLoadedEczCodeGraph()`);
        
        this._cancelAutoCloseTimer();

        try {
            const prepareOptions = {
                displayOptions, updateLayoutOptions, cyStyleJsonOptions
            };
            const jsCode = `
(async function() {
    var prepareOptions = ${JSON.stringify(prepareOptions)};
    var result = await window.prepareCodeGraphAndLayout(window.eczoodbData, prepareOptions);

    var cy = result.eczCodeGraph.cy;

    var svgData = cy.svg(${svgOptions ? JSON.stringify(svgOptions) : ''});
    return {
        svgData: svgData,
        moredata: {
            cy_data: cy.data(),
        }
    };
})();
`;
            let result = await this.page.evaluate(jsCode);
            let { svgData, moredata } = result;
            debug(`Result: `, result);
            debug(`compileLoadedEczCodeGraph() - evaluated compilation code and got SVG data!`);

            svgData = this._fixSvg(svgData, { fitWidth, embedSourceSansFonts, });
            return svgData;

        } finally {
            this._fireAutoCloseTimer();
        }
    }
}
