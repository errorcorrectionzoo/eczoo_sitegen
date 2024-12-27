import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.graphtools');


export function dispElement(ele)
{
    if (ele === null) {
        return 'null'
    }
    if (ele === undefined) {
        return 'undef'
    }
    if (ele.isNode()) {
        return ele.id();
    }
    if (ele.isEdge()) {
        return `[${ele.source().id()} → ${ele.target().id()}]`;
    }
    return `UNKNOWN{${JSON.stringify(ele)}}`;
}

export function dispCollection(eles)
{
    if (eles === null) {
        return 'null';
    }
    if (eles === undefined) {
        return 'undef';
    }
    return eles.map(dispElement).join(' ; ');
}



class _GraphComponentConnections
{
    constructor(components, options)
    {
        // return value of [cy eles].components()
        this.components = components;
        this.numComponents = components.length;

        this.options = options;

        // connectingPaths[componentIndex1][componentIndex2] = {
        //   paths: ( ... Array of { path: (path), pathLength: (# of edges in path) } ... ),
        //   shortestPath: (path in paths[].path that has shortest length),
        //   shortestLength: (length of shortest path),
        // }
        //
        // Each path is itself an array of alternating node and edge objects of
        // connected nodes and edges, starting from a node in componentIndex1
        // and ending with a node in componentIndex2.
        //
        // this.connectingPaths is initialized within the helper
        // function this._initializeConnectingPaths()
        this.connectingPaths = null;

        // Flag is set to true when in connectingPaths, all pairs of components have a
        // connecting path.  The value of this flag is updated only upon explicit call to
        // checkUpdateAllComponentsNowConnected() to check whether we've connected all
        // components after some additional node visit and handling.
        this.allComponentsNowConnected = null;
        // Updated at the same time as `this.allComponentsNowConnected`.  Set to the visit
        // depth of the point where we detected that all components are connected and when
        // we set the flag `allComponentsNowConnected` to true.
        this.allComponentsConnectedAtDepth = null;

        this._initializeConnectingPaths();
    }

    _initializeConnectingPaths()
    {
        this.allComponentsNowConnected = false;
        this.allComponentsConnectedAtDepth = null;

        this.connectingPaths = {};
        // initialize with empty objects
        for (let c1Index = 0; c1Index < this.numComponents; ++c1Index) {
            this.connectingPaths[c1Index] = {};
            for (let c2Index = 0; c2Index < this.numComponents; ++c2Index) {
                this.connectingPaths[c1Index][c2Index] =
                    this._mkEmptyConnectingPathsInfo( (c1Index === c2Index) );
            }
        }
    }
    _mkEmptyConnectingPathsInfo( isSameComponentIndex ) {
        return {
            paths: [],
            shortestPath: isSameComponentIndex ? [] : null,
            shortestLength: isSameComponentIndex ? 0 : null,
        }
    }


    // ### Intended for testRelatedNodeFn functionality below, which is dropped/not implemented.
    //
    // addOneMoreComponent(componentNodes)
    // {
    //     // make sure the nodes are not already included in an existing component
    //     for (const cEls of this.components) {
    //         if (cEls.intersect(componentNodes).length > 0) {
    //             // Error: component has nontrivial intersection with a different
    //             // component already.
    //             throw new Error(`addOneMoreComponent(): Component is not independent!`);
    //         }
    //     }
    //     const oldNumComponents = this.numComponents;
    //     const newComponentIndex = oldNumComponents; // == this.components.length - 1
    //     this.components = [...this.components, componentNodes];
    //     this.numComponents = this.components.length;
    //     // update the connectingPaths
    //     for (let i = 0; i < this.numComponents; ++i) {
    //         if (i >= oldNumComponents) {
    //             this.connectingPaths[i] = {};
    //         }
    //         for (let j = 0; j < this.numComponents; ++j) {
    //             if (j >= oldNumComponents) {
    //                 this.connectingPaths[i][j] =
    //                     this._mkEmptyConnectingPathsInfo( (i === j) );
    //             }
    //         }
    //     }
    //     // update all internal state variables
    //     if (this.allComponentsNowConnected) {
    //         this.allComponentsNowConnected = false;
    //         this.allComponentsConnectedAtDepth = null;
    //     }
    //     return newComponentIndex;
    // }


    processConnectingPath({
        componentIndex,
        otherComponentIndex,
        pathLength,
        buildPathFn,
    })
    {
        // debug(`processConnectingPath: `,
        //       {componentIndex,otherComponentIndex,pathLength});
        // debug(`at this point, connectedPaths: `);
        // for (let i = 0; i < this.numComponents; ++i) {
        //     for (let j = 0; j < this.numComponents; ++j) {
        //         const cinfo = this.connectingPaths[i][j];
        //         debug(`  ${i}->${j}:  ${cinfo.shortestLength}  :  ${dispCollection(cinfo.shortestPath)}; \n   `
        //               + cinfo.paths.map(
        //                     ({path,pathLength}, i) => `  #${i} [${pathLength}:]-- `+dispCollection(path)
        //                 ).join('\n') );
        //     }
        // }

        if (componentIndex === otherComponentIndex) {
            //debug(`called processConnectedPath() with twice the same component!`);
            return;
        }

        let connectingPathsInfo =
            this.connectingPaths[componentIndex][otherComponentIndex];
        let keepPath = false;
        if (pathLength > this.options.connectingNodesPathMaxLength) {
            // path is simply too long.
            keepPath = false;
        } else if (connectingPathsInfo.shortestLength == null) {
            // we don't have any other path, keep this path for sure
            keepPath = true;
        } else if (
            pathLength <= connectingPathsInfo.shortestLength +
                this.options.connectingNodesOnlyKeepPathsWithAdditionalLength
        ) {
            keepPath = true;
        }
        if (keepPath === false) {
            // let's not keep this path.
            return;
        }

        //debug(`building path...`);
        const path = buildPathFn();
        connectingPathsInfo.paths.push({ path, pathLength });
        let revPath = [...path].reverse();
        let revConnectingPathsInfo =
            this.connectingPaths[otherComponentIndex][componentIndex];
        revConnectingPathsInfo.paths.push({ path: revPath, pathLength });

        //debug(`built path & saved it: ${dispCollection(path)}`);

        if (connectingPathsInfo.shortestLength == null
            || pathLength < connectingPathsInfo.shortestLength) {
            //debug(`Registering new path as being shortest for this connection.`);
            connectingPathsInfo.shortestLength = pathLength;
            revConnectingPathsInfo.shortestLength = pathLength;
            connectingPathsInfo.shortestPath = path;
            revConnectingPathsInfo.shortestPath = revPath;
            // prune any paths that are too long.
            let newLengthLimit = pathLength
                + this.options.connectingNodesOnlyKeepPathsWithAdditionalLength ;
            //debug(`Cleaning up existing paths, new length limit = ${newLengthLimit}.`);
            for (let i = 0; i < connectingPathsInfo.paths.length; ++i) {
                if (connectingPathsInfo.paths[i].pathLength > newLengthLimit) {
                    connectingPathsInfo.paths.splice(i, 1);
                }
            }
            for (let i = 0; i < revConnectingPathsInfo.paths.length; ++i) {
                if (revConnectingPathsInfo.paths[i].pathLength > newLengthLimit) {
                    revConnectingPathsInfo.paths.splice(i, 1);
                }
            }
        }

        // now, we also want to register paths between components that now become
        // connected mediated through the new connection we found.
        for (let thirdComponentIndex = 0; thirdComponentIndex < this.numComponents;
             ++thirdComponentIndex) {
            if (thirdComponentIndex === componentIndex
                || thirdComponentIndex === otherComponentIndex) {
                continue;
            }
            //debug(`Checking for connections to third component ${thirdComponentIndex} `
            //    + `that are mediated through ${componentIndex}->${otherComponentIndex}`);
            // if third component is connected to the first (resp. other)
            // component, then we've potentially discovered a path connecting
            // the third component to the other (resp. first) component. Process it.
            const thirdConnectingToFirstInfo =
                this.connectingPaths[thirdComponentIndex][componentIndex];
            if (thirdConnectingToFirstInfo.shortestLength != null) {
                const thirdConnectionPath =
                    thirdConnectingToFirstInfo.shortestPath;
                const fullThirdConnectionPath = [
                    ...thirdConnectionPath,
                    ...path.slice(1),
                ];
                //debug(`Registering new path for third component ${thirdComponentIndex}->${otherComponentIndex} mediated through ${componentIndex}`);
                this.processConnectingPath({
                    componentIndex: thirdComponentIndex,
                    otherComponentIndex: otherComponentIndex,
                    pathLength: (
                        thirdConnectingToFirstInfo.shortestLength + pathLength
                    ),
                    buildPathFn: () => fullThirdConnectionPath,
                });
            }
            const otherConnectingToThirdInfo =
                this.connectingPaths[otherComponentIndex][thirdComponentIndex];
            if (otherConnectingToThirdInfo.shortestLength != null) {
                const thirdConnectionPath =
                    otherConnectingToThirdInfo.shortestPath;
                const fullThirdConnectionPath = [
                    ...path,
                    ...thirdConnectionPath.slice(1),
                ];
                //debug(`Registering another path for third component ${componentIndex}->${thirdComponentIndex} mediated through ${otherComponentIndex}`);
                this.processConnectingPath({
                    componentIndex: componentIndex,
                    otherComponentIndex: thirdComponentIndex,
                    pathLength: (
                        otherConnectingToThirdInfo.shortestLength + pathLength
                    ),
                    buildPathFn: () => fullThirdConnectionPath,
                });
            }
        }

    }

    checkUpdateAllComponentsNowConnected({ curDepth })
    {
        if (this.allComponentsNowConnected) {
            return true;
        }
        // Check - are all components finally connected?  This check makes us
        // stop searching for connecting paths earlier (see options).
        // It suffices to check that the component 0 is connected to all others.
        let checkAllConnected = true;
        for (let i = 1; i < this.numComponents; ++i) {
            if (this.connectingPaths[0][i].shortestLength == null) {
                checkAllConnected = false;
                break;
            }
        }
        if (checkAllConnected) {
            debug(`Now all components are connected!`);
            this.allComponentsNowConnected = true;
            this.allComponentsConnectedAtDepth = curDepth;
            return true;
        }
        return false;
    }
}





//TODO --
//
// MAIN TODO POINTS:
//
// - Different weights ("lengths") for different types of parental relationship edges.
//   A primal-parent relationships should count as shorter than a secondary-parent
//   relationship.  E.g. weights: { primaryParent: 1, secondaryParent: 2, cousin: 4 }  ?
//
//   PROBLEM: Need to fix our algorithm, see below.
//


/**
 * Detects disconnected components in `rootElements`, then explores the graph described
 * by `allElements` to find meaningful paths that connect these components.
 * 
 * ...
 */
export function connectingPathsComponents({
    rootElements,
    allElements,
    pathSearchElements, // patchwork ... set of nodes on which to run bfs
    connectingNodesMaxDepth,
    connectingNodesPathMaxLength,
    connectingNodesMaxExtraDepth,
    connectingNodesOnlyKeepPathsWithAdditionalLength,
    edgeLengthFn,
})
{
    connectingNodesMaxDepth ??= 15;
    connectingNodesPathMaxLength ??= 20;
    connectingNodesMaxExtraDepth ??= 3;
    connectingNodesOnlyKeepPathsWithAdditionalLength ??= 1;

    edgeLengthFn ??= (edge_) => 1;

    const allNodes = allElements.nodes();
    const allEdges = allElements.edges();

    // Identify the connected components of the displayed nodes and find paths
    // that connect the disconnected clusters
    const components = rootElements.components();

    if (!components.length) {
        // something wrong or empty graph
        return null;
    }

    let C = new _GraphComponentConnections(
        components,
        {
            connectingNodesMaxDepth,
            connectingNodesMaxExtraDepth,
            connectingNodesOnlyKeepPathsWithAdditionalLength,
            connectingNodesPathMaxLength,
        }
    );

    debug(`connectingPathsComponents(): Got graph components:`, C.components,
        ` by the way, options are = `, { connectingNodesMaxDepth, connectingNodesMaxExtraDepth, connectingNodesOnlyKeepPathsWithAdditionalLength, connectingNodesPathMaxLength });

    if (C.numComponents === 1) {
        // empty graph or a single component -- nothing to be done
        return { connectingPaths: { 0: { 0: {
            paths: [], shortestPath: [], shortestLength: 0,
        } } } };
    }

    // Do a big, breadth-first search starting from all the nodes we have
    // (yes, Cytoscape appears to be happy to do a mega-BFS starting from
    // multiple root nodes), and compute for each node its distance to a
    // a connected component.  Stop when we have paths between all pairs of
    // components, or if obtain a single connected component when when add
    // the paths that we discovered and reached a depth threshold.

    // nodeDistanceToComponent[nodeId] = { componentIndex, distance, previousNode }
    let nodeDistanceToComponent = {};
    for (const [componentIndex, componentCollection] of C.components.entries()) {
        for (const node of componentCollection.nodes()) {
            const nodeId = node.id();
            nodeDistanceToComponent[nodeId] = {
                componentIndex,
                distance: 0,
                previousEdge: null,
                previousNode: null,
                previousNodeIdChain: [],
            };
        }
    }

    let visitedNodes = new Set();

    let maxVisitedDepth = null;


    //
    // PROBLEM: BFS ISN'T THE RIGHT ALGORITHM TO USE HERE IF WE WANT TO HAVE EDGES
    // OF DIFFERENT WEIGHTS!!
    //
    // TEMPORARY HACK: Only perform the BFS search by walking through a selected set
    // of nodes (e.g. the primary-parent relationships).  Additional paths *might*
    // pass through one extra non-primary-path node.  This might be sufficient for
    // our purposes.
    //

    pathSearchElements.bfs({
        root: rootElements,
        directed: false,
        visit: function (curNode, edgeToCurNode, prevNode, visitIndex, depth) {
            if (depth > connectingNodesMaxDepth) {
                debug(`Maximum depth ${depth} reached after ${visitIndex} `
                        + `iterations, stopping BFS search here`);
                return false; // stop here.
            }
            if (C.allComponentsNowConnected
                && depth > C.allComponentsConnectedAtDepth + connectingNodesMaxExtraDepth) {
                debug(`Completed ${connectingNodesMaxExtraDepth} additional rounds `
                    + `of BFS after connecting the full graph, stopping here.`);
                return false; // stop here.
            }
            if (maxVisitedDepth == null || depth > maxVisitedDepth) {
                maxVisitedDepth = depth;
            }
            const curNodeId = curNode.id();

            const edgeToCurNodeLength =
                edgeToCurNode != null ? edgeLengthFn(edgeToCurNode) : null;

            debug(`#${visitIndex}: Visiting ${curNodeId} from ${prevNode?.id()} via `
                  + `${dispElement(edgeToCurNode)} of length ${edgeToCurNodeLength} `
                  + ` @ depth=${depth}`,
                  { nodeDistanceToComponent });

            visitedNodes.add(curNode);

            // haven't been here yet.  This happens most of the time, it is only skipped
            // for root nodes.
            let nodeDistanceInfo = nodeDistanceToComponent[curNodeId];
            if (nodeDistanceInfo == null) {
                // curNode hasn't been seen yet, record its distance information:
                const prevNodeId = prevNode.id();
                const prevDistanceInfo = nodeDistanceToComponent[prevNodeId];
                if (prevDistanceInfo == null) {
                    throw new Error(`Error: prevDistanceInfo is null/undefined!`);
                }
                nodeDistanceInfo = {
                    componentIndex: prevDistanceInfo.componentIndex,
                    distance: prevDistanceInfo.distance + edgeToCurNodeLength,
                    previousEdge: edgeToCurNode,
                    previousNode: prevNode,
                    previousNodeIdChain: [prevNodeId, ...prevDistanceInfo.previousNodeIdChain],
                };
                nodeDistanceToComponent[curNodeId] = nodeDistanceInfo;
            }
            const componentIndex = nodeDistanceInfo.componentIndex;
            const distance = nodeDistanceInfo.distance;

            // Is this node connected to a node attached to another component?
            const connectedEdges = curNode.connectedEdges();
            //debug({ nodeDistanceInfo, distance, connectedEdges });
            for (const connectedEdge of connectedEdges) {
                if (!allEdges.has(connectedEdge) || connectedEdge.same(edgeToCurNode)) {
                    continue;
                }
                //debug(`Exploring connecting edge ${dispElement(connectedEdge)}`);
                const nextNodeList = connectedEdge.connectedNodes().filter(
                    n => !n.same(curNode) && allNodes.has(n)
                );
                if (nextNodeList.length === 0) {
                    debug(`Connecting edge ${dispElement(connectedEdge)} has no valid other node!!?`);
                    continue;
                }
                const nextNode = nextNodeList[0];
                // if (visitedNodes.has(nextNode)) {
                //     debug(`Skipping edge ${dispElement(connectedEdge)}, already visited ${nextNode.id()}`);
                //     continue;
                // }

                const nextNodeId = nextNode.id();
                const otherNodeDistanceInfo =
                    nodeDistanceToComponent[nextNodeId];
                const otherComponentIndex = otherNodeDistanceInfo?.componentIndex ;

                // const _showNDI = (ndi) => (ndi != null) ? `{componentIndex:${ndi.componentIndex}, distance:${ndi.distance}, previousEdge:${dispElement(ndi.previousEdge)}, previousNode:${dispElement(ndi.previousNode)}, previousNodeIdChain:${ndi.previousNodeIdChain}}` : `(null/undef)`;
                // debug(` ... ${dispElement(connectedEdge)}, next node has info ${_showNDI(otherNodeDistanceInfo)}, we have ${_showNDI(nodeDistanceInfo)}`);

                // prohibit cycles in the "previous node chain"
                if (nodeDistanceInfo.previousNodeIdChain.includes(nextNodeId)) {
                    debug(`... skipping ${dispElement(connectedEdge)} as our previous node chain already includes next node ${nextNodeId}`);
                }

                if (otherComponentIndex != null
                    && otherComponentIndex !== componentIndex) {
                    // the nextNode is connected to a different component, maybe we
                    // can register a new path between these components!
                    //debug(`Detected path to other component!`, {otherNodeDistanceInfo});
                    C.processConnectingPath({
                        componentIndex,
                        otherComponentIndex,
                        pathLength: distance + otherNodeDistanceInfo.distance
                            + edgeLengthFn(connectedEdge),
                        buildPathFn: () => {
                            //debug(`building node chain with curNodeId=${curNodeId} / nextNodeId=${nextNodeId}`);
                            let path = [];
                            let n, e;
                            // nodes from [componentIndex] up to the connecting node
                            e = edgeToCurNode;
                            n = prevNode;
                            while (n != null) {
                                //debug(`Building path (1): `, {e, n});
                                path.unshift(e);
                                path.unshift(n);
                                let nid = n.id();
                                e = nodeDistanceToComponent[nid].previousEdge;
                                n = nodeDistanceToComponent[nid].previousNode;
                            }
                            // the current node - we connect prevNode to nextNode
                            //debug(`Building path (1.5): `, {curNode});
                            path.push(curNode);
                            // & nodes from the next connecting node to [otherComponentIndex]
                            e = connectedEdge;
                            n = nextNode;
                            while (n != null) {
                                //debug(`Building path (2): `, {e, n});
                                path.push(e);
                                path.push(n);
                                let nid = n.id();
                                e = nodeDistanceToComponent[nid].previousEdge;
                                n = nodeDistanceToComponent[nid].previousNode;
                            }
                            //debug(`path=${dispCollection(path)}`);
                            return path;
                        }
                    });
                }
            }

            //debug({ connectingPaths });

            C.checkUpdateAllComponentsNowConnected({ curDepth: depth });

            //debug(`Node visit completed`, { connectingPaths });
        }
    });
    
    // Do something with the paths that we found that connect the different
    // components.
    //debug(`Finally figured out the paths between connected components!`,
    //      connectingPaths);

    return {
        connectingPaths: C.connectingPaths,
        numComponents: C.numComponents,
        allComponentsNowConnected: C.allComponentsNowConnected,
        allComponentsConnectedAtDepth: C.allComponentsConnectedAtDepth,
        maxVisitedDepth,
    };
}