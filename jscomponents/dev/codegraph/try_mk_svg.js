import fs from 'fs';
import puppeteer from 'puppeteer';
import { getCyStyleJson } from '../../codegraph/index.js';

const browser = await puppeteer.launch();
const page = await browser.newPage();

await page.setContent(`
<!DOCTYPE HTML>
<html>
<style>
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap');
</style>
<body>
<div id="cy">TEXXT</div>
</body>
</html>
`);


const scriptUrls = [
    "https://unpkg.com/cytoscape@3.23.0/dist/cytoscape.min.js",
    "https://unpkg.com/canvas2svg@1.0.16/canvas2svg.js",
    "https://unpkg.com/cytoscape-svg@0.4.0/cytoscape-svg.js",
];
for (const scriptUrl of scriptUrls) {
    await page.addScriptTag({
        url: scriptUrl
    });
}

const jsonData = fs.readFileSync('./output_graph_try.json');


const styleData = getCyStyleJson({
    fontFamily: '"Source Serif Sans", sans-serif',
    fontSize: '17px',
});


// Evaluate JavaScript
const svgData = await page.evaluate(`
(function (graphData) {
  var domNode = window.document.getElementById('cy');
  //domNode.setAttribute('style', "width: '400px'; height: '600px';");
  var cy = cytoscape({
    container: domNode
  });
  //cy.mount(domNode);
  cy.json(graphData);
  cy.style(${JSON.stringify(styleData)});
  return cy.svg({ full: true});
})(${jsonData})
`);

fs.writeFileSync('./output-file-try.svg', svgData);


// Close browser.
await browser.close();
