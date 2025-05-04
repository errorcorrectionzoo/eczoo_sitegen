//
// Run as "yarn node bibrefs/collectBibRefs.js [...]".
//
// Try --help to get a list of options.
//

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.bibrefs');
const debuglog = debugm('EczLog');

import fs from 'fs';
import path from 'path';

import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import _ from 'lodash';

import { EczBibReferencesCollector } from '@errorcorrectionzoo/eczoohelpers_eczcollectbib/collectbib.js';

import { helperSetDefaultLogs } from '../_helpers/helperLogs.js';
import { loadEcZoo } from '../_helpers/helperEcZooLoader.js';


// ----------------------------------------------------------------------------

async function collectBibRefs(argv)
{
    helperSetDefaultLogs({ verbosityLevel: argv.verbose, quietMode: argv.quiet });
    debug(`collectBibRefs(): argv = `, argv);

    const {
        citePrefix,
        citePattern,
        domain,
        format,
        output,
        includeSourcePath,
        detailedSourcePath,
        dataDir,
        saveBibDb,
        loadBibDb,
    } = argv;

    // compile the pattern regexp
    let rxCitePattern = (citePattern != null) ? (() => {
        let m = /^\/(.*)\/([a-z]*)$/.exec(citePattern);
        if (m == null) {
            if (citePattern.startsWith('/')) {
                console.warn(`*** Warning: Provided cite-pattern starts with "/..." but failed to match the form of a regular expression syntax "/.../[flags]"`);
            }
            return new RegExp(citePattern);
        }
        const pat = m[1];
        const flags = m[2];
        const rx = new RegExp(pat, flags);
        debug(`Compiled cite-pattern regexp:`, rx);
        if (rx.global || rx.sticky) {
            console.warn(`*** Warning: Provided cite-pattern regular expression contains global (g) or sticky (y) flags.  You should avoid stateful regular expressions here (remove such flags).  Matching might fail unexpectedly.`);
        }
        return rx;
    })() : null;

    let bibcollector = new EczBibReferencesCollector();

    let eczoodb = null;

    if (loadBibDb && fs.existsSync(loadBibDb)) {
        debug(`Loading Bib DB from ‘${loadBibDb}’`);
        const data = fs.readFileSync(loadBibDb, { encoding: 'utf-8' })
        bibcollector.loadBibDbData( data );
    } else {
        if (loadBibDb != null) {
            console.warn(`Requested to load Bib DB from file ‘${loadBibDb}’ but the file does not exist.  Will load the eczoo from data.`);
        }

        debuglog(`genCodeGraph(): loading zoo... (might take several minutes)`);
        eczoodb = await loadEcZoo({
            dataDir,
            useFlmProcessor: true,
        });
        debuglog('genCodeGraph(): zoo is now loaded!');

        bibcollector.collectFromZooFlmProcessorEncountered({
            zoo_flm_processor: eczoodb.zoo_flm_processor,
            include_compiled_flm: true,
            include_encountered_in: true,
            // load all entries so that we can also filter entries after loading a data dump
            // filter_bib_entry: ...
        });
    }

    // see if we've been requested to save the data dump.
    if (saveBibDb && saveBibDb !== loadBibDb) {
        debug(`Saving Bib DB to ‘${saveBibDb}’`);
        fs.writeFileSync(saveBibDb, bibcollector.saveBibDbData());
    }

    // now, filter out selected bib entries.
    bibcollector = bibcollector.getFilteredBibDb({
        filter_bib_entry: ({ cite_prefix, cite_key, encountered_in }) => {
            if (citePrefix && citePrefix !== cite_prefix) {
                return false;
            }
            if (domain) {
                const { object_type, object_id } =
                    encountered_in.resource_info;
                if (object_type !== 'code') {
                    return false;
                }
                if (eczoodb == null) {
                    throw new Error(`Sorry, the intermediate data dump does not include domain information, meaning that cannot use --domain in conjunction with --load-bib-db.`);
                }
                const code = eczoodb.objects.code[object_id];
                const domains = eczoodb.code_parent_domains(code, { find_domain_id: domain });
                //debug(`Code ${code.code_id}'s parent domain(s) are`, domains);
                if (domains.length !== 1 || domains[0].domain_id !== domain) {
                    return false;
                }
            }
            if (rxCitePattern != null) {
                const cite_prefix_key = `${cite_prefix}:${cite_key}`;
                //debug(`Testing regexp:`, {rxCitePattern, cite_prefix_key});
                if (!rxCitePattern.test(cite_prefix_key)) {
                    return false;
                }
            }
            return true;
        },
        include_encountered_in: true
    });

    let outputData = null;

    if (['txt', 'json'].includes(format)) {
        //
        // Simple dump of the internal bib data.  Prepare a meaningful dict & dump it.
        //

        let data = {}
        for (const bibentry of Object.values(bibcollector.bib_db)) {

            const { cite_prefix, cite_key, encountered_in_list } = bibentry;

            debug(`Entry ‘${cite_prefix}:${cite_key}’ is encountered in:`, encountered_in_list);

            if (data[cite_prefix] == null) {
                data[cite_prefix] = {};
            }
            if (data[cite_prefix][cite_key] != null) {
                throw new Error(`Duplicate ‘${cite_prefix}:${cite_key}’ in internal bib structure!`);
            }
            data[cite_prefix][cite_key] = encountered_in_list.map(
                (encountered_in) => ({
                    resource_info: encountered_in.resource_info.toJSON(),
                    what: encountered_in.what,
                })
            );
        }

        //
        // Our relevant data is stored in `data`.  Now we output the information the
        // way the user requested it.
        //

        if (format === 'json') {

            let data2 = _.merge({}, data);
            if (!includeSourcePath) {
                for (const cite_prefix of [...Object.keys(data)]) {
                    for (const cite_key of [...Object.keys(data[cite_prefix])]) {
                        data[cite_prefix][cite_key] = true;
                    }
                }
            }
            outputData = JSON.stringify(data2, null, 4);

        } else if (format === 'txt') {

            let cite_prefix_list = Object.keys(data);
            cite_prefix_list.sort();
            for (const cite_prefix of cite_prefix_list) {
                const db = data[cite_prefix];
                let cite_key_list = Object.keys(db);
                cite_key_list.sort();
                for (const cite_key of cite_key_list) {
                    const db2 = db[cite_key];
                    outputData += `${cite_prefix}:${cite_key}`;
                    if (includeSourcePath) {
                        const spinfo = (x) => (
                            detailedSourcePath
                            ? x.what
                            : x.resource_info.source_path
                        );
                        // compress duplicates, include count
                        let itemsbyvalue = {};
                        for (const item of db2) {
                            const itemVal = spinfo(item);
                            if (itemsbyvalue[itemVal] != null) {
                                itemsbyvalue[itemVal] += 1;
                            } else {
                                itemsbyvalue[itemVal] = 1;
                            }
                        }
                        let values = [...Object.keys(itemsbyvalue)].sort();
                        outputData += ` :\n` + values.map(
                            (x) => `\t\t${x}${
                                itemsbyvalue[x] > 1  ? `  [×${itemsbyvalue[x]}]` : ''
                            }\n` 
                        ).join('');
                    } else {
                        outputData += `\n`;
                    }
                }
            }

        }

    } else if (format === 'bib:csl-json') {

        outputData = JSON.stringify(
            bibcollector.generateCslJsonEntries(),
            undefined, 4
        );

    } else if (format === 'bib:bibtex') {

        outputData = bibcollector.generateBibtexEntries().join('\n\n');

    } else {

        throw new Error(`Invalid format: ‘${format}’`);

    }

    if ( ! output ) {
        process.stdout.write(outputData);
    } else {
        process.stderr.write(`Writing output to ${output}\n`);
        fs.writeFileSync( output, outputData );
    }

}

// ----------------------------------------------------------------------------

//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    let Y = yargs(hideBin(process.argv));
    //terminalWidth = Y.terminalWidth() ?? 80;
    const argv = await Y
        .scriptName('collectBibRefs')
        .options({
            'cite-prefix': {
                alias: 'p',
                default: null,
                describe: "Only include citations with the given cite_prefix (e.g. 'doi' or 'arxiv')",
            },
            'cite-pattern': {
                alias: 'm',
                default: null,
                describe: "Only include citations whose entire prefix-key matches the given regular expression.  E.g. --cite-pattern='/^doi:10.\\d+\\/2897.*/ui'",
            },
            'domain': {
                alias: 'D',
                default: null,
                describe: "Only include citations in codes that belong to the given domain_id.  Does not work in conjunction with --load-bib-db.",
            },
            'format': {
                alias: 'f',
                default: 'txt',
                describe: "Output format ('txt' or 'json' or 'bib:csl-json' or 'bib:bibtex')",
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
                describe: "Whether or not to include the files where the citation was encountered (only for 'txt' and 'json' formats)",
            },
            'detailed-source-path': {
                alias: 'S',
                default: true,
                boolean: true,
                describe: "Include additional information if --include-source-path is on",
            },
            'save-bib-db': {
                alias: 'b',
                default: null,
                describe: "Save an intermediate data dump to the given file name to speed up further calls to this script using --load-bib-db.",
            },
            'load-bib-db': {
                alias: 'l',
                default: null,
                describe: "Rather than loading a zoo, load an intermediate data dump created by --save-bib-db.  Specify the same file name used for --save-bib-db.",
            },
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
        })
        .help()
        .wrap(Y.terminalWidth())
        .strict()
        .argv;

    await collectBibRefs(argv);
    
    debug('main() done');
}

await main();


// ----------------------------------------------------------------------------
