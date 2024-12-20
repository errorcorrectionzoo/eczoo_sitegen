import fs from 'fs';

import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';

import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';



let cached_eczoodb = null;


function get_error_string(err)
{
    let errstr = null;
    try {
        if (err && err.__class__ != null) {
            if (err.args) {
                errstr = `${err.__class__.__name__}: ${err.args}`;
            } else {
                errstr = `${err.__class__.__name__} (no information)`;
            }
        } else {
            errstr = ''+err;
        }
    } catch (tostrerr) {
        errstr = Object.toString(err);
    }
    return errstr;
}


export async function load_or_reload_eczoodb(eczoo_config)
{
    if (cached_eczoodb == null) {

        try {

            cached_eczoodb = await createEcZooDb({
                fs,
                fs_data_dir: eczoo_config.data_dir,
                ... get_eczoo_full_options({
                    citationsinfo_cache_dir: eczoo_config.citationsinfo_cache_dir
                })
            });
            const loader = await createEcZooYamlDbDataLoader(cached_eczoodb);

            const loader_handler = new ZooDbDataLoaderHandler(
                loader,
                {
                    throw_reload_errors: false, // for when in devel mode with eleventy
                }
            );
            await cached_eczoodb.install_zoo_loader_handler(loader_handler);

        } catch (err) {
            console.error(`ERROR INITIALIZING ZOO: ${get_error_string(err)}`);
            console.error(err);
            throw err;
        }
    }

    try {

        await cached_eczoodb.load();

    } catch (err) {
        console.error(`ERROR LOADING ZOO [site/site_data/eczoodb.js]: ${get_error_string(err)}`);
        console.error(err);
        throw err;
    }

    return cached_eczoodb;
};
