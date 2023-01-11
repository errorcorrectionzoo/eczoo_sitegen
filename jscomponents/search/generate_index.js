
import { SearchIndex } from '@phfaist/zoodb/search/searchindex';

import { $$kw, ZooTextFragmentRenderer, render_value } from '@phfaist/zoodb/zoollm';


export function generate_search_index({ eczoodb })
{
    const zoo_llm_environment = eczoodb.zoo_llm_environment;

    const search_index = SearchIndex.create(
        eczoodb,
        eczoodb.searchable_text_fieldset,
        {}
    );

    // comment this out to let the client build the index
    //search_index.build();

    return search_index.toJSON();
}
