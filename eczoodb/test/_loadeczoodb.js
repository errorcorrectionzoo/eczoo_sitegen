import fs from 'fs';

import { EcZooDb } from '../eczoodb.js';
import { get_eczoo_full_options } from '../fullopts.js';
import { EcZooDbYamlDataLoader } from '../load_yamldb.js';


import {fileURLToPath} from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data_dir = path.join(__dirname, '..', 'test_data');




export async function load_eczoo_cached({ eczoodb_options }={})
{
    let eczoodb = new EcZooDb({
        fs,
        fs_data_dir: data_dir,
        ... get_eczoo_full_options(),
        ... (eczoodb_options ?? {}),
    });
    eczoodb.install_zoo_loader(new EcZooDbYamlDataLoader({ }));

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
