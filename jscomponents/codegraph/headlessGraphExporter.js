import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.codegraph.headlessGraphExporter');

import puppeteer from 'puppeteer';
import { getCyStyleJson } from './index.js';

import loMerge from 'lodash/merge.js';


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
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');
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

    async compile(eczCodeGraph, { cyStyleJsonOptions }={})
    {
        // first, get the SVG data for this graph
        const cyJsonData = eczCodeGraph.cy.json();

        const page = this.page;

        const styleData = getCyStyleJson(
            loMerge(
                {
                    fontFamily: 'Source Sans Pro',
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
        const svgData = await this.page.evaluate(jsCode);

        return svgData;
    }
};


export async function exportCodeGraphToSvg(eczCodeGraph, options)
{
    const exporter = new CodeGraphSvgExporter();
    await exporter.setup();
    const svgData = await exporter.compile(eczCodeGraph, options);
    await exporter.done();
    return svgData;
}
