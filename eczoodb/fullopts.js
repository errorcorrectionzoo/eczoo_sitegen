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



const citationsinfo_cache_file =
      path.join(__dirname, '..', 'downloaded_citationinfo_cache.json');

console.log('cache file name = ', citationsinfo_cache_file);

export const eczoo_full_options = {

    use_relations_populator,
    use_gitlastmodified_processor,
    use_flm_environment,
    use_flm_processor,
    use_searchable_text_processor,

    flm_options: {
        citations: {
            csl_style: csl_style_json_data.data,
            cache_file: citationsinfo_cache_file,
        },
    },

};
