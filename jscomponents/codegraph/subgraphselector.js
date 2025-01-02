import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselector');

import loIsEqual from 'lodash/isEqual.js';

import { PrelayoutRadialTree } from './prelayout.js';


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

        this.isCurrentlyInstalled = false;

        this.radialPrelayoutRootNodesPrelayoutInfo = {};
        this.radialPrelayoutOptions = {};
    }

    _markSubgraphInstalled(installed)
    {
        this.isCurrentlyInstalled = installed;
    }

    /**
     * Sets the 'layoutVisible', 'layoutParent', 'layoutRoot', 'layoutFadeExtra'
     * classes as appropriate.
     * Should not assume any prior state of these classes; i.e., should unset these
     * classes on all elements that shouldn't have them.
     * 
     * DO NOT FORGET to call `this._markSubgraphInstalled(true);`.
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
        this._markSubgraphInstalled(true);

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
     * and/or layout (but only if this subgraph is currently marked as being
     * installed).
     * 
     * In the default implementation, a check is made to see if the options object
     * is the same as the currently set options object (deep equality comparison
     * using lodash's `_.isEqual(...)`).  If
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
        if (loIsEqual(options, this.options)) {
            return { pendingUpdateLayout: false };
        }
        debug(`EczCodeGraphSubgraphSelector.setOptions(): setting new options`,
              { options, thisOptions: this.options });
        this.options = Object.assign({}, this.options, options);
        if (!this.isCurrentlyInstalled) {
            return null;
        }
        return this.installSubgraph();
    }

    /**
     * Removes any custom styles/classes that was set by installSubgraph().
     * 
     * This method (or its possible subclass reimplementation) does not have
     * to clean up the classes 'layoutVisible', 'layoutParent', or 'layoutRoot',
     * as they are automatically removed as necessary when the subgraph selector
     * is uninstalled.
     * 
     * DO NOT FORGET to call `this._markSubgraphInstalled(false);`
     */
    uninstallSubgraph()
    {
        this._markSubgraphInstalled(false);
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


