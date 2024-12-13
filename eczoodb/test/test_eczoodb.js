import * as assert from 'assert';

import { load_eczoo_cached } from './_loadeczoodb.js';

//import fs from 'fs';
//import path from 'path';



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

        it('finds children of the binary_linear incl. as secondary parent relationship', function() {

            let binary_linear_family_tree = eczoodb.code_get_family_tree(
                eczoodb.objects.code.binary_linear,
            );
            let binary_linear_family_tree_ids = binary_linear_family_tree.map( (c) => c.code_id );
            binary_linear_family_tree_ids.sort();

            assert.deepStrictEqual(
                binary_linear_family_tree_ids,
                [ 'binary_linear', 'testcode', ]
            );

        });
        
        it('finds children of the binary_linear w/ only primary parent relationship', function() {

            let binary_linear_family_tree = eczoodb.code_get_family_tree(
                eczoodb.objects.code.binary_linear,
                { only_primary_parent_relation: true }
            );
            let binary_linear_family_tree_ids = binary_linear_family_tree.map( (c) => c.code_id );
            binary_linear_family_tree_ids.sort();

            assert.deepStrictEqual(
                binary_linear_family_tree_ids,
                [ 'binary_linear', ]
            );
        });

    });

    it('should have corrected computed property values', function () {
        
        assert.strictEqual(
            eczoodb.code_short_name(eczoodb.objects.code.css),
            'Calderbank-Shor-Steane (CSS) stabilizer'
        )

    });

});
