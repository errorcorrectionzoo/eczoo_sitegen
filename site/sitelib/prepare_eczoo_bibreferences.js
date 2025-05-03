import debugm from 'debug';
const debug = debugm('eczoo_sitegen.sitelib.prepare_eczoo_bibreferences');

import {
    EczBibReferencesCollector
} from '@errorcorrectionzoo/eczoohelpers_eczcollectbib/collectbib.js';

export function prepareEczooBibReferences(eczoodb)
{
    debug(`prepareEczooBibReferences()`, eczoodb.zoo_flm_processor);
    let c = new EczBibReferencesCollector();
    c.collectFromZooFlmProcessorEncountered({
        zoo_flm_processor: eczoodb.zoo_flm_processor,
        include_compiled_flm: true,
        include_encountered_in: true,
    });
    return c;
}
