import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.helpers.helperEcZooLoader');

import process from 'node:process';
import fs from 'fs';
import path from 'path';

import _ from 'lodash';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { zoo_permalinks } from '@errorcorrectionzoo/eczoodb/permalinks.js';

import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

const eczoo_sitegen_dir = path.join(__dirname, '..', '..');


export async function loadEcZoo({
    dataDir,
    useFlmProcessor,
} = {})
{
    debug(`loadEcZoo(), dataDir=${dataDir}`);

    dataDir ??= path.join(eczoo_sitegen_dir, '..', 'eczoo_data');
    useFlmProcessor ??= true;

    // make dataDir an absolute path
    if (!path.isAbsolute(dataDir)) {
        dataDir = path.join(process.cwd(), dataDir);
    }

    debug(`Using dataDir=‘${dataDir}’`);

    let overrideOptions = {};

    if (!useFlmProcessor) {
        overrideOptions.use_flm_processor = false;
    }

    const eczoodbopts = _.merge(
        {
            fs,
            fs_data_dir: dataDir,
        },
        get_eczoo_full_options({
            citationsinfo_cache_dir: path.join(eczoo_sitegen_dir, '_zoodb_citations_cache'),
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
        overrideOptions,
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