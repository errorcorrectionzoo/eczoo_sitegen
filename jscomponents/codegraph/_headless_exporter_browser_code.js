//
// PUPPETEER IN-BROWSER CODE
//

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

    // perform layout !
    await eczCodeGraph.updateLayout(loMerge(
        {
            animate: false
        },
        updateLayoutOptions
    ));

    return {
        eczoodb,
        eczCodeGraph,
        eczCodeGraphViewController,
    };
}

window.loadCodeGraph = _loadCodeGraph;
window.prepareCodeGraphAndLayout = _prepareCodeGraphAndLayout;
