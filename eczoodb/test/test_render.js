import * as assert from 'assert';


import fs from 'fs';
import path from 'path';


import * as zooflm from '@phfaist/zoodb/zooflm';
const { $$kw, repr } = zooflm;


import { load_eczoo_cached } from './_loadeczoodb.js';

//import { mkutils } from '../render_utils.js';

import { render_code_page } from '../render_code.js';
import { render_codelist_page } from '../render_codelist.js';


import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const data_dir = path.join(__dirname, '..', 'test_data');



const eczoodb = await load_eczoo_cached({
    data_dir,
    fs,
    eczoodb_options: {
        flm_allow_unresolved_citations: true,
        flm_allow_unresolved_references: true,
    }
});

const zoo_flm_environment = eczoodb.zoo_flm_environment;


describe('render_code', function () {

    it('should return HTML code starting with <div … >', async function () {

        const result_css_html = render_code_page(
            eczoodb.objects.code.css,
            {
                zoo_flm_environment,
                doc_metadata: {},
            }
        );

        assert.ok(result_css_html.startsWith('<div'));
        
    });
});



describe('render_codelist', function () {

    it('should return HTML code starting with <article … >', async function () {

        const result_all_html = render_codelist_page(
            eczoodb.objects.codelist.all,
            {
                eczoodb,
                doc_metadata: {},
            }
        );

        assert.ok(result_all_html.startsWith('<article'));
        
    });
});
