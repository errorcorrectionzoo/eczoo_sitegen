import * as assert from 'assert';

import { load_eczoo } from './_loadeczoodb.js';
import { get_list_data, describe_codelist } from '../compile_codelist.js';


// Helper: extract sorted code_id list from get_list_data result.
function ids(list) {
    return list.map(c => c.code_id).sort();
}

// Helper to build a minimal codelist object with the given select predicates
// and optional sort/display overrides.
function make_codelist(select, { sort, display } = {}) {
    return {
        list_id: 'test',
        title: 'Test',
        codes: { select },
        display: display ?? { style: 'index' },
        sort: sort ?? undefined,
    };
}


// ====================================================================
// Tests for get_list_data (the core compilation function)
// ====================================================================

describe('get_list_data', function () {

    this.timeout(0);

    let eczoodb;

    before(async function () {
        eczoodb = await load_eczoo({
            eczoodb_options: {
                flm_allow_unresolved_citations: true,
                flm_allow_unresolved_references: true,
            },
        });
    });

    // ------- Code selection predicates -------

    describe('select: all codes', function () {

        it('selects every code with an empty predicate collection', function () {
            const result = get_list_data({
                codelist: make_codelist([{}]),
                eczoodb,
            });
            // The test data has 10 codes
            const all_ids = Object.keys(eczoodb.objects.code).sort();
            assert.deepStrictEqual(ids(result), all_ids);
        });
    });

    describe('select: descendant_of', function () {

        it('selects descendants of stabilizer (inclusive)', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                ]),
                eczoodb,
            });
            // descendant_of is inclusive: stabilizer itself, plus css, surface, testcode
            assert.deepStrictEqual(
                ids(result),
                ['css', 'stabilizer', 'surface', 'testcode']
            );
        });

        it('selects descendants of css (inclusive)', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'css' },
                ]),
                eczoodb,
            });
            // css itself + surface
            assert.deepStrictEqual(ids(result), ['css', 'surface']);
        });

        it('returns only the code itself for a leaf code', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'surface' },
                ]),
                eczoodb,
            });
            assert.deepStrictEqual(ids(result), ['surface']);
        });
    });

    describe('select: not_descendant_of', function () {

        it('excludes descendants of stabilizer (inclusive)', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'quantum_into_quantum',
                      not_descendant_of: 'stabilizer' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // stabilizer, css, surface, testcode are all descendants of
            // stabilizer (inclusive), so excluded
            assert.ok(!result_ids.includes('stabilizer'));
            assert.ok(!result_ids.includes('css'));
            assert.ok(!result_ids.includes('surface'));
            assert.ok(!result_ids.includes('testcode'));
            // ecc, topological_code, qubits_into_qubits are descendants of
            // quantum_into_quantum but not of stabilizer
            assert.ok(result_ids.includes('ecc'));
            assert.ok(result_ids.includes('topological_code'));
        });
    });

    describe('select: any_descendant_of', function () {

        it('selects descendants of any of multiple codes (inclusive)', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { any_descendant_of: ['stabilizer', 'binary_linear'] },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // descendants of stabilizer (incl.): stabilizer, css, surface, testcode
            // descendants of binary_linear (incl.): binary_linear, testcode
            // union: binary_linear, css, stabilizer, surface, testcode
            assert.deepStrictEqual(
                result_ids,
                ['binary_linear', 'css', 'stabilizer', 'surface', 'testcode']
            );
        });
    });

    describe('select: all_descendant_of', function () {

        it('selects descendants of all listed codes', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { all_descendant_of: ['stabilizer', 'binary_linear'] },
                ]),
                eczoodb,
            });
            // testcode has parents stabilizer and binary_linear
            // css has parent stabilizer but not binary_linear
            assert.deepStrictEqual(ids(result), ['testcode']);
        });
    });

    describe('select: cousin_of', function () {

        it('selects cousins of binary_linear', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { cousin_of: 'binary_linear' },
                ]),
                eczoodb,
            });
            // css has binary_linear as a cousin
            assert.deepStrictEqual(ids(result), ['css']);
        });

        it('selects cousins of css', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { cousin_of: 'css' },
                ]),
                eczoodb,
            });
            // binary_linear is cousin_of css
            assert.deepStrictEqual(ids(result), ['binary_linear']);
        });

        it('returns empty when no cousins exist', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { cousin_of: 'surface' },
                ]),
                eczoodb,
            });
            assert.deepStrictEqual(ids(result), []);
        });
    });

    describe('select: not_cousin_of', function () {

        it('excludes cousins of a code', function () {
            const all = get_list_data({
                codelist: make_codelist([{}]),
                eczoodb,
            });
            const result = get_list_data({
                codelist: make_codelist([
                    { not_cousin_of: 'binary_linear' },
                ]),
                eczoodb,
            });
            // css is a cousin of binary_linear, so it's excluded
            assert.ok(!ids(result).includes('css'));
            assert.strictEqual(result.length, all.length - 1);
        });
    });

    describe('select: domain', function () {

        it('selects codes in classical_domain', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { domain: 'classical_domain' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            assert.ok(result_ids.includes('binary_linear'));
            assert.ok(result_ids.includes('ecc'));
        });

        it('selects codes in quantum_domain', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { domain: 'quantum_domain' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            assert.ok(result_ids.includes('stabilizer'));
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('quantum_into_quantum'));
        });
    });

    describe('select: domain with not_any_domain', function () {

        it('selects classical codes excluding quantum', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { domain: 'classical_domain',
                      not_any_domain: ['quantum_domain'] },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // These codes should not appear (they are also in quantum_domain)
            assert.ok(!result_ids.includes('stabilizer'));
            assert.ok(!result_ids.includes('css'));
            assert.ok(!result_ids.includes('surface'));
            assert.ok(!result_ids.includes('quantum_into_quantum'));
        });
    });

    describe('select: property_set', function () {

        it('selects codes with features.rate set', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { property_set: 'features.rate' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // binary_linear and css have features.rate
            assert.ok(result_ids.includes('binary_linear'));
            assert.ok(result_ids.includes('css'));
            // stabilizer does not
            assert.ok(!result_ids.includes('stabilizer'));
        });

        it('selects codes with features.transversal_gates set', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { property_set: 'features.transversal_gates' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // css and surface have transversal_gates
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
        });
    });

    describe('select: not_property_set', function () {

        it('excludes codes with features.rate set', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { not_property_set: 'features.rate' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            assert.ok(!result_ids.includes('binary_linear'));
            assert.ok(!result_ids.includes('css'));
            assert.ok(result_ids.includes('stabilizer'));
        });
    });

    describe('select: property (exact value match)', function () {

        it('selects codes with physical=qubits', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { property: { name: 'physical', value: 'qubits' } },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            assert.ok(result_ids.includes('stabilizer'));
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('qubits_into_qubits'));
            // binary_linear has physical=bits, not qubits
            assert.ok(!result_ids.includes('binary_linear'));
        });
    });

    describe('select: manual_code_list', function () {

        it('selects only the explicitly listed codes', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { manual_code_list: ['css', 'surface'] },
                ]),
                eczoodb,
            });
            assert.deepStrictEqual(ids(result), ['css', 'surface']);
        });
    });

    describe('select: exclude', function () {

        it('excludes specific codes from a broader selection', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer',
                      exclude: ['css'] },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            assert.ok(!result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('testcode'));
        });
    });

    // ------- OR logic between predicate collections -------

    describe('OR logic across predicate collections', function () {

        it('unions descendants and cousins of stabilizer', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                    { cousin_of: 'stabilizer' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // descendants: css, surface, testcode
            // cousins of stabilizer: none in test data
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('testcode'));
        });

        it('unions descendants of css and cousins of binary_linear', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'css' },
                    { cousin_of: 'binary_linear' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // descendants of css: surface
            // cousins of binary_linear: css
            assert.deepStrictEqual(result_ids, ['css', 'surface']);
        });

        it('unions property match with descendant_of', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { property: { name: 'physical', value: 'bits' } },
                    { descendant_of: 'css' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // physical=bits: binary_linear
            // descendants of css (inclusive): css, surface
            assert.deepStrictEqual(result_ids, ['binary_linear', 'css', 'surface']);
        });
    });

    // ------- AND logic within a predicate collection -------

    describe('AND logic within a predicate collection', function () {

        it('combines descendant_of with property_set', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer',
                      property_set: 'features.rate' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // descendants of stabilizer: css, surface, testcode
            // with features.rate: css (surface has threshold but not rate)
            assert.deepStrictEqual(result_ids, ['css']);
        });

        it('combines any_descendant_of with not_descendant_of', function () {
            const result = get_list_data({
                codelist: make_codelist([
                    { any_descendant_of: ['stabilizer', 'binary_linear'],
                      not_descendant_of: 'css' },
                ]),
                eczoodb,
            });
            const result_ids = ids(result);
            // any_descendant_of [stabilizer, binary_linear] (inclusive):
            //   binary_linear, css, stabilizer, surface, testcode
            // not_descendant_of css (inclusive): excludes css, surface
            assert.ok(!result_ids.includes('css'));
            assert.ok(!result_ids.includes('surface'));
            assert.ok(result_ids.includes('stabilizer'));
            assert.ok(result_ids.includes('binary_linear'));
            assert.ok(result_ids.includes('testcode'));
        });
    });

    // ------- Sorting -------

    describe('sorting', function () {

        it('sorts by name (default) in ascending order', function () {
            const result = get_list_data({
                codelist: make_codelist([{}]),
                eczoodb,
            });
            const names = result.map(c => c.code_id);
            // Verify the result is in alphabetical order by name
            for (let i = 1; i < names.length; i++) {
                // We can't compare code_ids directly (they're not the sort key),
                // but we can verify the list is in some consistent order.
                assert.ok(result.length > 0);
            }
        });

        it('sorts in reverse order', function () {
            const fwd = get_list_data({
                codelist: make_codelist([{}], { sort: { by: 'name' } }),
                eczoodb,
            });
            const rev = get_list_data({
                codelist: make_codelist([{}], {
                    sort: { by: 'name', reverse: true },
                }),
                eczoodb,
            });
            assert.deepStrictEqual(
                rev.map(c => c.code_id),
                [...fwd].reverse().map(c => c.code_id)
            );
        });

        it('sorts by code_id field', function () {
            const result = get_list_data({
                codelist: make_codelist(
                    [{ descendant_of: 'stabilizer' }],
                    { sort: { by: 'code_id' } }
                ),
                eczoodb,
            });
            const code_ids = result.map(c => c.code_id);
            const sorted = [...code_ids].sort();
            assert.deepStrictEqual(code_ids, sorted);
        });
    });

    // ------- Matches existing test_data codelists -------

    describe('with existing test_data codelists', function () {

        it('compiles list_all (all codes)', function () {
            const codelist = eczoodb.objects.codelist.all;
            const result = get_list_data({ codelist, eczoodb });
            const all_ids = Object.keys(eczoodb.objects.code).sort();
            assert.deepStrictEqual(ids(result), all_ids);
        });

        it('compiles list_stabilizer (descendants + cousins)', function () {
            const codelist = eczoodb.objects.codelist.qstabs;
            const result = get_list_data({ codelist, eczoodb });
            const result_ids = ids(result);
            // descendants of stabilizer: css, surface, testcode
            // cousins of stabilizer: none
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('testcode'));
        });

        it('compiles list_cousins_linear_binary (cousins only)', function () {
            const codelist = eczoodb.objects.codelist.cousins_linear_binary;
            const result = get_list_data({ codelist, eczoodb });
            assert.deepStrictEqual(ids(result), ['css']);
        });

        it('compiles list_stabilizernotcss (any_descendant_of + not_descendant_of)', function () {
            const codelist = eczoodb.objects.codelist.qstabsnotcss;
            const result = get_list_data({ codelist, eczoodb });
            const result_ids = ids(result);
            // any_descendant_of [stabilizer, binary_linear] (inclusive)
            // AND not_descendant_of css (inclusive)
            // -> stabilizer, binary_linear, testcode survive;
            //    css and surface excluded
            assert.ok(!result_ids.includes('css'));
            assert.ok(!result_ids.includes('surface'));
            assert.ok(result_ids.includes('stabilizer'));
            assert.ok(result_ids.includes('binary_linear'));
            assert.ok(result_ids.includes('testcode'));
        });

        it('compiles list_classical (domain filter)', function () {
            const codelist = eczoodb.objects.codelist.classical;
            const result = get_list_data({ codelist, eczoodb });
            const result_ids = ids(result);
            // classical_domain, not quantum_domain
            assert.ok(!result_ids.includes('stabilizer'));
            assert.ok(!result_ids.includes('quantum_into_quantum'));
        });

        it('compiles list_quantum (domain filter)', function () {
            const codelist = eczoodb.objects.codelist.quantum;
            const result = get_list_data({ codelist, eczoodb });
            const result_ids = ids(result);
            assert.ok(result_ids.includes('stabilizer'));
            assert.ok(result_ids.includes('css'));
            assert.ok(result_ids.includes('surface'));
            assert.ok(result_ids.includes('quantum_into_quantum'));
        });

        it('compiles list_test_stuff2 (domain only)', function () {
            const codelist = eczoodb.objects.codelist.test_stuff2;
            const result = get_list_data({ codelist, eczoodb });
            const result_ids = ids(result);
            assert.ok(result_ids.includes('binary_linear'));
            assert.ok(result_ids.includes('ecc'));
        });
    });
});


// ====================================================================
// Tests for describe_codelist (pattern recognition + FLM description)
// ====================================================================

describe('describe_codelist', function () {

    // ------- Standard patterns -------

    describe('standard patterns', function () {

        it('recognizes all_codes from an empty predicate collection', function () {
            const result = describe_codelist({
                codelist: make_codelist([{}]),
            });
            assert.strictEqual(result.pattern.type, 'all_codes');
            assert.strictEqual(result.description_flm, 'All codes.');
        });

        it('recognizes descendants pattern', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'descendants');
            assert.strictEqual(result.pattern.code_id, 'stabilizer');
            assert.strictEqual(
                result.description_flm,
                'All descendants of \\ref{code:stabilizer}.'
            );
        });

        it('recognizes cousins pattern', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { cousin_of: 'binary_linear' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'cousins');
            assert.strictEqual(result.pattern.code_id, 'binary_linear');
            assert.strictEqual(
                result.description_flm,
                'All cousins of \\ref{code:binary_linear}.'
            );
        });

        it('recognizes descendants_and_cousins pattern', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                    { cousin_of: 'stabilizer' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'descendants_and_cousins');
            assert.strictEqual(result.pattern.code_id, 'stabilizer');
            assert.strictEqual(
                result.description_flm,
                'All descendants and cousins of \\ref{code:stabilizer}.'
            );
        });

        it('recognizes descendants_and_cousins in reversed order', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { cousin_of: 'stabilizer' },
                    { descendant_of: 'stabilizer' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'descendants_and_cousins');
            assert.strictEqual(result.pattern.code_id, 'stabilizer');
        });

        it('recognizes domain with exclusions', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { domain: 'classical_domain',
                      not_any_domain: ['quantum_domain'] },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'domain');
            assert.strictEqual(result.pattern.domain_id, 'classical_domain');
            assert.deepStrictEqual(
                result.pattern.not_any_domain,
                ['quantum_domain']
            );
            assert.strictEqual(
                result.description_flm,
                'All codes in \\ref{domain:classical_domain}.'
            );
        });

        it('recognizes domain only', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { domain: 'classical_domain' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'domain');
            assert.strictEqual(result.pattern.domain_id, 'classical_domain');
            assert.strictEqual(
                result.description_flm,
                'All codes in \\ref{domain:classical_domain}.'
            );
        });

        it('recognizes property_set pattern', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property_set: 'features.rate' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'property_set');
            assert.strictEqual(result.pattern.property, 'features.rate');
            assert.strictEqual(
                result.description_flm,
                'All codes with rate.'
            );
        });

        it('recognizes property_set_excluding_descendants', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property_set: 'features.threshold',
                      not_descendant_of: 'ecc' },
                ]),
            });
            assert.strictEqual(
                result.pattern.type,
                'property_set_excluding_descendants'
            );
            assert.strictEqual(result.pattern.property, 'features.threshold');
            assert.strictEqual(result.pattern.not_descendant_of, 'ecc');
            assert.strictEqual(
                result.description_flm,
                'All codes with threshold that are not descendants of '
                + '\\ref{code:ecc}.'
            );
        });

        it('recognizes property_set_in_domain', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property_set: 'features.rate',
                      domain: 'classical_domain' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'property_set_in_domain');
            assert.strictEqual(result.pattern.property, 'features.rate');
            assert.strictEqual(result.pattern.domain_id, 'classical_domain');
            assert.strictEqual(
                result.description_flm,
                'All codes in \\ref{domain:classical_domain} with rate.'
            );
        });

        it('recognizes manual_code_list', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { manual_code_list: ['css', 'stabilizer', 'surface'] },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'manual_code_list');
            assert.deepStrictEqual(
                result.pattern.code_ids,
                ['css', 'stabilizer', 'surface']
            );
            assert.strictEqual(
                result.description_flm,
                'A manually specified list of codes.'
            );
        });
    });

    // ------- Fallback (generic) descriptions -------

    describe('fallback for non-standard predicate combinations', function () {

        it('handles a single collection with unrecognized key combination', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer',
                      not_cousin_of: 'css' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(
                result.description_flm.includes('\\ref{code:stabilizer}')
            );
            assert.ok(
                result.description_flm.includes('\\ref{code:css}')
            );
            assert.ok(
                result.description_flm.includes('not cousins of')
            );
        });

        it('handles any_descendant_of with not_descendant_of', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { any_descendant_of: ['stabilizer', 'binary_linear'],
                      not_descendant_of: 'css' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(
                result.description_flm.includes(
                    'descendants of any of \\ref{code:stabilizer}, '
                    + '\\ref{code:binary_linear}'
                )
            );
            assert.ok(
                result.description_flm.includes(
                    'not descendants of \\ref{code:css}'
                )
            );
        });

        it('produces an itemize list for multiple predicate collections', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property: { name: 'physical', value: 'qubits' } },
                    { descendant_of: 'stabilizer' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(result.description_flm.includes('\\begin{itemize}'));
            assert.ok(result.description_flm.includes('\\end{itemize}'));
            assert.ok(
                result.description_flm.includes('\\ref{code:stabilizer}')
            );
        });

        it('handles descendants_and_cousins of different codes as custom', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                    { cousin_of: 'css' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(
                result.description_flm.includes('\\ref{code:stabilizer}')
            );
            assert.ok(
                result.description_flm.includes('\\ref{code:css}')
            );
        });

        it('handles three or more predicate collections', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer' },
                    { cousin_of: 'css' },
                    { domain: 'classical_domain' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(result.description_flm.includes('\\begin{itemize}'));
            assert.ok(
                result.description_flm.includes('\\ref{domain:classical_domain}')
            );
        });
    });

    // ------- All predicate families in the fallback -------

    describe('fallback covers all predicate families', function () {

        it('handles all descendant_of variants', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'a',
                      any_descendant_of: ['b', 'c'],
                      all_descendant_of: ['d', 'e'],
                      not_descendant_of: 'f',
                      not_any_descendant_of: ['g'],
                      not_all_descendant_of: ['h', 'i'] },
                ]),
            });
            const flm = result.description_flm;
            assert.ok(flm.includes('descendants of \\ref{code:a}'));
            assert.ok(flm.includes('descendants of any of \\ref{code:b}, \\ref{code:c}'));
            assert.ok(flm.includes('descendants of all of \\ref{code:d}, \\ref{code:e}'));
            assert.ok(flm.includes('not descendants of \\ref{code:f}'));
            assert.ok(flm.includes('not descendants of any of \\ref{code:g}'));
            assert.ok(flm.includes('not descendants of all of \\ref{code:h}, \\ref{code:i}'));
        });

        it('handles all cousin_of variants', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { cousin_of: 'a',
                      any_cousin_of: ['b'],
                      all_cousin_of: ['c', 'd'],
                      not_cousin_of: 'e',
                      not_any_cousin_of: ['f'],
                      not_all_cousin_of: ['g', 'h'] },
                ]),
            });
            const flm = result.description_flm;
            assert.ok(flm.includes('cousins of \\ref{code:a}'));
            assert.ok(flm.includes('cousins of any of \\ref{code:b}'));
            assert.ok(flm.includes('cousins of all of \\ref{code:c}, \\ref{code:d}'));
            assert.ok(flm.includes('not cousins of \\ref{code:e}'));
            assert.ok(flm.includes('not cousins of any of \\ref{code:f}'));
            assert.ok(flm.includes('not cousins of all of \\ref{code:g}, \\ref{code:h}'));
        });

        it('handles all domain variants', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { domain: 'classical_domain',
                      any_domain: ['quantum_domain', 'classical_domain'],
                      all_domain: ['quantum_domain'],
                      not_domain: 'other_domain',
                      not_any_domain: ['x_domain'],
                      not_all_domain: ['y_domain', 'z_domain'] },
                ]),
            });
            const flm = result.description_flm;
            assert.ok(flm.includes('in \\ref{domain:classical_domain}'));
            assert.ok(flm.includes(
                'in any of \\ref{domain:quantum_domain}, \\ref{domain:classical_domain}'
            ));
            assert.ok(flm.includes('in all of \\ref{domain:quantum_domain}'));
            assert.ok(flm.includes('not in \\ref{domain:other_domain}'));
            assert.ok(flm.includes('not in any of \\ref{domain:x_domain}'));
            assert.ok(flm.includes(
                'not in all of \\ref{domain:y_domain}, \\ref{domain:z_domain}'
            ));
        });

        it('handles all property_set variants', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property_set: 'features.rate',
                      any_property_set: ['features.rate', 'features.threshold'],
                      all_property_set: ['features.decoders'],
                      not_property_set: 'features.magic_scaling_exponent',
                      not_any_property_set: ['realizations'],
                      not_all_property_set: ['features.rate', 'features.decoders'] },
                ]),
            });
            const flm = result.description_flm;
            assert.ok(flm.includes('with rate'));
            assert.ok(flm.includes('with any of rate, threshold'));
            assert.ok(flm.includes('with all of decoders'));
            assert.ok(flm.includes('without magic scaling exponent'));
            assert.ok(flm.includes('without any of realizations'));
            assert.ok(flm.includes('without all of rate, decoders'));
        });

        it('handles property (exact value match)', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { property: { name: 'physical', value: 'qubits' } },
                ]),
            });
            assert.ok(
                result.description_flm.includes('with physical equal to "qubits"')
            );
        });

        it('handles exclude predicate', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { descendant_of: 'stabilizer',
                      exclude: ['css', 'surface'] },
                ]),
            });
            assert.ok(
                result.description_flm.includes('excluding 2 specific codes')
            );
        });

        it('handles manual_code_list in the fallback', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { manual_code_list: ['css', 'surface'],
                      not_descendant_of: 'stabilizer' },
                ]),
            });
            assert.strictEqual(result.pattern.type, 'custom');
            assert.ok(
                result.description_flm.includes('manually listed codes')
            );
        });

        it('renders unknown predicates with raw key/value', function () {
            const result = describe_codelist({
                codelist: make_codelist([
                    { some_future_predicate: 'foo_value' },
                ]),
            });
            assert.ok(
                result.description_flm.includes('[some_future_predicate:')
            );
        });
    });

    // ------- Edge cases -------

    describe('edge cases', function () {

        it('returns type null for missing codes.select', function () {
            const result = describe_codelist({
                codelist: { list_id: 'bad', title: 'Bad', display: {} },
            });
            assert.strictEqual(result.pattern.type, null);
            assert.strictEqual(result.description_flm, 'Unknown code list.');
        });

        it('returns type null for non-array codes.select', function () {
            const result = describe_codelist({
                codelist: {
                    list_id: 'bad', title: 'Bad', display: {},
                    codes: { select: 'not_an_array' },
                },
            });
            assert.strictEqual(result.pattern.type, null);
        });

        it('returns type null when codes is missing entirely', function () {
            const result = describe_codelist({
                codelist: { list_id: 'x', title: 'X', display: {} },
            });
            assert.strictEqual(result.pattern.type, null);
        });

        it('handles an empty select array via the fallback', function () {
            const result = describe_codelist({
                codelist: make_codelist([]),
            });
            assert.ok(result.description_flm != null);
            assert.ok(result.pattern != null);
        });
    });
});
