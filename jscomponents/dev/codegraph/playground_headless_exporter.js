import debugm from 'debug'; const debug = debugm('ecz_playground_headless_exporter');

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_flm_environment } from '@phfaist/zoodb/std/use_flm_environment';

import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';

import {
    EczCodeGraph,
    EczCodeGraphViewController
 } from '@errorcorrectionzoo/jscomponents/codegraph/index.js';

import { exportCodeGraphToSvg } from '../../codegraph/headlessGraphExporter.js';


import eczoodbData from './eczoodata.json' assert { type: 'json' };

const displayOptions = {
    displayMode: 'isolate-nodes',
    modeIsolateNodesOptions: {
        nodeIds: [
            'k_oscillators',
        ],
        range: {
            parents: {
                primary: 5,
                secondary: 3,
                extra: 0,
            },
            children: {
                primary: 2,
                secondary: 2,
                extra: 0,
            },
        },
    },
    highlightImportantNodes: {
        highlightImportantNodes: false,
        highlightPrimaryParents: false,
        highlightRootConnectingEdges: false,
    },
};

// --------------------------------------------------------


let eczoodbRefsData = eczoodbData.refs_data;

debug(`Setting up eczoodb ...`);

let eczoodbOpts = {
    use_relations_populator,

    // In the future, maybe use ecz stats processor? currently it's not needed.

    use_flm_environment,
    use_flm_processor: false,

    // allow unresolved refs because e.g. a code description might contain a
    // reference to an equation/figure somewhere else on the code page
    // itself (and hence not listed in the global refs database)
    flm_options: {
        allow_unresolved_references: true,
    },

    use_searchable_text_processor: false,

    fs: null,
    // flm_processor_graphics_resources_fs_data_dir: data_dir,    
    // flm_processor_citations_override_arxiv_dois_file:
    //     path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
    // flm_processor_citations_preset_bibliography_files: [
    //     path.join(data_dir, 'code_extra', 'bib_preset.yml'),
    // ],

    continue_with_errors: true,
};

let eczoodb = await createEcZooDb(eczoodbOpts, { use_schemas_loader: false });

debug(`Created eczoodb, loading refs & citations ...`);

//
// load refs & citations
//
eczoodb.zoo_flm_environment.ref_resolver.load_database(
    eczoodbRefsData.refs
);
eczoodb.zoo_flm_environment.citations_provider.load_database(
    eczoodbRefsData.citations
);

debug(`Loaded refs & citations, loading data ...`);

//
// load zoo data
//
await eczoodb.load_data(eczoodbData.db);


debug(`Setting up code graph web app ...`);


// --------------------------------------------------------


let eczCodeGraph = new EczCodeGraph({
    eczoodb,
});

await eczCodeGraph.initialize();

let eczCodeGraphViewController = new EczCodeGraphViewController(eczCodeGraph, displayOptions);

await eczCodeGraphViewController.initialize();

//await eczCodeGraph.updateLayout({ animate: false });

// now, export to SVG:

let svgData = await exportCodeGraphToSvg(
    eczCodeGraph,
    {
        fitWidth: 620,
    }
);
debug(`Got SVG data: "${svgData.slice(0,100)}..."`);

import fs from 'fs';
fs.writeFileSync('./tmp_plygrd_headless_output.svg', svgData);

import child_process from 'child_process';
child_process.spawn(
    '/opt/homebrew/bin/convert',
    ['tmp_plygrd_headless_output.svg', 'tmp_plygrd_headless_output.png'],
);