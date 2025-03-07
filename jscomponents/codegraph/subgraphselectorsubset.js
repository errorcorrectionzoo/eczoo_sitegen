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

                showIntermediateConnectingNodes: true,
                // use algorithm defaults for these by default -
                connectingNodesMaxDepth: null,
                connectingNodesPathMaxLength: null,
                connectingNodesMaxExtraDepth: null,
                connectingNodesOnlyKeepPathsWithAdditionalLength: null,
                connectingNodesToDomainsAndKingdoms: true,
                connectingNodesToDomainsAndKingdomsMaxLength: 2,
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
            
            showIntermediateConnectingNodes,

            // Maximal depth to explore around connected graph components to
            // try and find connecting paths.
            connectingNodesMaxDepth,

            connectingNodesPathMaxLength,

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

            connectingNodesToDomainsAndKingdoms,
            connectingNodesToDomainsAndKingdomsMaxLength,

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




    _JUNK_WILL_DELETE_THIS()
    {
        // ...................


        // all elements of the code graph, visible or hidden.
        const allElements = this.cy.elements();

        const subsetCodeNodes = this.cy.collection().union( codeIds.map(
            (codeId) => {
                const e = this.cy.getElementById(this.eczCodeGraph.getNodeIdCode(codeId));
                if (e == null || e?.length == 0) {
                    console.warn(`No such code: ‘${codeId}’`);
                    return null;
                }
                return e;
            }
        ).filter( ele => (ele != null) ) );

        // include all internal edges
        let subsetElements = subsetCodeNodes.union(
            subsetCodeNodes.connectedEdges().filter(
                e => subsetCodeNodes.has(e.source()) && subsetCodeNodes.has(e.target())
            )
        );

        //let layoutPrimaryParentEdges = subsetElements.edges('[_primaryParent=1]');

        let fadeExtraElements = this.cy.collection();
        let connectingComponentsElements = this.cy.collection();

        //let rootElements = this.cy.collection();

        if (subsetElements.length === 0) {
            console.warn(`No code IDs set for subset graph layout.  (Set ‘codeIds={...}’ in `
                + `the ‘modeSubsetOptions’.  Note it's ‘codeIds’ and not ‘nodeIds’ as for the `
                + `‘isolate-nodes' mode.)`
            );
            
        }

        // allComponentElements is the subsetElements augmented by additional nodes
        // we find important so should pretty much count as in the original subset (domains
        // and kingdoms).  They are important for the purposes of the layout and finding
        // connecting nodes.  But they will still be displayed as faded.
        let allComponentElements = subsetElements;
        let additionalComponentElements = this.cy.collection();
        let domainKingdomPathConnectingElements = this.cy.collection();
        if (connectingNodesToDomainsAndKingdoms) {
            let domainsAndKingdomNodes = this.cy.collection();
            // Add all domains and kingdoms as elements we want to show.
            // Check the domains and kingdoms of all elements we selected.
            let nextNodes = subsetElements;
            let seenNodes = this.cy.collection();
            let nodeChainByParentNodeId = {};
            let levelCount = 0;
            while (nextNodes.length
                   && levelCount <= connectingNodesToDomainsAndKingdomsMaxLength) {
                ++levelCount;
                seenNodes = seenNodes.union(nextNodes);
                let upwardsEdges = nextNodes.connectedEdges(
                    '[_relType="parent"][_primaryParent=1]'
                ).filter(
                    (e) => nextNodes.has(e.source())
                );
                let nextNodeList = [];
                let foundKingdomsAndDomainsList = [];
                for (const upEdge of upwardsEdges) {
                    const childNode = upEdge.source();
                    let maybeOtherNode = upEdge.connectedNodes().filter(
                        (n) => !seenNodes.has(n)
                    );
                    if (maybeOtherNode.length) {
                        const otherNode = maybeOtherNode[0];
                        nextNodeList.push( otherNode );
                        let nodeChain = [ childNode, upEdge ];
                        if (nodeChainByParentNodeId[childNode.id()] != null) {
                            nodeChain = [
                                ... nodeChainByParentNodeId[childNode.id()],
                                ... nodeChain
                            ];
                        }
                        nodeChainByParentNodeId[otherNode.id()] = nodeChain;
                        const otherNodeData = otherNode.data();
                        if (otherNodeData._isDomain || otherNodeData._isKingdom) {
                            foundKingdomsAndDomainsList.push(otherNode);
                            // found domain/kingdom, include all connecting path elements
                            domainKingdomPathConnectingElements = 
                                domainKingdomPathConnectingElements.union(
                                    this.cy.collection().union(nodeChain).filter(
                                        (ele) => !subsetElements.has(ele)
                                    )
                                );
                        }
                    }
                }
                nextNodes = this.cy.collection().union(nextNodeList)
                
                const foundKingdomsAndDomains =
                    this.cy.collection().union(foundKingdomsAndDomainsList);
                domainsAndKingdomNodes = domainsAndKingdomNodes.union(
                    foundKingdomsAndDomains
                );
                debug(`Found ${foundKingdomsAndDomains.length} kingdoms/domains at `
                      + `this level - ${dispCollection(foundKingdomsAndDomains)}`);
            }
            const internalEdges = domainsAndKingdomNodes.connectedEdges().filter(
                e => {
                    const src = e.source();
                    const tgt = e.target();
                    return domainsAndKingdomNodes.has(tgt) && (
                        domainsAndKingdomNodes.has(src)
                        || allComponentElements.has(src)
                    );
                }                    
            );
            debug(`Adding internal edges = ${dispCollection(internalEdges)}`);
            additionalComponentElements = domainsAndKingdomNodes
                .union(internalEdges)
                .union(domainKingdomPathConnectingElements)
                ;
            // internal edges should be use for layout parent relationships
            // layoutPrimaryParentEdges =
            //     layoutPrimaryParentEdges.union(internalEdges.filter('[_primaryParent=1]'));
        }
        allComponentElements = allComponentElements.union(additionalComponentElements);

        fadeExtraElements = fadeExtraElements.union(additionalComponentElements);

        debug(`At this point:\nallComponentElements=${dispCollection(allComponentElements)}\nfadeExtraElements=${dispCollection(fadeExtraElements)}`);

        if (showIntermediateConnectingNodes && subsetElements.length) {

            debug(`Determining connected components and connecting paths...`);

            const connectingPathsInfo = connectingPathsComponents({
                rootElements: allComponentElements,
                allElements,
                pathSearchElements:
                    // keep only primary-parent relationship edges
                    allElements.filter('node, edge[_primaryParent=1]'),
                connectingNodesMaxDepth,
                connectingNodesPathMaxLength,
                connectingNodesMaxExtraDepth,
                connectingNodesOnlyKeepPathsWithAdditionalLength,

                // NOTE: NEED TO FIX MY ALGORITHM ! See ./graphtools.js
                edgeLengthFn: (edge) => {
                    const d = edge.data();
                    if (d._primaryParent) {
                        //debug(`Edge ${dispElement(edge)} is primary parent`);
                        return connectingNodesEdgeLengthsByType.primaryParent ?? 1;
                    }
                    if (d._relType === 'parent') {
                        //debug(`Edge ${dispElement(edge)} is secondary parent`);
                        return connectingNodesEdgeLengthsByType.secondaryParent ?? 1.2;
                    }
                    if (d._relType === 'cousin') {
                        //debug(`Edge ${dispElement(edge)} is cousin`);
                        return connectingNodesEdgeLengthsByType.cousin ?? 1.2;
                    }
                    throw new Error(`Unknown edge relationship in graph: ${dispElement(edge)}`);
                },
            })

            debug(`Found ${connectingPathsInfo?.numComponents} connected components.`);

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
            let participatingElementsArray = Object.values(participatingElementIds);
            connectingComponentsElements =
                this.cy.collection().union( participatingElementsArray );
            debug(`Found ${participatingElementsArray.length} connecting path elements:`,
                dispCollection(participatingElementsArray));

            // ### layoutParent's will be done later
            //
            // // edges of some of the connecting paths between connecting components need
            // // to be promoted to layout-primary-parent edges to ensure a smooth layout.
            // // proceed edge by edge until we have connected all components *once*, to avoid
            // // cycles in the layout-primary-parent relationships.
            // let connectingShortestPaths = [];
            // // collect all the shortest connecting paths between all pairs of components
            // for (let i = 0; i < numComponents; ++i) {
            //     for (let j = i + 1; j < numComponents; ++j) {
            //         if (connectingPaths[i][j].shortestPath != null) {
            //             connectingShortestPaths.push({
            //                 path: connectingPaths[i][j].shortestPath,
            //                 pathLength: connectingPaths[i][j].shortestPathLength,
            //                 from: i,
            //                 to: j,
            //                 otherPathInfos: connectingPaths[i][j].paths,
            //             });
            //         }
            //     }
            // }
            // // sort these by the length of each shortest path
            // connectingShortestPaths.sort( (a, b) => a.pathLength - b.pathLength );
            // // now: we add edges from these shortest connecting paths up until we've
            // // connected all components.  First, we'll need an object to help us
            // // remember which components are already connected.
            // let isLayoutParentConnected = {};
            // for (let i = 0; i < numComponents; ++i) {
            //     isLayoutParentConnected[i] = {};
            //     for (let j = i + 1; j < numComponents; ++j) {
            //         isLayoutParentConnected[i][j] = false;
            //     }
            // }
            // let markConnected = (from, to) => {
            //     if (from > to) {
            //         [from, to] = [to, from];
            //     }
            //     if (isLayoutParentConnected[from][to]) {
            //         return;
            //     }
            //     isLayoutParentConnected[from][to] = true;
            //     for (let i = 0; i < numComponents; ++i) {
            //         if (i === from || i === to) {
            //             continue;
            //         }
            //         if (isLayoutParentConnected[to][i] || isLayoutParentConnected[i][to]) {
            //             markConnected(from, i);
            //         }
            //         if (isLayoutParentConnected[from][i] || isLayoutParentConnected[i][from]) {
            //             markConnected(to, i);
            //         }
            //     }
            // };

            // // // we need to make sure any added nodes all belong to some layout
            // // // tree via layoutParent edges.
            // // let nodesToInsertIntoLayoutTree =
            // //     this.cy.collection().union( connectingComponentsElements.nodes() );

            // for (const shortestPathInfo of connectingShortestPaths) {
            //     const { from, to, path, otherPathInfos } = shortestPathInfo;
            //     if ( ! isLayoutParentConnected[from][to] ) {
            //         const pathElements = this.cy.collection().union(path);
            //         const pathEdges = pathElements.edges();
            //         debug(`Adding path edges as layout-parents: ${dispCollection(pathEdges)}`);
            //         // add this path as layout-parent edges
            //         // layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(
            //         //     pathEdges.filter('[_primaryParent=1]')
            //         // );
            //         // nodesToInsertIntoLayoutTree = nodesToInsertIntoLayoutTree.difference(
            //         //     pathElements.nodes()
            //         // );
            //         // now mark the corresponding components are connected, plus all
            //         // resulting additional connections.
            //         markConnected(from, to);
            //     }
            //     // // Investigate the other paths connecting these components, since we
            //     // // need to make sure any added nodes all belong to some layout
            //     // // tree via layoutParent edges.
            //     // if (nodesToInsertIntoLayoutTree.length === 0) {
            //     //     // all good, we can skip, no other nodes to insert
            //     //     continue;
            //     // }
            //     // for (const { path } of otherPathInfos) {
            //     //     for (let pi = 1; pi+1 < path.length; pi += 2) {
            //     //         let e = path[pi];
            //     //         let n = path[pi+1]
            //     //         if (nodesToInsertIntoLayoutTree.has(n)) {
            //     //             layoutPrimaryParentEdges =
            //     //                 layoutPrimaryParentEdges.union(e);
            //     //             nodesToInsertIntoLayoutTree =
            //     //                 nodesToInsertIntoLayoutTree.difference(n);
            //     //         }
            //     //     }
            //     //     if (nodesToInsertIntoLayoutTree.length === 0) {
            //     //         break;
            //     //     }
            //     // }
            // }

            fadeExtraElements = fadeExtraElements.union(connectingComponentsElements);
        }

        let visibleElements = subsetElements.union(fadeExtraElements);

        // ### layout root done later

        // // Strategy to find layout root nodes.

        // // We need to find the components and pick a root element in each component.
        // // We should do this *even if we added intermediate nodes* because we might
        // // have failed to fully connect the graph.
        // for (const component of visibleElements.components()) {
        //     // pick any element of this component that is in subsetElements.

        //     // if there's a domain in the component, then pick that.  Otherwise, pick
        //     // a kingdom.  Otherwise, just pick any code we can find from our original
        //     // subset element list.

        //     debug(`Picking a root element in the component:`, dispCollection(component));

        //     const domainNodes = component.nodes('[_isDomain=1]');
        //     if (domainNodes.length) {
        //         rootElements = rootElements.union(domainNodes[0]);
        //         continue;
        //     }
        //     const kingdomNodes = component.nodes('[_isKingdom=1]');
        //     if (kingdomNodes.length) {
        //         rootElements = rootElements.union(kingdomNodes[0]);
        //         continue;
        //     }

        //     for (const e of subsetElements.nodes()) {
        //         if (component.has(e)) {
        //             rootElements = rootElements.union(e);
        //             break;
        //         }
        //     }
        // }

        let addExtraNodeElements = this.cy.collection();
        let addExtraNodeFadeElements = this.cy.collection();

        if (nodeIds && nodeIds.length) {
            addExtraNodeElements = addExtraNodeElements.union( nodeIds.map(
                (nodeId) => {
                    const e = this.cy.getElementById(nodeId);
                    if (e == null || e?.length == 0) {
                        console.warn(`No such node ID: ‘${nodeId}’`);
                        return null;
                    }
                    return e;
                }
            ) );
            // include all internal edges & edges connecting to a strongly visible element
            addExtraNodeElements = addExtraNodeElements.union(
                addExtraNodeElements.connectedEdges().filter( e => (
                    (addExtraNodeElements.has(e.source())
                        && addExtraNodeElements.has(e.target()))
                    || (subsetElements.has(e.source())
                        || subsetElements.has(e.target()))
                ) )
            );
            // include all edges connecting to a visible element
            addExtraNodeFadeElements = addExtraNodeFadeElements.union(
                addExtraNodeElements.connectedEdges().filter(
                    e => fadeExtraElements.has(e.source())
                         || fadeExtraElements.has(e.target())
                )
            );
        }

        //
        // Decide LAYOUT TREE
        //

        let layoutPrimaryParentEdges = this.cy.collection();
        let layoutRootElements = this.cy.collection();

        // First, we need to decide which nodes to use as layout-root codes.
        //
        // Find all primary parent root nodes among the visible nodes.
        let primaryParentRootNodes = this.cy.collection();
        let internalPrimaryParentEdges = this.cy.collection();
        const visibleNodes = visibleElements.nodes();
        //let bestPrimaryParentEdgeByNodeId = {};
        for (const node of visibleNodes) {
            let ppEdges = node.connectedEdges().filter(
                (edge) => edge.data()._primaryParent
                    && (edge.data()._relType === 'parent')
                    && edge.source().id() === node.id()
                    && visibleElements.has(edge.target())
            );
            // if there are no visible primary parents, try to see if there is a visible
            // parent.
            if (ppEdges.length === 0) {
                ppEdges = node.connectedEdges().filter(
                    (edge) => (edge.data()._relType === 'parent')
                    && edge.source().id() === node.id()
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
            //bestPrimaryParentEdgeByNodeId[node.id()] = ppEdge;
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
            debug(`Will perform a round of including child nodes in layout tree...`, dispCollection(nodesToPositionInLayoutTree), `using last-level nodes`, dispCollection(lastLevelNodes));
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
            debug(`Still need to position nodes: [${dispCollection(nodesToPositionInLayoutTree)}]`);
            if (newLevelNodes.length === 0 && nodesToPositionInLayoutTree.length) {
                throw new Error(`Was not able to position all nodes in layout!`);
            }
        }
        debug(`Identified root nodes & edges (but before integrating orphan roots): layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; layoutRootElements=${dispCollection(layoutRootElements)}`);
        // Finally, adjust the layout to avoid root nodes that do not have any attached subtree.
        for (const rootElement of layoutRootElements) {
            if ( ! rootLayoutTreeHasChildren[rootElement.id()] ) {
                debug(`Node ${dispElement(rootElement)} is layout root and alone!`, rootLayoutTreeHasChildren);
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
                    debug(`Node ${dispElement(rootElement)} is alone, attaching it via edge ${dispElement(attachingEdge)} to ${dispElement(attachingNode)}; before: layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; layoutRootElements=${dispCollection(layoutRootElements)}`);
                    layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(attachingEdge);
                    layoutRootElements = layoutRootElements.difference(rootElement);
                    debug(`After attaching: layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}; layoutRootElements=${dispCollection(layoutRootElements)}`);
                    if (layoutRootElements.has(attachingNode)) {
                        debug(`The attaching node, ${attachingNode.id()}, is a layout root node. We must mark it as has having "children" to avoid moving it around on its turn!`);
                        rootLayoutTreeHasChildren[attachingNode.id()] = true;
                    }
                }
            }
        }

        debug(`codeIds=${codeIds.join(',')}`);
        debug(`subsetCodeNodes=${dispCollection(subsetCodeNodes)}`);
        debug(`subsetElements=${dispCollection(subsetElements)}`);
        debug(`connectingComponentsElements=${dispCollection(connectingComponentsElements)}`);
        debug(`fadeExtraElements=${dispCollection(fadeExtraElements)}`);
        debug(`visibleElements=${dispCollection(visibleElements)}`);
        debug(`layoutRootElements=${dispCollection(layoutRootElements)}`);
        debug(`layoutPrimaryParentEdges=${dispCollection(layoutPrimaryParentEdges)}`);
        debug(`addExtraNodeElements=${dispCollection(addExtraNodeElements)}`);
        debug(`addExtraNodeFadeElements=${dispCollection(addExtraNodeFadeElements)}`);

        this.cy.batch( () => {
            allElements.removeClass('layoutRoot layoutVisible layoutParent');

            subsetElements.addClass('layoutVisible');
            fadeExtraElements.addClass('layoutVisible layoutFadeExtra');
            layoutRootElements.addClass('layoutRoot');
            layoutPrimaryParentEdges.addClass('layoutParent');
            addExtraNodeFadeElements.addClass('layoutVisible layoutFadeExtra');
            addExtraNodeElements.addClass('layoutVisible').removeClass('layoutFadeExtra');
        } );

        // // find root nodes for the layout
        // visibleElements.forEach( (ele) => {
        //     if (!ele.isNode()) {
        //         return;
        //     }
        //     const eleVisOutgoers = ele.outgoers('node.layoutVisible');
        //     debug(`Inspecting node for root: `, {ele, eleVisOutgoers})
        //     if (eleVisOutgoers.length == 0) {
        //         // this one is a root node.
        //         ele.addClass('layoutRoot');
        //     }
        // } );
        // //debug(`Number of root codes for layout: `, this.cy.elements('.layoutRoot').length);

        this.radialPrelayoutOptions = {
            origin: {
                direction: Math.PI/2,
                angularSpread: Math.PI*.8,
                useWeights: true,
                // rootPositionXOffset: 500.0,
                // rootPositionYOffset: 30,
                rootPositioning: 'circle',
                rootPositionCircleAngularSpread: Math.PI * .8,
                rootPositionCircleDirection: Math.PI/2,
            },
            ignoreParentEdgeDirection: true,
        };

        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph() done.`);
    }

}



// ----------------------------------------------------------------------------


