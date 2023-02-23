import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs");

import loMerge from 'lodash/merge.js';

import { zoo_permalinks } from './permalinks.js';

import { StandardZooDb } from '@phfaist/zoodb/std/stdzoodb';


// -----------------------------------------------------------------------------


const default_config = {

    continue_with_errors: false,

    use_relations_populator: null,

    use_llm_environment: null,
    zoo_llm_environment_options: null,
    llm_allow_unresolved_references: false,
    llm_allow_unresolved_citations: false,

    use_llm_processor: null,

    llm_options: {

        refs:  {
            code: {
                // Keep 'code.name.llm_text' until we fix the issue in
                // zoodb/src/zoollm/_environment.js dealing with JSON
                // serialization of RefInstance's with LLMFragment instances.
                // Otherwise it's better to keep the fragment instance here
                // ('code.name') so that it doesn't have to be recompiled.
                formatted_ref_llm_text_fn: (codeid, code) => code.name.llm_text,
            },
            user: {
                formatted_ref_llm_text_fn: (userid, user) => user.name,
            },
        },

        citations: {
            csl_style: null, // CSL style (XML data)
            override_arxiv_dois_file:
                'code_extra/override_arxiv_dois.yml',
            preset_bibliography_files: [
                'code_extra/bib_preset.yml',
            ],
            default_user_agent: null,
        },
        
        resources: {
            rename_figure_template: null,
            figure_filename_extensions: null,
            graphics_resources_fs_data_dir: null,
        },

    },

    use_searchable_text_processor: null,

    searchable_text_options: {
        object_types: ['code',]  // only search for codes
    },

    zoo_permalinks,

};


export class EcZooDb extends StandardZooDb
{
    constructor(config)
    {
        super(loMerge({}, default_config, config));
    }

    //
    // Object computed properties
    //

    user_earliest_contribution(user)
    {
        if (!user.zoo_contributions || !user.zoo_contributions.code) {
            return null;
        }
        let earliest_date = null;
        for (const code_contrib of user.zoo_contributions.code) {
            const d = new Date(code_contrib.date);
            if (earliest_date === null || (d - earliest_date < 0)) {
                earliest_date = d;
            }
        }
        return earliest_date;
    }

    code_short_name(code)
    {
        if (code.short_name != null && code.short_name !== '') {
            return code.short_name;
        }
        let name = code.name;
        let short_name = null;
        if (this.config.use_llm_processor) {
            name = name.llm_text;
        }
        if (name.endsWith(" code")) {
            short_name = name.slice(0, -(" code".length));
        }
        if (short_name !== null) {
            if (this.config.use_llm_processor) {
                return this.zoo_llm_environment.make_fragment(
                    short_name,
                    this.$$kw({
                        what: `${code.name.what} (short)`,
                        resource_info: code._zoodb.resource_info,
                        standalone_mode: true,
                    })
                );
            } else {
                return short_name;
            }
        }
        return code.name;
    }

    /**
     * Do a simnple breadth-first visit of nodes starting from the given `code`
     * following the relation type specifed by `relation_properties` which must
     * be a list of one or more of ['parents', 'cousins', 'parent_of',
     * 'cousin_of'].  For 'parent_of' and 'cousin_of', the relations DB
     * processor must have been installed.
     *
     * The callback `callback(code)` is invoked for each visited code; it should
     * return `true` to stop visiting.
     */
    code_visit_relations(code, { relation_properties, callback, only_first_relation,
                                 predicate_relation })
    {
        let Q = [ code ];
        let explored = {};
        explored[code.code_id] = true;

        while (Q.length) {
            const visit_code = Q.shift();
            const callback_result = callback(visit_code);
            if (callback_result === true) {
                return;
            }
            for (const relation_property of relation_properties) {
                if (!visit_code.relations || !visit_code.relations[relation_property]) {
                    continue;
                }
                let code_neighbor_relations = visit_code.relations[relation_property];
                if (only_first_relation) {
                    code_neighbor_relations = code_neighbor_relations.slice(0,1);
                }
                for (const code_neighbor_relation of code_neighbor_relations) {
                    if (predicate_relation != null
                        && predicate_relation(visit_code, code_neighbor_relation)) {
                        continue;
                    }
                    const n_code_id = code_neighbor_relation.code_id;
                    if (explored[n_code_id]) {
                        continue;
                    }
                    explored[n_code_id] = true;
                    Q.push( this.objects.code[n_code_id] );
                }
            }
        }
    }

    code_is_descendant_of(code, parent_code_id)
    {
        let result = false;
        this.code_visit_relations(code, {
            relation_properties: ['parents'],
            callback: (code) => {
                if (code.code_id === parent_code_id) {
                    result = true;
                    return true;
                }
            },
        });
        return result;
    }

    code_is_cousin_of(code, cousin_code_id)
    {
        if (code.relations) {
            for (const rel_type of ['cousins', 'cousin_of']) {
                for (const rel_info of code.relations[rel_type] || []) {
                    if (rel_info.code_id === cousin_code_id) {
                        return true;
                    }
                }
            }
        }
        return false;
        // ### Nope, don't explore cousin relationships recursively!! Single
        // ### level only.
        //
        // let result = false;
        // this.code_visit_relations(code, {
        //     relation_properties: ['cousins', 'cousin_of'],
        //     callback: (code) => {
        //         if (code.code_id === cousin_code_id) {
        //             result = true;
        //             return true;
        //         }
        //     },
        // });
        // return result;
    }

    code_parent_domains(code, {find_domain_id} = {})
    {
        let domains_by_kingdom_code_id = Object.fromEntries(
            Object.entries(this.objects.kingdom).map(
                ([kingdom_id, kingdom]) =>
                  [kingdom.kingdom_code.code_id, kingdom.parent_domain]
            )
        );
        this.code_visit_relations(code, {
            relation_properties: ['parents'],
            callback: (code) => {
                const domain = domains_by_kingdom_code_id[code.code_id];
                if (domain !== undefined) {
                    domains.push(domain);
                }
                if (find_domain_id != null && domain.domain_id === find_domain_id) {
                    return true;
                }
            },
        });
        return domains;
    }

    code_get_family_tree(root_code)
    {
        let family_tree_codes = [];
        this.code_visit_relations(root_code, {
            relation_properties: ['parent_of'],
            callback: (code) => {
                family_tree_codes.push(code);
            },
        });
        return family_tree_codes;
    }
};


