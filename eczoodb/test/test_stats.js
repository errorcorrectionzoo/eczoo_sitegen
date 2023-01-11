import * as assert from 'assert';

import fs from 'fs';
import path from 'path';

import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const data_dir = path.join(__dirname, '..', 'test_data');


import { load_eczoo_cached } from '../load_yamldb.js';

import { zoo_generate_stats } from '../stats.js';



describe('stats', async function () {

    console.log('loading zoo!');
    const eczoodb = await load_eczoo({
        data_dir,
        fs,
        eczoodb_options: {
            llm_allow_unresolved_citations: true,
            llm_allow_unresolved_references: true,
        }
    });


    it('can generate some stats', function () {

        const zoo_stats = zoo_generate_stats( {
            eczoodb,
            stats: [
                ['total_num_codes', {label: 'code entries'}],
                ['total_num_kingdoms', {label: 'kingdoms'}],
                ['total_num_domains', {label: 'domains'}],
                ['code_familyhead_ids_and_codetypes', { spec_list: [
                    [['ecc', 'classical_into_quantum'], 'classical codes'],
                    [['quantum_into_quantum'], 'quantum codes'],
                    [['topological'], 'topological codes'],
                    [['css'], 'CSS codes'],
                    [['qldpc'],'quantum LDPC codes'],
                    [['oscillators'], 'bosonic codes'],
                ]} ],
            ]
        } );

    })

});
