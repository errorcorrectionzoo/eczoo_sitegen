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
    return `UNKNOWN{${JSON.stringify(e)}}`;
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


export function connectingPathsComponents({
    rootElements,
    allElements,
    connectingNodesMaxDepth,
    connectingNodesMaxExtraDepth,
    connectingNodesOnlyKeepPathsWithAdditionalLength,
})
{
    connectingNodesMaxDepth ??= 15;
    connectingNodesMaxExtraDepth ??= 2;
    connectingNodesOnlyKeepPathsWithAdditionalLength ??= 2;

    const allNodes = allElements.nodes();
    const allEdges = allElements.edges();

    // Identify the connected components of the displayed nodes and find paths
    // that connect the disconnected clusters
    const components = rootElements.components();
    const numComponents = components.length;

    debug(`Got components:`, components);

    if (!components.length) {
        // something wrong or empty graph
        return null;
    }

    if (components.length === 1) {
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
    for (const [componentIndex, componentCollection] of components.entries()) {
        for (const node of componentCollection.nodes()) {
            const nodeId = node.id();
            nodeDistanceToComponent[nodeId] = {
                componentIndex,
                distance: 0,
                previousEdge: null,
                previousNode: null,
            };
        }
    }

    // connectingPaths[componentIndex1][componentIndex2] = {
    //   paths: ( ... Array of { path: (path), pathLength: (# of edges in path) } ... ),
    //   shortestPath: (path in paths[].path that has shortest length),
    //   shortestLength: (length of shortest path),
    // }
    //
    // Each path is itself an array of alternating node and edge objects of
    // connected nodes and edges, starting from a node in componentIndex1
    // and ending with a node in componentIndex2.
    let connectingPaths = {};
    // initialize with empty objects
    for (let c1Index = 0; c1Index < numComponents; ++c1Index) {
        connectingPaths[c1Index] = {};
        for (let c2Index = 0; c2Index < numComponents; ++c2Index) {
            connectingPaths[c1Index][c2Index] = {
                paths: [],
                shortestPath: (c1Index === c2Index) ? [] : null,
                shortestLength: (c1Index === c2Index) ? 0 : null,
            }
        }
    }

    let seenConnectingEdges = new Set();

    let allComponentsNowConnected = false;
    let allComponentsConnectedAtDepth = null;

    let processConnectingPath = ({
        componentIndex,
        otherComponentIndex,
        pathLength,
        buildPath,
    }) => {
        debug(`processConnectingPath: `,
                {componentIndex,otherComponentIndex,pathLength});
        debug(`at this point, connectedPaths: `);
        for (let i = 0; i < numComponents; ++i) {
            for (let j = 0; j < numComponents; ++j) {
                const cinfo = connectingPaths[i][j];
                debug(`  ${i}->${j}:  ${cinfo.shortestLength}  :  ${dispCollection(cinfo.shortestPath)}; \n   `
                      + cinfo.paths.map(
                            ({path,pathLength}, i) => `  #${i} [${pathLength}:]-- `+dispCollection(path)
                        ).join('\n') );
            }
        }

        if (componentIndex === otherComponentIndex) {
            debug(`called processConnectedPath() with twice the same component!`);
            return;
        }

        let connectingPathsInfo =
            connectingPaths[componentIndex][otherComponentIndex];
        let keepPath = false;
        if (connectingPathsInfo.shortestLength == null) {
            // we don't have any other path, keep this path for sure
            keepPath = true;
        } else if (
            pathLength <= connectingPathsInfo.shortestLength +
                connectingNodesOnlyKeepPathsWithAdditionalLength
        ) {
            keepPath = true;
        }
        if (keepPath === false) {
            // let's not keep this path.
            return;
        }

        debug(`building path...`);
        const path = buildPath();
        connectingPathsInfo.paths.push({ path, pathLength });
        let revPath = [...path].reverse();
        let revConnectingPathsInfo =
            connectingPaths[otherComponentIndex][componentIndex];
        revConnectingPathsInfo.paths.push({ path: revPath, pathLength });

        debug(`built path & saved it: ${dispCollection(path)}`);

        if (connectingPathsInfo.shortestLength == null
            || pathLength < connectingPathsInfo.shortestLength) {
            debug(`Registering new path as being shortest for this connection.`);
            connectingPathsInfo.shortestLength = pathLength;
            revConnectingPathsInfo.shortestLength = pathLength;
            connectingPathsInfo.shortestPath = path;
            revConnectingPathsInfo.shortestPath = revPath;
            // prune any paths that are too long.
            let newLengthLimit = pathLength
                + connectingNodesOnlyKeepPathsWithAdditionalLength ;
            debug(`Cleaning up existing paths, new length limit = ${newLengthLimit}.`);
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
        for (let thirdComponentIndex = 0; thirdComponentIndex < numComponents;
             ++thirdComponentIndex) {
            if (thirdComponentIndex === componentIndex
                || thirdComponentIndex === otherComponentIndex) {
                continue;
            }
            debug(`Checking for connections to third component ${thirdComponentIndex} `
                + `that are mediated through ${componentIndex}->${otherComponentIndex}`);
            // if third component is connected to the first (resp. other)
            // component, then we've potentially discovered a path connecting
            // the third component to the other (resp. first) component. Process it.
            const thirdConnectingToFirstInfo =
                connectingPaths[thirdComponentIndex][componentIndex];
            if (thirdConnectingToFirstInfo.shortestLength != null) {
                const thirdConnectionPath =
                    thirdConnectingToFirstInfo.shortestPath;
                const fullThirdConnectionPath = [
                    ...thirdConnectionPath,
                    ...path.slice(1),
                ];
                debug(`Registering new path for third component ${thirdComponentIndex}->${otherComponentIndex} mediated through ${componentIndex}`);
                processConnectingPath({
                    componentIndex: thirdComponentIndex,
                    otherComponentIndex: otherComponentIndex,
                    pathLength: (
                        thirdConnectingToFirstInfo.shortestLength + pathLength
                    ),
                    buildPath: () => fullThirdConnectionPath,
                });
            }
            const otherConnectingToThirdInfo =
                connectingPaths[otherComponentIndex][thirdComponentIndex];
            if (otherConnectingToThirdInfo.shortestLength != null) {
                const thirdConnectionPath =
                    otherConnectingToThirdInfo.shortestPath;
                const fullThirdConnectionPath = [
                    ...path,
                    ...thirdConnectionPath.slice(1),
                ];
                debug(`Registering another path for third component ${componentIndex}->${thirdComponentIndex} mediated through ${otherComponentIndex}`);
                processConnectingPath({
                    componentIndex: componentIndex,
                    otherComponentIndex: thirdComponentIndex,
                    pathLength: (
                        otherConnectingToThirdInfo.shortestLength + pathLength
                    ),
                    buildPath: () => fullThirdConnectionPath,
                });
            }
        }

    };

    allElements.bfs({
        root: rootElements,
        directed: false,
        visit: function (curNode, edgeToCurNode, prevNode, visitIndex, depth) {
            if (depth > connectingNodesMaxDepth) {
                debug(`Maximum depth ${depth} reached after ${visitIndex} `
                        + `iterations, stopping BFS search here`);
                return false; // stop here.
            }
            if (depth > allComponentsConnectedAtDepth + connectingNodesMaxExtraDepth) {
                debug(`Completed ${connectingNodesMaxExtraDepth} additional rounds `
                    + `of BFS after connecting the full graph, stopping here.`);
                return false; // stop here.
            }
            const curNodeId = curNode.id();
            debug(`Visiting ${curNodeId} from ${prevNode?.id()} via `
                  + `${dispElement(edgeToCurNode)} @depth=${depth}`,
                  { nodeDistanceToComponent });
            if (nodeDistanceToComponent[curNodeId] != null) {
                // okay, this happens when we're visiting the initial root nodes.
                // Next.
                return;
            }
            // curNode hasn't been seen yet, record its distance information:
            const prevNodeId = prevNode.id();
            const prevDistanceInfo = nodeDistanceToComponent[prevNodeId];
            if (prevDistanceInfo == null) {
                throw new Error(`Error: prevDistanceInfo is null/undefined!`);
            }
            const componentIndex = prevDistanceInfo.componentIndex;
            const distance = prevDistanceInfo.distance + 1;
            const nodeDistanceInfo = {
                componentIndex,
                distance,
                previousEdge: edgeToCurNode,
                previousNode: prevNode,
            };
            nodeDistanceToComponent[curNodeId] = nodeDistanceInfo;

            debug({ prevDistanceInfo, nodeDistanceInfo, distance });

            // Is this node connected to a node attached to another component?
            const connectedEdges = curNode.connectedEdges().filter(
                e => (allEdges.has(e) && e !== edgeToCurNode && !seenConnectingEdges.has(e))
            );
            for (const connectedEdge of connectedEdges) {
                seenConnectingEdges.add(connectedEdge);
                const nextNodeList = connectedEdge.connectedNodes().filter(
                    n => !n.same(curNode) && allNodes.has(n)
                );
                if (nextNodeList.length === 0) {
                    continue;
                }
                const nextNode = nextNodeList[0];
                const nextNodeId = nextNode.id();
                const otherNodeDistanceInfo =
                    nodeDistanceToComponent[nextNodeId];
                const otherComponentIndex = otherNodeDistanceInfo?.componentIndex ;
                if (otherComponentIndex != null
                    && otherComponentIndex !== componentIndex) {
                    // the nextNode is connected to a different component, maybe we
                    // can register a new path between these components!
                    debug(`Detected path to other component!`, {otherNodeDistanceInfo});
                    processConnectingPath({
                        componentIndex,
                        otherComponentIndex,
                        pathLength: distance + otherNodeDistanceInfo.distance + 1,
                        buildPath: () => {
                            debug(`building node chain with curNodeId=${curNodeId} / nextNodeId=${nextNodeId}`);
                            let path = [];
                            let n, e;
                            // nodes from [componentIndex] up to the connecting node
                            e = edgeToCurNode;
                            n = prevNode;
                            while (n != null) {
                                debug(`Building path (1): `, {e, n});
                                path.unshift(e);
                                path.unshift(n);
                                let nid = n.id();
                                e = nodeDistanceToComponent[nid].previousEdge;
                                n = nodeDistanceToComponent[nid].previousNode;
                            }
                            // the current node - we connect prevNode to nextNode
                            debug(`Building path (1.5): `, {curNode});
                            path.push(curNode);
                            // & nodes from the next connecting node to [otherComponentIndex]
                            e = connectedEdge;
                            n = nextNode;
                            while (n != null) {
                                debug(`Building path (2): `, {e, n});
                                path.push(e);
                                path.push(n);
                                let nid = n.id();
                                e = nodeDistanceToComponent[nid].previousEdge;
                                n = nodeDistanceToComponent[nid].previousNode;
                            }
                            debug(`path=${dispCollection(path)}`);
                            return path;
                        }
                    });
                }
            }

            // Check - are all components finally connected?  This check makes us
            // stop searching for connecting paths earlier (see options).
            // It suffices to check that the component 0 is connected to all others.
            if (!allComponentsNowConnected) {
                let checkAllConnected = true;
                for (let i = 1; i < numComponents; ++i) {
                    if (connectingPaths[0][i].shortestLength == null) {
                        checkAllConnected = false;
                        break;
                    }
                }
                if (checkAllConnected) {
                    debug(`Now all components are connected!`);
                    allComponentsNowConnected = true;
                    allComponentsConnectedAtDepth = depth;
                }
            }
            debug(`Node visit completed`, { connectingPaths });
        }
    });
    
    // Do something with the paths that we found that connect the different
    // components.
    debug(`Finally figured out the paths between connected components!`,
          connectingPaths);

    return { connectingPaths, numComponents };
}