//
// PUPPETEER IN-BROWSER CODE
//

console.log(`Executing in-browser code now`);

function isStrict() { return !this; }
if (!isStrict()) {
    console.error(`Not strict mode!`);
    throw new Error(`Not strict mode!`);
}

// -----

import debugm from 'debug'; const debug = debugm('_headless_exporter_browser_code');

import loMerge from 'lodash/merge.js';

import { load_eczoodb_from_data } from './setup_eczoodb.js';

import { EczCodeGraph } from './index.js';
import { EczCodeGraphViewController } from './eczcodegraphviewcontroller.js';

import cytoscape from 'cytoscape';
import cySvg from 'cytoscape-svg';
cytoscape.use( cySvg );


async function _loadCodeGraph(eczoodbData, displayOptions)
{
    const eczoodb = await load_eczoodb_from_data(eczoodbData);

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
    });

    await eczCodeGraph.initialize();

    let eczCodeGraphViewController = new EczCodeGraphViewController(eczCodeGraph, displayOptions);

    await eczCodeGraphViewController.initialize();

    return { eczoodb, eczCodeGraph, eczCodeGraphViewController };
}

async function _prepareCodeGraphAndLayout(
    eczoodbData, { displayOptions, updateLayoutOptions, cyStyleOptions }
)
{
    const {
        eczoodb,
        eczCodeGraph,
        eczCodeGraphViewController,
    } = await _loadCodeGraph(eczoodbData, displayOptions);

    const domNode = window.document.createElement('div');
    window.document.body.appendChild(domNode);
    domNode.style.width = 800;
    domNode.style.height = 600;
    
    await eczCodeGraph.mountInDom(
        domNode,
        {
            styleOptions: {
                matchWebPageFonts: false,
                window,
                ...cyStyleOptions
            },
        }
    );

    eczCodeGraphViewController.setDisplayOptions(displayOptions);

    // perform layout !
    await eczCodeGraph.updateLayout(loMerge(
        {
            animate: false
        },
        updateLayoutOptions
    ));

    // fit into view
    await eczCodeGraph.cy.fit();

    return {
        eczoodb,
        eczCodeGraph,
        eczCodeGraphViewController,
    };
}

window.loadCodeGraph = _loadCodeGraph;
window.prepareCodeGraphAndLayout = _prepareCodeGraphAndLayout;

window.localStorage.debug = '*';

console.log('Loaded (console.log)');
debug(`Loaded.`);
console.debug('Loaded (console.debug)');
