import path from 'path';

import csl_style_json_data from './eczoo-bib-style.js';

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_gitlastmodified_processor } from '@phfaist/zoodb/std/use_gitlastmodified_processor';
import { use_flm_environment } from '@phfaist/zoodb/std/use_flm_environment';
import { use_flm_processor } from '@phfaist/zoodb/std/use_flm_processor';
import { use_searchable_text_processor } from '@phfaist/zoodb/std/use_searchable_text_processor';

//
// Note: "full options" includes options that require filesystem access and/or
// possibility for spawning processes, so are not browser-compatible.
//

import { citationsinfo_cache_dir_default } from './dirs_defaults.js';
export { citationsinfo_cache_dir_default };


export function get_eczoo_full_options({csl_style_data, citationsinfo_cache_dir}={}) {

    csl_style_data ??= csl_style_json_data.data;

    citationsinfo_cache_dir ??= citationsinfo_cache_dir_default;

    // console.log('cache file dir = ', citationsinfo_cache_dir);

    return {
        use_relations_populator,
        use_gitlastmodified_processor,
        use_flm_environment,
        use_flm_processor,
        use_searchable_text_processor,

        flm_options: {
            citations: {
                csl_style: csl_style_data,
                cache_dir: citationsinfo_cache_dir,
            },
        },
    };
};
