import csl_style_json_data from './eczoo-bib-style.json' assert { type: 'json' };

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_gitlastmodified_processor } from '@phfaist/zoodb/std/use_gitlastmodified_processor';
import { use_flm_environment } from '@phfaist/zoodb/std/use_flm_environment';
import { use_flm_processor } from '@phfaist/zoodb/std/use_flm_processor';
import { use_searchable_text_processor } from '@phfaist/zoodb/std/use_searchable_text_processor';


export const eczoo_full_options = {

    use_relations_populator,
    use_gitlastmodified_processor,
    use_flm_environment,
    use_flm_processor,
    use_searchable_text_processor,

    flm_options: {
        citations: {
            csl_style: csl_style_json_data.data,
        },
    },

};
