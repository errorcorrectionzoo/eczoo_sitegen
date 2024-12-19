import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselector');

import loMerge from 'lodash/merge.js';

import { PrelayoutRadialTree } from './prelayout.js';

import { connectingPathsComponents, dispCollection } from './graphtools.js';


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
 * - set/unset `layoutFadeExtra` class on elements that should appear faded
 *   as "secondary" or "extra" elements in a layout.
 *
 * Furthermore:
 *
 * - Subclasses may set `this.radialPrelayoutRootNodesPrelayoutInfo` to
 *   set the root nodes information that is used when creating the default
 *   radial prelayout with the default implementation of
 *   `this.createPrelayoutInstance()`.
 * 
 * IMPORTANT:
 * The constructor of this class must NOT assume that this subgraph
 * selector will imminently be installed!  We can create multiple
 * subgraph selector instances and then install the one we want
 * dynamically.
 */
export class EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph, options={})
    {
        this.eczCodeGraph = eczCodeGraph;
        this.eczoodb = eczCodeGraph.eczoodb;
        this.cy = eczCodeGraph.cy;
        this.options = options;

        this.radialPrelayoutRootNodesPrelayoutInfo = {};
        this.radialPrelayoutOptions = {};
    }

    /**
     * Sets the 'layoutVisible', 'layoutParent', 'layoutRoot', 'layoutFadeExtra'
     * classes as appropriate.
     * Should not assume any prior state of these classes; i.e., should unset these
     * classes on all elements that shouldn't have them.
     *
     * This function may return an object of the form
     * `{ pendingUpdateLayout: true|false }`.
     * The `pendingUpdateLayout` property indicates whether a layout update
     * should be initiated after installing the subgraph.  This value defaults
     * to true if no object is returned or if the returned
     * `pendingUpdateLayout` property is undefined or null.
     */
    installSubgraph()
    {
        const eles = this.cy.elements();
        eles.addClass('layoutVisible');
        eles.removeClass('layoutParent layoutFadeExtra');
    }

    /**
     * Updates the options of the subgraph selector.
     * 
     * The options might affect how the subgraph is selected and/or laid out, the
     * effect of these options are completely left to the implementing subclass.
     * 
     * By default, a simple property merge is performed with existing options by
     * using `Object.assign` (no recursion into subproperties).  Reimplement this
     * method if you need finer-grained merge logic.
     * 
     * In this default implementation, after setting the options to `this.options`,
     * the `installSubgraph()` method is called again to recalculate the subgraph
     * and/or layout.
     * 
     * In the default implementation, a check is made to see if the options object
     * is the same as the currently set options object (comparison with `===`).  If
     * so, nothing is done and the function returns immediately, and no graph
     * layout update is requested.
     * 
     * This function may return an object of the form
     * `{ pendingUpdateLayout: true|false }`.
     * The `pendingUpdateLayout` property indicates whether a layout update
     * should be initiated after installing the subgraph.  This value defaults
     * to true if no object is returned or if the returned
     * `pendingUpdateLayout` property is undefined or null.
     */
    setOptions(options)
    {
        if (options === this.options) {
            return { pendingUpdateLayout: false };
        }
        this.options = Object.assign({}, this.options, options);
        return this.installSubgraph();
    }

    /**
     * Removes any custom styles/classes that was set by installSubgraph().
     * 
     * This method (or its possible subclass reimplementation) does not have
     * to clean up the classes 'layoutVisible', 'layoutParent', or 'layoutRoot',
     * as they are automatically removed as necessary when the subgraph selector
     * is uninstalled.
     */
    uninstallSubgraph()
    {
    }

    /**
     * Return options about how to lay out the subgraph.
     * 
     * Subclasses should make sure this method returns a dictionary with the following
     * keys set:
     * 
     * - `reusePreviousLayoutPositions`: `true`|`false` depending on whether the subgraph
     *    should go through a layout again or whether existing node positions may be kept.
     *
     */
    getSubgraphLayoutOptions()
    {
        return {
            reusePreviousLayoutPositions: this.options?.reusePreviousLayoutPositions ?? true,
        }
    }

    createPrelayoutInstance({ rootNodeIds })
    {
        const rootNodesPrelayoutInfo = this.radialPrelayoutRootNodesPrelayoutInfo;

        let prelayoutOptions = this.radialPrelayoutOptions;

        let prelayout = new PrelayoutRadialTree({
            cy: this.cy,
            rootNodeIds,
            rootNodesPrelayoutInfo,
            prelayoutOptions,
        });

        return prelayout;
    }


    static clear(eczCodeGraph)
    {
        const cy = eczCodeGraph.cy;
        cy.elements().removeClass('layoutRoot layoutVisible layoutParent layoutFadeExtra');
    }
}



// ----------------------------------------------------------------------------



export class EczCodeGraphSubgraphSelectorAll extends EczCodeGraphSubgraphSelector
{
    installSubgraph()
    {
        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph()`);

        const allElements = this.cy.elements();
        allElements.addClass('layoutVisible');
        allElements.removeClass('layoutParent layoutFadeExtra');
        allElements.edges('[_primaryParent=1]').addClass('layoutParent');

        const globalGraphRootNodesInfo = this.eczCodeGraph.globalGraphRootNodesInfo;
        if (globalGraphRootNodesInfo.radialPrelayoutRootNodesPrelayoutInfo) {
            this.radialPrelayoutRootNodesPrelayoutInfo =
                globalGraphRootNodesInfo.radialPrelayoutRootNodesPrelayoutInfo;
        }

        for (const graphRootNodeId of globalGraphRootNodesInfo.rootNodeIds) {
            let graphRootNode = this.cy.getElementById(graphRootNodeId);
            graphRootNode.addClass('layoutRoot');
        }

        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph() done.`);
    }
}



// ----------------------------------------------------------------------------



export class EczCodeGraphSubgraphSelectorSubset extends EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph, options={})
    {
        options = loMerge(
            {
                // defaults
                reusePreviousLayoutPositions: false,
                codeIds: [],
                includeConnectedKingdomAndDomains: true,
                showIntermediateConnectingNodes: true,
                // use algorithm defaults for these by default -
                connectingNodesMaxDepth: null,
                connectingNodesMaxExtraDepth: null,
                connectingNodesOnlyKeepPathsWithAdditionalLength: null,
            },
            options
        );
        super(eczCodeGraph, options);
    }

    installSubgraph()
    {
        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph()`);
        let {
            // A list of code IDs to include in the subgraph to display.
            codeIds,

            includeConnectedKingdomAndDomains,

            showIntermediateConnectingNodes,

            // Maximal depth to explore around connected graph components to
            // try and find connecting paths.
            connectingNodesMaxDepth,

            // Once the components have been connected by paths, we continue for
            // at most `connectingNodesMaxExtraDepth` many rounds to see if some
            // other paths with similar lengths can also connect the existing
            // components.  But we stop after that.
            connectingNodesMaxExtraDepth,

            // We'll only show nodes that generate paths between components so as
            // long as these nodes participate to a path whose length is at most
            // `connectingNodesOnlyKeepPathsWithAdditionalLength` longer than
            // the shortest path connecting the given components.
            connectingNodesOnlyKeepPathsWithAdditionalLength,
        } = this.options;

        const allElements = this.cy.elements();
        const subsetCodeNodes = this.cy.collection().union( codeIds.map(
            (codeId) => this.cy.getElementById(this.eczCodeGraph.getNodeIdCode(codeId))
        ) );
        // include all internal edges
        let subsetElements = subsetCodeNodes.union(
            subsetCodeNodes.connectedEdges().filter(
                e => subsetCodeNodes.has(e.source()) && subsetCodeNodes.has(e.target())
            )
        );
        let layoutPrimaryParentEdges = subsetElements.edges('[_primaryParent=1]');

        let fadeExtraElements = this.cy.collection();
        let connectingComponentsElements = this.cy.collection();

        if (includeConnectedKingdomAndDomains) {
            // Run two iterations of picking adjascent kingdoms and domains.
            for (let repeat = 0; repeat < 2; ++repeat) {
                subsetElements = subsetElements.union(
                    subsetElements.outgoers( (ele) => {
                        return (
                            (ele.isEdge() && ele.target().data()._isKingdom)
                            || (ele.isNode() && ele.data()._isKingdom)
                            || (ele.isEdge() && ele.target().data()._isDomain)
                            || (ele.isNode() && ele.data()._isDomain)
                        );
                    } )
                );
            }
        }

        if (showIntermediateConnectingNodes) {

            const connectingPathsInfo = connectingPathsComponents({
                rootElements: subsetElements,
                allElements,
                connectingNodesMaxDepth,
                connectingNodesMaxExtraDepth,
                connectingNodesOnlyKeepPathsWithAdditionalLength,
            })

            const { connectingPaths, numComponents } = connectingPathsInfo;

            // Select all elements (nodes & edges) participating in connecting paths,
            // and mark them as "fadeExtra" layout-visible nodes.  (Of course, make
            // sure they don't belong to the original graph subset; those are
            // displayed as regular elements.)
            let participatingElementIds = {};
            for (let i = 0; i < numComponents; ++i) {
                for (let j = i + 1; j < numComponents; ++j) {
                    let paths = connectingPaths[i][j].paths;
                    for (const pathInfo of paths) {
                        for (const ele of pathInfo.path) {
                            const eId = ele.id();
                            if (!subsetElements.has(ele)
                                && participatingElementIds[eId] == null) {
                                    participatingElementIds[eId] = ele;
                            }
                        }
                    }
                }
            }
            let participatingElements = Object.values(participatingElementIds);
            connectingComponentsElements = this.cy.collection().union( participatingElements );
            debug(`Found ${participatingElements.length} connecting path elements:`,
                dispCollection(participatingElements));

            // edges of some of the connecting paths between connecting components need
            // to be promoted to layout-primary-parent edges to ensure a smooth layout.
            // proceed edge by edge until we have connected all components *once*, to avoid
            // cycles in the layout-primary-parent relationships.
            let connectingShortestPaths = [];
            // collect all the shortest connecting paths between all pairs of components
            for (let i = 0; i < numComponents; ++i) {
                for (let j = i + 1; j < numComponents; ++j) {
                    if (connectingPaths[i][j].shortestPath != null) {
                        connectingShortestPaths.push({
                            path: connectingPaths[i][j].shortestPath,
                            pathLength: connectingPaths[i][j].shortestPathLength,
                            from: i,
                            to: j,
                        });
                    }
                }
            }
            // sort these by the length of each shortest path
            connectingShortestPaths.sort( (a, b) => a.pathLength - b.pathLength );
            // now: we add edges from these shortest connecting paths up until we've
            // connected all components.  First, we'll need an object to help us
            // remember which components are already connected.
            let isLayoutParentConnected = {};
            for (let i = 0; i < numComponents; ++i) {
                isLayoutParentConnected[i] = {};
                for (let j = i + 1; j < numComponents; ++j) {
                    isLayoutParentConnected[i][j] = false;
                }
            }
            let markConnected = (from, to) => {
                if (from > to) {
                    [from, to] = [to, from];
                }
                if (isLayoutParentConnected[from][to]) {
                    return;
                }
                isLayoutParentConnected[from][to] = true;
                for (let i = 0; i < numComponents; ++i) {
                    if (i === from || i === to) {
                        continue;
                    }
                    if (isLayoutParentConnected[to][i] || isLayoutParentConnected[i][to]) {
                        markConnected(from, i);
                    }
                    if (isLayoutParentConnected[from][i] || isLayoutParentConnected[i][from]) {
                        markConnected(to, i);
                    }
                }
            };
            //
            for (const shortestPathInfo of connectingShortestPaths) {
                const { from, to, path } = shortestPathInfo;
                if (isLayoutParentConnected[from][to]) {
                    continue;
                }
                const pathEdges = this.cy.collection().union(path).edges();
                debug(`Adding path edges as layout-parents: ${dispCollection(pathEdges)}`);
                // add this path as layout-parent edges
                layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(pathEdges);
                // now mark the corresponding components are connected, plus all
                // resulting additional connections.
                markConnected(from, to);
            }

            fadeExtraElements = fadeExtraElements.union(connectingComponentsElements);
        }

        let visibleElements = subsetElements.union(fadeExtraElements);

        debug(`codeIds=${codeIds.join(',')}`);
        debug(`subsetCodeNodes=${dispCollection(subsetCodeNodes)}`);
        debug(`subsetElements=${dispCollection(subsetElements)}`);
        debug(`connectingComponentsElements=${dispCollection(connectingComponentsElements)}`);
        debug(`fadeExtraElements=${dispCollection(fadeExtraElements)}`);
        debug(`visibleElements=${dispCollection(visibleElements)}`);

        allElements.removeClass('layoutVisible layoutParent');

        subsetElements.addClass('layoutVisible');
        layoutPrimaryParentEdges.addClass('layoutParent');

        debug(`about to fadeExtraElements...`, {fadeExtraElements});
        debug(`fadeExtraElements' classes -> `, fadeExtraElements.map( e => e._private?.classes ));
        fadeExtraElements.addClass('layoutVisible layoutFadeExtra');

        // find root nodes for the layout
        visibleElements.forEach( (ele) => {
            if (!ele.isNode()) {
                return;
            }
            const eleVisOutgoers = ele.outgoers('node.layoutVisible');
            debug(`Inspecting node for root: `, {ele, eleVisOutgoers})
            if (eleVisOutgoers.length == 0) {
                // this one is a root node.
                ele.addClass('layoutRoot');
            }
        } );
        //debug(`Number of root codes for layout: `, this.cy.elements('.layoutRoot').length);

        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph() done.`);
    }

}
