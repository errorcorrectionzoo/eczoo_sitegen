import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.eczcodegraph');

import _ from 'lodash';


const defaultPrelayoutOptions = {

    layoutParentEdgeSelector: '._layoutParent',

    origin: {
        position: {x: 0, y: 0},
        radius: 50.0,
        angularSpread: 2*Math.PI, ///3, //2*Math.PI * 0.2,
        direction: Math.PI/2,
        useWeights: false,
    },

    radiusSegmentLevels: [200, 200, ],
    radiusSegmentLevelFactor: 1.1,

    weightCalcLevels: 2, // look at descendants over X levels for weights  

    weightCalcSecondaryFactor: 0.2,
};


/**
 * Object capable of (pre-)laying out nodes in a radial tree.
 * 
 * - `cy` - the cytoscape graph object.
 * 
 * - `rootNodeIds` - the list of root node IDs, those nodes placed at the center
 *   and from which the tree branches originate
 * 
 * - `rootNodesPrelayoutInfo` - information about the position of the root
 *   nodes, the direction in which the tree branches should go and the angular
 *   spread to use for the branches.  Will sprout branches at angles within
 *   "direction +/- (angular spread/2)"
 * 
 * - `options` - see default options above
 */
export class PrelayoutRadialTree
{
    constructor({cy, rootNodeIds, rootNodesPrelayoutInfo, options})
    {
        this.cy = cy;
        this.rootNodeIds = rootNodeIds;
        this.rootNodesPrelayoutInfo = rootNodesPrelayoutInfo;
        this.options = _.merge(
            {},
            defaultPrelayoutOptions,
            options
        );
    }

    run()
    {
        let pBranches = [];

        let positionedNodesData = {};

        // position the root nodes & set branch "layouters" instances
        let rootNodePrelayoutInfo = {};
        let rootNodeIdsToBePositioned = [];
        for (const rootNodeId of this.rootNodeIds) {
            let prelayoutInfo = this.rootNodesPrelayoutInfo[rootNodeId];
            if (prelayoutInfo != null) {
                rootNodePrelayoutInfo[rootNodeId] = prelayoutInfo;
            } else {
                rootNodeIdsToBePositioned.push(rootNodeId);
            }
        }
        // create "prelayoutInfo" for any root nodes that haven't been manually
        // positioned & directed
        const numJ = rootNodeIdsToBePositioned.length;
        const maxJ = Math.max(rootNodeIdsToBePositioned.length - 1, 1);
        const origin = this.options.origin;
        debug(`Will need to auto position ${numJ} root nodes;`, { origin });
        for (const [j, rootNodeId] of rootNodeIdsToBePositioned.entries()) {
            let angleFraction = j / maxJ;
            if (maxJ === 1) { // special case if we're positioning a single node
                angleFraction = 0.5;
            }
            const angle = origin.direction
                  + (angleFraction - 0.5) * origin.angularSpread;
            const R = origin.radius;
            const position = {
                x:  origin.position.x + R * Math.cos(angle),
                y:  origin.position.y + R * Math.sin(angle),
            };
            rootNodePrelayoutInfo[rootNodeId] = {
                position,
                radiusOffset: R,
                direction: angle,
                angularSpread: origin.angularSpread / numJ,
            };
        }
        
        for (const [rootNodeId, prelayoutInfo] of Object.entries(rootNodePrelayoutInfo)) {

            debug(`Prelayout - Prepping root node ${rootNodeId}`, { prelayoutInfo });

            positionedNodesData[rootNodeId] = {
                position: prelayoutInfo.position,
                isRoot: true,
                relatedAs: 'root',
            };

            const cyRootNode = this.cy.getElementById(rootNodeId);

            const hasChildren = cyRootNode.incomers(this.options.layoutParentEdgeSelector).length > 0;
            const hasParents = cyRootNode.outgoers(this.options.layoutParentEdgeSelector).length > 0;

            if (hasChildren) {
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: prelayoutInfo.radiusOffset,
                        position: prelayoutInfo.position,
                        direction: prelayoutInfo.direction,
                        angularSpread: prelayoutInfo.angularSpread,
                    },
                    options: this.options,
                    branchOptions: {
                        treeDirection: 'children',
                        flipDirection: false,
                    },
                    positionedNodesData,
                }));
            }
            if (hasParents) {
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: prelayoutInfo.radiusOffset,
                        position: prelayoutInfo.position,
                        direction: prelayoutInfo.direction,
                        angularSpread: prelayoutInfo.angularSpread,
                    },
                    options: this.options,
                    branchOptions: {
                        treeDirection: 'parents',
                        flipDirection: true,
                    },
                    positionedNodesData,
                }));
            }
        }

        // Now position the nodes.  Also set marks on nodes so that we can
        // identify those nodes that we positioned and those that we didn't
        // position (the latter should thus be hidden).

        for (const pBranch of pBranches) {
            pBranch.positionAndMarkNodesInData();
        }

        for (const [nodeId, positioningInfo] of Object.entries(positionedNodesData)) {

            let node = this.cy.getElementById(nodeId);
            const { position, isRoot, relatedAs } = positioningInfo;

            node.addClass(["prelayoutPositioned", `prelayoutRelatedAs_${relatedAs}`]);
            if (isRoot) {
                node.addClass(['prelayoutPositioned', 'prelayoutRoot']);
            }
            node.position(position);

        }

    }

}


// ---


class _PrelayoutRadialTreeBranchSet
{
    constructor({cy, root, options, branchOptions, positionedNodesData})
    {
        this.cy = cy;

        this.root = root; // { nodeId, position, direction, angularSpread }
        this.rootNode = this.cy.getElementById(this.root.nodeId);

        this.options = options;

        this.branchOptions = _.merge({
            treeDirection: 'children',
            flipDirection: false,
        }, branchOptions);

        this.positionedNodesData = positionedNodesData;

        this.nodeOrderinginfoByLevel = null;
    }

    //
    // Compute additional information w.r.t. the nodes.
    //
    _computeNodeInfos()
    {
        let nodeOrderinginfoByLevel = [];
        const options = this.options;

        let getEdges = null;
        if (this.branchOptions.treeDirection === 'children') {
            getEdges = (node) => node.incomers(this.options.layoutParentEdgeSelector);
        } else if (this.branchOptions.treeDirection === 'parents') {
            getEdges = (node) => node.outgoers(this.options.layoutParentEdgeSelector);
        }

        let seenNodes = new Set();

        let thisLevelNodes = [ {
            nodeId: this.root.nodeId,
            level: 0,
            //treeDepthRemaining: Object.assign({}, this.branchOptions.tree),
            parentNodeOrderingInfo: null,
            connectedNodesInfos: [],
            totalNumDescendants: 0,
            // numDescendants[rlevel] = total number of direct descendants
            // which are exactly 1+rlevel child edges away from this node.
            numDescendants: [],
            relatedAs: 'root', // one of 'root', 'primary', 'secondary'
        } ];

        let otherConnectedNode = (edge, baseNodeId) => {
            let src = edge.source();
            let tgt = edge.target();
            if (src.id() === baseNodeId) {
                return tgt;
            }
            return src;
        };
        // let relationEdgesGetters = {};
        // for (const whichRelationStrength of ['primary', 'secondary']) {
        //     const selector = options.relationSelector[whichRelationStrength];
        //     if (selector === false) {
        //         relationEdgesGetters[whichRelationStrength] = false;
        //         continue;
        //     }
        //     const fn = mkRelationEdgesGetterWithTreeDirection(
        //         selector, this.branchOptions.treeDirection
        //     );
        //     relationEdgesGetters[whichRelationStrength] = fn;
        // }
        // debug({ relationEdgesGetters });

        nodeOrderinginfoByLevel.push(thisLevelNodes);
        let level = 0;
        while (thisLevelNodes.length) {
            let nextLevelNodes = [];

            for (const nodeOrderingInfo of thisLevelNodes) {

                const {
                    nodeId, parentNodeOrderingInfo, //treeDepthRemaining
                } = nodeOrderingInfo;

                // for each node, update the number of descendants of each
                // parent node
                let pInfo = parentNodeOrderingInfo;
                let pRLevel = 0;
                while (pInfo != null) {
                    pInfo.totalNumDescendants += 1;
                    while (pInfo.numDescendants.length <= pRLevel) {
                        pInfo.numDescendants.push(0);
                    }
                    pInfo.numDescendants[pRLevel] += 1;
                    pInfo = pInfo.parentNodeOrderingInfo;
                    pRLevel += 1;
                }

                for (const whichRelationStrength of ['primary', 'secondary']) {

                    let cyNode = this.cy.getElementById(nodeId);
                    let connectedEdges = getEdges(cyNode);

                    // // see if we're still allowed to expand in that tree direction
                    // if (treeDepthRemaining[whichRelationStrength] === 0) {
                    //     // not true and not a strictly positive number -> cannot
                    //     // continue exploring relations of this type beyond this
                    //     // tree node
                    //     continue;
                    // }
                    // let relationEdgesGetter = relationEdgesGetters[whichRelationStrength];
                    // if (relationEdgesGetter === false) {
                    //     continue;
                    // }

                    // find children through primary parent relation and add them
                    // for next level's processing
                    // let selector = (
                    //     `${options.relationSelector[whichRelationStrength]}`
                    //     + `[${closeNodeWhich}="${nodeId}"]`
                    // );
                    // debug(`selector =`, selector);
                    //let connectedEdges = relationEdgesGetter(this.cy.getElementById(nodeId));
                    let connectedNodesInfos = []
                    for (const edge of connectedEdges) {
                        const connectedNode = otherConnectedNode(edge, nodeId);
                        const connectedNodeId = connectedNode.id();
                        if (Object.hasOwn(this.positionedNodesData, connectedNodeId)
                            || seenNodes.has(connectedNodeId)) {
                            continue;
                        }
                        seenNodes.add(connectedNodeId);

                        // let nextTreeDepthRemaining = Object.assign({}, treeDepthRemaining);
                        // if (nextTreeDepthRemaining[whichRelationStrength] !== true) {
                        //     // decrease the remaining quota for this whichRelationStrength
                        //     nextTreeDepthRemaining[whichRelationStrength] -= 1;
                        // }
                        // if (whichRelationStrength === 'secondary') {
                        //     // never consider primary connections of secondary connections
                        //     nextTreeDepthRemaining.primary = 0;
                        // }

                        connectedNodesInfos.push({
                            nodeId: connectedNodeId,
                            level: level+1,
                            parentNodeOrderingInfo: nodeOrderingInfo,
                            connectedNodesInfos: [],
                            totalNumDescendants: 0,
                            numDescendants: [],
                            // treeDepthRemaining: nextTreeDepthRemaining,
                            //relatedAs: whichRelationStrength,
                        });
                    }
                    nodeOrderingInfo.connectedNodesInfos.push(...connectedNodesInfos);
                    nextLevelNodes.push(...connectedNodesInfos);
                }
            }
            nodeOrderinginfoByLevel.push( nextLevelNodes );
            thisLevelNodes = nextLevelNodes;
            level += 1;
        }

        this.nodeOrderinginfoByLevel = nodeOrderinginfoByLevel;
    }

    //
    // Compute a "weight" for each node -- basically how much angular space the
    // tree is expected to occupy.
    //
    _computeNodeWeights()
    {    
        for (const [/*level*/, orderinginfoList] of this.nodeOrderinginfoByLevel.entries()) {
            orderinginfoList.forEach( (info) => {
                let w = Math.max(
                    1,
                    _.sum(info.numDescendants.slice(0, this.options.weightCalcLevels))
                        ?? 0
                );
                if (info.relatedAs === 'secondary') {
                    w *= this.options.weightCalcSecondaryFactor;
                }
                info._weight = w;
            } );
        }
    }

    //
    // Main POSITION & MARK routines.
    //

    positionAndMarkNodesInData()
    {
        // First, compute important information.  Might inspect
        // this.positionedNodesData to avoid repositioning nodes that already
        // belong to other subtrees.

        this._computeNodeInfos();
        this._computeNodeWeights();

        // NOTE: We don't mark & position the root node itself; that is done by
        // our main Prelayout... class.

        let direction = this.root.direction;
        if (this.branchOptions.flipDirection) {
            direction = -direction;
        }

        this._positionNodeChildren({
            node: this.rootNode,
            nodePosition: this.root.position,
            nodeInfo: this.nodeOrderinginfoByLevel[0][0],
            level: 1,
            angularSpread: this.root.angularSpread,
            direction: direction,
        });
    }


    _markNodeAndSetRelativePosition({node, isRoot, referencePoint, relPos, relatedAs})
    {
        const computedPos = {
            x:  referencePoint.x + relPos.x,
            y:  referencePoint.y + relPos.y,
        };

        const nodeId = node.id();

        if (Object.hasOwn(this.positionedNodesData, nodeId)) {
            throw new Error(`Node ${nodeId} is being positioned in two different subtrees!`);
        }

        this.positionedNodesData[node.id()] = {
            position: computedPos,
            isRoot,
            relatedAs,
        };

        return computedPos;
    }


    _positionNodesRadially({
        nodeInfos, referencePoint, R, direction, angularSpread, isRoot, useWeights
    })
    {
        isRoot ??= false;
        useWeights ??= true;

        let totalWeight = _.sum( nodeInfos.map( (info) => info._weight ?? 1 ) );
        let cumulWeight = 0;

        let positionedNodes = [];

        let numNodes = nodeInfos.length;

        for (const [j, nodeInfo] of nodeInfos.entries()) {
            
            const { nodeId, _weight, relatedAs, } = nodeInfo;

            let node = this.cy.getElementById(nodeId);

            let angleFraction;
            if (numNodes === 1) {
                angleFraction = 0.5;
            } else if (useWeights) {
                angleFraction = cumulWeight / totalWeight;
                if (isRoot && numNodes > 1) {
                    // don't offset angles on root codes, so they align well on
                    // the root circle
                } else {
                    // center on "weight quota"
                    angleFraction += _weight / (2.0*totalWeight);
                }
            } else {
                angleFraction = j / numNodes;
                if (isRoot && numNodes > 1) {
                    // don't offset angles on root codes, so they align well on
                    // the root circle
                } else {
                    angleFraction += 0.5 / numNodes;
                }
            }

            let angle = direction + (angleFraction - 0.5) * angularSpread;

            let relPos = {
                x:  R * Math.cos(angle),
                y:  R * Math.sin(angle),
            };

            cumulWeight += _weight;

            let nodePosition = this._markNodeAndSetRelativePosition({
                node,
                referencePoint,
                relPos,
                isRoot,
                relatedAs,
            });

            // debug(`Positioning ${nodeId};`,
            //       { direction, angularSpread,
            //         _weight, angleFraction, angle, relPos, nodePosition });

            // determine the angular spread that we can allocate to the children
            let childAngularSpread =  _weight * angularSpread / totalWeight;

            positionedNodes.push({
                nodeId, node, nodePosition, nodeInfo,
                angularSpread: childAngularSpread,
                direction: angle,
            });

        }

        return positionedNodes;
    }

    // how to position a non-root node -- in the right direction etc.
    _positionNodeChildren({/*node,*/ nodePosition, nodeInfo, level, angularSpread, direction})
    {
        const options = this.options;

        if (direction == null) {
            direction = Math.atan2(nodePosition.y - this.root.position.y,
                                   nodePosition.x - this.root.position.x);
        }

        const orl = options.radiusSegmentLevels.length;
        let R = this.root.radius;
        for (let l = 0; l < level; ++l) {
            R +=
                (level < orl)
                ? options.radiusSegmentLevels[level]
                : (options.radiusSegmentLevels[orl-1]
                   * Math.pow(options.radiusSegmentLevelFactor, level - orl))
            ;
        }

        // if we don't use the origin as the center of the arc, then we would
        // need to compute this correctly here.

        const positionedNodes = this._positionNodesRadially({
            nodeInfos: nodeInfo.connectedNodesInfos,
            referencePoint: this.root.position,
            R, direction, angularSpread,
        });

        for (const N of positionedNodes) {
            this._positionNodeChildren({
                node: N.node,
                nodePosition: N.nodePosition,
                nodeInfo: N.nodeInfo,
                level: level+1,
                angularSpread: N.angularSpread,
                direction: N.direction,
            });
        }
    }

}