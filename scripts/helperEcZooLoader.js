import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.helperEcZooLoader');

import fs from 'fs';
import path from 'path';

import _ from 'lodash';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { zoo_permalinks } from '@errorcorrectionzoo/eczoodb/permalinks.js';

import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



export async function loadEcZoo({ dataDir, } = {})
{
    debug(`loadEcZoo(), dataDir=${dataDir}`);

    dataDir ??= path.join(__dirname, '..', '..', 'eczoo_data');

    debug(`Using dataDir=‘${dataDir}’`);

    const eczoodbopts = _.merge(
        {
            fs,
            fs_data_dir: dataDir,
        },
        get_eczoo_full_options({
            citationsinfo_cache_dir: path.join(__dirname, '..', '_zoodb_citations_cache'),
        }),
        {
            flm_options: {
                resources: {
                    rename_figure_template:
                        (f) =>  `fig-${f.b32hash(24)}.pdf`,
                },
            },
            zoo_permalinks: {
                object: (object_type, object_id) => {
                    return 'https://errorcorrectionzoo.org'
                        + zoo_permalinks.object(object_type, object_id);
                },
                graphics_resource: (graphics_resource) =>
                    `__abstract_fig_reference__/${graphics_resource.src_url}`
            },
        },
    );

    let eczoodb = await createEcZooDb(eczoodbopts);
    const yaml_loader = await createEcZooYamlDbDataLoader(eczoodb);
    const loader_handler = new ZooDbDataLoaderHandler(
        yaml_loader,
        {
            throw_reload_errors: false, // for when in devel mode with eleventy
        }
    );

    await eczoodb.install_zoo_loader_handler(loader_handler);
    
    await eczoodb.load();

    return eczoodb;
}