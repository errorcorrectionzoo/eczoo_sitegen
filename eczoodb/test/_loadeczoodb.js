import fs from 'fs';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '../eczoodb.js';
import { get_eczoo_full_options } from '../fullopts.js';
import { createEcZooYamlDbDataLoader } from '../load_yamldb.js';


import path from 'path';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

const data_dir = path.join(__dirname, '..', 'test_data');




export async function load_eczoo_cached({ eczoodb_options }={})
{
    let eczoodb = await createEcZooDb({
        fs,
        fs_data_dir: data_dir,
        ... get_eczoo_full_options({
            citationsinfo_cache_dir: '_TEST_zoodb_citations_cache',
        }),
        ... (eczoodb_options ?? {}),
    });
    let loader = await createEcZooYamlDbDataLoader(eczoodb);
    await eczoodb.install_zoo_loader_handler(
        new ZooDbDataLoaderHandler( loader )
    );

    await eczoodb.load();

    return eczoodb;
}


/*

// thanks https://stackoverflow.com/a/35820220/1694896 !
function promiseState(p) {
  const t = {};
  return Promise.race([p, t])
    .then((v) => (v === t) ? "pending" : "fulfilled", () => "rejected");
}


..........................................


let cached_eczoodb = null;

async function load(eczoo_config)
{
    if (cached_eczoodb == null) {
        const fs = await import('fs');

        const { EcZooDb } = await import('@errorcorrectionzoo/eczoodb/eczoodb.js');
        const { get_eczoo_full_options } = await import('@errorcorrectionzoo/eczoodb/fullopts.js');

        const { EcZooDbYamlDataLoader } =
              await import('@errorcorrectionzoo/eczoodb/load_yamldb.js');

        cached_eczoodb = new EcZooDb({
            fs,
            fs_data_dir: eczoo_config.data_dir,
            ... get_eczoo_full_options()
        });
        cached_eczoodb.install_zoo_loader(new EcZooDbYamlDataLoader({ }));
    }

    await cached_eczoodb.load();

    return cached_eczoodb;
};

*/
