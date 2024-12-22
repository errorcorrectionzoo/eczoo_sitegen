import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselectorisolatemode');

import loMerge from 'lodash/merge.js';
import loIsEqual from 'lodash/isEqual.js';

import { EczCodeGraphSubgraphSelector } from './subgraphselector.js';

export class EczCodeGraphSubgraphSelectorIsolateFamilyTree extends EczCodeGraphSubgraphSelector
{
    constructor(eczCodeGraph, options={})
    {
        options = loMerge(
            {
                reusePreviousLayoutPositions: true,
                nodeIds: [],
                range: {
                    parents: {
                        primary: 5,
                        secondary: 5,
                        extra: 0,
                    },
                    children: {
                        primary: 2,
                        secondary: 2,
                        extra: 0,
                    },
                },
                extraRelationSelector: 'edge',
            },
            options
        );
        super(eczCodeGraph, options);
    }

    installSubgraph()
    {
        const {
            nodeIds,
            range,
            extraRelationSelector
        } = this.options;

        debug(`installSubgraph(). options =`, this.options);

        this.cy.batch( () => {

            this.cy.elements().removeClass([
                'layoutVisible', 'layoutRoot', 'layoutParent',
                'layoutFadeExtra',
                'isolationRoot',
                'isolationRootConnectingEdge',
            ]);
            //this.cy.edges('[_primaryParent=1]').addClass('layoutParent'); // not automatically!
            
            // add selected root nodes to the layout.
            for (const nodeId of nodeIds) {
                this.cy.getElementById(nodeId).addClass(
                    ['layoutRoot', 'layoutVisible', 'isolationRoot']
                );
            }

            let rootNodes = this.cy.nodes('.layoutVisible');

            // expand the graph, following primary parent relationships.
            let primaryParentElements = rootNodes;
            for (let step = 0; step < range.parents.primary; ++step) {
                let edges = primaryParentElements.outgoers('[_primaryParent=1]'); // only the edges
                edges.addClass('layoutParent');
                primaryParentElements = primaryParentElements.union(edges).union(edges.connectedNodes());
            }

            let primaryChildElements = rootNodes;
            for (let step = 0; step < range.children.primary; ++step) {
                let edges = primaryChildElements.incomers('[_primaryParent=1]'); // only the edges
                edges.addClass('layoutParent');
                primaryChildElements = primaryChildElements.union(edges).union(edges.connectedNodes());
            }

            let seenNodeIds = new Set();
            primaryParentElements.forEach( (n) => seenNodeIds.add(n.id()) );
            primaryChildElements.forEach( (n) => seenNodeIds.add(n.id()) );

            // Further expand the graph, including secondary parent relationships.
            // We need to start again from rootNodes for the counting to work out correctly;
            // we'll rediscover our primary parents but the important thing is to be able to
            // track when an edge needs to be included in the .layoutParent main edge tree
            let secondaryParentElements = rootNodes;
            for (let step = 0; step < range.parents.secondary; ++step) {
                let edges = secondaryParentElements.outgoers('[_relType="parent"]'); // only the edges
                edges.forEach( (edge) => {
                    // mark the edge as being a directing edge for the layout if it needs to be one
                    // for this subgraph.
                    const node = edge.target();
                    const nodeId = node.id();
                    if (!seenNodeIds.has(nodeId)) {
                        edge.addClass('layoutParent');
                        seenNodeIds.add(nodeId);
                    }
                } );
                secondaryParentElements =
                    secondaryParentElements.union(edges).union(edges.connectedNodes());
            }
            let secondaryChildElements = rootNodes;
            for (let step = 0; step < range.parents.secondary; ++step) {
                let edges = secondaryChildElements.incomers('[_relType="parent"]'); // only the edges
                edges.forEach( (edge) => {
                    // mark the edge as being a directing edge for the layout if it needs to be one
                    // for this subgraph.
                    const node = edge.source();
                    const nodeId = node.id();
                    if (!seenNodeIds.has(nodeId)) {
                        edge.addClass('layoutParent');
                        seenNodeIds.add(nodeId);
                    }
                } );
                secondaryChildElements =
                    secondaryChildElements.union(edges).union(edges.connectedNodes());
            }

            let mainNodes = primaryParentElements.union(primaryChildElements)
                .union(secondaryParentElements).union(secondaryChildElements);

            debug(`mainNodes are `, mainNodes, `extra relation selector = `, extraRelationSelector);

            // Expand the graph even further, including opposite-direction parent relationships
            // and/or cousin relationships.
            let allElements = mainNodes;
            let maxExtra = Math.max(range.parents.extra ?? 0, range.children.extra ?? 0);
            debug(`range = `, range, `maxExtra = `, maxExtra);
            for (let step = 0; step < maxExtra; ++step) {
                debug(`Processing extra/neighbor nodes step ${step}. allElements = `, allElements);
                let outElements = [];
                let inElements = [];
                if (step < range.parents.extra) {
                    let outEdges = allElements.outgoers(extraRelationSelector);
                    outEdges.forEach( (edge) => {
                        if (!edge.isEdge()) { return }
                        // mark the edge as being a directing edge for the layout if it needs to be one
                        // for this subgraph.
                        const node = edge.target();
                        const nodeId = node.id();
                        if (!seenNodeIds.has(nodeId)) {
                            edge.addClass('layoutParent');
                            seenNodeIds.add(nodeId);
                        }
                    } );
                    outElements = outEdges.union(outEdges.connectedNodes());
                    debug({ outEdges, outElements });
                }
                if (step < range.children.extra) {
                    let inEdges = allElements.incomers(extraRelationSelector);
                    inEdges.forEach( (edge) => {
                        if (!edge.isEdge()) { return }
                        // mark the edge as being a directing edge for the layout if it needs to be one
                        // for this subgraph.
                        const node = edge.source();
                        const nodeId = node.id();
                        if (!seenNodeIds.has(nodeId)) {
                            edge.addClass('layoutParent');
                            seenNodeIds.add(nodeId);
                        }
                    } );
                    inElements = inEdges.union(inEdges.connectedNodes());
                    debug({ inEdges, inElements });
                }
                allElements = allElements.union(inElements).union(outElements);
            }

            // primaryParentElements.addClass('layoutVisible');
            // primaryChildElements.addClass('layoutVisible');
            // secondaryParentElements.addClass('layoutVisible');
            // secondaryChildElements.addClass('layoutVisible');
            allElements.addClass('layoutVisible');
            const extraElements = allElements.not(mainNodes);
            extraElements.addClass('layoutFadeExtra');

            // facilitate highlighting of visible edges that connect to the isolated root nodes
            rootNodes.connectedEdges('edge.layoutVisible').addClass('isolationRootConnectingEdge');

            debug(`extraElements are `, extraElements);

        } );

        // store some info for the radial prelayout engine

        this.radialPrelayoutOptions = {
            origin: {
                direction: Math.PI/2,
                angularSpread: Math.PI*.8,
                useWeights: true,
            },
        };

        // use global computed prelayout information for our layout, just in case root nodes
        // coincide with global root nodes (e.g. for "zoom domains" option)
        const globalGraphRootNodesInfo = this.eczCodeGraph.globalGraphRootNodesInfo;
        if (globalGraphRootNodesInfo?.radialPrelayoutRootNodesPrelayoutInfo) {
            this.radialPrelayoutRootNodesPrelayoutInfo =
                globalGraphRootNodesInfo.radialPrelayoutRootNodesPrelayoutInfo;
        }

        // note the EczCodeGraph will automatically mark itself as needing a layout update.
    }


    setOptions(options)
    {
        options ??= {};
        if (loIsEqual(options, {}) || loIsEqual(options, this.options)) {
            return { pendingUpdateLayout: false };
        }
        let resetOptions = {};
        if (options.nodeIds != null) {
            resetOptions.nodeIds = null;
        }
        this.options = loMerge(
            {},
            this.options,
            resetOptions,
            options
        );
        return this.installSubgraph();
    }
    

    uninstallSubgraph()
    {
        this.cy.elements().removeClass([
            'layoutFadeExtra', 'isolationRoot', 'isolationRootConnectingEdge',
        ]);
    }
}