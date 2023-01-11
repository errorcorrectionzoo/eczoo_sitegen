import * as assert from 'assert';

import fs from 'fs';
import path from 'path';

//import { EcZooDb } from '../eczoodbjs.js';
import { load_eczoo } from '../load_yamldb.js';


import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const data_dir = path.join(__dirname, '..', 'test_data');


describe('load_yamldb', function () {

    describe('load_eczoo', function () {

        this.timeout(0);

        it('should successfully load test data for the EC Zoo', async function () {

            const eczoodb = await load_eczoo({data_dir, fs});

        });
    });

});
