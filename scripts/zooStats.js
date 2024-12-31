//
// Run as "yarn node scripts/zooStats.js [...]".
// Try --help to get a list of options.
//

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.zooStats');
const debuglog = debugm('EczLog');

import fs from 'fs';

import _ from 'lodash';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { stringify as csvStringify } from 'csv-stringify/sync';

import { helperSetDefaultLogs } from './_helpers/helperLogs.js';
import { loadEcZoo } from './_helpers/helperEcZooLoader.js';




class CSVRecords {
    constructor(keysWithTitles)
    {
        this.keysWithTitles = keysWithTitles;
        this.keys = this.keysWithTitles.map( ([key, title_]) => key );
        this.indexForKey = Object.fromEntries(
            this.keys.map( (key, idx) => [key, idx] )
        );

        this.records = [];
    }

    addRecord(record)
    {
        this.records.push(
            [ ... this.keys.map( k => record[k] ) ]
        );
    }

    sortBy({key, reverse})
    {
        const factor = reverse ? -1 : 1;
        const idx = this.indexForKey[key];
        this.records.sort( (a, b) => factor*a[idx].localeCompare(b[idx]) );
    }

    toCSV()
    {
        return csvStringify([
            // header record
            Object.fromEntries(this.keysWithTitles),
            // content records
            ... this.records
        ]);
    }
};


// helper: dump FLM text (whether compiled or not)
function toFlmText(s)
{
    return s?.flm_text ?? s;
}


//
// Tool: detect degenerate paths
//

async function zooStats(argv)
{
    helperSetDefaultLogs({ verbosityLevel: argv.verbose, quietMode: argv.quiet });
    debug(`zooStats(): argv = `, argv);

    const {
        dataDir,
        includeNumRefs,
        outputCsv,
    } = argv;

    const useFlmProcessor = includeNumRefs ? true : false;

    debuglog(`zooStats(): loading zoo... (might take ${ useFlmProcessor ? 'several minutes' : 'a minute'})`);
    const eczoodb = await loadEcZoo({
        dataDir,
        useFlmProcessor,
    });
    debuglog('zooStats(): zoo is now loaded!');

    // compute all the stats we want to know about

    // VVA: “ Maybe u could help me generate some statistics? Eg:
    //         - A spreadsheet listing all codes, the number of refs on their code pages, and
    //           the number of parents, childern, and cousins?
    //         - Total number of parent-child and cousin connections ”

    const flm_scanner = eczoodb.zoo_flm_processor?.scanner ?? null;

    let totalNumCodes = 0;
    let totalNumParentRels = 0;
    let totalDoubleNumCousinRels = 0;

    let allCodes = new CSVRecords([
        ['code_id', 'CODE_ID'],
        ['name', 'NAME'],
        ['code_short_name', 'SHORT NAME'],
        ['num_parents', 'NUM PARENTS'],
        ['num_children', 'NUM CHILDREN'],
        ['num_cousins', 'NUM COUSINS'],
        ['num_refs', 'TIMES REFERRED TO'],
    ]);
    for (const [code_id, code] of Object.entries(eczoodb.objects.code)) {
        let relations = code.relations ?? {};
        // let's include in num_parents any domain/kingdom parent relationship.
        let num_parents = relations.parents?.length ?? 0;
        if (relations.root_for_domain && relations.root_for_domain.length) {
            num_parents += relations.root_for_domain.length;
        }
        if (relations.root_for_kingdom && relations.root_for_kingdom.length) {
            num_parents += relations.root_for_kingdom.length;
        }
        // number of children
        let num_children = relations.parent_of?.length ?? 0;
        // number of cousins
        let num_cousins = (relations.cousins?.length ?? 0) + (relations.cousin_of?.length ?? 0);

        totalNumCodes += 1;        
        // update total number of parent relationships ("arrows")
        totalNumParentRels += num_parents;
        // update total number of cousin relationships. Each cousin relationship will be counted
        // exactly twice. We'll divide by two at the very end.
        totalDoubleNumCousinRels += num_cousins;

        // number of references to this code.
        let num_refs = 'N/A';
        if (includeNumRefs) {
            const encountered_refs =
                flm_scanner.get_encountered_references_to_labels([['code', code_id]]);
            if (encountered_refs != null) {
                debug(
                    `Code ${code_id} is referenced ${encountered_refs.length} times: `
                    + encountered_refs.map(
                        ({resource_info: ri}) => `‘${ri.object_type}:${ri.object_id}’`
                    ).join(', ')
                );
                num_refs = encountered_refs.length;
            } else {
                num_refs = 0;
            }
        }

        allCodes.addRecord({
            code_id,
            name: toFlmText(code.name),
            code_short_name: toFlmText(eczoodb.code_short_name(code)),
            num_parents,
            num_children,
            num_cousins,
            num_refs,
        });
    }
    allCodes.sortBy({key: 'code_id'});

    const csvData = allCodes.toCSV();
    if (outputCsv && outputCsv !== '-') {
        fs.writeFileSync(outputCsv, csvData);
        debuglog(`zooStats(): Wrote CSV to ${outputCsv}`);
    } else {
        process.stdout.write(csvData);
    }

    // Total number of parent & cousin relationships:
    const totalNumCousinRels = totalDoubleNumCousinRels / 2;

    console.log(`
************************************************************
EC ZOO STATS REPORT
************************************************************

Code-level report written to ‘${outputCsv}’

TOTALS:
        Number of codes: ${totalNumCodes}
        Number of parent relationships: ${totalNumParentRels}
        Number of cousin relationships: ${totalNumCousinRels}

************************************************************
`);

    debuglog('zooStats(): done.');
}





let terminalWidth = null;

//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    let Y = yargs(hideBin(process.argv));
    terminalWidth = Y.terminalWidth() ?? 80;
    const argv = await Y
        .scriptName('zooStats')
        .options({
            'data-dir': {
                alias: 'd',
                default: null,
                describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
            },
            'verbose': {
                alias: 'v',
                count: true,
                default: 0,
                describe: 'Enable verbose mode (use -vv for extra debug messages)'
            },
            'quiet': {
                alias: 'q',
                boolean: true,
                describe: 'Suppress logging messages',
            },
            //
            'include-num-refs': {
                boolean: true,
                default: false,
                describe: `Compute number of times this code is referred to by other code pages or other code list pages.  (This option results in significantly larger zoo load times as it needs to compile the latex-like fragments.)`
            },
            'output-csv': {
                default: `output-eczoo-stats-codes-${(new Date()).toISOString().slice(0,10)}.csv`,
                describe: `Write statistics about codes to the given CSV file name`
            },
        })
        .help()
        .wrap(Y.terminalWidth())
        .strict()
        .argv;

    await zooStats(argv);
    
    debug('main() done');
}

await main();
