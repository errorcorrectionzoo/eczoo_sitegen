
import { SearchIndex } from '@phfaist/zoodbtools_search/searchindex';
import { getLunrCustomOptionsAdvancedSetup } from '@phfaist/zoodbtools_search/lunradvancedsetup';

import { lunrAdvancedOptions } from './configuresearchindex.js';

//import { $$kw, ZooTextFragmentRenderer, render_value } from '@phfaist/zoodb/zooflm';


export function generate_search_index({ eczoodb })
{
    //const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const search_index = SearchIndex.create(
        eczoodb,
        eczoodb.searchable_text_fieldset,
        {}
    );

    const indexLunrCustomOptions = getLunrCustomOptionsAdvancedSetup(lunrAdvancedOptions);
    search_index.install_lunr_customization(indexLunrCustomOptions);

    // comment this out to let the client build the index
    //search_index.build();

    return search_index.toJSON();
}
