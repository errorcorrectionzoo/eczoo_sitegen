import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.compile_codelist");

import { getfield } from '@phfaist/zoodb/util';

import * as zoollm from '@phfaist/zoodb/zoollm';
const { $$kw, repr } = zoollm;



export function get_list_data({codelist, eczoodb})
{
    // resolve code list, prepare all codes
    const code_select_predicate = (code, predinfo) => {
        //
        // All predicate conditions (the properties of `predinfo`) combine with
        // 'AND'.  Check each one that is specified; if any one does not match,
        // we need to return false.
        //
        if (predinfo.not != null) {
            if ( code_select_predicate(code, predinfo.not) ) {
                return false;
            }
        }
        if (predinfo.property_set != null) {
            if ( getfield(code, predinfo.property_set) == null ) {
                return false;
            }
        }
        if (predinfo.property != null) {
            const { name, value } = predinfo.property;
            if ( getfield(code, name) !== value ) {
                return false;
            }
        }
        if (predinfo.domain != null) {
            const domains = eczoodb.code_parent_domains(
                code, { find_domain_id: predinfo.domain }
            );
            if (domains.filter( (d) => d.domain_id === predinfo.domain ).length == 0) {
                return false;
            }
        }
        if (predinfo.descendant_of) {
            if ( ! eczoodb.code_is_descendant_of(code, predinfo.descendant_of) ) {
                return false;
            }
        }
        if (predinfo.cousin_of) {
            if ( ! eczoodb.code_is_cousin_of(code, predinfo.cousin_of) ) {
                return false;
            }
        }
        if (predinfo.manual_code_list) {
            if ( ! predinfo.manual_code_list.includes(code.code_id) ) {
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

    
    const list_of_codes = Object.values(eczoodb.objects.code).filter(
        (code) => code_select_predicates(code, codelist.codes.select)
    );

    const sort_by = codelist.sort?.by ?? 'name';
    const sort_reverse = codelist.sort?.reverse ?? false;
    const sort_case_sensitive = codelist.sort?.case_sensitive ?? false;

    const text_fragment_renderer = new zoollm.ZooTextFragmentRenderer;

    const normalize_sort_value = (value) => {
        if ('render_standalone' in value) { // e.g., llmfragment
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

    return list_of_codes;
}


