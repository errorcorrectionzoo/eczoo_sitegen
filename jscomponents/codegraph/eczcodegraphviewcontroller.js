import loMerge from 'lodash/merge.js';

//import { EczCodeGraph } from './eczcodegraph.js';

import { EczCodeGraphSubgraphSelectorAll } from './subgraphselector.js';
import { EczCodeGraphSubgraphSelectorIsolateFamilyTree } from './subgraphselectorisolatemode.js';
import {
    EczCodeGraphFilterDomainColors,
    EczCodeGraphFilterHideSecondaryEdges,
    EczCodeGraphFilterSearchHighlight,
    EczCodeGraphFilterHighlightImportantNodes,
} from './stdgraphfilters.js';



const defaultDisplayOptions = {
    displayMode: 'all', // 'all' | 'isolate-nodes'
    modeIsolateNodesOptions: {
        nodeIds: null,
        range: {
            parents: {
                primary: 2,
                secondary: 2,
                extra: 1,
            },
            children: {
                primary: 1,
                secondary: 1,
                extra: 1,
            },
        },
        reusePreviousLayoutPositions: true,
        extraRelationSelector: 'edge',
    },
    domainColoring: true,
    cousinEdgesShown: false,
    secondaryParentEdgesShown: false,
    searchHighlightText: null,
    highlightImportantNodes: {
        highlightImportantNodes: true,
        degreeThreshold: 8,
        highlightPrimaryParents: true,
    },
};


/**
 * The view controller ensures that:
 * 
 * - Standard views are made available by installing the relevant subgraph
 *   selectors and graph filters according to simple dict options such as
 *   `displayMode: 'isolate-nodes'`;
 * 
 * - The code graph & its canvas view is in a well-defined view state given by
 *   these `displayOptions`.
 * 
 * This class is a great help for the UI based on React, which prefers to deal
 * with objects that have well-defined states.
 * 
 * See `defaultDisplayOptions` for the structure of the options.
 *      
 */
export class EczCodeGraphViewController
{
    constructor(eczCodeGraph, displayOptions)
    {
        this.getMergedDisplayOptions = EczCodeGraphViewController.getMergedDisplayOptions;
        this.eczCodeGraph = eczCodeGraph;
        this.displayOptions = EczCodeGraphViewController.getMergedDisplayOptions(
            defaultDisplayOptions,
            displayOptions ?? {}
        );
        this.subgraphSelectorInstances = {};
    }

    initialize()
    {
        this.subgraphSelectorInstances = {
            'all': new EczCodeGraphSubgraphSelectorAll(this.eczCodeGraph),
            'isolate-nodes': new EczCodeGraphSubgraphSelectorIsolateFamilyTree(this.eczCodeGraph),
        }

        this.eczCodeGraph.installSubgraphSelector(
            this.subgraphSelectorInstances.all
        );

        const graphFilterInstances = {
            domainColors: new EczCodeGraphFilterDomainColors(this.eczCodeGraph),
            hideSecondaryEdges: new EczCodeGraphFilterHideSecondaryEdges(this.eczCodeGraph),
            search: new EczCodeGraphFilterSearchHighlight(this.eczCodeGraph),
            highlightImportantNodes: new EczCodeGraphFilterHighlightImportantNodes(this.eczCodeGraph),
        };
        for (const [graphFilterName, graphFilter] of Object.entries(graphFilterInstances)) {
            this.eczCodeGraph.installGraphFilter({ graphFilterName, graphFilter });
        }

        this._setGraph();
    }

    _setGraph()
    {
        let subgraphSelector = null;
        let subgraphSelectorOptions = {};
        if (this.displayOptions.displayMode === 'all') {
            subgraphSelector = this.subgraphSelectorInstances['all'];
            subgraphSelectorOptions = {};
        } else if (this.displayOptions.displayMode === 'isolate-nodes') {
            subgraphSelector = this.subgraphSelectorInstances['isolate-nodes'];
            subgraphSelectorOptions = this.displayOptions.modeIsolateNodesOptions;
        } else {
            throw new Error(`Invalid display mode: ${this.displayOptions.displayMode}`);
        }        

        // update everything at once, as necessary.
        this.eczCodeGraph.updateSubgraphSelectorAndSetGraphFilterOptions(
            subgraphSelector,
            subgraphSelectorOptions,
            // filterOptionsDict:
            {
                domainColors: {
                    enabled: this.displayOptions.domainColoring
                },
                hideSecondaryEdges: {
                    cousinEdgesShown: this.displayOptions.cousinEdgesShown,
                    secondaryParentEdgesShown: this.displayOptions.secondaryParentEdgesShown,
                },
                search: {
                    searchText: this.displayOptions.searchHighlightText,
                },
                highlightImportantNodes: this.displayOptions.highlightImportantNodes,
            }
        );

    }

    static getMergedDisplayOptions(oldDisplayOptions, displayOptions)
    {
        if (displayOptions == null || !displayOptions) {
            return oldDisplayOptions;
        }
        let mergeResetOptions = {};
        if (displayOptions.modeIsolateNodesOptions?.nodeIds != null) {
            mergeResetOptions.modeIsolateNodesOptions = { nodeIds: null };
        }
        return loMerge(
            {},
            oldDisplayOptions,
            mergeResetOptions,
            displayOptions
        );
    }

    setDisplayOptions(displayOptions)
    {
        this.displayOptions = this.getMergedDisplayOptions(
            this.displayOptions,
            displayOptions
        );
        this._setGraph();
    }


}
