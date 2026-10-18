import csl_style_json_data from './eczoo-bib-style.js';

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_gitlastmodified_processor } from '@phfaist/zoodb/std/use_gitlastmodified_processor';
import { use_flm_engine } from '@phfaist/zoodb/std/use_flm_engine';
import { use_flm_processor } from '@phfaist/zoodb/std/use_flm_processor';
import { use_searchable_text_processor } from '@phfaist/zoodb/std/use_searchable_text_processor';

// Loads the WebAssembly module of the FLM engine under Node.  (In a browser,
// the module is fetched instead, so this option is set here, with the other
// options that are not browser-compatible, and not in eczoodb.js.)
import { load_zoodb_flm_wasm_node } from '@phfaist/zoodb/zooflm/wasm-node';

import { EczStatsDbProcessor } from './stats.js';
import { EczPopulateCodeListsDbProcessor } from './compile_codelist.js';

//
// Note: "full options" includes options that require filesystem access and/or
// possibility for spawning processes, so are not browser-compatible.
//

import { citationsinfo_cache_dir_default } from './dirs_defaults.js';
export { citationsinfo_cache_dir_default };


export function get_eczoo_full_options({
    csl_style_data,
    citationsinfo_cache_dir,
    populate_code_lists,
}={}) {

    csl_style_data ??= csl_style_json_data.data;
    citationsinfo_cache_dir ??= citationsinfo_cache_dir_default;
    populate_code_lists ??= true;

    // console.log('cache file dir = ', citationsinfo_cache_dir);

    const ecz_stats_processor = new EczStatsDbProcessor();

    let ecz_codelists_processor = null;
    if (populate_code_lists) {
        ecz_codelists_processor = new EczPopulateCodeListsDbProcessor();
    }

    return {
        use_relations_populator,
        use_gitlastmodified_processor,
        use_flm_engine,
        use_flm_processor,
        use_searchable_text_processor,

        extra_db_processors: {
            stats: {
                priority: 80,
                instance: ecz_stats_processor,
            },
            codelists: {
                priority: 30,
                instance: ecz_codelists_processor,
            },
        },

        flm_options: {
            load_wasm: load_zoodb_flm_wasm_node,
            citations: {
                csl_style: csl_style_data,
                cache_dir: citationsinfo_cache_dir,
            },
            // (The quote environments are a standard feature of the FLM
            // engine, `quote`, enabled by default.)
        },

        custom_zoodb_properties: {
            ecz_stats_processor,
        },
    };
}
