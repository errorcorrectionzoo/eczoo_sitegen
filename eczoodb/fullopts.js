import csl_style_json_data from './eczoo-bib-style.json' assert { type: 'json' };

import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_llm_environment } from '@phfaist/zoodb/std/use_llm_environment';
import { use_llm_processor } from '@phfaist/zoodb/std/use_llm_processor';
import { use_searchable_text_processor } from '@phfaist/zoodb/std/use_searchable_text_processor';


export const eczoo_full_options = {

    use_relations_populator,
    use_llm_environment,
    use_llm_processor,
    use_searchable_text_processor,

    llm_options: {
        citations: {
            csl_style: csl_style_json_data.data,
        },
    },
};
