
import { SearchIndex } from '@phfaist/zoodbtools_search/searchindex';
import { SearchWidget } from '@phfaist/zoodbtools_search/searchwidget';
import { getLunrCustomOptionsAdvancedSetup } from '@phfaist/zoodbtools_search/lunradvancedsetup';

import { lunrAdvancedOptions } from './configuresearchindex.js';

import { zoo_object_permalink } from '@errorcorrectionzoo/eczoodb/permalinks.js';


export async function load()
{
    const dom_container = window.document.getElementById('EczooSearchWidget');

    const search_index_url = dom_container.dataset.searchIndexUrl;

    const indexLunrCustomOptions = getLunrCustomOptionsAdvancedSetup(lunrAdvancedOptions);

    // download the search data
    console.log("Downloading the search data...");
    const response = await window.fetch(search_index_url);
    const search_index_data = await response.json();
    const search_index = SearchIndex.load(search_index_data, indexLunrCustomOptions);

    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());
    let initial_search_query = params.q ?? null;

    const resolve_href = (object_type, object_id, object_doc_) => {
        return zoo_object_permalink(object_type, object_id);
    };

    window.search_widget = new SearchWidget(search_index, {
        dom_container,
        initial_search_query,
        resolve_href,
        context_length: 200,
        getMathJax: () => window.MathJax,
    });
    
}
