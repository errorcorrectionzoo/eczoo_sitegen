// import debug_mod from 'debug';
// const debug = debug_mod("eczoodbjs.compile_codelist");

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
                code,
            );
            const domain_ids = domains.map( (d) => d.domain_id );
            let result = predicate_args.some( (arg) => domain_ids.includes(arg) );
            return do_apply_not( result );
        }
        if (apply_all) {
            const domains = eczoodb.code_parent_domains(
                code, // { find_domain_id: predicate_args }
            );
            const domain_ids = domains.map( (d) => d.domain_id );
            let result = predicate_args.every( (arg) => domain_ids.includes(arg) );
            return do_apply_not( result );
        }
        // apply simple:
        const domains = eczoodb.code_parent_domains(
            code, { find_domain_id: predicate_args }
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
        if ('render_standalone' in value) { // e.g., flmfragment
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


const _EcZooDbCodeListComputedData = {
    codelist: {
        compiled_code_id_list: {
            fn: function (codelist) { // capture "this"
                const eczoodb = this;
                debug(`Compiling code list ${codelist.list_id} ...`);
                const code_list = get_list_data({codelist, eczoodb});
                return code_list.map( (c) => c.code_id );
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
