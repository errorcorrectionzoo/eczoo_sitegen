import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.compile_codelist");

import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
//const { $$kw, repr } = zooflm;

import { ComputedDataProcessor } from '@phfaist/zoodb/dbprocessor/computeddata';



function run_predicate(predicate_name_raw, predicate_args, code, eczoodb)
{
    let predicate_name = predicate_name_raw;

    if (predicate_name === 'property') {
        const { name, value } = predicate_args;
        return ( getfield(code, name) === value );
    }
    if (predicate_name === 'manual_code_list') {
        return predicate_args.includes(code.code_id);
    }
    if (predicate_name === 'exclude') {
        return ! predicate_args.includes(code.code_id);
    }

    // handle any_*, all_*, not_*, not_any_*, not_all_*
    const apply_not = predicate_name.startsWith('not_');
    let do_apply_not = (result) => result;
    if (apply_not) {
        predicate_name = predicate_name.substring(4);
        do_apply_not = (result) => !result;
    }
    const apply_all = predicate_name.startsWith('all_');
    if (apply_all) {
        predicate_name = predicate_name.substring(4);
    }
    const apply_any = !apply_all && predicate_name.startsWith('any_');
    if (apply_any) {
        predicate_name = predicate_name.substring(4);
    }

    if (predicate_name === 'property_set') {
        if (apply_any) {
            return do_apply_not( predicate_args.some( (arg) => (getfield(code, arg) != null) ) );
        }
        if (apply_all) {
            return do_apply_not( predicate_args.every( (arg) => (getfield(code, arg) != null) ) );
        }
        return do_apply_not( getfield(code, predicate_args) != null );
    }

    if (predicate_name === 'domain') {
        if (apply_any) {
            const domains = eczoodb.code_parent_domains(
                code, {
                    only_primary_parent_relation: true
                }
            );
            const domain_ids = domains.map( (d) => d.domain_id );
            let result = predicate_args.some( (arg) => domain_ids.includes(arg) );
            return do_apply_not( result );
        }
        if (apply_all) {
            const domains = eczoodb.code_parent_domains(
                code, {
                    only_primary_parent_relation: true,
                    // find_domain_id: predicate_args
                }
            );
            const domain_ids = domains.map( (d) => d.domain_id );
            let result = predicate_args.every( (arg) => domain_ids.includes(arg) );
            return do_apply_not( result );
        }
        // apply simple:
        const domains = eczoodb.code_parent_domains(
            code, {
                only_primary_parent_relation: true,
                find_domain_id: predicate_args,
            }
        );
        let result = domains.some( (d) => d.domain_id === predicate_args );
        return do_apply_not( result );
    }

    if (predicate_name === 'descendant_of') {
        if (apply_any) {
            let result = false;
            eczoodb.code_visit_relations(code, {
                relation_properties: ['parents'],
                callback: (code) => {
                    //debug(`any_descendant_of: testing ‘${code.code_id}’ for ${JSON.stringify(predicate_args)}... `);
                    if (predicate_args.includes(code.code_id)) {
                        //debug(`... found!`);
                        result = true;
                        return true;
                    }
                },
            });
            return do_apply_not( result );
        }
        if (apply_all) {
            let missing = [ ... predicate_args ];
            eczoodb.code_visit_relations(code, {
                relation_properties: ['parents'],
                callback: (code) => {
                    const code_id = code.code_id;
                    if (missing.includes(code_id)) {
                        missing = missing.filter( (arg) => arg !== code_id );
                        if (missing.length === 0) {
                            return true;
                        }
                    }
                },
            });
            let result = (missing.length === 0);
            return do_apply_not( result );
        }
        let result = eczoodb.code_is_descendant_of(code, predicate_args);
        return do_apply_not( result );
    }

    if (predicate_name === 'cousin_of') {
        if (apply_any) {
            let result = (
                code.relations?.cousins?.some(
                    (rel_info) => predicate_args.includes(rel_info.code_id)
                )
                || code.relations?.cousin_of?.some(
                    (rel_info) => predicate_args.includes(rel_info.code_id)
                )
            );
            return do_apply_not( result );
        }
        if (apply_all) {
            let missing = [ ... predicate_args ];
            let all_cousins = [
                ... code.relations?.cousins ?? [],
                ... code.relations?.cousin_of ?? []
            ];
            all_cousins.forEach(
                (rel_info) => {
                    const code_id = rel_info.code_id;
                    if (missing.includes(code_id)) {
                        missing = missing.filter( (arg) => arg !== code_id );
                    }
                }
            );
            let result = (missing.length === 0);
            return do_apply_not( result );
        }
        return do_apply_not( eczoodb.code_is_cousin_of(code, predicate_args) );
    }

    throw new Error(`Invalid predicate name: ${predicate_name}`);
}





export function get_list_data({codelist, eczoodb})
{
    // resolve code list, prepare all codes
    const code_select_predicate = (code, predinfo) => {
        //
        // All predicate conditions (the properties of `predinfo`) combine with
        // 'AND'.  Check each one that is specified; if any one does not match,
        // we need to return false.
        //

        for (const [predicate_name_raw, predicate_args] of Object.entries(predinfo)) {

            let predicate_name = predicate_name_raw;

            if (!run_predicate(predicate_name, predicate_args, code, eczoodb)) {
                return false;
            }

        }

        return true;
    };

    const code_select_predicates = (code, predicate_info_list) => {
        for (const predicate_info of predicate_info_list) {
            // the different predicate objects combine with 'OR', so any one
            // that passes will do
            if (code_select_predicate(code, predicate_info)) {
                return true;
            }
        }
        return false;
    };

    
    let list_of_codes = Object.values(eczoodb.objects.code).filter(
        (code) => code_select_predicates(code, codelist.codes.select)
    );

    const sort_by = codelist.sort?.by ?? 'name';
    const sort_reverse = codelist.sort?.reverse ?? false;
    const sort_case_sensitive = codelist.sort?.case_sensitive ?? false;
    const sort_parents_before_children = codelist.sort?.parents_before_children ?? false;

    const text_fragment_renderer = new zooflm.ZooTextFragmentRenderer;

    const normalize_sort_value = (value) => {
        if (typeof value === 'object' && 'render_standalone' in value) { // e.g., flmfragment
            return value.render_standalone(text_fragment_renderer)
        }
        let nvalue = ''+value;
        if (!sort_case_sensitive) {
            return nvalue.toLowerCase();
        }
        return nvalue;
    };

    const sort_keys = Object.fromEntries(
        list_of_codes.map(
            (code) => [code.code_id, normalize_sort_value( getfield(code, sort_by) )]
        )
    );

    const cmp = sort_reverse
          ? (astr, bstr) => ( (astr === bstr) ? 0 : ( (astr > bstr) ? -1 : +1 ) )
          : (astr, bstr) => ( (astr === bstr) ? 0 : ( (astr < bstr) ? -1 : +1 ) )
    ;

    list_of_codes.sort(
        (code_a, code_b) => cmp(sort_keys[code_a.code_id], sort_keys[code_b.code_id])
    )

    if (sort_parents_before_children) {
        list_of_codes = eczoodb.code_parent_child_sort(list_of_codes);
    }

    return list_of_codes;
}


// ----------------------------------------------------------------------------


/**
 * Analyze a codelist's `codes.select` predicates and return a machine-readable
 * description of what the list selects, along with an FLM text description.
 *
 * @param {object} {eczoodb, codelist} - The eczoodb and a codelist data object (with `codes.select`).
 * @returns {{ pattern: object, description_flm: string }}
 *   - `pattern`: machine-readable object with a `type` field and relevant
 *     parameters (e.g. `{ type: 'descendants', code_id: 'topological' }`).
 *   - `description_flm`: FLM markup string describing the list in words.
 */
export function describe_codelist({ eczoodb, codelist })
{
    const select = codelist.codes?.select;
    if (!select || !Array.isArray(select)) {
        return {
            pattern: { type: null },
            description_flm: 'Unknown code list.',
        };
    }

    // ---- Pattern: all codes ----
    if (select.length === 1 && Object.keys(select[0]).length === 0) {
        return {
            pattern: { type: 'all_codes' },
            description_flm: 'All codes.',
        };
    }

    // Helper: check if a predicate collection has exactly the given keys (unordered)
    const has_exactly_keys = (pred, keys) => {
        const pkeys = Object.keys(pred);
        return pkeys.length === keys.length && keys.every(k => pkeys.includes(k));
    };

    // Helper: format a code_id as an FLM reference
    const code_ref = (code_id) => `\\ref{code:${code_id}}`;

    // Helper: format a domain_id as an FLM reference
    const domain_ref = (domain_id) => `\\ref{domain:${domain_id}}`;

    // Helper: format a property path for display
    const prop_label = (prop) => {
        // e.g. "features.threshold" -> "threshold", "realizations" -> "realizations"
        const parts = prop.split('.');
        return parts[parts.length - 1].replace(/_/g, ' ');
    };

    // ---- Try to match known standard patterns first. If none match, fall
    //      through to the generic description builder below. ----

    if (select.length === 1) {
        const pred = select[0];

        // Pattern: descendants only
        if (has_exactly_keys(pred, ['descendant_of'])) {
            return {
                pattern: { type: 'descendants', code_id: pred.descendant_of },
                description_flm:
                    `All descendants of ${code_ref(pred.descendant_of)}.`,
            };
        }

        // Pattern: cousins only
        if (has_exactly_keys(pred, ['cousin_of'])) {
            return {
                pattern: { type: 'cousins', code_id: pred.cousin_of },
                description_flm:
                    `All cousins of ${code_ref(pred.cousin_of)}.`,
            };
        }

        // Pattern: domain with exclusions
        if (pred.domain != null && pred.not_any_domain != null
            && has_exactly_keys(pred, ['domain', 'not_any_domain'])) {
            return {
                pattern: {
                    type: 'domain',
                    domain_id: pred.domain,
                    not_any_domain: pred.not_any_domain,
                },
                description_flm:
                    `All codes in ${domain_ref(pred.domain)}.`,
            };
        }

        // Pattern: domain only
        if (has_exactly_keys(pred, ['domain'])) {
            return {
                pattern: { type: 'domain', domain_id: pred.domain },
                description_flm:
                    `All codes in ${domain_ref(pred.domain)}.`,
            };
        }

        // Pattern: property_set with not_descendant_of
        if (pred.property_set != null && pred.not_descendant_of != null
            && has_exactly_keys(pred, ['property_set', 'not_descendant_of'])) {
            return {
                pattern: {
                    type: 'property_set_excluding_descendants',
                    property: pred.property_set,
                    not_descendant_of: pred.not_descendant_of,
                },
                description_flm:
                    `All codes with ${prop_label(pred.property_set)}`
                    + ` that are not descendants of`
                    + ` ${code_ref(pred.not_descendant_of)}.`,
            };
        }

        // Pattern: property_set with domain
        if (pred.property_set != null && pred.domain != null
            && has_exactly_keys(pred, ['property_set', 'domain'])) {
            return {
                pattern: {
                    type: 'property_set_in_domain',
                    property: pred.property_set,
                    domain_id: pred.domain,
                },
                description_flm:
                    `All codes in ${domain_ref(pred.domain)}`
                    + ` with ${prop_label(pred.property_set)}.`,
            };
        }

        // Pattern: property_set only
        if (has_exactly_keys(pred, ['property_set'])) {
            return {
                pattern: {
                    type: 'property_set',
                    property: pred.property_set,
                },
                description_flm:
                    `All codes with ${prop_label(pred.property_set)}.`,
            };
        }

        // Pattern: manual_code_list
        if (has_exactly_keys(pred, ['manual_code_list'])) {
            return {
                pattern: {
                    type: 'manual_code_list',
                    code_ids: pred.manual_code_list,
                },
                description_flm:
                    `A manually specified list of codes.`,
            };
        }
    }

    if (select.length === 2) {
        const [p0, p1] = select;

        // Pattern: descendants and cousins of the same code (either order)
        let desc_pred = null, cous_pred = null;
        if (has_exactly_keys(p0, ['descendant_of'])
            && has_exactly_keys(p1, ['cousin_of'])) {
            desc_pred = p0; cous_pred = p1;
        } else if (has_exactly_keys(p0, ['cousin_of'])
                   && has_exactly_keys(p1, ['descendant_of'])) {
            desc_pred = p1; cous_pred = p0;
        }
        if (desc_pred && cous_pred
            && desc_pred.descendant_of === cous_pred.cousin_of) {
            return {
                pattern: {
                    type: 'descendants_and_cousins',
                    code_id: desc_pred.descendant_of,
                },
                description_flm:
                    `All descendants and cousins of`
                    + ` ${code_ref(desc_pred.descendant_of)}.`,
            };
        }
    }

    // ---- Fallback: build a generic description from predicates.
    //      Handles any combination of predicate collections. ----
    const description_parts = [];
    for (let i = 0; i < select.length; i++) {
        const pred = select[i];
        const conds = [];
        for (const [key, val] of Object.entries(pred)) {
            // descendant_of family
            if (key === 'descendant_of') {
                conds.push(`descendants of ${code_ref(val)}`);
            } else if (key === 'any_descendant_of') {
                conds.push(`descendants of any of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'all_descendant_of') {
                conds.push(`descendants of all of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'not_descendant_of') {
                conds.push(`not descendants of ${code_ref(val)}`);
            } else if (key === 'not_any_descendant_of') {
                conds.push(`not descendants of any of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'not_all_descendant_of') {
                conds.push(`not descendants of all of ${val.map(code_ref).join(', ')}`);

            // cousin_of family
            } else if (key === 'cousin_of') {
                conds.push(`cousins of ${code_ref(val)}`);
            } else if (key === 'any_cousin_of') {
                conds.push(`cousins of any of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'all_cousin_of') {
                conds.push(`cousins of all of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'not_cousin_of') {
                conds.push(`not cousins of ${code_ref(val)}`);
            } else if (key === 'not_any_cousin_of') {
                conds.push(`not cousins of any of ${val.map(code_ref).join(', ')}`);
            } else if (key === 'not_all_cousin_of') {
                conds.push(`not cousins of all of ${val.map(code_ref).join(', ')}`);

            // domain family
            } else if (key === 'domain') {
                conds.push(`in ${domain_ref(val)}`);
            } else if (key === 'any_domain') {
                conds.push(`in any of ${val.map(domain_ref).join(', ')}`);
            } else if (key === 'all_domain') {
                conds.push(`in all of ${val.map(domain_ref).join(', ')}`);
            } else if (key === 'not_domain') {
                conds.push(`not in ${domain_ref(val)}`);
            } else if (key === 'not_any_domain') {
                conds.push(`not in any of ${val.map(domain_ref).join(', ')}`);
            } else if (key === 'not_all_domain') {
                conds.push(`not in all of ${val.map(domain_ref).join(', ')}`);

            // property_set family
            } else if (key === 'property_set') {
                conds.push(`with ${prop_label(val)}`);
            } else if (key === 'any_property_set') {
                conds.push(`with any of ${val.map(prop_label).join(', ')}`);
            } else if (key === 'all_property_set') {
                conds.push(`with all of ${val.map(prop_label).join(', ')}`);
            } else if (key === 'not_property_set') {
                conds.push(`without ${prop_label(val)}`);
            } else if (key === 'not_any_property_set') {
                conds.push(`without any of ${val.map(prop_label).join(', ')}`);
            } else if (key === 'not_all_property_set') {
                conds.push(`without all of ${val.map(prop_label).join(', ')}`);

            // property (exact value match)
            } else if (key === 'property') {
                conds.push(`with ${val.name} equal to ${JSON.stringify(val.value)}`);

            // explicit code lists
            } else if (key === 'manual_code_list') {
                conds.push(`manually listed codes`);
            } else if (key === 'exclude') {
                conds.push(`excluding ${val.length} specific codes`);

            // unknown predicate — render raw for debugging
            } else {
                conds.push(`[${key}: ${JSON.stringify(val)}]`);
            }
        }
        if (conds.length === 0) {
            description_parts.push('all codes');
        } else {
            description_parts.push('codes that are ' + conds.join(' and '));
        }
    }

    let description_flm;
    if (description_parts.length === 1) {
        description_flm = description_parts[0].charAt(0).toUpperCase()
            + description_parts[0].slice(1) + '.';
    } else {
        description_flm = 'Union of:\n\\begin{itemize}\n'
            + description_parts.map(p => `\\item ${p}`).join('\n')
            + '\n\\end{itemize}';
    }

    return {
        pattern: { type: 'custom', select },
        description_flm,
    };
}


const _EcZooDbCodeListComputedData = {
    codelist: {
        compiled_codes_info: {
            fn: function (codelist) { // capture "this"
                const eczoodb = this;
                debug(`Compiling code list ${codelist.list_id} ...`);
                const code_list = get_list_data({codelist, eczoodb});
                const code_id_list = code_list.map( (c) => c.code_id );
                const code_id_set = new Set(code_id_list);
                return {
                    code_list,
                    code_id_list,
                    code_id_set,
                };
            },
        },
    },
};

export class EczPopulateCodeListsDbProcessor extends ComputedDataProcessor
{
    constructor(options)
    {
        super(Object.assign({
            computed_data: _EcZooDbCodeListComputedData,
            keep_computed_data_in_data_dumps: false,
        }, options));
    }
}
