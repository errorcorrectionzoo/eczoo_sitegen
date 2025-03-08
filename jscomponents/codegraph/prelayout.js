import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.prelayout');

// for debugging messages
import { dispElement } from './graphtools.js';

import loSum from 'lodash/sum.js';
import loMerge from 'lodash/merge.js';


const defaultPrelayoutOptions = {

    layoutParentEdgeSelector: '.layoutParent',

    // if ignoreParentEdgeDirection is false, then all connected nodes of a 
    // root node (through parental edges) are considered as children for
    // layout purposes.  Parental relationship direction is anyways ignored
    // for non-root nodes, those edges being viewed as those of an undirected
    // tree graph.
    ignoreParentRootEdgeDirection: false,

    // for automatic positioning of root nodes without an explicit position
    origin: {
        // positioning of root nodes that do not have a predefined position
        position: {x: 0, y: 0},
        rootPositioning: 'linear', // 'linear' or 'circle'
        // for linear positioning - offset for each root node
        rootPositionXOffset: 500.0,
        rootPositionYOffset: 0,
        // for circle positioning.  Circle radius is computed automatically such that
        // root nodes are spaced by `rootPositionCircleRootSpacing`
        rootPositionCircleRootSpacing: 200.0,
        rootPositionCircleDirection: Math.PI/2,
        rootPositionCircleAngularSpread: 0.8*Math.PI,

        // default settings for the subtrees attached to each root node
        angularSpread: 2*Math.PI, ///3, //2*Math.PI * 0.2,
        radius: 200.0, // default radius for root nodes
        direction: Math.PI/2,
        useWeights: false,
    },

    radiusSegmentLevels: [400, 400, ],
    radiusSegmentLevelFactor: 1.1,

    weightCalcLevels: 6, // look at descendants over X levels for weights
    weightCalcSecondaryFactor: 0.1, //0.3,
};




const rootPositioningFunctions = {
    linear: ({ numRootNodes, origin }) => {
        return (j) => ({
            position: {
                x: origin.position.x + (j - numRootNodes/2) * origin.rootPositionXOffset,
                y: origin.position.y + (j - numRootNodes/2) * origin.rootPositionYOffset,
            }
        });
    },
    circle: ({ numRootNodes, origin }) => {
        const numGaps = (numRootNodes - 1)
        const circleRadius = numGaps
            * origin.rootPositionCircleRootSpacing
            / origin.rootPositionCircleAngularSpread
            ;
        const anglePerGap = (
            (numGaps === 0)
            ? 0
            : (origin.rootPositionCircleAngularSpread / numGaps)
        );
        debug(`Preparing to position ${numRootNodes} root nodes...`);
        return (j) => {
            const jp = (j + 0.5 - numGaps/2); // if numGaps==0, jp is irrelevant below
            const phi = origin.rootPositionCircleDirection  +  jp * anglePerGap ;
            debug(`Position #${j}/${numRootNodes} at phi=${phi}; circleRadius=${circleRadius}, origin.position=${JSON.stringify(origin.position)}`);
            return {
                position: {
                    x:  origin.position.x + circleRadius * Math.cos(phi),
                    y:  origin.position.y + circleRadius * Math.sin(phi),
                },
                direction: phi,
                angularSpread: (origin.rootPositionCircleAngularSpread / numRootNodes),
            };
        };
    },
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
 * - `prelayoutOptions` - see default options above
 */
export class PrelayoutRadialTree
{
    constructor({cy, rootNodeIds, rootNodesPrelayoutInfo, prelayoutOptions})
    {
        this.cy = cy;
        this.rootNodeIds = rootNodeIds;
        this.rootNodesPrelayoutInfo = rootNodesPrelayoutInfo;
        this.prelayoutOptions = loMerge(
            {},
            defaultPrelayoutOptions,
            prelayoutOptions
        );
    }

    run()
    {
        // debug(`prelayout run() rootNodeIds =`, this.rootNodeIds,
        //       ` rootNodesPrelayoutInfo =`, this.rootNodesPrelayoutInfo,
        //       ` prelayoutOptions =`, this.prelayoutOptions,);

        let pBranches = [];

        let positionedNodesData = {};

        // position the root nodes & set branch "layouters" instances
        let rootNodePrelayoutInfo = {};
        let rootNodeIdsToBePositioned = [];
        let numGivenPositionedRootNodes = 0;
        for (const rootNodeId of this.rootNodeIds) {
            let prelayoutInfo = this.rootNodesPrelayoutInfo[rootNodeId];
            if (prelayoutInfo != null) {
                rootNodePrelayoutInfo[rootNodeId] = prelayoutInfo;
                ++numGivenPositionedRootNodes;
            } else {
                rootNodeIdsToBePositioned.push(rootNodeId);
            }
        }
        // create "prelayoutInfo" for any root nodes that haven't been manually
        // positioned & directed
        const numJ = rootNodeIdsToBePositioned.length;
        //const maxJ = Math.max(rootNodeIdsToBePositioned.length - 1, 1);
        const origin = this.prelayoutOptions.origin;

        if (numGivenPositionedRootNodes > 0 && rootNodeIdsToBePositioned.length > 0) {
            throw new Error(`PrelayoutRadialTree.run(): If you position some of the `
                + `root nodes, you should position all of them `
                + `(in rootNodesPrelayoutInfo’)`);
        }

        //debug(`Will need to auto position ${numJ} root nodes;`, { origin });
        let rootPositioning = origin.rootPositioning;
        let getRootPositioningFunc = rootPositioningFunctions[rootPositioning]
        if (rootPositioning == null || getRootPositioningFunc == null) {
            console.warn(`Invalid root node positioning strategy!  Picking linear.`);
            rootPositioning = 'linear';
        }
        const getRootPosition = getRootPositioningFunc({
            numRootNodes: numJ,
            origin
        });

        for (const [j, rootNodeId] of rootNodeIdsToBePositioned.entries()) {
            const positionOption = getRootPosition(j);
            debug(`Root node ${j} is placed at ${JSON.stringify(positionOption)}`);
            rootNodePrelayoutInfo[rootNodeId] = {
                radiusOffset: origin.radius, // R,
                direction: origin.direction, //angle,
                angularSpread: origin.angularSpread, // / numJ,
                ...positionOption,
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

            let childrenEdges = null;
            let parentsEdges = null;

            childrenEdges =
                cyRootNode.incomers(this.prelayoutOptions.layoutParentEdgeSelector)
                .edges('.layoutVisible');
            parentsEdges =
                cyRootNode.outgoers(this.prelayoutOptions.layoutParentEdgeSelector)
                .edges('.layoutVisible');

            if (this.prelayoutOptions.ignoreParentEdgeDirection) {
                childrenEdges = childrenEdges.union(parentsEdges);
                parentsEdges = [];
            }

            //debug(`root node children & parent edges are`, { childrenEdges, parentsEdges });

            if (childrenEdges.length) {
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: prelayoutInfo.radiusOffset,
                        position: prelayoutInfo.position,
                        direction: prelayoutInfo.direction,
                        angularSpread: prelayoutInfo.angularSpread,
                        propertyCodesSortOrder: prelayoutInfo.propertyCodesSortOrder,
                        useWeights: origin.useWeights,
                    },
                    prelayoutOptions: this.prelayoutOptions,
                    branchOptions: {
                        initialEdges: childrenEdges,
                    },
                    positionedNodesData,
                }));
            }
            if (parentsEdges.length) {
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: prelayoutInfo.radiusOffset,
                        position: prelayoutInfo.position,
                        direction: prelayoutInfo.direction + Math.PI, // opposite direction
                        angularSpread: prelayoutInfo.angularSpread,
                        propertyCodesSortOrder: prelayoutInfo.propertyCodesSortOrder,
                        useWeights: origin.useWeights,
                    },
                    prelayoutOptions: this.prelayoutOptions,
                    branchOptions: {
                        initialEdges: parentsEdges,
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

            if (isRoot) {
                node.addClass(['prelayoutPositioned',
                               `prelayoutRelatedAs_${relatedAs}`,
                               'prelayoutRoot']);
            } else {
                node.addClass(["prelayoutPositioned",
                               `prelayoutRelatedAs_${relatedAs}`]);
            }
            node.position(position);

        }

    }

}


// ---


class _PrelayoutRadialTreeBranchSet
{
    constructor({ cy, root, prelayoutOptions, branchOptions, positionedNodesData })
    {
        this.cy = cy;

        // { nodeId, position, direction, angularSpread, propertyCodesSortOrder }
        this.root = root;
        this.rootNode = this.cy.getElementById(this.root.nodeId);

        this.prelayoutOptions = prelayoutOptions;

        this.branchOptions = loMerge({
            initialEdges: null,
            propertyCodesSortOrder: 1,
        }, branchOptions);

        // IMPORTANT: This object is shared between multiple different
        // _PrelayoutRadialTreeBranchSet object instances.  The reference to
        // the common object is what is provided to the argument to this
        // constructor.
        this.positionedNodesData = positionedNodesData;

        this.propertyCodesSortOrder = root.propertyCodesSortOrder;

        this.nodeOrderingInfoByLevel = null;
        this.nodeOrderingInfoByParent = null;
        this.nodePositioningInfo = null;

        //debug(`Initialized _PrelayoutRadialTreeBranchSet with root node ${this.rootNode.id()}`,
        //      { branchOptions: this.branchOptions, positionedNodesData });
    }

    //
    // Compute additional information w.r.t. the nodes.
    //
    _computeNodeInfos()
    {
        let nodeOrderingInfoByLevel = [];
        let nodeOrderingInfoByParent = {};
        
        const layoutParentEdgeSelector = this.prelayoutOptions.layoutParentEdgeSelector;

        let seenNodes = new Set();

        let thisLevelNodes = [ {
            nodeId: this.root.nodeId,
            nodeConnectingEdge: null,
            level: 0,
            parentNodeId: null,
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

        nodeOrderingInfoByLevel.push({
            level: 0,
            nodeInfos: thisLevelNodes,
            // will be computed later
            levelTotalDescendantWeight: null,
        });
        nodeOrderingInfoByParent[""] = {
            level: 0,
            nodeInfos: thisLevelNodes,
        };

        let level = 0;
        while (thisLevelNodes.length) {
            let nextLevelNodes = [];

            level += 1;

            //debug(`Getting layout-children of nodes at current layout level ${level}, current `
            //      + `level nodes are `, thisLevelNodes);

            for (const nodeOrderingInfo of thisLevelNodes) {

                const {
                    nodeId,
                    nodeConnectingEdge,
                    parentNodeOrderingInfo,
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

                let cyNode = this.cy.getElementById(nodeId);
                let connectedEdges = null;
                if (level === 1) {
                    connectedEdges = this.branchOptions.initialEdges;
                }
                if (connectedEdges == null) {
                    connectedEdges = cyNode.connectedEdges(layoutParentEdgeSelector)
                        .edges('.layoutVisible');
                }

                //debug(`Node ${cyNode.id()} has connected edges`, connectedEdges);

                let connectedNodesInfos = [];
                for (const edge of connectedEdges) {
                    if (edge === nodeConnectingEdge) {
                        // don't go back up the tree!
                        continue;
                    }
                    const connectedNode = otherConnectedNode(edge, nodeId);
                    const connectedNodeId = connectedNode.id();

                    // debug(`Layout-child node: ${cyNode.id()}->${connectedNodeId}; `
                    //       + `pos-data? ${JSON.stringify(this.positionedNodeData?.[connectedNodeId])} `
                    //       + `seen? ${seenNodes.has(connectedNodeId)}`);

                    if (Object.hasOwn(this.positionedNodesData, connectedNodeId)
                        || seenNodes.has(connectedNodeId)) {
                        continue;
                    }
                    seenNodes.add(connectedNodeId);

                    let newNodeInfo = {
                        nodeId: connectedNodeId,
                        nodeConnectingEdge: edge,
                        level: level,
                        parentNodeId: nodeOrderingInfo.nodeId,
                        parentNodeOrderingInfo: nodeOrderingInfo,
                        connectedNodesInfos: [],
                        totalNumDescendants: 0,
                        numDescendants: [],
                        isPropertyCode: connectedNode.data('_isPropertyCode') ? 1 : 0,
                    };

                    connectedNodesInfos.push(newNodeInfo);

                    // debug(`Added layout-child node ${connectedNodeId} with info`, newNodeInfo);
                }
                nodeOrderingInfo.connectedNodesInfos.push(...connectedNodesInfos);
                nextLevelNodes.push(...connectedNodesInfos);
                nodeOrderingInfoByParent[nodeId] = {
                    level: level,
                    nodeInfos: connectedNodesInfos,
                };
            }
            nodeOrderingInfoByLevel.push( {
                level,
                nodeInfos: nextLevelNodes,
                levelTotalDescendantWeight: null,
            } );
            thisLevelNodes = nextLevelNodes;
        }

        this.nodeOrderingInfoByLevel = nodeOrderingInfoByLevel;
        this.nodeOrderingInfoByParent = nodeOrderingInfoByParent;
    }

    //
    // Compute a "weight" for each node -- basically how much angular space the
    // tree is expected to occupy.
    //
    _computeNodeDescendantWeightsAndSortNodes()
    {
        const propertyCodesSortOrder = this.propertyCodesSortOrder;

        // compute total descendant weight of each node
        for (let orderingInfoAtLevel of this.nodeOrderingInfoByLevel) {
            let levelTotalDescendantWeight = 0;
            for (let info of orderingInfoAtLevel.nodeInfos) {
                let w = Math.max(
                    1,
                    loSum(info.numDescendants.slice(0, this.prelayoutOptions.weightCalcLevels))
                        ?? 0
                );
                if (info.relatedAs === 'secondary') {
                    w *= this.prelayoutOptions.weightCalcSecondaryFactor;
                }
                info._descendantWeight = w;
                levelTotalDescendantWeight += w;
            }
            orderingInfoAtLevel.levelTotalDescendantWeight = levelTotalDescendantWeight;
        }

        // At this point, we have the total descendant weights for each node.
        
        // Now, we sort the nodes to hopefully equalize the distribution of
        // descendant weights within each group.
        let thisLevelParentIdList = [ "" ];
        for (let orderingInfoAtLevel of this.nodeOrderingInfoByLevel) {
            let orderedAllNodeInfos = [];
            let nextLevelParentIdList = [];
            // compute, at this level, the maximal angular spread we can allocate to
            // this group
            for (let parentId of thisLevelParentIdList) {
                let group = this.nodeOrderingInfoByParent[parentId];
                //debug(`group: `, { group } );
                const totalGroupDescendantWeight = loSum(
                    group.nodeInfos.map( (nodeInfo) => nodeInfo._descendantWeight )
                );
                let cumulatedDescendantWeight = 0;
                // node by node, we're going to pick the next node such that the
                // cumulated descendant weight stays as closely as possible to the
                // one we'd expect if all nodes had equal weight (uniform)
                let nodeInfosToPick = [ ... group.nodeInfos ]; // copy array
                //debug(`nodeInfosToPick =`, nodeInfosToPick, `; totalGroupDescendantWeight = `, totalGroupDescendantWeight);
                let pickedNodeInfos = [];
                const groupNumNodes = nodeInfosToPick.length;
                while (nodeInfosToPick.length) {
                    // as long as there are nodes to pick, find the one that best
                    // makes the new cumulated descendant weight close to uniform
                    let uniformNextCumulatedDescendantWeight =
                        pickedNodeInfos.length * totalGroupDescendantWeight / groupNumNodes;
                    // 
                    let bestIdx = null;
                    let bestValue = null;
                    let bestPropertyCodeSortValue = null;
                    for (let i = 0; i < nodeInfosToPick.length; ++i) {
                        let nodeInfo = nodeInfosToPick[i]
                        let delta = (cumulatedDescendantWeight + nodeInfo._descendantWeight)
                            - uniformNextCumulatedDescendantWeight;
                        let value = delta*delta; // we'll minimize the square of the delta
                        let propertyCodeSortValue = 
                            nodeInfo.isPropertyCode ? propertyCodesSortOrder : 0;
                        if (bestValue == null
                            || (propertyCodeSortValue < bestPropertyCodeSortValue)
                            || (propertyCodeSortValue === bestPropertyCodeSortValue
                                && value < bestValue)) {
                            bestPropertyCodeSortValue = propertyCodeSortValue;
                            bestValue = value;
                            bestIdx = i;
                        }
                    }
                    // pick node at index idx
                    pickedNodeInfos.push( nodeInfosToPick[bestIdx] );
                    nodeInfosToPick.splice(bestIdx, 1); // remove from "to-pick" list
                }
                //debug(`pickedNodeInfos =`, pickedNodeInfos);
                // fix the group's children nodeInfos to ensure order is correct:
                group.nodeInfos = pickedNodeInfos;

                // continue preparing the level's flat node info list
                orderedAllNodeInfos.push( ... pickedNodeInfos );
                nextLevelParentIdList.push( ... pickedNodeInfos.map( (ni) => ni.nodeId ) );
            }
            // replace nodeInfos by the ordered one !
            thisLevelParentIdList = nextLevelParentIdList;
            // debug(`Reordering nodes at level ${orderingInfoAtLevel.level}:`,
            //       { before: orderingInfoAtLevel.nodeInfos.map( (ni) => ni.nodeId ),
            //         after: orderedAllNodeInfos.map( (ni) => ni.nodeId ) });
            orderingInfoAtLevel.nodeInfos = orderedAllNodeInfos;
        }
    }

    //
    // Main POSITION & MARK routines.
    //

    _distributeAngles({ items, R, parentR, direction, angularSpread, isFirstLevel })
    {
        // items are each { weight, parentNodeAngleDirection, nodeInfo }

        const maxLocalHalfAngularSpread = 0.8*Math.PI / 2;

        const angleSpreadTwistedCompressionFactor = 0.3;
        const angleSpreadUpdateCompressionFactor = 0.75;

        const globalStartAngle = direction - angularSpread/2;
        const globalEndAngle = globalStartAngle + angularSpread;

        if ( ! Number.isFinite(direction) || ! Number.isFinite(angularSpread)
            || ! Number.isFinite(R) || ! Number.isFinite(parentR) ) {
            throw new Error(`Invalid inputs to _distributeAngles()! ` + JSON.stringify({
                direction, angularSpread, R, parentR
            }));
        }

        // Start at point (parentR, 0) and send a ray at angle  alpha :=
        // `maxLocalHalfAngularSpread` from the X-axis until reaching a point P
        // at distance exactly R from the origin.
        // Let phi := `maxEvenHalfAngularSpread` := atan2(P.x, P.y).
        // 
        // P is determined by the equation
        //   R*cos(phi) = parentR + ell * cos(alpha)
        //   R*sin(phi) = ell * sin(alpha)
        //
        // -> ell = R * sin(phi) / sin(alpha)
        // -> R*cos(phi) = parentR + R*sin(phi)*cos(alpha)/sin(alpha)
        // -> ...?
        //
        // Instead: solve both eqns for phi, then equate them ->
        //
        // -> arccos[ parentR/R + (ell/R) * cos(alpha) ]  =  arcsin[ (ell/R) * sin(alpha) ]
        //
        // Def:   r = parentR/R  ;  u = ell/R  .
        //
        // ->  1 - (r + u * cos(alpha))^2 = u^2 sin^2(alpha)
        //
        // ->  1 - r^2 - 2*u*r*cos(alpha) - u^2 cos^2(alpha) = u^2 sin^2(alpha)
        //
        // ->  u^2 + 2*r*cos(alpha)*u + r^2 - 1  = 0
        //
        // ->  u = -r*cos(alpha) + sqrt[ r^2 cos^2(alpha) - (r^2 - 1) ]   (with u>0)
        //       = -r*cos(alpha) + sqrt[ 1 + r^2 (cos^2(alpha) - 1) ]
        //
        // ->   phi = arctan2(r + u*cos(alpha), u*sin(alpha))
        // or:  phi = arccos( r + u * cos(alpha) )
        //
        let maxEvenHalfAngularSpread = 2*Math.PI; // no limit for first-level children
        if (!isFirstLevel) {
            const ca = Math.cos(maxLocalHalfAngularSpread);
            const r = parentR/R;
            const u = -r*ca + Math.sqrt( 1 + r*r * (ca*ca - 1) );

            maxEvenHalfAngularSpread = Math.acos( r + u*ca );
        }

        //debug(`Distributing items=${items.map( item => `(weight ${item.weight} parent direction ${item.parentNodeAngleDirection*180/Math.PI}deg)`).join(', ')}.  maxEvenHalfAngularSpread=${maxEvenHalfAngularSpread*180/Math.PI}deg`, { items });

        // now, let's distribute angles.

        let totalWeight = loSum(items.map( ({weight}) => weight ));

        let angleSpreadCompressionFactor = 1.0;
        let needNewIteration = true;

        let itemAngles = [];

        while (needNewIteration) {
            needNewIteration = false;

            // start again.
            itemAngles = [];

            let curAngle = direction - angularSpread/2;
            for (const { weight, parentNodeAngleDirection } of items) {

                let useAngle = angleSpreadCompressionFactor *
                    weight / totalWeight * angularSpread;

                const minAngle = Math.max(
                    parentNodeAngleDirection - maxEvenHalfAngularSpread,
                    globalStartAngle
                );
                const maxAngle = Math.min(
                    parentNodeAngleDirection + maxEvenHalfAngularSpread,
                    globalEndAngle,
                );

                if (curAngle >= maxAngle) {
                    if (angleSpreadCompressionFactor < 1e-4) {
                        throw new Error(`Something's wrong, cannot distribute angles!`);
                    }
                    angleSpreadCompressionFactor =
                        angleSpreadUpdateCompressionFactor * angleSpreadCompressionFactor;
                    debug(`Failure to distribute angles! curAngle=${curAngle*180/Math.PI}deg >= maxAngle=${maxAngle*180/Math.PI}deg, trying again with angleSpreadCompressionFactor=${angleSpreadCompressionFactor}`);
                    needNewIteration = true;
                    break;
                }
                const beginAngle = Math.max(curAngle, minAngle)
                const endAngle = Math.min(
                    Math.max(
                        beginAngle + useAngle*angleSpreadTwistedCompressionFactor,
                        curAngle + useAngle
                    ),
                    maxAngle
                );
                //debug(`Computing item angles:`, {beginAngle, endAngle, curAngle, minAngle, maxAngle, parentNodeAngleDirection, globalStartAngle, globalEndAngle, parentR, R});
                curAngle = endAngle;
                if (endAngle <= beginAngle) {
                    throw new Error(`Internal error, endAngle <= beginAngle !?!?`);
                }

                itemAngles.push({
                    beginAngle,
                    endAngle,
                    midAngle: (endAngle + beginAngle)/2,
                    useAngle, minAngle, maxAngle, angleSpreadCompressionFactor,
                });
            }
        }

        //debug(`Got angles: ${itemAngles.map( (ia) => `${ia.midAngle*180/Math.PI}deg` ).join(', ')}`);

        return itemAngles;
    }

    positionAndMarkNodesInData()
    {
        // First, compute important information.  Might inspect
        // this.positionedNodesData to avoid repositioning nodes that already
        // belong to other subtrees.

        this._computeNodeInfos();
        this._computeNodeDescendantWeightsAndSortNodes();

        // NOTE: We don't mark & position the root node itself; that is done by
        // our main Prelayout... class.

        const direction = 
            this.branchOptions.flipDirection ? -this.root.direction : this.root.direction;
        const angularSpread = this.root.angularSpread;

        this.nodePositioningInfo = {};

        this.nodePositioningInfo[this.root.nodeId] = {
            posRelative: { x: 0, y: 0 },
            beginAngle: direction - angularSpread/2,
            midAngle: direction,
            endAngle: direction + angularSpread/2,
            R: 0,
        };

        const {
            radiusSegmentLevels,
            radiusSegmentLevelFactor,
        } = this.prelayoutOptions;
        const radiusSegmentLevelsLength = radiusSegmentLevels.length;

        let R = this.root.radius;

        for (const levelOrderingInfos of this.nodeOrderingInfoByLevel) {
            const { level, nodeInfos } = levelOrderingInfos;
            if (level === 0) { // The ROOT node itself must already be positioned.
                continue;
            }

            const parentR = (level === 1) ? 0 : R;

            // compute the new radius
            const segmentLevel = level - 1;
            R += (
                (segmentLevel < radiusSegmentLevelsLength)
                ? radiusSegmentLevels[segmentLevel]
                : (radiusSegmentLevels[radiusSegmentLevelsLength-1]
                   * Math.pow(radiusSegmentLevelFactor, segmentLevel - radiusSegmentLevelsLength))
            );

            // position the nodes at this level

            const isFirstLevel = (level === 1); // ROOT node's children
            // special handling for ROOT's children - each child gets equal angular
            // fraction regardless of computed weight
            const useWeights = this.root.useWeights && !isFirstLevel;

            //debug(`nodeInfos =`, { nodeInfos });
            const items = nodeInfos.map( (nodeInfo) => {
                const { _descendantWeight, parentNodeId } = nodeInfo;
                const weight = (useWeights ? _descendantWeight : 1);
                //debug(`Forming item: ${nodeInfo.nodeId} - weight=${weight}, parent's posInfo.midAngle=${this.nodePositioningInfo[parentNodeId].midAngle*180/Math.PI}deg`);
                return {
                    weight,
                    parentNodeAngleDirection:
                        this.nodePositioningInfo[parentNodeId].midAngle,
                    nodeInfo,
                };
            } );
            
            const itemAngles = this._distributeAngles({
                items, R, parentR, direction, angularSpread, isFirstLevel
            });

            for (const [j, nodeInfo] of nodeInfos.entries()) {

                const { beginAngle, midAngle, endAngle } = itemAngles[j];

                let posRelative = {
                    x: R * Math.cos(midAngle),
                    y: R * Math.sin(midAngle),
                };
                let position = {
                    x: this.root.position.x + posRelative.x,
                    y: this.root.position.y + posRelative.y,
                };

                const { nodeId, relatedAs, } = nodeInfo;

                this._markNodePosition({
                    nodeId,
                    isRoot: false,
                    relatedAs,
                    position,
                });
                this.nodePositioningInfo[nodeId] = {
                    posRelative,
                    beginAngle,
                    midAngle,
                    endAngle,
                    R,
                };
            }
        }

        // ----

        debug(`_PrelayoutRadialTreeBranchSet: branch nodes positioned.`);
        //this._debugPrintPrelayoutTreeBranchPositioning()
    }

    _debugPrintPrelayoutTreeBranchPositioning()
    {
        for (const [level, orderingInfos] of this.nodeOrderingInfoByLevel.entries()) {
            const { nodeInfos } = orderingInfos;
            debug(` * LEVEL ${level}:`);
            for (const nodeOrderingInfo of nodeInfos) {
                const {
                    nodeId,
                    nodeConnectingEdge,
                    //level,
                    //parentNodeOrderingInfo,
                    //connectedNodesInfos,
                    totalNumDescendants,
                    numDescendants,
                    isPropertyCode,
                } = nodeOrderingInfo;
                debug(`    → ${nodeId} from ${dispElement(nodeConnectingEdge)} totalNumDescendants=${totalNumDescendants} # of descendants by level=[${numDescendants.join(', ')}] isPropertyCode=${isPropertyCode}`);

                if (nodeId === this.root.nodeId) {
                    const {
                        radius,
                        position,
                        direction,
                        angularSpread,
                        useWeights,
                    } = this.root;
                    debug(`      [ROOT] (${position.x},${position.y}) ∡${direction*180/Math.PI}deg ± ${angularSpread*180/Math.PI} radius=${radius} useWeights=${useWeights}`);
                }
                const nodePositioningInfo = this.nodePositioningInfo[nodeId];
                if (nodePositioningInfo != null) {
                    const {
                        beginAngle,
                        //midAngle,
                        endAngle,
                        //posDirection,
                        posRelative,
                        R,
                    } = nodePositioningInfo;
                    debug(`      @ root+(${posRelative.x},${posRelative.y}) ∡ ${beginAngle*180/Math.PI}--${endAngle*180/Math.PI}deg at R=${R})`);
                }
            }
        }
    }

    _markNodePosition({ nodeId, isRoot, relatedAs, position, nodePositioningDebugInfo })
    {
        if (Object.hasOwn(this.positionedNodesData, nodeId)) {
            throw new Error(`Node ${nodeId} is being positioned in two different subtrees!`);
        }
        this.positionedNodesData[nodeId] = {
            position,
            isRoot,
            relatedAs,
            nodePositioningDebugInfo,
        };
    }

}
