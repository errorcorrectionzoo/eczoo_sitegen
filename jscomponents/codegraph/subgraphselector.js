import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselector');

import loMerge from 'lodash/merge.js';

import { PrelayoutRadialTree } from './prelayout.js';


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
     * Sets the 'layoutVisible', 'layoutParent', 'layoutRoot' classes as appropriate.
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
        eles.removeClass('layoutParent');
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

        prelayoutOptions = loMerge({
            origin: {
                position: { x: 0, y: 0 },
                angularSpread: 2*Math.PI,
                useWeights: false,
            },
            // layoutParentEdgeSelector: '.layoutParent',
            weightCalcLevels: 6,
            weightCalcSecondaryFactor: 0.3,
        }, prelayoutOptions);

        let prelayout = new PrelayoutRadialTree({
            cy: this.cy,
            rootNodeIds,
            rootNodesPrelayoutInfo,
            options: prelayoutOptions,
        });

        return prelayout;
    }


    static clear(eczCodeGraph)
    {
        const cy = eczCodeGraph.cy;
        cy.elements().removeClass(['layoutRoot', 'layoutVisible', 'layoutParent']);
    }
}




export class EczCodeGraphSubgraphSelectorAll extends EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph, options={})
    {
        options = loMerge(
            {
                rootPositioning: {
                    rootAbstractCodesXSpacing: 750,
                    rootAbstractCodesYPosition: 0,
                    rootAbstractCodesYPositionSingleOffset: 150,
                    domainNodesXSpacing: 750,
                    domainNodesYPosition: 250,
                    domainNodesYPositionSingleOffset: 150,
                },
                customDomainIdsOrder:  {
                    classical_domain: -100,
                    quantum_domain: 100,
                }
            },
            options
        );
        super(eczCodeGraph, options);
    }

    installSubgraph()
    {
        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph()`);

        const allElements = this.cy.elements();
        allElements.addClass('layoutVisible');
        allElements.removeClass('layoutParent');
        allElements.edges('[_primaryParent=1]').addClass('layoutParent');

        // Find out where to position the graph root nodes

        const eczCodeGraph = this.eczCodeGraph;
        const cy = this.cy;
        const eczoodb = this.eczoodb;

        const {
            rootPositioning,
            customDomainIdsOrder
        } = this.options;
        
        const {
            rootAbstractCodesXSpacing,
            rootAbstractCodesYPosition,
            rootAbstractCodesYPositionSingleOffset,
            domainNodesXSpacing,
            domainNodesYPosition,
            domainNodesYPositionSingleOffset,
        } = rootPositioning;

        let rootNodesPrelayoutInfo = {};
        let domainIds = Object.keys(eczoodb.objects.domain);

        debug(`Domains before custom ordering: ${domainIds}`);

        domainIds.sort(
            (aId, bId) => (customDomainIdsOrder[aId] ?? 0) - (customDomainIdsOrder[bId] ?? 0)
        );
        debug(`Domains after custom ordering: ${domainIds}`);

        for (const [j, domainId] of domainIds.entries()) {
            const nodeId = eczCodeGraph.getNodeIdDomain(domainId);
            rootNodesPrelayoutInfo[nodeId] = {
                position: {
                    x: (j - (domainIds.length-1)/2) * domainNodesXSpacing,
                    y: domainNodesYPosition
                       + Math.min(j, domainIds.length-1-j) * domainNodesYPositionSingleOffset
                },
                radiusOffset: 50,
                direction: Math.PI - Math.PI * (j+0.5) / domainIds.length,
                angularSpread: Math.PI / domainIds.length,
            };
        }
        // these are abstract property codes:
        let rootCodeNodeIds = eczCodeGraph.getOverallRootNodeIds({ includeDomains: false });
        //debug(`rootCodeNodeIds = `, rootCodeNodeIds);
        for (const [j, codeNodeId] of rootCodeNodeIds.entries()) {
            rootNodesPrelayoutInfo[codeNodeId] = {
                position: {
                    x: (j - (rootCodeNodeIds.length-1)/2) * rootAbstractCodesXSpacing,
                    y: rootAbstractCodesYPosition
                       - Math.min(j, rootCodeNodeIds.length-1-j) * rootAbstractCodesYPositionSingleOffset
                },
                radiusOffset: 50,
                direction: Math.PI + Math.PI * (j+0.5) / rootCodeNodeIds.length,
                angularSpread: Math.PI / rootCodeNodeIds.length,
            };
        }

        debug(`rootNodesPrelayoutInfo = `, rootNodesPrelayoutInfo);

        this.radialPrelayoutRootNodesPrelayoutInfo = rootNodesPrelayoutInfo;

        for (const graphRootNodeId
             of Object.keys( rootNodesPrelayoutInfo )) {
            let graphRootNode = cy.getElementById(graphRootNodeId);
            graphRootNode.addClass('layoutRoot');
        }

        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph() done.`);
    }
}
