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
                includeConnectedKingdomAndDomains: true,
                showIntermediateConnectingNodes: true,
                // use algorithm defaults for these by default -
                connectingNodesMaxDepth: null,
                connectingNodesMaxExtraDepth: null,
                connectingNodesOnlyKeepPathsWithAdditionalLength: null,
            },
            options
        );
        super(eczCodeGraph, options);
    }

    installSubgraph()
    {
        let {
            // A list of code IDs to include in the subgraph to display.
            codeIds,

            includeConnectedKingdomAndDomains,

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

        if (subsetElements.length === 0) {
            console.warn(`No code IDs set for subset graph layout.  (Set ‘codeIds={...}’ in `
                + `the ‘modeSubsetOptions’.  Note it's ‘codeIds’ and not ‘nodeIds’ as for the `
                + `‘isolate-nodes' mode.)`
            );
            
        }

        if (includeConnectedKingdomAndDomains) {
            // Run two iterations of picking adjascent kingdoms and domains.
            for (let repeat = 0; repeat < 2; ++repeat) {
                subsetElements = subsetElements.union(
                    subsetElements.outgoers( (ele) => {
                        return (
                            (ele.isEdge() && ele.target().data()._isKingdom)
                            || (ele.isNode() && ele.data()._isKingdom)
                            || (ele.isEdge() && ele.target().data()._isDomain)
                            || (ele.isNode() && ele.data()._isDomain)
                        );
                    } )
                );
            }
        }

        if (showIntermediateConnectingNodes && subsetElements.length) {

            const connectingPathsInfo = connectingPathsComponents({
                rootElements: subsetElements,
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
            let participatingElements = Object.values(participatingElementIds);
            connectingComponentsElements = this.cy.collection().union( participatingElements );
            debug(`Found ${participatingElements.length} connecting path elements:`,
                dispCollection(participatingElements));

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
            //
            for (const shortestPathInfo of connectingShortestPaths) {
                const { from, to, path } = shortestPathInfo;
                if (isLayoutParentConnected[from][to]) {
                    continue;
                }
                const pathEdges = this.cy.collection().union(path).edges();
                debug(`Adding path edges as layout-parents: ${dispCollection(pathEdges)}`);
                // add this path as layout-parent edges
                layoutPrimaryParentEdges = layoutPrimaryParentEdges.union(pathEdges);
                // now mark the corresponding components are connected, plus all
                // resulting additional connections.
                markConnected(from, to);
            }

            fadeExtraElements = fadeExtraElements.union(connectingComponentsElements);
        }

        let visibleElements = subsetElements.union(fadeExtraElements);

        debug(`codeIds=${codeIds.join(',')}`);
        debug(`subsetCodeNodes=${dispCollection(subsetCodeNodes)}`);
        debug(`subsetElements=${dispCollection(subsetElements)}`);
        debug(`connectingComponentsElements=${dispCollection(connectingComponentsElements)}`);
        debug(`fadeExtraElements=${dispCollection(fadeExtraElements)}`);
        debug(`visibleElements=${dispCollection(visibleElements)}`);

        allElements.removeClass('layoutVisible layoutParent');

        subsetElements.addClass('layoutVisible');
        layoutPrimaryParentEdges.addClass('layoutParent');

        debug(`about to fadeExtraElements...`, {fadeExtraElements});
        debug(`fadeExtraElements' classes -> `, fadeExtraElements.map( e => e._private?.classes ));
        fadeExtraElements.addClass('layoutVisible layoutFadeExtra');

        // find root nodes for the layout
        visibleElements.forEach( (ele) => {
            if (!ele.isNode()) {
                return;
            }
            const eleVisOutgoers = ele.outgoers('node.layoutVisible');
            debug(`Inspecting node for root: `, {ele, eleVisOutgoers})
            if (eleVisOutgoers.length == 0) {
                // this one is a root node.
                ele.addClass('layoutRoot');
            }
        } );
        //debug(`Number of root codes for layout: `, this.cy.elements('.layoutRoot').length);

        debug(`EczCodeGraphSubgraphSelectorAll: installSubgraph() done.`);
    }

}
