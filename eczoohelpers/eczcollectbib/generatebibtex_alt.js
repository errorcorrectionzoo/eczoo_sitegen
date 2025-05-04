
import '@citation-js/plugin-bibtex';

import { plugins } from '@citation-js/core';

//
// prevent escaping of unicode and existing commands
//

function _clearObject(object)
{
    Object.keys(object).forEach(key => {
        delete object[key];
    });
}

const config = plugins.config.get('@bibtex');
_clearObject(config.constants.diacritics);
_clearObject(config.constants.commands);
_clearObject(config.constants.ligatures);
config.constants.ligaturePattern = /^[]/g; // RegExp that never matches.
_clearObject(config.constants.mathScripts);


export function generateBibtex(bib_db, { filterByEntry }={})
{
    let bibtex_entries = [];

    for (const bibentry of Object.values(bib_db)) {
        if (filterByEntry != null && !filterByEntry(bibentry)) {
            continue;
        }
        bibtex_entries.push( bibentry.cite_instance.format('bibtex') );
    }

    return bibtex_entries;
}
