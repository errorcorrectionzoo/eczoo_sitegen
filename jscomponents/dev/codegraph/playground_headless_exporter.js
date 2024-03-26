import debugm from 'debug'; const debug = debugm('ecz_playground_headless_exporter');

// import {
//     EczCodeGraph,
//     EczCodeGraphViewController
// } from '@errorcorrectionzoo/jscomponents/codegraph/index.js';

import { CodeGraphSvgExporter } from '../../codegraph/headlessGraphExporter.js';


import eczoodbData from './eczoodata.json' assert { type: 'json' };


const displayOptions = {
    displayMode: 'all', //'isolate-nodes',
    modeIsolateNodesOptions: {
        nodeIds: [
            'k_oscillators',
        ],
        range: {
            parents: {
                primary: 5,
                secondary: 3,
                extra: 0,
            },
            children: {
                primary: 2,
                secondary: 2,
                extra: 0,
            },
        },
    },
    highlightImportantNodes: {
        highlightImportantNodes: false,
        highlightPrimaryParents: false,
        highlightRootConnectingEdges: false,
    },
};

// --------------------------------------------------------

let exporter = new CodeGraphSvgExporter();

await exporter.setup();

await exporter.loadEcZooDbData(eczoodbData);

const svgData = await exporter.compileLoadedEczCodeGraph({
    displayOptions,
    //updateLayoutOptions: ...,
    //cyStyleJsonOptions: ...,
    //svgOptions: ...,
    //fitWidth: ...,
    //embedSourceSansFonts: ...,
})

debug(`Got SVG data: "${svgData.slice(0,100)}..."`);

await exporter.done();

const outFname = './tmp_plygrd_headless_output.svg';

import fs from 'fs';
fs.writeFileSync(outFname, svgData);

debug(`Saved SVG to ${outFname}`);

import child_process from 'child_process';
const outPngName = 'tmp_plygrd_headless_output.png';
child_process.spawn(
    '/opt/homebrew/bin/convert',
    [outFname, outPngName],
);

debug(`Converted PNG to ${outPngName}`);