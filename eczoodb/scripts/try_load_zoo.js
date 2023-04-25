import debug_mod from 'debug';
const debug = debug_mod('eczoodbjs.try_load_zoo');

import fs from 'fs';
import path from 'path';

import { EcZooDb, load_eczoo } from '../eczoodbjs.js';


import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function run({data_dir})
{
    debug(`run(), data_dir=${data_dir}`);

    const eczoo = new EcZooDb({
        fs,
        flm_processor_graphics_resources_fs_data_dir: data_dir,    
        flm_processor_citations_override_arxiv_dois_file:
            path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
        flm_processor_citations_preset_bibliography_files: [
            path.join(data_dir, 'code_extra', 'bib_preset.yml'),
        ],
    });

    eczoo.load_yamldb({
        data_dir,
    });
};



async function run2({data_dir})
{
    debug(`run2(), data_dir=${data_dir}`);

    const eczoodb = await load_eczoo({data_dir, fs});

    debug('by the way, eczoodb.objects.domain=', eczoodb.objects.domain);

    debug('by the way, eczoodb.objects.domain.quantum_domain.kingdoms=',
          eczoodb.objects.domain.quantum_domain.kingdoms);

    debug('by the way, eczoodb.code_short_name(eczoodb.objects.code.css)=',
          eczoodb.code_short_name(eczoodb.objects.code.css));


};


const data_dir = path.join(__dirname, '..', 'test_data');
//const data_dir = path.join(__dirname, '..', '..', 'eczoo_data');

//await run({ data_dir, });
await run2({ data_dir, });
