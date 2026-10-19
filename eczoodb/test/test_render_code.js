import * as assert from 'assert';


import fs from 'fs';
import path from 'path';


//import * as zooflm from '@phfaist/zoodb/zooflm';
//const { $$kw, repr } = zooflm;


import { load_eczoo } from './_loadeczoodb.js';

//import { mkutils } from '../render_utils.js';

import { render_code_page } from '../render_code.js';


const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

const data_dir = path.join(__dirname, '..', 'test_data');



describe('render_code', function () {

    this.timeout(0);

    it('should return HTML code starting with <div … >', async function () {

        const eczoodb = await load_eczoo({
            data_dir,
            fs,
            eczoodb_options: {
                flm_options: {
                    allow_unresolved_citations: true,
                    allow_unresolved_references: true,
                },
            }
        });
        const zoo_flm_engine = eczoodb.zoo_flm_engine;

        const result_css = render_code_page(
            eczoodb.objects.code.css,
            {
                zoo_flm_engine,
                eczoodb,
            }
        );

        assert.ok(result_css.html.startsWith('<div'));
        assert.deepStrictEqual(result_css.diagnostics, []);
        
    });
});
