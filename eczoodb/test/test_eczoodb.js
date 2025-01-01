import debug_module from 'debug';
const debug = debug_module('eczoo_sitegen.eczoodb.test_eczoodb');

import * as assert from 'assert';

import { load_eczoo } from './_loadeczoodb.js';

//import fs from 'fs';
//import path from 'path';


describe('EcZooDb', async function () {

    this.timeout(0);

    describe('#code_is_descendant_of', function () {

        it('should find that the CSS code is descendant of the stabilier code', async function () {
            
            const eczoodb = await load_eczoo();

            assert.ok(
                eczoodb.code_is_descendant_of(eczoodb.objects.code.css, 'stabilizer')
            );

        });

    });

    describe('#code_get_family_tree', function () {

        it('finds children of the CSS code', async function() {

            const eczoodb = await load_eczoo();

            let css_family_tree = eczoodb.code_get_family_tree( eczoodb.objects.code.css );
            let css_family_tree_ids = css_family_tree.map( (c) => c.code_id );
            css_family_tree_ids.sort();

            assert.deepStrictEqual(
                css_family_tree_ids,
                ['css', 'surface', ]
            );
        });

        it('finds children of the binary_linear incl. as secondary parent relationship', async function() {
            const eczoodb = await load_eczoo();

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
        
        it('finds children of the binary_linear w/ only primary parent relationship', async function() {

            const eczoodb = await load_eczoo();

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


    describe('#code_parent_kingdoms', function () {

        it('identifies correct parent kingdom(s) of codes', async function () {
            
            const eczoodb = await load_eczoo();

            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.css,
                ).map( d => d.kingdom_id ),
                ['qubits_into_qubits']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.css, {
                        find_kingdom_id: 'qubits_into_qubits',
                    }
                ).map( d => d.kingdom_id ),
                ['qubits_into_qubits']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.binary_linear,
                ).map( d => d.kingdom_id ),
                ['bits_into_bits']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.binary_linear, {
                        find_kingdom_id: 'bits_into_bits',
                    }
                ).map( d => d.kingdom_id ),
                ['bits_into_bits']
            );
        });
        it('identifies correct primary parent kingdom of codes', async function () {

            const eczoodb = await load_eczoo();

            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.css, {
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.kingdom_id ),
                ['qubits_into_qubits']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.css, {
                        find_kingdom_id: 'qubits_into_qubits',
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.kingdom_id ),
                ['qubits_into_qubits']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.binary_linear, {
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.kingdom_id ),
                ['bits_into_bits']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_kingdoms(
                    eczoodb.objects.code.binary_linear, {
                        find_kingdom_id: 'bits_into_bits',
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.kingdom_id ),
                ['bits_into_bits']
            );
        });
    });

    describe('#code_parent_domain', function () {

        it('identifies correct parent domain(s) of codes', async function () {
            
            const eczoodb = await load_eczoo();

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.css,
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.css, {
                        find_domain_id: 'quantum_domain',
                    }
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.binary_linear,
                ).map( d => d.domain_id ).sort(),
                // quantum is found via classical_code -> quantum_code secondary parent rel
                ['classical_domain', 'quantum_domain'].sort()
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.binary_linear, {
                        find_domain_id: 'classical_domain',
                    }
                ).map( d => d.domain_id ),
                ['classical_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.quantum_into_quantum,
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.quantum_into_quantum, {
                        find_domain_id: 'quantum_domain',
                    }
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.ecc,
                ).map( d => d.domain_id ).sort(),
                ['quantum_domain', 'classical_domain'].sort()
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.ecc, {
                        find_domain_id: 'classical_domain',
                    }
                ).map( d => d.domain_id ),
                ['classical_domain']
            );
        });
        it('identifies correct primary parent domain of codes', async function () {

            const eczoodb = await load_eczoo();

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.css, {
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.css, {
                        find_domain_id: 'quantum_domain',
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.binary_linear, {
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.domain_id ),
                ['classical_domain']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.binary_linear, {
                        find_domain_id: 'classical_domain',
                        only_primary_parent_relation: true,
                    }
                ).map( d => d.domain_id ),
                ['classical_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.quantum_into_quantum,
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.quantum_into_quantum, {
                        find_domain_id: 'quantum_domain',
                    }
                ).map( d => d.domain_id ),
                ['quantum_domain']
            );

            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.ecc,
                ).map( d => d.domain_id ).sort(),
                ['quantum_domain', 'classical_domain'].sort()
            );
            assert.deepStrictEqual(
                eczoodb.code_parent_domains(
                    eczoodb.objects.code.ecc, {
                        find_domain_id: 'classical_domain',
                    }
                ).map( d => d.domain_id ),
                ['classical_domain']
            );
        });

    });

    describe('#code_is_property_code', async function () {
        it('identifies which codes are property codes', async function () {

            const eczoodb = await load_eczoo();

            assert.strictEqual(
                eczoodb.code_is_property_code(eczoodb.objects.code.css),
                false
            );

            assert.strictEqual(
                eczoodb.code_is_property_code(eczoodb.objects.code.binary_linear),
                false
            );

            assert.strictEqual(
                eczoodb.code_is_property_code(eczoodb.objects.code.testcode),
                false
            );

            assert.strictEqual(
                eczoodb.code_is_property_code(eczoodb.objects.code.quantum_into_quantum),
                true
            );

            assert.strictEqual(
                eczoodb.code_is_property_code(eczoodb.objects.code.abstr),
                true
            );
        });
    });

    it('should have correct computed property values', async function () {

        const eczoodb = await load_eczoo();

        debug(`about to call eczoodb.code_short_name...`);
        const short_name = eczoodb.code_short_name(eczoodb.objects.code.css);
        debug(`done! short_name=`, {short_name});
        
        assert.strictEqual(
            short_name.flm_text,
            'Calderbank-Shor-Steane (CSS) stabilizer'
        )

    });

});
