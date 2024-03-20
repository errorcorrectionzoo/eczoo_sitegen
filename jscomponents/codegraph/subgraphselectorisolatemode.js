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
                extraRelationSelector: '',
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
                'layoutVisible', 'layoutRoot', 'layoutParent', 'isolationRoot', 'isolationExtra'
            ]);
            this.cy.edges('[_primaryParent=1]').addClass('layoutParent');
            
            // add selected root nodes to the layout.
            for (const nodeId of nodeIds) {
                this.cy.getElementById(nodeId).addClass(
                    ['layoutRoot', 'layoutVisible', 'isolationRoot']
                );
            }

            let rootNodes = this.cy.nodes('.layoutVisible');

            let seenNodes = new Set( rootNodes.map( (node) => node.id() ) );

            // expand the graph, following primary parent relationships.
            let primaryParentElements = rootNodes;
            for (let step = 0; step < range.parents.primary; ++step) {
                let edges = primaryParentElements.outgoers('[_primaryParent=1]');
                primaryParentElements = primaryParentElements.union(edges).union(edges.connectedNodes());
            }

            let primaryChildElements = rootNodes;
            for (let step = 0; step < range.children.primary; ++step) {
                let edges = primaryChildElements.incomers('[_primaryParent=1]');
                primaryChildElements = primaryChildElements.union(edges).union(edges.connectedNodes());
            }

            // mark the nodes we've collected so far as belonging to the layout.  We need this
            // now already for the next step
            primaryParentElements.addClass('layoutVisible');
            primaryChildElements.addClass('layoutVisible');

            // Further expand the graph, including secondary parent relationships.
            // We need to start again from rootNodes for the counting to work out correctly;
            // we'll rediscover our primary parents but the important thing is to be able to
            // track when an edge needs to be included in the .layoutParent main edge tree
            let secondaryParentElements = rootNodes;
            for (let step = 0; step < range.parents.secondary; ++step) {
                let edges = secondaryParentElements.outgoers('[_relType="parent"]');
                edges.forEach( (edge) => {
                    // mark the edge as being a directing edge for the layout if it needs to be one
                    // for this subgraph.
                    const nodeId = edge.target().id();
                    if (!seenNodes.has(nodeId)) {
                        edge.addClass('layoutParent');
                        seenNodes.add(nodeId);
                    }
                } );
                secondaryParentElements =
                    secondaryParentElements.union(edges).union(edges.connectedNodes());
            }
            let secondaryChildElements = rootNodes;
            for (let step = 0; step < range.parents.secondary; ++step) {
                let edges = secondaryChildElements.incomers('[_relType="parent"]');
                edges.forEach( (edge) => {
                    // mark the edge as being a directing edge for the layout if it needs to be one
                    // for this subgraph.
                    const nodeId = edge.source().id();
                    if (!seenNodes.has(nodeId)) {
                        edge.addClass('layoutParent');
                        seenNodes.add(nodeId);
                    }
                } );
                secondaryChildElements =
                    secondaryChildElements.union(edges).union(edges.connectedNodes());
            }
            secondaryParentElements.addClass('layoutVisible');
            secondaryChildElements.addClass('layoutVisible');

            let mainNodes = primaryParentElements.union(primaryChildElements)
                .union(secondaryParentElements).union(secondaryChildElements);

            // Expand the graph even further, including opposite-direction parent relationships
            // and/or cousin relationships.
            let extraElements = mainNodes;
            let maxExtra = Math.max(range.parents.extra, range.children.extra);
            for (let step = 0; step < maxExtra; ++step) {
                let outElements = [];
                let inElements = [];
                if (step < range.parents.extra) {
                    let outEdges = extraElements.outgoers(extraRelationSelector);
                    outEdges.forEach( (edge) => {
                        // mark the edge as being a directing edge for the layout if it needs to be one
                        // for this subgraph.
                        const nodeId = edge.source().id();
                        if (!seenNodes.has(nodeId)) {
                            edge.addClass('layoutParent');
                            seenNodes.add(nodeId);
                        }
                    } );
                    outElements = outEdges.union(outEdges.connectedNodes());
                }
                if (step < range.children.extra) {
                    let inEdges = extraElements.incomers(extraRelationSelector);
                    inEdges.forEach( (edge) => {
                        // mark the edge as being a directing edge for the layout if it needs to be one
                        // for this subgraph.
                        const nodeId = edge.source().id();
                        if (!seenNodes.has(nodeId)) {
                            edge.addClass('layoutParent');
                            seenNodes.add(nodeId);
                        }
                    } );
                    inElements = inEdges.union(inEdges.connectedNodes());
                }
                extraElements = extraElements.union(inElements).union(outElements);
            }
            extraElements.addClass('layoutVisible');

            extraElements.not(mainNodes).addClass('isolationExtra');

        } );

        // store some info for the radial prelayout engine

        this.radialPrelayoutRootNodesPrelayoutInfo = {
            origin: {
                direction: Math.PI/2,
                angularSpread: Math.PI,
            },
        };

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
    
}