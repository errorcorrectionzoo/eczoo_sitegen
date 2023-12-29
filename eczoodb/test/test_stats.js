import * as assert from 'assert';

import fs from 'fs';
import path from 'path';

import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const data_dir = path.join(__dirname, '..', 'test_data');


import { load_eczoo_cached } from './_loadeczoodb.js';

// import { zoo_generate_stats } from '../stats.js';



describe('stats', async function () {

    console.log('loading zoo!');
    const eczoodb = await load_eczoo_cached({
        eczoodb_options: {
            flm_allow_unresolved_citations: true,
            flm_allow_unresolved_references: true,
        }
    });


    it.skip('can generate some stats', function () {

        // ... TODO ...

    })

});
