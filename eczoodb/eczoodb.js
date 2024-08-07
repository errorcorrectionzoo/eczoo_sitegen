import debug_mod from 'debug';
const debug = debug_mod("eczoodb");

import loMerge from 'lodash/merge.js';

import { zoo_permalinks } from './permalinks.js';

import { ZooDb } from '@phfaist/zoodb';
import { makeStandardZooDb } from '@phfaist/zoodb/std/stdzoodb';

import { schema_root_dir_default } from './dirs_defaults.js';

import { objects_config } from './objects_config.js';

// -----------------------------------------------------------------------------


const default_config = {

    continue_with_errors: false,

    use_relations_populator: null,

    use_gitlastmodified_processor: null,

    use_flm_environment: null,
    zoo_flm_environment_options: null,
    flm_allow_unresolved_references: false,
    flm_allow_unresolved_citations: false,

    use_flm_processor: null,

    flm_options: {

        refs:  {
            code: {
                // Keep 'code.name.flm_text' until we fix the issue in
                // zoodb/src/zooflm/_environment.js dealing with JSON
                // serialization of RefInstance's with FLMFragment instances.
                // Otherwise it's better to keep the fragment instance here
                // ('code.name') so that it doesn't have to be recompiled.
                formatted_ref_flm_text_fn: (codeid, code) => code.name.flm_text,
            },
            user: {
                formatted_ref_flm_text_fn: (userid, user) => user.name,
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
            // cache_file: ......, // set with "full options" in fullopts.js
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





export class EcZooDb extends ZooDb
{
    constructor(options)
    {
        super(options);
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
        if (this.config.use_flm_processor) {
            name = name.flm_text;
        }
        if (name.endsWith(" code")) {
            short_name = name.slice(0, -(" code".length));
        }
        if (short_name !== null) {
            if (this.config.use_flm_processor) {
                return this.zoo_flm_environment.make_fragment(
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

    //
    // Helpers, visitors, etc.
    //

    /**
     * Do a simple breadth-first visit of nodes starting from the given `code`
     * following the relation type specifed by `relation_properties` which must
     * be a list of one or more of ['parents', 'cousins', 'parent_of',
     * 'cousin_of'].  For 'parent_of' and 'cousin_of', the relations DB
     * processor must have been installed.
     *
     * The callback `callback(code)` is invoked for each visited code; it should
     * return `true` to stop visiting.
     * 
     * You can specify a predicate to test whether or not to follow a specific
     * relation.  The predicate is called as
     * ``predicate_relation(code, code_neighbor_relation, relation_property)``
     * with `code` = the currently visited code, `code_neighbor_relation` = the
     * relation object (e.g. typically with 'code_id' and 'detail' properties)
     * and `relation_property` the property name that describes the relation type
     * (e.g. 'parent_of').  The predicate's return value, evaluated as a boolean
     * indicates whether or not to follow that relation.
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
                        && !predicate_relation(visit_code, code_neighbor_relation,
                                               relation_property)) {
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
        if (code.relations == null) {
            return false;
        }
        for (const rel_type of ['cousins', 'cousin_of']) {
            if (code.relations[rel_type] == null) {
                continue;
            }
            for (const rel_info of code.relations[rel_type]) {
                if (rel_info.code_id === cousin_code_id) {
                    return true;
                }
            }
        }
        return false;
    }

    code_parent_domains(code, { find_domain_id, only_primary_parent_relation } = {})
    {
        let domains_by_dk_root_code_id = {};
        for (const domain of Object.values(this.objects.domain)) {
            for (const domainRootCodeRel of domain.root_codes) {
                domains_by_dk_root_code_id[ domainRootCodeRel.code_id ] = domain;
            }
        }
        for (const kingdom of Object.values(this.objects.kingdom)) {
            for (const kingdomRootCodeRel of kingdom.root_codes) {
                domains_by_dk_root_code_id[ kingdomRootCodeRel.code_id ] =
                    kingdom.parent_domain;
            }
        }

        let domains = [];
        this.code_visit_relations(code, {
            relation_properties: ['parents'],
            callback: (code_visit) => {
                const domain = domains_by_dk_root_code_id[code_visit.code_id];
                if (domain !== undefined) {
                    domains.push(domain);
                    if (find_domain_id != null && domain.domain_id === find_domain_id) {
                        return true;
                    }
                }
            },
            only_first_relation: only_primary_parent_relation,
        });
        return domains;
    }

    code_is_primary_parent(parent_code, child_code)
    {
        // if child_code is a kingdom root code, then it "the kingdom itself is
        // the primary parent" (it's the most important "parent" in the code graph,
        // and a code can have at most one primary parent).
        const child_relations = child_code.relations;
        if (child_relations == null) {
            return false;
        }
        if (child_relations.root_for_domain != null
            && child_relations.root_for_domain.length >= 1) {
            return false;
        }
        if (child_relations.root_for_kingdom != null
            && child_relations.root_for_kingdom.length >= 1) {
            return false;
        }
        if (child_relations.parents?.[0]?.code_id === parent_code.code_id) {
            return true;
        }
        return false;
    }

    code_get_family_tree(root_code, { parent_child_sort, only_primary_parent_relation } = {})
    {
        let predicate_relation = null;
        if (only_primary_parent_relation ?? false) {
            predicate_relation = (code, relation, relation_property_) =>
                this.code_is_primary_parent(code, relation.code)
                ;
        }

        let family_tree_codes = [];
        this.code_visit_relations(root_code, {
            relation_properties: ['parent_of'],
            callback: (code) => {
                family_tree_codes.push(code);
            },
            predicate_relation,
        });
        
        if (parent_child_sort ?? true) {
            // enforce the returned array to be topologically sorted, i.e., a
            // parent always appears before any of its children in the list.
            // Simple BFS doesn't always enforce this on its own
            // (cf. https://stackoverflow.com/a/35458168/1694896)
            return this.code_parent_child_sort(family_tree_codes);
        }

        return family_tree_codes;
    }

    /**
     * Follows primary-parent relationships upwards as long as possible.  When
     * no further primary-parent is found (e.g., for a root property code or for
     * a domain/kingdom root code), then information about that code is returned.
     * 
     * Returns an object
     * `{ primary_parent_root_code, primary_parent_chain_code_ids }`
     * containing the root code object and the chain (an array) of `code_id`'s
     * explored until we reached the root code.
     */
    code_get_primary_parent_root(code, { include_domain_kingdom_root_info }={})
    {
        // Primary parent relationship = first parent in the parents: list, except for
        // domain and kingdom root codes (in which case the domain or kingdom node is
        // the 'primary parent')

        // follow primary parent relationship to determine a root code
        // whether we're part of a kingdom.
        let primary_parent_root_code = code;
        let is_root_code = true;
        // detect any cycles so we can report an error.
        let primary_parent_chain_code_ids = [ code.code_id ];
        while ( (primary_parent_root_code.relations?.root_for_kingdom == null
                    || primary_parent_root_code.relations?.root_for_kingdom?.length == 0)
                && (primary_parent_root_code.relations?.root_for_domain == null
                    || primary_parent_root_code.relations?.root_for_domain?.length == 0)
                && primary_parent_root_code.relations?.parents?.length > 0 ) {
            primary_parent_root_code = primary_parent_root_code.relations.parents[0].code;
            is_root_code = false;
            const primary_parent_root_code_id = primary_parent_root_code.code_id;
            if (primary_parent_chain_code_ids.includes(primary_parent_root_code_id)) {
                const seenCodeChainNames = [].concat(
                    primary_parent_chain_code_ids,
                    [ primary_parent_root_code_id ]
                ).map( (cId) => {
                    let c = this.objects.code[cId];
                    return `‘${c.name.flm_text ?? c.name}’ (${c.code_id})`;
                } );
                throw new Error(
                    `Detected cycle in primary-parent relationships: `
                    + seenCodeChainNames.join(' → ')
                );
            } else {
                primary_parent_chain_code_ids.push( primary_parent_root_code_id );
            }
        }
        let info = {
            primary_parent_root_code,
            primary_parent_chain_code_ids,
            is_root_code,
        };
        if (include_domain_kingdom_root_info) {
            let parent_domain =  null;
            let parent_kingdom = null;
            let is_domain_root_code = false;
            let is_kingdom_root_code = false;

            let root_for_domain = primary_parent_root_code.relations?.root_for_domain;
            if (root_for_domain != null && root_for_domain.length > 0) {
                if (root_for_domain.length > 1) {
                    throw new Error(
                        `Code ${primary_parent_root_code.code_id} is root code for multiple `
                        + `domains: ` + root_for_domain.map((k) => k.kingdom_id).join(', ')
                    );
                }
                parent_domain = root_for_domain[0].domain;
                parent_kingdom = null;
                is_domain_root_code = is_root_code;
                is_kingdom_root_code = false;
            } else {
                let root_for_kingdom = primary_parent_root_code.relations?.root_for_kingdom;
                if (root_for_kingdom != null && root_for_kingdom.length > 0) {
                    if (root_for_kingdom.length > 1) {
                        throw new Error(
                            `Code ${primary_parent_root_code.code_id} is root for multiple `
                            + `kingdoms: ` + root_for_kingdom.map((k) => k.kingdom_id).join(', ')
                        );
                    }
                    parent_kingdom = root_for_kingdom[0].kingdom;
                    parent_domain = parent_kingdom?.parent_domain;
                    is_domain_root_code = false;
                    is_kingdom_root_code = is_root_code;
                }
            }

            info.parent_domain = parent_domain;
            info.parent_kingdom = parent_kingdom;
            info.is_domain_root_code = is_domain_root_code;
            info.is_kingdom_root_code = is_kingdom_root_code;
        }
        return info;
    }

    code_get_parent_domain(code, { primary_parent_root_code }={})
    {
        if (primary_parent_root_code == null) {
            ({ primary_parent_root_code } = this.code_get_primary_parent_root(code));
        }

        let root_for_domain = primary_parent_root_code.relations?.root_for_domain;
        if (root_for_domain != null && root_for_domain.length > 0) {
            if (root_for_domain.length > 1) {
                throw new Error(
                    `Code ${primary_parent_root_code.code_id} is root code for multiple domains: `
                    + root_for_domain.map((k) => k.kingdom_id).join(', ')
                );
            }
            return root_for_domain[0].domain;
        }

        let root_for_kingdom = primary_parent_root_code.relations?.root_for_kingdom;
        if (root_for_kingdom != null && root_for_kingdom.length > 0) {
            if (root_for_kingdom.length > 1) {
                throw new Error(
                    `Code ${primary_parent_root_code.code_id} is root for multiple kingdoms: `
                    + root_for_kingdom.map((k) => k.kingdom_id).join(', ')
                );
            }
            return root_for_kingdom[0].kingdom?.parent_domain;
        }

        return null;
    }

    code_get_parent_kingdom(code, { primary_parent_root_code }={})
    {
        if (primary_parent_root_code == null) {
            ({ primary_parent_root_code } = this.code_get_primary_parent_root(code));
        }

        let root_for_kingdom = primary_parent_root_code.relations?.root_for_kingdom;
        if (root_for_kingdom == null || root_for_kingdom.length === 0) {
            return null;
        }

        if (root_for_kingdom.length > 1) {
            throw new Error(
                `Code ${primary_parent_root_code.code_id} is a root code for multiple kingdoms: `
                + root_for_kingdom.map((k) => k.kingdom_id).join(', ')
            );
        }

        return root_for_kingdom[0].kingdom;
    }

    /**
     * Sort the given list of objects such that parents always appear before any
     * of their children.  Cf. https://en.wikipedia.org/wiki/Topological_sorting
     *
     * The argument `codes` is expected to be an array of code objects.
     */
    code_parent_child_sort(codes)
    {
        // debug(`code_parent_child_sort() `, { codes });

        let sorted = [];

        const orig_code_ids = codes.map( (c) => c.code_id );

        // Using https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm

        // Internal representation of edges.  It will change along the course of
        // the algorithm.
        let all_child_nodes = {};
        let num_incoming_edges = Object.fromEntries(codes.map( (c) => [c.code_id, 0] ));
        for (const c of codes) {
            if (c.relations != null && c.relations.parent_of != null) {
                // keep only those child codes that are in the original given
                // list and also sort them to preserver order according to that
                // list
                let child_codes_w_orderidx = c.relations.parent_of
                    .map( (c_rel) => [ orig_code_ids.indexOf(c_rel.code_id),  c_rel.code] )
                    .filter( ([cidx, c_]) => (cidx !== -1) ) ;
                child_codes_w_orderidx.sort( (a, b) => a[0] - b[0] );
                const child_codes = child_codes_w_orderidx.map( ([cidx_, c]) => c );
                all_child_nodes[c.code_id] = child_codes;
                for (const child of child_codes) {
                    num_incoming_edges[child.code_id] += 1;
                }
            }
        }

        // find "root nodes" w/o any parents
        let root_nodes = codes.filter( (c) => (num_incoming_edges[c.code_id] === 0) );

        while (root_nodes.length) {
            const n = root_nodes.shift();
            sorted.push(n);
            
            // visit children of n
            let new_root_nodes = []
            while ( all_child_nodes[n.code_id] != null && all_child_nodes[n.code_id].length ) {
                const m = all_child_nodes[n.code_id].shift();
                num_incoming_edges[m.code_id] -= 1;
                if (num_incoming_edges[m.code_id] === 0) {
                    // no other incoming edges
                    new_root_nodes.push(m);
                }
            }
            // prepending the new set of root codes, instead of simply appending
            // each encountered new root code to root_nodes, yields a more
            // friendly ordering of the resulting code list as it picks children
            // of a code before other parent codes, which would visually mess up
            // the different lineage trees.
            root_nodes = new_root_nodes.concat(root_nodes);

            delete all_child_nodes[n.code_id];
        }

        // Let's see if there are any nodes remaining in the graph --- there
        // shouldn't be any as long as there was no cycle originally.
        let cycle_node_idx = Object.values(all_child_nodes).findIndex(
            (children) => (children != null && children.length > 0)
        );
        if (cycle_node_idx !== -1) {
            //
            // There are cycles! Report them.
            //

            const clean_all_child_nodes = () => {
                // Remove any listed children that are not themselves listed
                // as having children.
                for (;;) {
                    let remove_cids = new Set();
                    all_child_nodes = Object.fromEntries(
                        Object.entries(all_child_nodes).map( ([c_id, children]) => {
                            let new_children = (children ?? []).filter( (child) => {
                                const child_id = child.code_id;
                                if ( !Object.hasOwn(all_child_nodes, child_id)
                                     || (all_child_nodes[child_id] == null)
                                     || (all_child_nodes[child_id].length == 0) ) {
                                    return false; // filter this child out
                                }
                                return true;
                            } );
                            if (new_children.length == 0) {
                                remove_cids.add(c_id);
                            }
                            return [c_id, new_children];
                        } )
                    );
                    if (remove_cids.size) {
                        for (const cid of remove_cids) {
                            delete all_child_nodes[cid];
                        }
                    } else {
                        break;
                    }
                }
            };

            clean_all_child_nodes();
            
            // Now start following & reporting cycles.
            let cycles = [];
            
            while (Object.keys(all_child_nodes).length) {
                // pick one node with children.
                const [c_id, children_] = Object.entries(all_child_nodes)[0];

                let this_cycle = [];
                let m = this.objects.code[c_id];
                while (m != null && !this_cycle.includes(m.code_id)) {
                    this_cycle.push(m.code_id);
                    // Pick a child to follow the cycle relationship.  Remove
                    // the child edge as we remove the cycle from the graph.
                    m = all_child_nodes[m.code_id].shift();
                }
                this_cycle.push( c_id ); // repeat the first code ID to make cycle explicit
                
                cycles.push( this_cycle );

                clean_all_child_nodes();
            }

            throw new Error(
                `ERROR: Cycles detected in parent-child relationships:\n`
                + cycles.map(
                    (cyc) => `    ` + cyc.map( (cid) => {
                        const c = this.objects.code[cid];
                        return `‘${c.name.flm_text ?? c.name}’ (${cid})`;
                    } ).join(' → ')
                ).join('\n')
            );
        }

        return sorted;
    }




    //
    // Validate the database.  Enforces any external constraints (e.g. no cycles
    // in the parent-child relationship).
    //

    async validate()
    {
        // any validation done by the parent zoodb object
        super.validate();

        // Check that there are no cycles in parent-child relationships.
        
        // eslint-disable-next-line no-unused-vars
        let all_parent_child_sorted_codes = this.code_parent_child_sort(
            Object.values(this.objects.code)
        );

        // Check that all codes are at most root codes of a single domain/kingdom.
        for (const [code_id, code] of Object.entries(this.objects.code)) {
            const root_for_domain = code.relations?.root_for_domain ?? [];
            const root_for_kingdom = code.relations?.root_for_kingdom ?? [];
            if (root_for_domain.length + root_for_kingdom.length > 1) {
                throw new Error(
                    `Code ‘${code_id}’ is root code for more than one domain/kingdom: `
                    + [
                        (root_for_domain.length
                         ? `Domain(s): ` + root_for_domain.map((k) => k.domain_id).join(', ')
                         : '')
                        ,
                        (root_for_kingdom.length
                          ? `Kingdom(s): ` + root_for_kingdom.map((k) => k.kingdom_id).join(', ')
                          : '')
                    ].join(' and ')
                );
            }
        }
    }
}




export async function createEcZooDb(
    config = {},
    { use_schemas_loader, schema_root, schema_add_extension }={}
)
{
    schema_root = schema_root ?? schema_root_dir_default;
    schema_add_extension = schema_add_extension ?? null;

    debug('schema_root is ', { schema_root });

    let schemas_config = {
        schema_root: schema_root,
        schema_rel_path: 'schemas/',
        schema_add_extension: schema_add_extension ?? '.yml',
    };

    if ( ! (use_schemas_loader ?? true) ) {
        schemas_config = false;
    }

    config = loMerge(
        {
            ZooDbClass: EcZooDb,

            //
            // specify where to find schemas
            //
            schemas: schemas_config,

            // The SchemaLoader will automatically load all files in the
            // folder if the schema_root is a filesystem path.  Otherwise,
            // specify a list of schema names to load here:
            schema_names: Object.entries(objects_config).map(
                ([object_type, object_config]) => object_config.schema_name ?? object_type
            ),

        },
        default_config,
        config,
    );

    return await makeStandardZooDb(config);
}
