import debug_module from 'debug';
const debug = debug_module('eczoo_site.jscomponents.codegraph.setup');

import history from 'history/browser';

import { EczCodeGraph } from './index.js';
import { EczCodeGraphViewController } from './eczcodegraphviewcontroller.js';

import { load_eczoodb_from_data } from './setup_eczoodb.js';
import { EczCodeGraphComponent } from './ui.jsx';

// ---

import React from 'react';
import { createRoot } from 'react-dom/client';

// ---




function getDisplayOptionsFromUrlFragment(hrefFragment)
{
    let nodeId = null;

    // matches a JSON object?
    const rxJsonDisplayOptions = /^#J(.*)$/.exec(hrefFragment);
    if (rxJsonDisplayOptions != null) {
        const jsonDisplayOptions = decodeURIComponent(rxJsonDisplayOptions[1]);
        return JSON.parse(jsonDisplayOptions);
    }

    // matches a code?
    const nodeRxMatchCode = /^#code_(.*)$/.exec(hrefFragment);
    if (nodeRxMatchCode != null) {
        // highlight a given code
        const codeId = nodeRxMatchCode[1];
        debug(`Gonna highlight code ${codeId}`);
        nodeId = EczCodeGraph.getNodeIdCode(codeId);
    }
    // matches a domain?
    const nodeRxMatchDomain = /^#domain_(.*)$/.exec(hrefFragment);
    if (nodeRxMatchDomain != null) {
        // highlight a given code
        const domainId = nodeRxMatchDomain[1];
        debug(`Gonna highlight domain ${domainId}`);
        nodeId = EczCodeGraph.getNodeIdDomain(domainId);
    }
    // matches a kingdom?
    const nodeRxMatchKingdom = /^#kingdom_(.*)$/.exec(hrefFragment);
    if (nodeRxMatchKingdom != null) {
        // highlight a given code
        const kingdomId = nodeRxMatchKingdom[1];
        debug(`Gonna highlight kingdom ${kingdomId}`);
        nodeId = EczCodeGraph.getNodeIdKingdom(kingdomId);
    }

    if (nodeId == null) {
        // don't highlight anything specific via fragment
        return;
    }
    
    return {
        displayMode: 'isolate-nodes',
        modeIsolateNodesOptions: {
            nodeIds: [ nodeId ],
            redoLayout: true,
            range: {
                parents: {
                    primary: 5,
                    secondary: 0,
                },
                children: {
                    primary: 2,
                    secondary: 0,
                },
            },
        },
    };
}



//
// Set up code graph code and install the React UI
//


export async function load({ displayOptions, graphGlobalOptions }={})
{

    debug('codegraph setup: load() called')

    const domContainer = window.document.getElementById('main');

    //domContainer.classList.add('jsapp-loading');
    domContainer.innerHTML = 'loading …'

    const eczoodbDataUrl =
          domContainer.dataset.eczoodbDataUrl ?? '/dat/eczoodata.json';

    // try to get data from the global 'window' object, in case it's there.
    let eczoodbData = window.eczData?.eczoodbData;

    if (!eczoodbData) {
        // download the search data
        debug("Downloading the zoo graph data...");

        let eczoodbDataJsonPromise =
            fetch(eczoodbDataUrl).then( (response) => response.json() );
        
        eczoodbData = await eczoodbDataJsonPromise;
    }

    debug(`Setting up eczoodb ...`);

    const eczoodb = await load_eczoodb_from_data(eczoodbData);

    debug(`Setting up code graph web app ...`);

    //
    // Set initial graph positioning/layout options.  Zoom into the requested
    // node, if any was requested as a HTML URL fragment.
    //

    displayOptions ??= {};

    // inspect htmlFragment for display options
    const hrefFragment = window.location.hash;
    debug({hrefFragment});
    if (hrefFragment != null) {
        displayOptions = EczCodeGraphViewController.getMergedDisplayOptions(
            displayOptions,
            getDisplayOptionsFromUrlFragment(hrefFragment)
        );
    }

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
        graphGlobalOptions,
    });

    await eczCodeGraph.initialize();

    let eczCodeGraphViewController = new EczCodeGraphViewController(eczCodeGraph, displayOptions);

    await eczCodeGraphViewController.initialize();

    // expose eczCodeGraph to the JS console for debugging
    window.eczCodeGraph = eczCodeGraph;
    window.eczCodeGraphViewController = eczCodeGraphViewController;

    debug('Graph initialized.');

    //
    // Render the React app
    //
    const reactRoot = createRoot(domContainer);
    const pFirstRenderLayoutPromise = new Promise( (resolve) => {
        reactRoot.render(
            React.createElement(
                EczCodeGraphComponent,
                {
                    eczCodeGraph,
                    eczCodeGraphViewController,
                    history,
                    onLayoutDone: () => resolve(),
                },
                null
            )
        );
    } );
    await pFirstRenderLayoutPromise;

    debug('Layout done.');
}

