
// for: "all" mode, "isolate" mode.
// Selects the relevant nodes & edges and sets layout-parent-edges.
/**
 * Needs to set/unset the following properties on all nodes and edges:
 *
 * - set/unset class `layoutVisible` on nodes and edges, defining which
 *   nodes/edges belong to the subgraph we want to display.
 *  
 * - set/unset `layoutParent` on edges, defining all directed parental
 *   relations that should be used for laying out the graph.  The subgraph
 *   with these edges must form a tree (no cycles) [or multiple trees].
 * 
 * - set/unset `layoutRoot` class on nodes that are root nodes of the
 *   layout.
 *
 */
export class EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph)
    {
        this.eczCodeGraph = eczCodeGraph;
        this.cy = eczCodeGraph.cy;
    }

    /**
     * Sets the 'layoutVisible', 'layoutParent', 'layoutRoot' classes as appropriate.
     * Should not assume any prior state of these classes; i.e., should unset these
     * classes on all elements that shouldn't have them.
     *
     * The `previousSubgraphLayoutInformation` is the subgraph layout information returned
     * by the previous subgraph
     */
    installSubgraph({ previousSubgraphLayoutInformation })
    {
        const eles = this.cy.elements();
        eles.addClass('layoutVisible');
        eles.removeClass('layoutParent');
    }

    /**
     * 
     *
     */
    getSubgraphLayoutInformation()
    {
        .........
        return {
            reusePreviousLayoutPositions,
        }
    }

    createPrelayoutInstance({ rootNodeIds })
    {
    }


    static clear(eczCodeGraph)
    {
        const cy = eczCodeGraph.cy;
        cy.elements().removeClass(['layoutVisible', 'layoutParent']);
    }
}


export class EczCodeGraphSubgraphSelectorAll extends EczCodeGraphSubgraphSelector
{
    installSubgraph()
    {
        const allElements = this.cy.elements();
        allElements.addClass('layoutVisible');
        allElements.removeClass('layoutParent');
        allElements.edges('[_primaryParent=1]').addClass('layoutParent');
        let rootNodeIds = this.eczCodeGraph.getOverallRootNodeIds();
        ...
    }
}


export class EczCodeGraphSubgraphSelectorIsolateFamilyTree extends EczCodeGraphSubgraphSelector
{
    installSubgraph()
    {
        this.cy.elements().removeClass('layoutVisible');
        this.cy.edges('[_primaryParent=1]').addClass('layoutParent');
        let rootNodeIds = this.eczCodeGraph.getOverallRootNodeIds();
        ...
    }
}
