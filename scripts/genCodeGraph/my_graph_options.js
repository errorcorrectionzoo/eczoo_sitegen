
const _junk = {
    "graphGlobalOptions":{
        "rootPositioning":{"rootNodesCircleXRadius":500,"rootNodesCircleYRadius":300},"customDomainIdsOrder":{"classical_domain":-100,"quantum_domain":100},
        "useCodeShortNamesForLabels":false,"alwaysSkipCoseLayout":false,
        "overrideCoseLayoutOptions": {
            idealEdgeLength: 50, edgeElasticity: 1.5, nodeRepulsion: 100000
        }
    },
    "displayOptions":{
        "displayMode":"subset","modeSubsetOptions":{"codeIds":[
            "binomial","bosonic_q-ary_expansion","bosonic_rotation","cat","chebyshev","chuang-leung-yamamoto","dual_rail","fock_state","matrix_qm","number_phase","one_hot_quantum","constant_excitation_permutation_invariant","paircat","two-legged-cat","two-mode_binomial","very-small-logical-qubit","wasilewski-banaszek","chi2"
            // "balanced","combinatorial_design","constant_weight","hadamard","one_hot","one_vs_one","tetracode","weight_two","simplex","simplex734","q-ary_simplex"
        ],"reusePreviousLayoutPositions":false,"showIntermediateConnectingNodes":true,},"domainColoring":true,"cousinEdgesShown":true,"secondaryParentEdgesShown":true,"highlightImportantNodes":{"highlightImportantNodes":true,"degreeThreshold":8,"highlightPrimaryParents":true,"highlightRootConnectingEdges":false},"searchHighlightText":null
    },
    //fitWidth: 800,
}
;

export default {
    graphGlobalOptions: {
    //     "rootPositioning": {
    //         "rootNodesCircleXRadius": 500,
    //         "rootNodesCircleYRadius": 300
    //     },
    //     "customDomainIdsOrder": {
    //         "classical_domain": -100,
    //         "quantum_domain": 100
    //     },
    //     "useCodeShortNamesForLabels": false,
    //    "alwaysSkipCoseLayout": true,
    //     "overrideCoseLayoutOptions": {
    //         "quality": "proof",
    //         "nodeDimensionsIncludeLabels": true,
    //         "idealEdgeLength": 75,
    //         "edgeElasticity": 0.3,
    //         "nodeRepulsion": 2000,
    //         "relativePlacementConstraint": [
    //             // {
    //             //     "top": "c_stabilizer",
    //             //     "bottom": "c_css",
    //             //     "gap": 0
    //             // },
    //         ]
    //     }
    },
    displayOptions: {
        "displayMode":"subset",
        "modeSubsetOptions": {
            "codeIds": ["css","surface","testcode","stabilizer","qubits_into_qubits"],
            "reusePreviousLayoutPositions": false,
            "showIntermediateConnectingNodes": true,
            "nodeIds": []
        },
        cousinEdgesShown: true,
        secondaryParentEdgesShown: true,
        "highlightImportantNodes": {
            "highlightImportantNodes": true,
            "highlightPrimaryParents": true,
            "highlightRootConnectingEdges": true,
        }
    },
}
