import loMerge from 'lodash/merge.js';

//import { EczCodeGraph } from './eczcodegraph.js';

import { EczCodeGraphSubgraphSelectorAll } from './subgraphselector.js';
import {
    EczCodeGraphFilterDomainColors,
    EczCodeGraphFilterHideSecondaryEdges
} from './stdgraphfilters.js';



const defaultDisplayOptions = {
    displayMode: 'all', // 'all', 'isolate-nodes'
    modeIsolateNodesOptions: {
        nodeIds: null,
        redoLayout: false,
        range: {
            parents: {
                primary: 5,
                secondary: 0,
            },
            children: {
                primary: 2,
                secondary: 0,
            },
        },
    },
    domainColoring: true,
    cousinEdgesShown: false,
    secondaryParentEdgesShown: false,
    // lowDegreeNodesDimmed: {
    //     enabled: false,
    //     degree: 8,
    //     dimLeaf: false,
    // },
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
    }

    initialize()
    {
        this.eczCodeGraph.installSubgraphSelector(
            new EczCodeGraphSubgraphSelectorAll(this.eczCodeGraph)
        );

        const graphFilterInstances = {
            domainColors: new EczCodeGraphFilterDomainColors(this.eczCodeGraph),
            hideSecondaryEdges: new EczCodeGraphFilterHideSecondaryEdges(this.eczCodeGraph),
        };
        for (const [graphFilterName, graphFilter] of Object.entries(graphFilterInstances)) {
            this.eczCodeGraph.installGraphFilter({ graphFilterName, graphFilter });
        }

        this._setGraphFilterOptions();
    }
    _setGraphFilterOptions()
    {
        this.eczCodeGraph.setGraphFilterOptions({
            domainColors: {
                enabled: this.displayOptions.domainColoring
            },
            hideSecondaryEdges: {
                cousinEdgesShown: this.displayOptions.cousinEdgesShown,
                secondaryParentEdgesShown: this.displayOptions.secondaryParentEdgesShown,
            }
        });
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
        this._setGraphFilterOptions();
    }


}
