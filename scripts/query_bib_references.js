//
// Run as "yarn node scripts/query_bib_references.js [...]".
// Try --help to get a list of options.
//

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.query_bib_references');

import fs from 'fs';

import _ from 'lodash';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { loadEcZoo } from './helperEcZooLoader.js';

//
// Core script function. Loads the zoo and performs the desired analysis.
//
async function runmain(args)
{
    process.stderr.write('runmain(): loading zoo... (might take a couple minutes)\n');
    const eczoodb = await loadEcZoo({ dataDir: args.dataDir });

    process.stderr.write('runmain(): zoo is now loaded!\n');

    //
    // Zoo is loaded (eczoodb). Query anything we need from it at this point.
    //

    const encountered_citations = eczoodb.zoo_flm_processor.scanner.get_encountered('citations');

    let data = {};

    for (const encountered_citation of encountered_citations) {
        //debug(`encountered citation, `, encountered_citation);
        const { cite_prefix, cite_key } = encountered_citation;
        const { object_type, object_id, source_path } =
            encountered_citation.encountered_in.resource_info;
        if (args.citePrefix && args.citePrefix !== cite_prefix) {
            continue;
        }
        if (args.domain) {
            if (object_type !== 'code') {
                continue;
            }
            const code = eczoodb.objects.code[object_id];
            const domains = eczoodb.code_parent_domains(code, { find_domain_id: args.domain });
            //debug(`Code ${code.code_id}'s parent domain(s) are`, domains);
            if (domains.length !== 1 || domains[0].domain_id !== args.domain) {
                continue;
            }
        }
        if (data[cite_prefix] == null) {
            data[cite_prefix] = {};
        }
        if (data[cite_prefix][cite_key] == null) {
            data[cite_prefix][cite_key] = [];
        }
        data[cite_prefix][cite_key].push({ source_path });
    }

    //
    // Our relevant data is stored in `data`.  Now we output the information the
    // way the user requested it.
    //

    let outputData = '';

    if (args.format === 'json') {

        let data2 = _.merge({}, data);
        if (!args.includeSourcePath) {
            for (const cite_prefix of [...Object.keys(data)]) {
                for (const cite_key of [...Object.keys(data[cite_prefix])]) {
                    data[cite_prefix][cite_key] = true;
                }
            }
        }
        outputData = JSON.stringify(data2, null, 4);

    } else if (args.format === 'txt') {

        let cite_prefix_list = Object.keys(data);
        cite_prefix_list.sort();
        for (const cite_prefix of cite_prefix_list) {
            const db = data[cite_prefix];
            let cite_key_list = Object.keys(db);
            cite_key_list.sort();
            for (const cite_key of cite_key_list) {
                const db2 = db[cite_key];
                outputData += `${cite_prefix}:${cite_key}`;
                if (args.includeSourcePath) {
                    outputData += ` :\n` + db2.map( (x) => `\t\t${x.source_path}\n` ).join('');
                } else {
                    outputData += `\n`;
                }
            }
        }

    }

    if ( ! args.output ) {
        process.stdout.write(outputData);
    } else {
        process.stderr.write(`Writing output to ${args.output}\n`);
        fs.writeFileSync( args.output, outputData );
    }

    return;
}


//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    const args = yargs(hideBin(process.argv))
        .scriptName('query_bib_references')
        .usage('Usage: $0 [options]')
        .options({
            'data-dir': {
                alias: 'd',
                default: null,
                describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
            },
            'cite-prefix': {
                alias: 'p',
                default: null,
                describe: "Only include citations with the given cite_prefix (e.g. 'doi' or 'arxiv')",
            },
            'domain': {
                alias: 'D',
                default: null,
                describe: "Only include citations in codes that belong to the given domain_id",
            },
            'format': {
                alias: 'f',
                default: 'txt',
                describe: "Output format ('txt' or 'json')",
            },
            'output': {
                alias: 'o',
                default: null,
                describe: "Output file to write to (default stdout)",
            },
            'include-source-path': {
                alias: 's',
                default: true,
                boolean: true,
                describe: "Whether or not to include the files where the citation was encountered",
            },
        })
        .strictOptions()
        .argv
    ;

    await runmain(args);
}

await main();
