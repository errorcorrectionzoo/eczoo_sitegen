import csl_style_json_data from './eczoo-bib-style.json' assert { type: 'json' };

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_gitlastmodified_processor } from '@phfaist/zoodb/std/use_gitlastmodified_processor';
import { use_flm_environment } from '@phfaist/zoodb/std/use_flm_environment';
import { use_flm_processor } from '@phfaist/zoodb/std/use_flm_processor';
import { use_searchable_text_processor } from '@phfaist/zoodb/std/use_searchable_text_processor';

//
// Note: "full options" includes options that require filesystem access and/or
// possibility for spawning processes, so are not browser-compatible.
//


import path from 'path';

import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import process from 'process';

export const citationsinfo_cache_dir_default =
    path.join(
        __dirname,
        '..',
        (process.env.ECZOO_CITATIONS_CACHE_DIR ?? '_zoodb_citations_cache')
    );


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
