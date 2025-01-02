import * as assert from 'assert';

import fs from 'fs';
import path from 'path';

import { load_eczoo } from './_loadeczoodb.js';

import { render_codelist_page } from '../render_codelist.js';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;

const data_dir = path.join(__dirname, '..', 'test_data');


describe('render_codelist', function () {

    this.timeout(0);

    it('should return HTML code starting with <article … >', async function () {

        const eczoodb = await load_eczoo({
            data_dir,
            fs,
            eczoodb_options: {
                flm_allow_unresolved_citations: true,
                flm_allow_unresolved_references: true,
            }
        });

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
