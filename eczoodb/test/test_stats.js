import * as assert from 'assert';

import fs from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

const data_dir = path.join(__dirname, '..', 'test_data');


import { load_eczoo } from './_loadeczoodb.js';

// import { zoo_generate_stats } from '../stats.js';



describe('stats', function () {

    this.timeout(0);

    it.skip('can generate some stats', async function () {

        console.log('loading zoo!');
        const eczoodb = await load_eczoo({
            eczoodb_options: {
                flm_allow_unresolved_citations: true,
                flm_allow_unresolved_references: true,
            }
        });
    
        // ... TODO ...

    })

});
