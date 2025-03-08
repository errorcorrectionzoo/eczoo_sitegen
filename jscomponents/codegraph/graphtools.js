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


// ============================================================================


/**
 * Detects disconnected components in `rootElements`, then explores the graph described
 * by `allElements` to find meaningful paths that connect these components.
 * 
 * ...
 */
export function connectingPathsComponents({
    cy,
    visibleElements,
    allElements,
    connectingNodesMaxPathLength,
    connectingNodesMaxNumPaths,
    connectingNodesOnlyKeepPathsWithAdditionalLength,
    edgeLengthFn,
})
{
    connectingNodesMaxPathLength ??= 3.5;
    connectingNodesMaxNumPaths ??= 5;
    connectingNodesOnlyKeepPathsWithAdditionalLength ??= 0;

    edgeLengthFn ??= (edge_) => 1;

    debug(`connectingPathsComponents: visible elements = ${dispCollection(visibleElements)}`);

    // We're trying to find k-shortest path routing between nodes, where edges that
    // are visible have zero weight (same component).  We can adapt Dijkstra's algorithm
    // for this, see https://en.wikipedia.org/wiki/K_shortest_path_routing.

    // Start with any node, figure out shortest paths to all other visible nodes.
    // All nodes with distance zero to that node are in the same component.  Then,
    // we pick any node with nonzero distance to the first node, and repeat the process
    // to identify further components.  Each component is represented by one node in
    // that component.
    let remainingVisibleNodesToProcess = visibleElements.nodes();
    // components = [
    //     {
    //         representativeNode: (representative node ID),
    //         nodes: (cy collection of nodes in the component, no edges included),
    //         elements: (cy collection with nodes and all internal edges in visibleElements),
    //         shortestPathsTo: {
    //             otherNodeId: {
    //                 paths: ( ... Array of { path: (path), pathLength: .. } ... ),
    //                 shortestPath: (path),
    //                 shortestPathLength: ...,
    //             },
    //             ... shortest paths to all other nodes in graph
    //         },
    //         shortestPathsToComponents: [
    //            shortestPathsTo[components[0].representativeNode.id()],
    //            shortestPathsTo[components[1].representativeNode.id()],
    //            ...,
    //         ],
    //     },
    //     ...
    // ]
    let componentInfos = [];

    while (remainingVisibleNodesToProcess.length) {
        // pick a representative node for the new component that we'll identify ...
        let representativeNode = remainingVisibleNodesToProcess[0];
        debug(
            `New round of identifying a graph component.  Using representative node `
            + `${dispElement(representativeNode)}`
        );
        // ... and figure out all path lengths to all other nodes in the graph.
        let shortestPathsTo = dijkstraMultiShortestPaths({
            allElements,
            rootNode: representativeNode,
            recordShortestPathsTo: visibleElements.nodes(),
            edgeLengthFn,
            maxPathLength: connectingNodesMaxPathLength,
            maxNumPaths: connectingNodesMaxNumPaths,
            maxAdditionalLength: connectingNodesOnlyKeepPathsWithAdditionalLength,
        });
        // debug(`Got shortestPathsTo =`, shortestPathsTo);

        let componentNodes = [];
        // All nodes at distance zero to this node are in the same component.
        for (const [otherNodeId, shortestPathsInfo] of Object.entries(shortestPathsTo)) {
            if (shortestPathsInfo.shortestPathLength === 0) {
                const otherNode = visibleElements.getElementById(otherNodeId);
                if (otherNode == null) {
                    console.error(
                        `Internal inconsistency: got a node at distance zero by it I couldn't `
                        + `find it in visibleElements!`
                    );
                    continue;
                }
                componentNodes.push( otherNode );
            }
        }
        if (componentNodes.length === 0) {
            console.error(
                `Internal inconsistency: I was not able to identify a new component, even `
                + `though there are remaining visible nodes to process.`
            );
            break;
        }
        const componentNodesCollection = cy.collection().union(componentNodes);
        remainingVisibleNodesToProcess = remainingVisibleNodesToProcess.difference(
            componentNodesCollection
        );
        const componentElements = componentNodesCollection.union(
            visibleElements.edges().filter(
                (ele) => (
                    componentNodesCollection.has(ele.source())
                    && componentNodesCollection.has(ele.target())
                )
            )
        );

        let newComponentInfo = {
            representativeNode,
            nodes: componentNodesCollection,
            elements: componentElements,
            shortestPathsTo,
            shortestPathsToComponents: null, // populated later.
        };
        // debug(
        //     `The new component represented by ${dispElement(representativeNode)} `
        //     + `contains the nodes ${dispCollection(componentNodesCollection)}. `
        //     + `All elements in component = ${dispCollection(componentElements)}.`
        // );
        componentInfos.push(newComponentInfo);
    }

    // initialize `shortestPathsToComponents` property of each component, now that we know
    // how many components we have in total.
    for (let [componentIndex, component] of componentInfos.entries()) {
        component.shortestPathsToComponents = new Array(componentInfos.length);
        component.shortestPathsToComponents[componentIndex] = { // path to self
            paths: [ [] ],
            shortestPath: [],
            shortestPathLength: 0,
        };
    }

    // Now we got the components, identify the shortest paths to all other components.
    for (let componentIndex = 0; componentIndex < componentInfos.length; ++componentIndex) {
        let thisComponent = componentInfos[componentIndex];
        for (let otherComponentIndex = componentIndex + 1;
             otherComponentIndex < componentInfos.length; ++otherComponentIndex) {
            const otherComponent = componentInfos[otherComponentIndex];
            // ...
            const connectingShortestPaths = thisComponent.shortestPathsTo[
                otherComponent.representativeNode.id()
            ];
            debug(
                `Distance between component #${componentIndex} and #${otherComponentIndex} `
                + `is ${ connectingShortestPaths.shortestPathLength }. `
                + `connectingShortestPaths =`, connectingShortestPaths
            );

            thisComponent.shortestPathsToComponents[otherComponentIndex] =
                connectingShortestPaths;

            otherComponent.shortestPathsToComponents[componentIndex] = {
                paths: connectingShortestPaths.paths.map( _reversedPathInfo ),
                shortestPath: [...connectingShortestPaths.shortestPath].reverse(),
                shortestPathLength: connectingShortestPaths.shortestPathLength,
            };
        }
    }

    return { componentInfos };
}

const _reversedPathInfo = (path) => {
    return {
        pathLength: path.pathLength,
        path: [...path.path].reverse(),
        stepPath: [...path.stepPath].reverse(),
        to: (path.path.length ? path.path[0] : null),
    };
};
     


function dijkstraMultiShortestPaths({
    allElements,
    rootNode,
    recordShortestPathsTo,
    edgeLengthFn,
    maxPathLength,
    maxNumPaths,
    maxAdditionalLength,
})
{
    debug(
        `dijkstraMultiShortestPaths()!`, {
            allElements,
            rootNode,
            recordShortestPathsTo,
            edgeLengthFn,
            maxPathLength,
            maxNumPaths,
            maxAdditionalLength,
        }
    );

    const allNodes = allElements.nodes();

    // adapting the algorithm in https://en.wikipedia.org/wiki/K_shortest_path_routing

    // "B"
    // sortedTestPaths = [
    //     {
    //         pathLength: (path-length),
    //         // 'stepPath': only edges, without length-zero edges
    //         stepPath: [...steppath1],
    //         // 'path': node and edges, alternating, also zero-length; w/o "to" node
    //         path: [...path1],
    //         to: targetNode
    //     },
    //     ...
    // ]
    let sortedTestPaths = [];

    // "P", but for all target nodes (those in `recordShortestPathsTo`)
    let shortestPathsTo = {}; // nodeId: [ { pathLength:, path:, ... as above}, ... ]

    // "count_u" - number of shortest paths encountered to all other node IDs
    let numShortestPathsTo = {}; // nodeId: (number)

    for (const node of recordShortestPathsTo.nodes()) {
        shortestPathsTo[node.id()] = { paths: [] };
    }
    for (const node of allNodes) {
        numShortestPathsTo[node.id()] = 0;
    }

    sortedTestPaths = [ { pathLength: 0, stepPath: [], path: [], to: rootNode } ];

    const processEdge = (path, v) => {
        //debug(`processEdge():`, path, dispElement(v));
        // try a new path
        const newTo = v.connectedNodes().filter( n => n.id() !== path.to.id() ) [0];
        //debug(`newTo =`, dispElement(newTo));
        // forbid cycles in the path
        if (newTo == null || path.path.indexOf(newTo) !== -1) {
            // Maybe newTo == null if an edge has the same source & target node?
            return;
        }
        const edgeWeight = edgeLengthFn(v);
        const newPathLength = path.pathLength + edgeWeight;
        // debug(
        //     `edgeWeight = ${edgeWeight}, newPathLength=${newPathLength}, `
        //     + `maxPathLength=${maxPathLength}, maxNumPaths=${maxNumPaths}`
        // );
        if (maxNumPaths != null && newPathLength > maxPathLength) {
            return;
        }
        
        const newPathItems = [ ...path.path, path.to, v ];
        let newStepPathItems = [ ...path.stepPath ]
        if (edgeWeight !== 0) {
            newStepPathItems.push(v);
        } else {
            // ignore path if it differs from another existing path by length-0 edges only
            // debug(
            //     `newStepPathItems=${newStepPathItems.map( dispElement ).join(' • ')}  ;;`
            // );
            for (const otherPath of sortedTestPaths) {
                if (otherPath.to === newTo
                    && otherPath.stepPath.length === newStepPathItems.length
                    && newStepPathItems.every( (w, idx) => (w === otherPath.stepPath[idx]) )
                ) {
                    return;
                }
            }
        }
        
        const newPath = {
            pathLength: newPathLength,
            path: newPathItems,
            stepPath: newStepPathItems,
            to: newTo,
        };
        // debug(`newPath =`, newPath);
        // add the path to the sorted list of paths to consider
        let i = 0;
        for (i = 0; i < sortedTestPaths.length; ++i) {
            const pi = sortedTestPaths[i];
            if (pi.pathLength > newPathLength) {
                // insert here
                break;
            }
        }
        sortedTestPaths.splice(i, 0, newPath);
    };
    const recordNewShortestPath = (path) => {
        const pathToId = path.to.id();
        if (!recordShortestPathsTo.has(path.to)) {
            return;
        }
        let shortestPathsToHerePaths = shortestPathsTo[pathToId].paths;
        if (shortestPathsToHerePaths.length > 0 && 
            path.pathLength > shortestPathsToHerePaths[0].pathLength + maxAdditionalLength) {
            return;
        }
        // Record the shortest path into shortestPathsTo[pathToId].paths, which is aliased
        // to shortestPathsToHerePaths; keep the list sorted by increasing path length.
        let j = 0;
        for (j = 0; j < shortestPathsToHerePaths.length; ++j) {
            if (shortestPathsToHerePaths[j].pathLength > path.pathLength) {
                // will insert here
                break;
            }
        }
        shortestPathsToHerePaths.splice(j, 0, path);
    };

    while (sortedTestPaths.length) {
        // the shortest path in "sortedTestPaths" is the first one.
        const path = sortedTestPaths.shift();
        // debug(`algo iteration: processing path = ${dispCollection(path.path)}`);
        // debug({ sortedTestPaths });
        const pathToId = path.to.id();

        numShortestPathsTo[pathToId] += 1;

        recordNewShortestPath(path);

        // explore 
        if (numShortestPathsTo[pathToId] <= maxNumPaths) {
            const connectedEdges = path.to.connectedEdges().filter( (edge) => {
                return (
                    allElements.has(edge) && allElements.has(edge.source())
                    && allElements.has(edge.target())
                );
            });
            for (const v of connectedEdges) {
                processEdge(path, v);
            }
        }
    }

    // add "shortest path" information to each element of shortestPathsToHere
    for (const [nId_, info] of Object.entries(shortestPathsTo)) {
        if (info.paths.length) {
            info.shortestPath = info.paths[0].path;
            info.shortestPathLength = info.paths[0].pathLength;
        } else {
            info.shortestPath = [];
            info.shortestPathLength = Infinity;
        }
    }

    return shortestPathsTo;
}



