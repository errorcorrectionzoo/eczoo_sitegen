import debugm from 'debug';
const debug = debugm('codegraph_page_main');

function isStrict() { return !this; }
if (!isStrict()) {
    throw new Error(`Not strict mode!`);
}


const initialDisplayOptions = {
  cousinEdgesShown: true,
  secondaryParentEdgesShown: true,

//   displayMode: 'isolate-nodes',
//   modeIsolateNodesOptions: {
//     nodeIds: [ 'c_css', 'c_stabilizer', 'c_surface' ],
//     reusePreviousLayoutPositions: false,
//     range: {
//       parents: {
//           primary: 2,
//           secondary: 1,
//           extra: 0,
//       },
//       children: {
//           primary: 2,
//           secondary: 1,
//           extra: 0,
//       },
//     },
//   },

    displayMode: 'subset',
    modeSubsetOptions: {
        codeIds: [
            'css', 'stabilizer', 'surface', 'heavy_hex', 'ecc'
            //'css', 'qubits_into_qubits', 'surface'
        ],
        //showIntermediateConnectingNodes: true,
        //
        // connectingNodesPathMaxLength: 20,
        // connectingNodesMaxDepth: 15,
        // connectingNodesMaxExtraDepth: 3,
        // connectingNodesOnlyKeepPathsWithAdditionalLength: 0,
        // connectingNodesEdgeLengthsByType: {
        //     primaryParent: 1,
        //     secondaryParent: 4,
        //     cousin: 15,
        // },
        //
        connectingNodesPathMaxLength: 3.5,
        connectingNodesMaxDepth: 15,
        connectingNodesMaxExtraDepth: 3,
        connectingNodesOnlyKeepPathsWithAdditionalLength: 0,
        connectingNodesEdgeLengthsByType: {
            primaryParent: 1,
            secondaryParent: 1.2,
            cousin: 1.2,
        },
    },

    highlightImportantNodes: {
        highlightImportantNodes: true,
        highlightPrimaryParents: true,
        highlightRootConnectingEdges: false,
    },
};

const initialGraphGlobalOptions = {
    useCodeShortNamesForLabels: false,
    //alwaysSkipCoseLayout: true,
};




debug('Running code graph dev setup ...');
console.log("Running code graph dev setup. If you don't see debug messages run localStorage.debug='*'");

import eczoodbData from './eczoodata.json';
//import eczoodbData from './eczoodata-test.json';

window.eczData = { eczoodbData };

import * as codegraphsetup from '../../codegraph/setup.js';
import * as mathjax from '../../mathjax/setup.js';

window.addEventListener('load', async function () {
    await mathjax.load();
    await codegraphsetup.load({
        displayOptions: initialDisplayOptions,
        graphGlobalOptions: initialGraphGlobalOptions,
    });
    debug(`window load handler - code graph setup done!`);
    window.eczcodegraphdebug = () => {
        window.eczCodeGraph.cy.elements().toggleClass('DEBUG');
        window.eczCodeGraph.graphGlobalOptions.alwaysSkipCoseLayout =
            ! window.eczCodeGraph.graphGlobalOptions.alwaysSkipCoseLayout;
    };
    console.info('Type eczcodegraphdebug() to enable visual DEBUG mode!');
});
