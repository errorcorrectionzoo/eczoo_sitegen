import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.genCodeGraph');
const debuglog = debugm('EczLog');

import fs from 'fs';
import path from 'path';

import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import readlinePromises from 'node:readline/promises';

import _ from 'lodash';


import { helperSetDefaultLogs } from '../_helpers/helperLogs.js';
import { loadEcZoo } from '../_helpers/helperEcZooLoader.js';


import {
    CodeGraphSvgExporter,
} from '@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js';


//const __filename = import.meta.__filename;
//const __dirname = import.meta.dirname;



const defaultOptions = {
    cyStyleOptions: {
        fontFamily: 'Source Sans Pro',
        fontSize: 18,
    },
    fitWidth: 1200,
    importSourceSansFonts: true,
    // svgOptions: {
    //     scale: 1.0,
    // }
};



//Error.stackTraceLimit = 999;

async function genCodeGraph(argv)
{
    helperSetDefaultLogs({ verbosityLevel: argv.verbose, quietMode: argv.quiet });
    debug(`genCodeGraph(): argv = `, argv);

    const {
        dataDir,
        graphOptionsJsFile,
        output: outputFileName,
    } = argv;

    debuglog(`genCodeGraph(): loading zoo... (might take several minutes)`);
    const eczoodb = await loadEcZoo({
        dataDir,
        useFlmProcessor: true,
    });
    debuglog('genCodeGraph(): zoo is now loaded!');


    let codeGraphExporter = new CodeGraphSvgExporter({
        //autoCloseMs: 5 * 60 * 1000, // 5 minutes
    });

    await codeGraphExporter.setup();

    const rl = readlinePromises.createInterface({ input: process.stdin, output: process.stdout });

    try {

        const eczoodbData = await eczoodb.data_dump({});
        await codeGraphExporter.loadEcZooDbData(eczoodbData);

        //
        // generate a graph!
        //
        let version = 0;
        while (true) {

            ++version;
            const graphOptions = (await import(`./${graphOptionsJsFile}?v=${version}`)).default;

            const options = _.merge(
                {},
                defaultOptions,
                graphOptions,
            );

            const svgData = await codeGraphExporter.compileLoadedEczCodeGraph({
                ...options,
            });

            fs.writeFileSync(outputFileName, svgData);

            let userResponse = await rl.question(`
Wrote graph to ${outputFileName}.
If you'd like to update the graph, edit graph_options.js and hit ENTER.
To quit, type ‘q’ and hit ENTER.
`);
            if (userResponse.trim().toLowerCase() === 'q') {
                break;
            }
        }

    } finally {

        rl.close();
        codeGraphExporter.done();

    }
}


//let terminalWidth = null;

//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    let Y = yargs(hideBin(process.argv));
    //terminalWidth = Y.terminalWidth() ?? 80;
    const argv = await Y
        .scriptName('genCodeGraph')
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
            'graph-options-js-file': {
                default: 'my_graph_options.js',
                describe: `JS module containing the graph options to apply.  The module should provide an options object as default export. The object should at least contain the key 'displayOptions' with relevant options.  The object is passed as is to CodeGraphExporter.compileLoadedEczCodeGraph().`
            },
            'output': {
                alias: 'o',
                default: 'code_graph_output.svg',
                describe: 'The output file to write the SVG figure to.',
            }
        })
        .help()
        .wrap(Y.terminalWidth())
        .strict()
        .argv;

    await genCodeGraph(argv);
    
    debug('main() done');
}

await main();


   
