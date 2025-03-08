import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselectorsubset');

import loMerge from 'lodash/merge.js';

import { connectingPathsComponents, dispCollection, dispElement } from './graphtools.js';

import { EczCodeGraphSubgraphSelector } from './subgraphselector.js';


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

                connectingNodesToDomainsAndKingdoms: true,
                connectingNodesToDomainsAndKingdomsMaxLength: 2,
                showIntermediateConnectingNodes: true,
                // use algorithm defaults for these by default -
                connectingNodesMaxPathLength: null,
                connectingNodesMaxNumPaths: null,
                connectingNodesOnlyKeepPathsWithAdditionalLength: null,
                connectingNodesEdgeLengthsByType: {
                    primaryParent: null,
                    secondaryParent: null,
                    cousin: null,
                },

                nodeIds: [],
            },
            options
        );
        super(eczCodeGraph, options);
    }


    //
    // HELPERS
    //

    getSelectedElementsWithInternalEdges({ codeIds, nodeIds })
    {
        const selectedNodeElements = [
            ... codeIds.map( (codeId) => this.eczCodeGraph.getNodeIdCode(codeId) ),
            ... nodeIds
        ].map( (nId) => {
            const e = this.cy.getElementById(nId);
            if (e == null || e?.length == 0) {
                console.warn(`No such node ID: ‘${nId}’`);
                return null;
            }
            return e;
        } ).filter( (ele) => (ele != null) );
    
        const selectedNodeElementsCy = this.cy.collection().union( selectedNodeElements );
    
        return selectedNodeElementsCy.union(
            selectedNodeElementsCy.connectedEdges().filter(
                e => selectedNodeElementsCy.has(e.source()) && selectedNodeElementsCy.has(e.target())
            )
        );
    }

    findParentDomainAndKingdomNodes({
        primaryElements,
        secondaryElements,
        connectingNodesToDomainsAndKingdomsMaxLength,
    })
    {
        const visibleElements = primaryElements.union(secondaryElements);

        let domainsAndKingdomNodes = this.cy.collection();
        // Add all domains and kingdoms as elements we want to show.
        // Check the domains and kingdoms of all elements we selected.
        let nextNodes = primaryElements;
        let seenNodes = this.cy.collection();
        // Store a *list of node chains* for each parent node ID (might be several
        // node chains going up to a kingdom):
        let nodeChainsByParentNodeId = {};
        let levelCount = 0;
        while (nextNodes.length) {
            ++levelCount;
            seenNodes = seenNodes.union(nextNodes);
            let upwardsEdges = nextNodes.connectedEdges().filter(
                (e) => {
                    const ed = e.data();
                    return (
                        ed._relType === 'parent' && ed._primaryParent
                        && nextNodes.has(e.source())
                        && !seenNodes.has(e.target())
                    );
                }
            );
            let nextNodeSet = new Set();
            let foundKingdomsAndDomainsSet = new Set();
            for (const upEdge of upwardsEdges) {
                const childNode = upEdge.source();
                let parentNode = upEdge.target(); // know not in seenNodes.
                if (levelCount < connectingNodesToDomainsAndKingdomsMaxLength) {
                    nextNodeSet.add( parentNode );
                }

                const parentNodeId = parentNode.id();
                const childNodeId = childNode.id();
                if (nodeChainsByParentNodeId[childNodeId] == null
                    || nodeChainsByParentNodeId[childNodeId].length === 0
                ) {
                    // sanitize paths of the child node we're building upon.  Should
                    // always be at least one path, even if it is empty.
                    nodeChainsByParentNodeId[childNodeId] = [ [] ];
                }
                if (nodeChainsByParentNodeId[parentNodeId] == null) {
                    nodeChainsByParentNodeId[parentNodeId] = [ ];
                }
                let addNodeChain = [
                    upEdge, parentNode,
                ].filter( (ele) => !visibleElements.has(ele) );
                for (let nodePathUpToHere of nodeChainsByParentNodeId[childNode.id()]) {
                    const newChain = [
                        ...nodePathUpToHere,
                        ...addNodeChain,
                    ];
                    if (newChain.length) {
                        nodeChainsByParentNodeId[parentNodeId].push(newChain);
                    }
                }

                const parentNodeData = parentNode.data();
                if (parentNodeData._isDomain || parentNodeData._isKingdom) {
                    foundKingdomsAndDomainsSet.add(parentNode);
                    // Explore this node anyway, even if past our limit; this is to include
                    // a parent domain for a discovered kingdom.
                    nextNodeSet.add( parentNode );
                }
            }
            nextNodes = this.cy.collection().union([...nextNodeSet]);
            
            domainsAndKingdomNodes = domainsAndKingdomNodes.union(
                [...foundKingdomsAndDomainsSet]
            );
            debug(
                `Found ${foundKingdomsAndDomainsSet.size} kingdoms/domains at `
                + `this level - ${dispCollection([...foundKingdomsAndDomainsSet])}; next node set is`,
                nextNodeSet
            );
        }
        debug(
            `Finally, domains & kingdom nodes are ${dispCollection(domainsAndKingdomNodes)}`
            + ` and node chains are:`, nodeChainsByParentNodeId
        );
        let additionalConnectingElementsList = [];
        for (const domkingNode of domainsAndKingdomNodes) {
            for (const nodeChain of nodeChainsByParentNodeId[domkingNode.id()]) {
                additionalConnectingElementsList.push(
                    ... nodeChain // already contains only elements not in visibleElements.
                );
            }
        }

        const additionalConnectingElements = this.cy.collection().union(
            additionalConnectingElementsList
        );
    
        return {
            domainsAndKingdomNodes,
            additionalConnectingElements,
            additionalNodesWithEdges:
                domainsAndKingdomNodes.union(additionalConnectingElements),
        };
    }


    findIntermediateNodesConnectingComponents({
        primaryElements,
        secondaryElements,
        connectingNodesMaxPathLength,
        connectingNodesMaxNumPaths,
        connectingNodesOnlyKeepPathsWithAdditionalLength,
        connectingNodesEdgeLengthsByType,
    })
    {
        const visibleElements = primaryElements.union(secondaryElements);
        const visibleEdges = visibleElements.edges();
        const {
            componentInfos
        } = connectingPathsComponents({
            cy: this.cy,
            visibleElements,
            allElements: this.cy.elements(),
            connectingNodesMaxPathLength,
            connectingNodesMaxNumPaths,
            connectingNodesOnlyKeepPathsWithAdditionalLength,
            edgeLengthFn: (edge) => {
                if (visibleEdges.has(edge)) {
                    return 0; // same component!
                }
                const d = edge.data();
                if (d._primaryParent) {
                    //debug(`Edge ${dispElement(edge)} is primary parent`);
                    return connectingNodesEdgeLengthsByType.primaryParent ?? 1;
                }
                if (d._relType === 'parent') {
                    //debug(`Edge ${dispElement(edge)} is secondary parent`);
                    return connectingNodesEdgeLengthsByType.secondaryParent ?? 1.3;
                }
                if (d._relType === 'cousin') {
                    //debug(`Edge ${dispElement(edge)} is cousin`);
                    return connectingNodesEdgeLengthsByType.cousin ?? 2.1;
                }
                throw new Error(`Unknown edge relationship in graph: ${dispElement(edge)}`);
            },
        })

        let intermediateConnectingElements = this.cy.collection();

        for (const [componentIndex, componentInfo] of componentInfos.entries()) {
            for (let otherComponentIndex = componentIndex + 1;
                 otherComponentIndex < componentInfos.length; ++otherComponentIndex) {
                const shortestPathsToOtherComponent =
                    componentInfo.shortestPathsToComponents[otherComponentIndex];
                for (const path of shortestPathsToOtherComponent.paths) {
                    debug(
                        `Collecting intermediate collecting nodes between components `
                        + `#${componentIndex} and #${otherComponentIndex}: `
                        + `${dispCollection(path.path)}`
                    );
                    intermediateConnectingElements = intermediateConnectingElements.union(
                        path.path
                    );
                }
            }
        }

        // remove from intermediateConnectingElements any elements that are already
        // collected in existing primary & secondary element lists
        intermediateConnectingElements = intermediateConnectingElements.filter(
            (ele) => ! primaryElements.has(ele) && ! secondaryElements.has(ele)
        );
    
        return { intermediateConnectingElements };
    }

    
    buildLayoutTree( { visibleElements })
    {
        let layoutPrimaryParentEdges = this.cy.collection();
        let layoutRootElements = this.cy.collection();

        // First, we need to decide which nodes to use as layout-root codes.
        //
        // Find all primary parent root nodes among the visible nodes.
        let primaryParentRootNodes = this.cy.collection();
        let internalPrimaryParentEdges = this.cy.collection();
        const visibleNodes = visibleElements.nodes();

        for (const node of visibleNodes) {
            let ppEdges = node.connectedEdges().filter(
                (edge) => edge.data()._primaryParent
                    && (edge.data()._relType === 'parent')
                    && edge.source().id() === node.id()
                    && visibleElements.has(edge)
                    && visibleElements.has(edge.target())
            );
            // if there are no visible primary parents, try to see if there is a visible
            // parent.
            if (ppEdges.length === 0) {
                ppEdges = node.connectedEdges().filter(
                    (edge) => (edge.data()._relType === 'parent')
                    && edge.source().id() === node.id()
                    && visibleElements.has(edge)
                    && visibleElements.has(edge.target())
                );
            }
            if (ppEdges.length === 0) {
                // no primary parent in the subset of visible elements.
                primaryParentRootNodes = primaryParentRootNodes.union( node );
                continue;
            }
            // ### could have more than one parent in case of fallback to regular parent --
            // ### we'll pick the first one.
            // if (ppEdges.length > 1) {
            //     throw new Error(`Internal error: more than one primary parent edge from node ${node.id()}!`);
            // }
            const ppEdge = ppEdges[0];
            internalPrimaryParentEdges = internalPrimaryParentEdges.union(ppEdge);
        }
        // all primary-parent-root nodes are defined as layout-root nodes
        layoutRootElements = primaryParentRootNodes;

        // now see which primary-parent edges we should include.
        let nodesToPositionInLayoutTree = visibleNodes.difference(
            primaryParentRootNodes
        );
        let rootLayoutTreeHasChildren = {};
        let lastLevelNodes = layoutRootElements;
        while (nodesToPositionInLayoutTree.length) {
            debug(
                `Will perform a round of including child nodes in layout tree...`,
                dispCollection(nodesToPositionInLayoutTree),
                `using last-level nodes`, dispCollection(lastLevelNodes)
            );
            let newLevelNodes = this.cy.collection();
            for (const parentNode of lastLevelNodes) {
                // pick child node(s) via primary-parent relation that still need
                // to be positioned
                const primaryChildToPositionEdges = parentNode.connectedEdges().filter(
                    (edge) => internalPrimaryParentEdges.has(edge)
                        && edge.target().id() === parentNode.id()
                        && nodesToPositionInLayoutTree.has(edge.source())
                );
                layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(
                    primaryChildToPositionEdges
                );
                let theseNodes = this.cy.collection(
                    primaryChildToPositionEdges.map( (edge) => edge.source() )
                );
                if (layoutRootElements.has(parentNode) && theseNodes.length) {
                    rootLayoutTreeHasChildren[parentNode.id()] = true;
                }
                nodesToPositionInLayoutTree = nodesToPositionInLayoutTree.difference(
                    theseNodes
                );
                newLevelNodes = newLevelNodes.union(theseNodes);
            }
            lastLevelNodes = newLevelNodes;
            debug(`Positioned nodes ${dispCollection(newLevelNodes)}`);
            debug(
                `Still need to position nodes [${dispCollection(nodesToPositionInLayoutTree)}]`
            );
            if (newLevelNodes.length === 0 && nodesToPositionInLayoutTree.length) {
                throw new Error(`Was not able to position all nodes in layout!`);
            }
        }
        debug(
            `Identified root nodes & edges (but before integrating orphan roots): `
            + `layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; `
            + `layoutRootElements=${dispCollection(layoutRootElements)}`
        );
        // Finally, adjust the layout to avoid root nodes that do not have any attached subtree.
        for (const rootElement of layoutRootElements) {
            if ( ! rootLayoutTreeHasChildren[rootElement.id()] ) {
                debug(
                    `Node ${dispElement(rootElement)} is layout root and alone!`,
                    rootLayoutTreeHasChildren
                );
                // try to avoid using this node as a root node -- see if we can
                // attach it to another root node/subtree
                const edges = rootElement.connectedEdges().filter(
                    (edge) => visibleElements.has(edge)
                );
                let attachingEdge = null;
                // see if we have a primary parent connecting us somewhere else, use
                // that (perhaps it's in the "wrong" direction, preventing this node from
                // being included in the corresponding subtree
                const ppEdges = edges.filter('[_primaryParent]');
                if (ppEdges.length) {
                    // attach!
                    attachingEdge = ppEdges[0];
                } else {
                    const pEdges = edges.filter('[_relType="parent"]');
                    if (pEdges.length) {
                        attachingEdge = pEdges[0];
                    } else if (edges.length) {
                        attachingEdge = edges[0];
                    }
                }
                if (attachingEdge != null) {
                    const attachingNode = attachingEdge.connectedNodes().filter(
                        (n) => n.id() !== rootElement.id()
                    );
                    debug(
                        `Node ${dispElement(rootElement)} is alone, attaching it via edge ${dispElement(attachingEdge)} to ${dispElement(attachingNode)}; before: layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; layoutRootElements=${dispCollection(layoutRootElements)}`
                    );
                    layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(attachingEdge);
                    layoutRootElements = layoutRootElements.difference(rootElement);
                    debug(
                        `After attaching: layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; layoutRootElements=${dispCollection(layoutRootElements)}`
                    );
                    if (layoutRootElements.has(attachingNode)) {
                        debug(
                            `The attaching node, ${attachingNode.id()}, is a layout root node. We must mark it as has having "children" to avoid moving it around on its turn!`
                        );
                        rootLayoutTreeHasChildren[attachingNode.id()] = true;
                    }
                }
            }
        }

        return { layoutRootElements, layoutPrimaryParentEdges };
    }



    //
    // MAIN METHOD installSubgraph()
    //

    installSubgraph()
    {
        this._markSubgraphInstalled(true);

        let {
            // A list of code IDs to include in the subgraph to display.
            codeIds,

            // The following node ID's will be shown in addition to any
            // selected codes.  You can specify codes as codeIds or as nodeIds
            // interchangeably.  The corresponding nodes are treated in the
            // same fashion.
            nodeIds,
            
            connectingNodesToDomainsAndKingdoms,
            connectingNodesToDomainsAndKingdomsMaxLength,

            showIntermediateConnectingNodes,

            connectingNodesMaxPathLength,
            connectingNodesMaxNumPaths,

            // We'll only show nodes that generate paths between components so as
            // long as these nodes participate to a path whose length is at most
            // `connectingNodesOnlyKeepPathsWithAdditionalLength` longer than
            // the shortest path connecting the given components.
            connectingNodesOnlyKeepPathsWithAdditionalLength,

            // eg. { primaryParent: 1, secondaryParent: 5, cousin: 10 }
            connectingNodesEdgeLengthsByType,

        } = this.options;

        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph(), codeIds=${codeIds}`);

        const primaryElements = this.getSelectedElementsWithInternalEdges({
            codeIds,
            nodeIds
        });

        let secondaryElements = this.cy.collection();

        //
        // Maybe we need to find nearby domains & kingdoms by following edges up
        // the tree along primary parents.
        //
        if (connectingNodesToDomainsAndKingdoms) {
            const {
                additionalNodesWithEdges,
            } = this.findParentDomainAndKingdomNodes({
                primaryElements,
                secondaryElements,
                connectingNodesToDomainsAndKingdomsMaxLength,
            });
            secondaryElements = secondaryElements.union(additionalNodesWithEdges);
        }

        // MISSING: find nodes connecting components...
        if (showIntermediateConnectingNodes) {
            const {
                intermediateConnectingElements
            } = this.findIntermediateNodesConnectingComponents({
                primaryElements,
                secondaryElements,
                connectingNodesMaxPathLength,
                connectingNodesMaxNumPaths,
                connectingNodesOnlyKeepPathsWithAdditionalLength,
                connectingNodesEdgeLengthsByType,
            });
            secondaryElements = secondaryElements.union(intermediateConnectingElements);
        }

        const {
            layoutPrimaryParentEdges,
            layoutRootElements
        } = this.buildLayoutTree({
            visibleElements: primaryElements.union(secondaryElements)
        });

        debug(`codeIds=${codeIds.join(',')}`);
        debug(`nodeIds=${codeIds.join(',')}`);
        debug(`primaryElements=${dispCollection(primaryElements)}`);
        debug(`secondaryElements=${dispCollection(secondaryElements)}`);
        debug(`layoutRootElements=${dispCollection(layoutRootElements)}`);
        debug(`layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}`);
        
        this.cy.batch( () => {
            this.cy.elements().removeClass(['layoutRoot','layoutVisible','layoutParent']);

            primaryElements.addClass('layoutVisible');
            secondaryElements.addClass(['layoutVisible', 'layoutFadeExtra']);
            layoutRootElements.addClass('layoutRoot');
            layoutPrimaryParentEdges.addClass('layoutParent');
        } );

        this.radialPrelayoutOptions = {
            origin: {
                direction: Math.PI/2,
                angularSpread: Math.PI*.8,
                useWeights: true,
                rootPositioning: 'circle',
                rootPositionCircleAngularSpread: Math.PI * .8,
                rootPositionCircleDirection: Math.PI/2,
            },
            ignoreParentEdgeDirection: true,
        };

        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph() done.`);
    }

}
