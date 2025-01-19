//
// Generate some statistics for the EC Zoo
//
import debugm from 'debug';
const debug = debugm('eczoodb.stats');

import { ZooDbProcessorBase } from '@phfaist/zoodb/dbprocessor/base';


export function get_home_page_stats({ stats })
{
    // stats is the ecz_stats_processor.stats object populated by the
    // database processor class defined below.
    return [
        stats.total_num_codes,
        stats.total_num_kingdoms,
        stats.total_num_domains,

        ... stats.home_code_family_trees,

    ];
}

//
// List of code family tree stats to compute.  All of these with the property
// 'home: true' will be included in the home page stats, in the given order.
// Any of these stats with the property 'home: false' will be computed and will
// be available to user code but will not be displayed on the home page.
//
// The 'key' property should be unique in this list of stats but is otherwise
// never displayed to the user.
//
export const stats_code_family_trees_spec = [

    {
        key: 'classical',
        domain_id: 'classical_domain',
        //code_id_list: ['ecc'], //['ecc', 'classical_into_quantum'],
        label: 'classical codes',
        only_primary_parent_relation: true,
        home: true,
    },
    {
        key: 'quantum',
        domain_id: 'quantum_domain',
        //code_id_list: ['quantum_into_quantum'],
        label: 'quantum codes',
        only_primary_parent_relation: true,
        home: true,
    },
    {
        key: 'cq',
        domain_id: 'classical_into_quantum_domain',
        //code_id_list: ['classical_into_quantum'],
        label: 'c-q codes',
        only_primary_parent_relation: true,
        home: true,
    },
    {
        key: 'topological',
        code_id_list: ['topological'],
        label: 'topological codes',
        only_primary_parent_relation: false,
        home: true,
    },
    {
        key: 'qldpc',
        code_id_list: ['qldpc'],
        label: 'quantum LDPC codes',
        only_primary_parent_relation: false,
        home: true,
    },
    {
        key: 'dynamic_gen',
        code_id_list: ['dynamic_gen'],
        label: 'dynamically generated codes',
        only_primary_parent_relation: false,
        home: true,
    },
    {
        key: 'css',
        code_id_list: ['css', 'qudit_css', 'galois_css'],
        label: 'CSS codes',
        only_primary_parent_relation: false,
        home: true,
    },
    {
        key: 'oscillators',
        code_id_list: ['oscillators'],
        label: 'bosonic codes',
        only_primary_parent_relation: true,
        home: true,
    },

];




//
// Stats generator & processor.
//
export class EczStatsDbProcessor extends ZooDbProcessorBase
{
    constructor(config)
    {
        super();

        this.config = config ?? {};
        this.stats_code_family_trees_spec = stats_code_family_trees_spec;
        this.stats = null;
    }

    initialize_zoo()
    {
        // clear stats
        this.stats = {};
    }

    process_zoo()
    {
        let eczoodb = this.zoodb;
        this.stats = this.generate_stats(eczoodb);
    }

    get_home_page_stats()
    {
        return get_home_page_stats({
            stats: this.stats,
        });
    }

    // ---

    generate_stats(eczoodb)
    {
        // calculate zoo stats !
        let stats = {};

        debug('Calculating EC Zoo stats ...');

        // total_num_codes
        stats.total_num_codes = {
            value: Object.keys(eczoodb.objects.code).length,
            label: 'code entries',
        };
        
        // total_num_domains
        stats.total_num_domains = {
            value: Object.keys(eczoodb.objects.domain).length,
            label: 'domains',
        };

        // total_num_kingdoms
        stats.total_num_kingdoms = {
            value: Object.keys(eczoodb.objects.kingdom).length,
            label: 'kingdoms',
        };

        debug('Calculating EC Zoo stats ... # of codes per kingdom and # of codes under each kingdom root code');

        // number of codes for each kingdom
        stats.num_codes_per_kingdom = {};
        stats.num_codes_per_kingdom_root_code = {};
        for (const [kingdom_id,kingdom] of Object.entries(eczoodb.objects.kingdom)) {
            const root_code_id_list =
                kingdom.root_codes?.map( (relObj) => relObj.code_id ) ?? [];
            const value = this.get_num_code_family_tree_members(
                {
                    eczoodb,
                    code_id_list: root_code_id_list,
                    only_primary_parent_relation: true,
                }
            );
            stats.num_codes_per_kingdom[kingdom_id] = {
                value: (value === null ? 0 : value),
                label: `in the ${kingdom.name.flm_text ?? kingdom.name}`,
            };

            for (const { code_id } of kingdom.root_codes ?? []) {
                const value = this.get_num_code_family_tree_members(
                    {
                        eczoodb,
                        code_id_list: [ code_id ],
                        only_primary_parent_relation: true,
                    }
                );
                stats.num_codes_per_kingdom_root_code[code_id] = {
                    value,
                    label: `descendants of ‘${ code_id }’`,
                };
            }
        }

        debug('Calculating EC Zoo stats ... # of codes per main family tree');

        // hard-coded code family tree sizes
        stats.code_family_trees = {};
        for (const statspec of this.stats_code_family_trees_spec) {
            const { key, label } = statspec;
            const value = this.get_num_code_family_tree_members(
                { eczoodb, ...statspec }
            );
            if (value !== null) {
                stats.code_family_trees[key] = {
                    value,
                    label,
                };
            }
        }
        stats.home_code_family_trees = this.stats_code_family_trees_spec.filter(
            ({ key, home }) => (!!home && Object.hasOwn(stats.code_family_trees, key))
        ).map(
            ({ key }) => stats.code_family_trees[key],
        );

        debug('Calculating EC Zoo stats ... done!');
        debug(stats);

        return stats;
    }

    // ---

    get_num_code_family_tree_members({ eczoodb, domain_id, code_id_list, only_primary_parent_relation })
    {
        only_primary_parent_relation ??= false;

        debug(`domain_id=${domain_id}  code_id_list=${code_id_list}`);

        if (domain_id != null) {
            if (code_id_list != null) {
                throw new Error(`Cannot specify both 'domain_id' and 'code_id_list' here.`)
            }
            const domain = eczoodb.objects.domain[domain_id];
            // skip if no such domain (eg, test data)
            if (domain == null) {
                return null;
            }
            let root_code_id_list = [];
            // find all root codes for this domain and associated kingdoms,
            // use those as code_id_list.
            for (const { code_id } of domain.root_codes) {
                root_code_id_list.push(code_id);
            }
            for (const { kingdom } of domain.kingdoms) {
                for (const { code_id } of kingdom.root_codes) {
                    root_code_id_list.push(code_id);
                }
            }

            code_id_list = root_code_id_list;
        }

        let family_head_codes = [];
        for (const code_id of code_id_list) {
            let code = eczoodb.objects.code[code_id] ?? null;
            if (code == null) {
                continue;
            }
            family_head_codes.push(code);
        }

        if (family_head_codes.length === 0) {
            // no such codes / no such family tree
            return null;
        }

        let collected_code_ids = new Set();
        for (const family_head_code of family_head_codes) {
            let child_code_list = eczoodb.code_get_family_tree(
                family_head_code,
                { only_primary_parent_relation, }
            );
            for (const child_code of child_code_list) {
                collected_code_ids.add(child_code.code_id);
            }
        }

        debug(`get_num_code_family_tree_members [${code_id_list}] -> `
              + `(${collected_code_ids.size}) ${Array.from(collected_code_ids)} `);
        
        // collective family heads = 1 code
        return collected_code_ids.size - family_head_codes.length + 1;
    }

}
