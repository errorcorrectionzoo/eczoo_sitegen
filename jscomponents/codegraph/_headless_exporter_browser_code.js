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


async function _loadCodeGraph(eczoodbData, displayOptions, graphGlobalOptions)
{
    const eczoodb = await load_eczoodb_from_data(eczoodbData);

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
        graphGlobalOptions,
    });

    await eczCodeGraph.initialize();

    let eczCodeGraphViewController =
        new EczCodeGraphViewController(eczCodeGraph, displayOptions);

    await eczCodeGraphViewController.initialize();

    return { eczoodb, eczCodeGraph, eczCodeGraphViewController };
}

async function _prepareCodeGraphAndLayout(
    eczoodbData, { graphGlobalOptions, displayOptions, updateLayoutOptions, cyStyleOptions }
)
{
    const {
        eczoodb,
        eczCodeGraph,
        eczCodeGraphViewController,
    } = await _loadCodeGraph(eczoodbData, displayOptions, graphGlobalOptions);

    debug(`Code graph loaded.`);

    const domNode = window.document.createElement('div');
    window.document.body.appendChild(domNode);
    domNode.style.width = 800;
    domNode.style.height = 600;
    
    await eczCodeGraph.mountInDom(
        domNode,
        {
            styleOptions: Object.assign(
                {
                    matchWebPageFonts: false,
                    window: window,
                },
                cyStyleOptions,
            ),
        }
    );

    debug(`Mounted in DOM!`);

    eczCodeGraphViewController.setDisplayOptions(displayOptions);

    debug(`set display options!`);

    // perform layout !
    await eczCodeGraph.updateLayout(loMerge(
        {
            animate: false
        },
        updateLayoutOptions
    ));

    debug(`ran updateLayout()!`);

    const cy = eczCodeGraph.cy;

    // fit into view
    await cy.fit();

    debug(`fit cy canvas view to graph. Done!`);

    debug(`There are ${cy.nodes().length} nodes in the graph.`);

    return {
        eczoodb,
        eczCodeGraph,
        eczCodeGraphViewController,
    };
}

async function _loadAndCompileCodeGraphToSvgPromise(eczoodbData, prepareOptions, svgOptions)
{
    //debug('eczoodbData = ', JSON.stringify(eczoodbData)); // ok, works
    debug('prepareOptions = ', JSON.stringify(prepareOptions));
    var result = await _prepareCodeGraphAndLayout(eczoodbData, prepareOptions);

    var cy = result.eczCodeGraph.cy;

    var svgData = cy.svg(Object.assign(
        {
            full: true,
        },
        svgOptions
    ));
    return {
        svgData: svgData,
        // moredata: {
        //     cy_data: cy.json(),
        // }
    };
}

window.loadCodeGraph = _loadCodeGraph;
window.prepareCodeGraphAndLayout = _prepareCodeGraphAndLayout;
window.loadAndCompileCodeGraphToSvgPromise = _loadAndCompileCodeGraphToSvgPromise;

window.localStorage.debug = '*';

console.log('Loaded (msg via console.log())');
debug(`Loaded (msg via debug()).`);
console.debug('Loaded (msg via console.debug())');

window.finished_loading = true;
