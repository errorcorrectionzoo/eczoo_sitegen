import debug_mod from 'debug';
const debug = debug_mod('eczoodbjs.try_load_zoo');

import process from 'node:process';
import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

import readlinePromises from 'readline/promises';

import _ from 'lodash';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { zoo_permalinks } from '@errorcorrectionzoo/eczoodb/permalinks.js';

import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';


Error.stackTraceLimit = 999;


const eczoo_sitegen_dir = path.join(__dirname, '..', '..');
const eczoo_root_dir = path.join(eczoo_sitegen_dir, '..');


async function runmain({
    dataDir,
    wait,
} = {})
{
    debug(`runmain(), dataDir=${dataDir}`);

    dataDir ??= path.join(eczoo_root_dir, 'eczoo_data');

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
                    `_figpdf/${graphics_resource.src_url}`
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

    // Zoo is loaded.  ...
    if (wait) {
        const rl = readlinePromises.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const answer_ = await rl.question('Type ENTER to exit.');
        // ignore answer
    }

    debug("Done!");
}



import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main()
{
    const args = yargs(hideBin(process.argv))
        .scriptName('@errorcorrectionzoo/scripts/try_load_zoo')
        .usage('Usage: $0 [options] code_id [code_id ...]')
        .options({
            'data-dir': {
                alias: 'd',
                default: null,
                describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
            },
            'wait': {
                default: false,
                type: 'boolean',
                describe: "Pause after loading the zoo and wait for user input",
            }
        })
        .strictOptions()
        .argv
    ;

    await runmain(args);
}

await main();
