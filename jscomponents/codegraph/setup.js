import debug_module from 'debug';
const debug = debug_module('eczoo_site.jscomponents.codegraph.setup');

import { EczCodeGraph } from './index.js';
import { EczCodeGraphComponent } from './ui.jsx';

import { use_relations_populator } from '@errorcorrectionzoo/eczoodb/use_relations_populator.js';
import { use_llm_environment } from '@errorcorrectionzoo/eczoodb/use_llm_environment.js';
import { EcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';

// ---

import _ from 'lodash';

import React from 'react';
import { createRoot } from 'react-dom/client';

// ---




function getDisplayOptionsFromUrlFragment(hrefFragment)
{
    const nodeRxMatch = /^#code_(.*)$/.exec(hrefFragment);
    if (nodeRxMatch == null) {
        return {};
    }
    // highlight a given code
    const codeId = nodeRxMatch[1];
    debug(`Gonna highlight code ${codeId}`);
    return {
        displayMode: 'isolate-nodes',
        modeIsolateNodesOptions: {
            nodeIds: [ EczCodeGraph.getNodeIdCode(codeId) ],
            redoLayout: true,
            range: {
                parents: {
                    primary: 5,
                    secondary: 1,
                },
                children: {
                    primary: 2,
                    secondary: 1,
                },
            },
        },
    };
}




//
// Set up code graph code
//

window.addEventListener('load', async () => {

    debug('setup code graph!')

    const domContainer = window.document.getElementById('main');

    //domContainer.classList.add('jsapp-loading');
    domContainer.innerHTML = 'loading …'

    const eczoodbDataUrl =
          domContainer.dataset.eczoodbDataUrl ?? '/dat/eczoodata.json';
    const eczoodbRefsDataUrl =
          domContainer.dataset.eczoodbRefsDataUrl ?? '/dat/eczoorefsdata.json'; //

    // try to get data from the global 'window' object, in case it's there.
    let eczoodbData = window.eczData?.eczoodbData;
    let eczoodbRefsData = window.eczData?.eczoodbRefsData;

    if (!eczoodbData) {
        // download the search data
        debug("Downloading the zoo graph data...");

        let eczoodbDataJsonPromise =
            fetch(eczoodbDataUrl).then( (response) => response.json() );
        let eczoodbRefsDataJsonPromise =
            fetch(eczoodbRefsDataUrl).then( (response) => response.json() );

        [eczoodbData, eczoodbRefsData] = await Promise.all([
            eczoodbDataJsonPromise,
            eczoodbRefsDataJsonPromise,
        ]);
    }

    let eczoodbOpts = {
        use_relations_populator,

        use_llm_environment,
        use_llm_processor: false,

        // allow unresolved refs because e.g. a code description might contain a
        // reference to an equation/figure somewhere else on the code page
        // itself (and hence not listed in the global refs database)
        llm_allow_unresolved_references: true,

        use_searchable_text_processor: false,

        fs: null,
        // llm_processor_graphics_resources_fs_data_dir: data_dir,    
        // llm_processor_citations_override_arxiv_dois_file:
        //     path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
        // llm_processor_citations_preset_bibliography_files: [
        //     path.join(data_dir, 'code_extra', 'bib_preset.yml'),
        // ],
    };

    let eczoodb = new EcZooDb(eczoodbOpts);

    //
    // load refs & citations
    //
    eczoodb.zoo_llm_environment.ref_resolver.load_database(
        eczoodbRefsData.refs
    );
    eczoodb.zoo_llm_environment.citations_provider.load_database(
        eczoodbRefsData.citations
    );

    //
    // load zoo data
    //
    await eczoodb.load_data(eczoodbData.db);


    //
    // Set initial graph positioning/layout options.  Zoom into the requested
    // node, if any was requested as a HTML URL fragment.
    //

    let displayOptions = {};

    // // inspect dom node's own data for a highlight, if applicable
    // if (domContainer.dataset.isolateTreeForCode) {
    //     const codeId = domContainer.dataset.isolateTreeForCode;
    //     _.merge(displayOptions, getDisplayOptionsFromUrlFragment(hrefFragment));
    // }

    // inspect htmlFragment for display options
    const hrefFragment = window.location.hash;
    debug({hrefFragment});
    if (hrefFragment != null) {
        _.merge(displayOptions, getDisplayOptionsFromUrlFragment(hrefFragment));
    }

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
        displayOptions,
    });

    await eczCodeGraph.initialize();

    // expose eczCodeGraph to the JS console for debugging
    window.eczCodeGraph = eczCodeGraph;

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
                    onLayoutDone: () => resolve(),
                },
                null
            )
        );
    } );
    await pFirstRenderLayoutPromise;

    debug('Layout done.');
});

