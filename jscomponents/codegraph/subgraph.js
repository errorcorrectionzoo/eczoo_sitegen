
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
 */
export class EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph)
    {
        this.eczCodeGraph = eczCodeGraph;
        this.cy = eczCodeGraph.cy;
    }
    applySubgraph()
    {
        const eles = this.cy.elements();
        eles.addClass('layoutVisible');
        eles.removeClass('layoutParent');
    }
}

export class EczCodeGraphSubgraphSelectorAll extends EczCodeGraphSubgraphSelector
{
    applySubgraph()
    {
        this.cy.elements().addClass('layoutVisible');
        this.cy.edges('[_primaryParent=1]').addClass('layoutParent');
    }
}
