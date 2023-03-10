import * as assert from 'assert';

import { load_eczoo_cached } from './_loadeczoodb.js';

import fs from 'fs';
import path from 'path';



const eczoodb = await load_eczoo_cached();


describe('EcZooDb', function () {

    this.timeout(0);

    describe('#code_is_descendant_of', function () {

        it('should find that the CSS code is descendant of the stabilier code', function () {
            
            assert.ok(
                eczoodb.code_is_descendant_of(eczoodb.objects.code.css, 'stabilizer')
            );

        });

    });

    describe('#code_get_family_tree', function () {

        it('finds children of the CSS code', function() {

            let css_family_tree = eczoodb.code_get_family_tree( eczoodb.objects.code.css );
            let css_family_tree_ids = css_family_tree.map( (c) => c.code_id );
            css_family_tree_ids.sort();

            assert.deepStrictEqual(
                css_family_tree_ids,
                ['css', 'surface', ]
            );
        });

    });

});
