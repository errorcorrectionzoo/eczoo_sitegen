import debug_module from 'debug';
const debug = debug_module('eczoo_site.jscomponents.codegraph.setup_eczoodb');


import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_flm_environment } from '@phfaist/zoodb/std/use_flm_environment';

import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';



export async function load_eczoodb_from_data(eczoodbData)
{
    let eczoodbRefsData = eczoodbData.refs_data;

    let eczoodbOpts = {
        use_relations_populator,

        // In the future, maybe use ecz stats processor? currently it's not needed.

        use_flm_environment, // set up a standard FLM environment ...
        use_flm_processor: false, // ... but not the full automatic FLM DB processing

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

    return eczoodb;
}

