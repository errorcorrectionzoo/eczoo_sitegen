
import { SearchIndex } from '@phfaist/zoodb/search/searchindex';
import { SearchWidget } from '@phfaist/zoodb/search/searchwidget';

import { zoo_object_permalink } from '@errorcorrectionzoo/eczoodb/permalinks.js';


window.addEventListener('load', async () => {

    const dom_container = window.document.getElementById('EczooSearchWidget');

    const search_index_url = dom_container.dataset.searchIndexUrl;

    // download the search data
    console.log("Downloading the search data...");
    const response = await fetch(search_index_url);
    const search_index_data = await response.json();
    const search_index = SearchIndex.load(search_index_data);

    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());
    let initial_search_query = params.q ?? null;

    const resolve_href = (object_type, object_id, object_doc) => {
        return zoo_object_permalink(object_type, object_id);
    };

    window.search_widget = new SearchWidget(search_index, {
        dom_container,
        initial_search_query,
        resolve_href,
        context_length: 200,
        getMathJax: () => window.MathJax,
    });
    
});
