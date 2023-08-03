import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.codegraph.headlessGraphExporter');

import puppeteer from 'puppeteer';
import { getCyStyleJson } from './index.js';

import loMerge from 'lodash/merge.js';


// Keep "Source Sans Pro" for now, not "Source Sans 3", because otherwise I get
// issues with fonte rendering in the SVG graphic.  Tried a few things, it's
// buggy, unsure how to best fix!!
const importSourceSansFontsCss = "@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');";



export class CodeGraphSvgExporter
{
    constructor()
    {
        this.browser = null;
        this.page = null;
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
            "https://unpkg.com/cytoscape@3.23.0/dist/cytoscape.min.js",
            "https://unpkg.com/canvas2svg@1.0.16/canvas2svg.js",
            "https://unpkg.com/cytoscape-svg@0.4.0/cytoscape-svg.js",
        ];
        for (const scriptUrl of scriptUrls) {
            await this.page.addScriptTag({
                url: scriptUrl,
            });
        }
    }

    async done()
    {
        // Close browser.
        await this.browser.close();
    }

    async compile(eczCodeGraph, options={})
    {
        const {
            cyStyleJsonOptions,
            fitWidth,
            embedSourceSansFonts,
        } = options ;

        // first, get the SVG data for this graph
        const cyJsonData = eczCodeGraph.cy.json();

        const page = this.page;

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
  //domNode.setAttribute('style', "width: '400px'; height: '600px';");

  var cy = cytoscape({
    container: domNode
  });

  cy.json(graphData);
  cy.style(styleData);

  return cy.svg({ full: true });

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
