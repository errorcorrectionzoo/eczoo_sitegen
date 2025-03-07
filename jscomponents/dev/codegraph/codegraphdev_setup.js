import debugm from 'debug';
const debug = debugm('codegraph_page_main');

function isStrict() { return !this; }
if (!isStrict()) {
    throw new Error(`Not strict mode!`);
}

const initialDisplayOptions = {
    "displayMode": "subset",
    "modeSubsetOptions": {
        "codeIds": [
            "balanced",
            "combinatorial_design", "constant_weight", "hadamard", "one_hot", "one_vs_one","tetracode","weight_two","simplex","simplex734","q-ary_simplex"
        ],
        "reusePreviousLayoutPositions": false,
        "showIntermediateConnectingNodes": false,
        "connectingNodesMaxDepth": 25,
        "connectingNodesPathMaxLength": 3.5,
        "connectingNodesMaxExtraDepth": 3,
        "connectingNodesOnlyKeepPathsWithAdditionalLength":0,
        "connectingNodesToDomainsAndKingdoms": true,
        "connectingNodesToDomainsAndKingdomsMaxLength": 2,
        "connectingNodesEdgeLengthsByType": {
            "primaryParent": 1,
            "secondaryParent": 1.2,
            "cousin": 1.2
        }
    },
    "domainColoring": true,
    "cousinEdgesShown": true,
    "secondaryParentEdgesShown": true,
    "highlightImportantNodes": {
        "highlightImportantNodes": true,
        "degreeThreshold": 8,
        "highlightPrimaryParents": true,
        "highlightRootConnectingEdges": false
    },
    "searchHighlightText": null
};

const initialDisplayOptions_alt2 = {
    "displayMode": "subset",
    "modeIsolateNodesOptions": {
        "nodeIds": null,
        "range": {
            "parents": {
                "primary": 2,
                "secondary": 2,
                "extra": 1
            },
            "children": {
                "primary": 1,
                "secondary": 1,
                "extra": 1
            }
        },
        "reusePreviousLayoutPositions": true,
        "extraRelationSelector": "edge"
    },
    "modeSubsetOptions": {
        "codeIds": [
            "2d_color",
            "two_dimensional_hyperbolic_surface",
            "2d_stabilizer",
            "tqd_abelian",
            "quantum_double_abelian",
            "analog_surface",
            "qcga",
            "clifford-deformed_surface",
            "compactified_r",
            "double_semion",
            "stab_5_1_3",
            "gkp_surface_concatenated",
            "galois_color",
            "galois_topological",
            "triangular_color",
            "surface",
            "matching",
            "qudit_surface",
            "rotated_surface",
            "square_lattice_cluster",
            "488_color",
            "stellated_color",
            "toric",
            "triangle_surface",
            "4612_color",
            "twist_defect_color",
            "twist_defect_surface",
            "twisted_xzzx",
            "union_jack_color",
            "xysurface",
            "xyz_color",
            "xyz_hexagonal",
            "xzzx",
            "chern_simons_gkp",
            "stab_13_1_5",
            "rhombic_dodecahedron_surface",
            "gross",
            "stab_17_1_5",
            "stellated_dodecahedron_css",
            "stab_4_2_2",
            "stab_5_1_2",
            "stab_6_4_2",
            "steane",
            "twist_defect_7_1_3",
            "shor_nine",
            "surface-17",
            "stab_9_1_3"
        ],
        "reusePreviousLayoutPositions": false,
        "showIntermediateConnectingNodes": true,
        "connectingNodesMaxDepth": 25,
        "connectingNodesPathMaxLength": 3.5,
        "connectingNodesMaxExtraDepth": 3,
        "connectingNodesOnlyKeepPathsWithAdditionalLength": 0,
        "connectingNodesToDomainsAndKingdoms": true,
        "connectingNodesEdgeLengthsByType": {
            "primaryParent": 1,
            "secondaryParent": 1.2,
            "cousin": 1.2
        }
    },
    "domainColoring": true,
    "cousinEdgesShown": true,
    "secondaryParentEdgesShown": true,
    "highlightImportantNodes": {
        "highlightImportantNodes": true,
        "degreeThreshold": 8,
        "highlightPrimaryParents": true,
        "highlightRootConnectingEdges": false
    },
    "searchHighlightText": null
};


const initialDisplayOptions_alt0 = {
    "displayMode": "subset",
    "modeIsolateNodesOptions": {
        "nodeIds": null,
        "range": {
            "parents": {
                "primary": 2,
                "secondary": 2,
                "extra": 1
            },
            "children": {
                "primary": 1,
                "secondary": 1,
                "extra": 1
            }
        },
        "reusePreviousLayoutPositions": true,
        "extraRelationSelector": "edge"
    },
    "modeSubsetOptions": {
        "codeIds": [
            "2d_color",
            "two_dimensional_hyperbolic_surface",
            "2d_stabilizer",
            "tqd_abelian",
            "quantum_double_abelian",
            "analog_surface",
            "qcga",
            "clifford-deformed_surface",
            "compactified_r",
            "double_semion",
            "stab_5_1_3",
            "gkp_surface_concatenated",
            "galois_color",
            "galois_topological",
            "triangular_color",
            "surface",
            "matching",
            "qudit_surface",
            "rotated_surface",
            "square_lattice_cluster",
            "488_color",
            "stellated_color",
            "toric",
            "triangle_surface",
            "4612_color",
            "twist_defect_color",
            "twist_defect_surface",
            "twisted_xzzx",
            "union_jack_color",
            "xysurface",
            "xyz_color",
            "xyz_hexagonal",
            "xzzx",
            "chern_simons_gkp",
            "stab_13_1_5",
            "rhombic_dodecahedron_surface",
            "gross",
            "stab_17_1_5",
            "stellated_dodecahedron_css",
            "stab_4_2_2",
            "stab_5_1_2",
            "stab_6_4_2",
            "steane",
            "twist_defect_7_1_3",
            "shor_nine",
            "surface-17",
            "stab_9_1_3"
        ],
        "reusePreviousLayoutPositions": false,
        "showIntermediateConnectingNodes": true,
        connectingNodesPathMaxLength: 2, //3.5,
        connectingNodesMaxDepth: 15,
        connectingNodesMaxExtraDepth: 3,
        connectingNodesToDomainsAndKingdoms: true,
        connectingNodesToDomainsAndKingdomsMaxLength: 1,
        connectingNodesOnlyKeepPathsWithAdditionalLength: 0,
        connectingNodesEdgeLengthsByType: {
            primaryParent: 1,
            secondaryParent: 1.2,
            cousin: 1.2,
        },
    },
    "domainColoring": true,
    "cousinEdgesShown": true,
    "secondaryParentEdgesShown": true,
    "highlightImportantNodes": {
        "highlightImportantNodes": true,
        "degreeThreshold": 8,
        "highlightPrimaryParents": true,
        "highlightRootConnectingEdges": false
    },
    "searchHighlightText": null
};


const initialDisplayOptions_alt = {
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
            'css', 'stabilizer', 'surface', 'heavy_hex', 'ecc',  'qubits_into_qubits',
            "weight_two", "quantum_repetition", "graph_quantum", //"knill",
            //'css', 'qubits_into_qubits', 'surface', 'testcode',
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
        connectingNodesPathMaxLength: 2, //3.5,
        connectingNodesMaxDepth: 15,
        connectingNodesMaxExtraDepth: 3,
        connectingNodesOnlyKeepPathsWithAdditionalLength: 0, connectingNodesToDomainsAndKingdoms: true,
        connectingNodesToDomainsAndKingdomsMaxLength: 0,
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
    alwaysSkipCoseLayout: true, //false,
    overrideCoseLayoutOptions: {
        //quality: "proof",
        //nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 75,
        edgeElasticity: 0.3,
        nodeRepulsion: 9000,
        // relativePlacementConstraint: [
        //     // {
        //     //     "top": "c_stabilizer",
        //     //     "bottom": "c_css",
        //     //     "gap": 0
        //     // },
        //     // {
        //     //     "top": "c_css",
        //     //     "bottom": "c_surface",
        //     //     "gap": 0
        //     // },
        //     {
        //         "top": "c_stabilizer",
        //         "bottom": "c_testcode",
        //         "gap": 10
        //     }
        // ]
    }
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
