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
                flm_allow_unresolved_citations: true,
                flm_allow_unresolved_references: true,
            }
        });
        const zoo_flm_environment = eczoodb.zoo_flm_environment;

        const result_css_html = render_code_page(
            eczoodb.objects.code.css,
            {
                zoo_flm_environment,
                doc_metadata: {},
                eczoodb,
            }
        );

        assert.ok(result_css_html.startsWith('<div'));
        
    });
});
