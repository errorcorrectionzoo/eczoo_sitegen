import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.subgraphselectorsubset');

import loMerge from 'lodash/merge.js';

import { connectingPathsComponents, dispCollection } from './graphtools.js';

import { EczCodeGraphSubgraphSelector } from './subgraphselector.js';


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
                connectingNodesMaxExtraDepth: null,
                connectingNodesOnlyKeepPathsWithAdditionalLength: null,
                connectingNodesToDomainsAndKingdoms: true,
            },
            options
        );
        super(eczCodeGraph, options);
    }

    installSubgraph()
    {
        this._markSubgraphInstalled(true);

        let {
            // A list of code IDs to include in the subgraph to display.
            codeIds,

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

            connectingNodesToDomainsAndKingdoms,
        } = this.options;

        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph(), codeIds=${codeIds}`);

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

        let rootElements = this.cy.collection();

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
        if (connectingNodesToDomainsAndKingdoms) {
            let domainsAndKingdomNodes = this.cy.collection();
            // Add all domains and kingdoms as elements we want to show.
            // Check the domains and kingdoms of all elements we selected.
            let nextNodes = subsetElements;
            let seenNodes = this.cy.collection();
            while (nextNodes.length) {
                seenNodes = seenNodes.union(nextNodes);
                let upwardsEdges = nextNodes.connectedEdges(
                    '[_relType="parent"]'
                ).filter(
                    (e) => nextNodes.has(e.source())
                );
                nextNodes = upwardsEdges.connectedNodes().filter(
                    (n) => !seenNodes.has(n)
                );
                const foundKingdomsAndDomains =
                    nextNodes.filter('node[_isDomain=1], node[_isKingdom=1]');
                domainsAndKingdomNodes = domainsAndKingdomNodes.union(
                    foundKingdomsAndDomains
                );
                debug(`Found ${foundKingdomsAndDomains.length} kingdoms/domains at `
                      + `this level - `, foundKingdomsAndDomains);
            }
            const internalEdges = domainsAndKingdomNodes.connectedEdges().filter(
                e => domainsAndKingdomNodes.has(e.source())
                     && domainsAndKingdomNodes.has(e.target())
            );
            additionalComponentElements = domainsAndKingdomNodes.union(internalEdges);
            // internal edges should be use for layout parent relationships
            layoutPrimaryParentEdges =
                layoutPrimaryParentEdges.union(internalEdges);
        }
        allComponentElements = allComponentElements.union(additionalComponentElements);

        fadeExtraElements = fadeExtraElements.union(additionalComponentElements);

        if (showIntermediateConnectingNodes && subsetElements.length) {

            const connectingPathsInfo = connectingPathsComponents({
                rootElements: allComponentElements,
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
            let participatingElementsArray = Object.values(participatingElementIds);
            connectingComponentsElements =
                this.cy.collection().union( participatingElementsArray );
            debug(`Found ${participatingElementsArray.length} connecting path elements:`,
                dispCollection(participatingElementsArray));

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
                            otherPathInfos: connectingPaths[i][j].paths,
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

            // we need to make sure any added nodes all belong to some layout
            // tree via layoutParent edges.
            let nodesToInsertIntoLayoutTree =
                this.cy.collection().union( connectingComponentsElements.nodes() );

            for (const shortestPathInfo of connectingShortestPaths) {
                const { from, to, path, otherPathInfos } = shortestPathInfo;
                if ( ! isLayoutParentConnected[from][to] ) {
                    const pathElements = this.cy.collection().union(path);
                    const pathEdges = pathElements.edges();
                    debug(`Adding path edges as layout-parents: ${dispCollection(pathEdges)}`);
                    // add this path as layout-parent edges
                    layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(pathEdges);
                    nodesToInsertIntoLayoutTree = nodesToInsertIntoLayoutTree.difference(
                        pathElements.nodes()
                    );
                    // now mark the corresponding components are connected, plus all
                    // resulting additional connections.
                    markConnected(from, to);
                }
                // Investigate the other paths connecting these components, since we
                // need to make sure any added nodes all belong to some layout
                // tree via layoutParent edges.
                if (nodesToInsertIntoLayoutTree.length === 0) {
                    // all good, we can skip, no other nodes to insert
                    continue;
                }
                for (const { path } of otherPathInfos) {
                    for (let pi = 1; pi+1 < path.length; pi += 2) {
                        let e = path[pi];
                        let n = path[pi+1]
                        if (nodesToInsertIntoLayoutTree.has(n)) {
                            layoutPrimaryParentEdges =
                                layoutPrimaryParentEdges.union(e);
                            nodesToInsertIntoLayoutTree =
                                nodesToInsertIntoLayoutTree.difference(n);
                        }
                    }
                    if (nodesToInsertIntoLayoutTree.length === 0) {
                        break;
                    }
                }
            }

            fadeExtraElements = fadeExtraElements.union(connectingComponentsElements);
        }

        let visibleElements = subsetElements.union(fadeExtraElements);

        // We need to find the components and pick a root element in each component.
        // We should do this *even if we added intermediate nodes* because we might
        // have failed to fully connect the graph.
        for (const component of visibleElements.components()) {
            // pick any element of this component that is in subsetElements.

            // if there's a domain in the component, then pick that.  Otherwise, pick
            // a kingdom.  Otherwise, just pick any code we can find from our original
            // subset element list.

            debug(`Picking a root element in the component:`, dispCollection(component));

            const domainNodes = component.nodes('[_isDomain=1]');
            if (domainNodes.length) {
                rootElements = rootElements.union(domainNodes[0]);
                continue;
            }
            const kingdomNodes = component.nodes('[_isKingdom=1]');
            if (kingdomNodes.length) {
                rootElements = rootElements.union(kingdomNodes[0]);
                continue;
            }

            for (const e of subsetElements.nodes()) {
                if (component.has(e)) {
                    rootElements = rootElements.union(e);
                    break;
                }
            }
        }

        debug(`codeIds=${codeIds.join(',')}`);
        debug(`subsetCodeNodes=${dispCollection(subsetCodeNodes)}`);
        debug(`subsetElements=${dispCollection(subsetElements)}`);
        debug(`connectingComponentsElements=${dispCollection(connectingComponentsElements)}`);
        debug(`fadeExtraElements=${dispCollection(fadeExtraElements)}`);
        debug(`visibleElements=${dispCollection(visibleElements)}`);
        debug(`rootElements=${dispCollection(rootElements)}`);

        this.cy.batch( () => {
            allElements.removeClass('layoutVisible layoutParent');

            subsetElements.addClass('layoutVisible');
            layoutPrimaryParentEdges.addClass('layoutParent');
            fadeExtraElements.addClass('layoutVisible layoutFadeExtra');
            rootElements.addClass('layoutRoot');
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

        debug(`EczCodeGraphSubgraphSelectorSubset: installSubgraph() done.`);
    }

}
