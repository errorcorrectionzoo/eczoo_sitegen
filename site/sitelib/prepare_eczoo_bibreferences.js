import debugm from 'debug';
const debug = debugm('eczoo_sitegen.sitelib.prepare_eczoo_bibreferences');

import path from 'path';

import {
    EczBibReferencesCollector
} from '@errorcorrectionzoo/eczoohelpers_eczcollectbib/collectbib.js';

export async function prepareEczooBibReferences(eczoodb)
{
    debug(`prepareEczooBibReferences()`);
    let c = new EczBibReferencesCollector();
    c.collectFromZooFlmProcessorEncountered({
        zoo_flm_processor: eczoodb.zoo_flm_processor,
        include_compiled_flm: true,
        include_encountered_in: true,
    });
    await c.processEntries({
        anystyleOptions: {
            cacheFile: path.join(eczoodb.zoo_flm_processor.options.citations.cache_dir,
                                 '_anystyle_manual_citations_cache.json')
        }
    });
    return c;
}
