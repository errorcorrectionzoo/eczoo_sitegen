//
// Generate some statistics for the EC Zoo
//


class ZooStatsGenerator
{
    constructor({ eczoodb })
    {
        this.eczoodb = eczoodb;
    }

    total_num_codes({ label, }) {
        return [ [ Object.keys(this.eczoodb.objects.code).length, label ] ];
    }

    total_num_domains({ label, }) {
        return [ [ Object.keys(this.eczoodb.objects.domain).length, label ] ];
    }

    total_num_kingdoms({ label, }) {
        return [ [ Object.keys(this.eczoodb.objects.kingdom).length, label ] ];
    }

    code_familyhead_ids_and_codetypes({ spec_list })
    {
        const eczoodb = this.eczoodb;

        let thestats = [];
        for (const [code_id_list, label] of spec_list) {
            let family_head_codes = [];
            for (const code_id of code_id_list) {
                let code = eczoodb.objects.code[code_id] ?? null;
                if (code == null) {
                    continue
                }
                family_head_codes.push(code);
            }

            let collected_code_ids = new Set();
            for (const family_head_code of family_head_codes) {
                let child_code_list = eczoodb.code_get_family_tree(family_head_code);
                for (const child_code of child_code_list) {
                    collected_code_ids.add(child_code.code_id);
                }
            }

            thestats.push(
                [ collected_code_ids.size - family_head_codes.length , label ]
            );
        }

        return thestats
    }
}


export function zoo_generate_stats({ eczoodb, stats })
{
    let stats_gen = new ZooStatsGenerator({ eczoodb });

    let results_stats = [];

    for (const [stat_type, stat_spec] of stats) {

        const newstats = stats_gen[stat_type] (stat_spec);

        results_stats.push( ... newstats );
        
    }

    return results_stats;
}
