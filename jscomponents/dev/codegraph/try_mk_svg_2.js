import fs from 'fs';

import { EczCodeGraph } from '../../codegraph/index.js';

import { use_relations_populator } from '@errorcorrectionzoo/eczoodb/use_relations_populator.js';
import { use_flm_environment } from '@errorcorrectionzoo/eczoodb/use_flm_environment.js';
import { EcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';

import eczoodbRefsData from './eczoodata_allrefs_test.json' with { type: 'json' };
import eczoodbData from './eczoodata_full_test.json' with { type: 'json' };


import { exportCodeGraphToSvg } from '../../codegraph/headlessGraphExporter.js';



let eczoodbOpts = {
    use_relations_populator,

    use_flm_environment,
    use_flm_processor: false,

    // allow unresolved refs because e.g. a code description might contain a
    // reference to an equation/figure somewhere else on the code page
    // itself (and hence not listed in the global refs database)
    flm_allow_unresolved_references: true,

    use_searchable_text_processor: false,

    fs: null,
    // flm_processor_graphics_resources_fs_data_dir: data_dir,    
    // flm_processor_citations_override_arxiv_dois_file:
    //     path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
    // flm_processor_citations_preset_bibliography_files: [
    //     path.join(data_dir, 'code_extra', 'bib_preset.yml'),
    // ],
};

let eczoodb = new EcZooDb(eczoodbOpts);

//
// load zoo data
//
await eczoodb.load_data(eczoodbData.db);


const displayOptions = {
    displayMode: 'isolate-nodes',
    modeIsolateNodesOptions: {
        nodeIds: [ EczCodeGraph.getNodeIdCode('qubits_into_qubits') ],
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


let eczCodeGraph = new EczCodeGraph({
    eczoodb,
    displayOptions,
});

await eczCodeGraph.initialize();

await eczCodeGraph.layout({ animate: false });


// now, export to SVG:

const svgData = await exportCodeGraphToSvg(eczCodeGraph, {
    cyStyleJsonOptions: {
        fontFamily: 'Source Sans Pro',
        fontSize: '20px',
    },
});

fs.writeFileSync('./output2-new-svg.svg', svgData);
