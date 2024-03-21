//import debugm from 'debug';
//const debug = debugm('eczoo_sitegen.jscomponents.codegraph.headlessGraphExporter');

import loMerge from 'lodash/merge.js';

import puppeteer from 'puppeteer';

import { getCyStyleJson } from './style.js';


// Keep "Source Sans Pro" for now, not "Source Sans 3", because otherwise I get
// issues with fonte rendering in the SVG graphic.  Tried a few things, it's
// buggy, unsure how to best fix!!
const importSourceSansFontsCss = "@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');";



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

        this.browser = await puppeteer.launch();
        this.page = await this.browser.newPage();

        await this.page.setContent(`<!DOCTYPE HTML>
<html>
<style>
${ importSourceSansFontsCss }
</style>
<body id="body">
</body>
</html>`);

        const scriptUrls = [
            "https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js",
            "https://unpkg.com/canvas2svg@1.0.16/canvas2svg.js",
            "https://unpkg.com/cytoscape-svg@0.4.0/cytoscape-svg.js",
        ];
        for (const scriptUrl of scriptUrls) {
            await this.page.addScriptTag({
                url: scriptUrl,
            });
        }

        this._fireAutoCloseTimer();
    }

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

    async compile(eczCodeGraph, options={})
    {
        this._cancelAutoCloseTimer();
        if (this.browser == null) {
            throw new Error(
                'CodeGraphSvgExporter.compile(): Browser is already null! '
                + '(either didn\'t setup(), timed out, or done() called)'
            );
        }

        const {
            cyStyleJsonOptions,
            fitWidth,
            embedSourceSansFonts,
        } = options ;

            try {

            // first, get the SVG data for this graph
            const cyJsonData = eczCodeGraph.cy.json();

            const styleData = getCyStyleJson(
                loMerge(
                    {
                        fontFamily: "Source Sans Pro",
                        fontSize: '18px',
                    },
                    cyStyleJsonOptions
                )
            );

            const jsCode = `
    (function () {

    var graphData = ${JSON.stringify(cyJsonData)};
    var styleData = ${JSON.stringify(styleData)};

    var domNode = window.document.createElement('div');
    window.document.body.appendChild(domNode);
    //domNode.setAttribute('style', "width: '400px'; height: '600px';"); // looks unnecessary.

    var cy = cytoscape({
        container: domNode
    });

    cy.json(graphData);
    cy.style(styleData);

    var svgData = cy.svg({ full: true });

    window.document.body.removeChild(domNode);

    return svgData;

    })();
    `;
            //debug('Generating SVG, using jsCode =', jsCode);

            // Evaluate JavaScript
            let svgData = await this.page.evaluate(jsCode);

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
                        return match + `<style>${ importSourceSansFontsCss }</style>`;
                    }
                );
            }

            return svgData;

        } finally {
            this._fireAutoCloseTimer();
        }
    }
}


export async function exportCodeGraphToSvg(eczCodeGraph, options)
{
    const exporter = new CodeGraphSvgExporter();
    await exporter.setup();
    const svgData = await exporter.compile(eczCodeGraph, options);
    await exporter.done();
    return svgData;
}
