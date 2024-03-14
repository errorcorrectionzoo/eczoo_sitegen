import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.eczcodegraph');

import loMerge from 'lodash/merge.js';

import cytoscape from 'cytoscape';
//import cyNavigator from 'cytoscape-navigator';
//import cyCoseBilkent from 'cytoscape-cose-bilkent';
import cyFcose from 'cytoscape-fcose';

import {
    render_text_standalone, is_flm_fragment,
    // $$kw,
} from '@phfaist/zoodb/zooflm';

import { cyBaseStyleJson, getCyStyleJson } from './style.js';

import { PrelayoutRadialTree } from './prelayout.js';

import { EczCodeGraphSubgraphSelector, EczCodeGraphSubgraphSelectorAll } from './subgraphselector.js';

import { EczCodeGraphFilterXYZ } from './graphfilter.js';

// -----


//cytoscape.use( cyCoseBilkent );
cytoscape.use( cyFcose );
//cytoscape.use( cyNavigator );



// -----

function contentToText(content)
{
    if (is_flm_fragment(content)) {
        return render_text_standalone(content);
    }
    return content;
}
function contentToNodeLabel(content)
{
    let label = contentToText(content);

    label = label.trim();
    
    // remove math "\(" & "\)" since we need to produce text here
    // ... (FIXME, Find out how to display math in the CY graph?)
    label = label.replace(/\\\(|\\\)/g, '');

    return label;
}


// -----



/**
 * Contains subgraph and layout information? - YES via subgraph selector object.
 */
export class EczCodeGraph
{
    constructor({ eczoodb })
    {
        debug('EczCodeGraph constructor');

        // expose static methods via "this.XXX()"
        this.getNodeIdCode = EczCodeGraph.getNodeIdCode;
        this.getNodeIdDomain = EczCodeGraph.getNodeIdDomain;
        this.getNodeIdKingdom = EczCodeGraph.getNodeIdKingdom;
        //this.getMergedDisplayOptions = EczCodeGraph.getMergedDisplayOptions;

        // the eczoodb
        this.eczoodb = eczoodb;

        // the background color to use
        this.bgColor = 'rgb(255, 236, 217)';

        // the subgraph selector.
        this.subgraphSelector = null; // initialize only after initial graph is initialized!
        // any display filters.
        this.graphFilters = [];
    }

    async initialize()
    {
        debug('EczCodeGraph initialize()');

        await this.initGraph();
        
        EczCodeGraphSubgraphSelector.clear(this);
        this.subgraphSelector = new EczCodeGraphSubgraphSelectorAll(this);

        debug('EczCodeGraph initialize() done');
    }

    static getNodeIdCode(codeId)
    {
        return `c_${codeId}`;
    }

    static getNodeIdKingdom(kingdomId)
    {
        return `k_${kingdomId}`;
    }

    static getNodeIdDomain(domainId)
    {
        return `d_${domainId}`;
    }

    // --------------------------------

    installGraphFilter({ graphFilterName, graphFilter })
    {
        this.graphFilters.push({ graphFilterName, graphFilter });

        const eles = this.cy.elements('.layoutVisible');
        graphFilter.applyFilter({ eles });
    }

    setGraphFilterOptions(filterOptionsDict)
    {
        const eles = this.cy.elements('.layoutVisible');
        for (const { graphFilterName, graphFilter } of this.graphFilters) {
            if (Object.hasOwn(filterOptionsDict, graphFilterName)) {
                let filterOptions = loMerge(
                    {},
                    graphFilter.filterOptions,
                    filterOptionsDict[graphFilterName]
                );
                graphFilter.setFilterOptions(filterOptions);
            }
            graphFilter.applyFilter({ eles });
        }
    }

    _removeGraphFilters({ eles }={})
    {
        eles ??= this.cy.elements('.layoutVisible');
        for (const graphFilter of this.graphFilters) {
            graphFilter.removeFilter({ eles });
        }
    }
    _applyGraphFilters({ eles }={})
    {
        eles ??= this.cy.elements('.layoutVisible');
        for (const graphFilter of this.graphFilters) {
            graphFilter.applyFilter({ eles });
        }
    }

    installSubgraphSelector(subgraphSelector)
    {
        const previousSubgraphLayoutInformation =
            this.subgraphSelector.getSubgraphLayoutInformation();

        // clean the graph from any display filters
        this._removeGraphFilters();

        this.subgraphSelector = subgraphSelector;
        this.subgraphSelector.installSubgraph({ previousSubgraphLayoutInformation });

        this._applyGraphFilters();
    }


    // --------------------------------

    async initGraph()
    {
        debug("EczCodeGraph: initGraph() ...");

        let nodes = [];
        let edges = [];

        // === domains and kingdoms ===

        // let domainColorIndexCounter = 0;
        // let domainColorIndexByDomainId = {};

        for (const [domainId, domain] of Object.entries(this.eczoodb.objects.domain)) {

            //debug(`Adding domain =`, domain);

            const thisDomainNodeId = this.getNodeIdDomain(domainId);
            // const thisDomainColorIndex = domainColorIndexCounter;
            // domainColorIndexCounter =
            //     (domainColorIndexCounter + 1) % cyStyleNumDomainColors;

            // domainColorIndexByDomainId[domainId] = thisDomainColorIndex;

            const thisDomainName = contentToText(domain.name);
            const thisDomainLabel = contentToNodeLabel(thisDomainName);

            nodes.push({
                data: {
                    id: thisDomainNodeId,
                    label: thisDomainLabel,
                    _isDomain: 1,
                    _domainId: domainId,
                    // _domainColorIndex: thisDomainColorIndex,

                    _objectName: thisDomainName,
                }
            });


            // Add all the domain's kingdoms

            for (const kingdomRelation of domain.kingdoms) {
                //debug(`Adding kingdom; relation object = `, kingdomRelation);
                const kingdomId = kingdomRelation.kingdom_id;
                const kingdom = kingdomRelation.kingdom;

                const kingdomName = contentToText(kingdom.name);
                const label = contentToNodeLabel(kingdomName);

                // create node & add it to our list of nodes

                const thisKingdomNodeId = this.getNodeIdKingdom(kingdomId);
                nodes.push({
                    data: {
                        id: thisKingdomNodeId,
                        label: label,
                        _isKingdom: 1,
                        _kingdomId: kingdomId,
                        _kingdomName: kingdomName,
                        _objectName: kingdomName,
                        _parentDomainId: domainId,
                        // _domainColorIndex: thisDomainColorIndex,
                    }
                });

                // create edge that connects the kingdom to the domain

                edges.push({
                    data: {
                        _relType: 'parent',
                        _primaryParent: 1,
                        source: thisKingdomNodeId,
                        target: thisDomainNodeId,
                    }
                });
            }
        }

        // === codes ===

        for (const [codeId, code] of Object.entries(this.eczoodb.objects.code)) {

            //debug(`adding code =`, code);

            const codeShortName = contentToText(this.eczoodb.code_short_name(code));
            const codeName = contentToText(code.name);

            let label = contentToNodeLabel(codeShortName);

            const thisCodeNodeId = this.getNodeIdCode(codeId);

            let nodeData = {
                id: thisCodeNodeId,
                label: label,
                _codeId: codeId,
                _isCode: 1,
                _objectName: codeName,
            };

            // debug(`Searching for ${codeId}'s primary-parent root code`);

            const primaryParentRootCodeInfo  = this.eczoodb.code_get_primary_parent_root(code);
            const primaryParentRootCode = primaryParentRootCodeInfo.primary_parent_root_code;

            const parentKingdom = this.eczoodb.code_get_parent_kingdom(code, primaryParentRootCodeInfo);

            const isKingdomRootCode = (parentKingdom != null) && (primaryParentRootCode === code);

            if (parentKingdom != null) {

                const parentKingdomRootCodeId = primaryParentRootCode.code_id;
                const parentKingdomId = parentKingdom.kingdom_id;
                const parentDomainId = parentKingdom.parent_domain.domain_id;

                if (isKingdomRootCode) {
                    Object.assign(nodeData, {
                        _isKingdomRootCode: 1,
                    });
                }    

                Object.assign(nodeData, {
                    _hasParentKingdom: 1,
                    _parentKingdomRootCodeId: parentKingdomRootCodeId,
                    _parentKingdomId: parentKingdomId,
                    _parentDomainId: parentDomainId,
                    //_domainColorIndex: domainColorIndexByDomainId[parentDomainId],
                });

            } else {

                Object.assign(nodeData, {
                    _hasParentKingdom: 0,
                });

            }

            nodes.push({
                data: nodeData,
            });

            // if this code is a kingdom root code, add an edge to the kingdom node.
            if (isKingdomRootCode) {

                edges.push({
                    data: {
                        _relType: 'parent',
                        _primaryParent: 1,
                        source: thisCodeNodeId,
                        target: this.getNodeIdKingdom(parentKingdom.kingdom_id),
                    }
                });

            }

            // add an edge for every parent or cousin relation.
            for (const relationType of ['parent', 'cousin']) {
                let relationInstances = code.relations[relationType + 's'];
                //debug(`code's ${relationType} relations is: `, relationInstances);
                if (relationInstances == null) {
                    // null or undefined
                    continue;
                }

                for (let j = 0; j < relationInstances.length; ++j) {
                    const relationInstance = relationInstances[j];
                    let edgeData = {
                        _relType: relationType,
                        source: thisCodeNodeId,
                        target: this.getNodeIdCode(relationInstance.code.code_id),
                    };
                    if (relationType === 'parent') {
                        if (j === 0 && !isKingdomRootCode) {
                            edgeData._primaryParent = 1;
                        } else {
                            edgeData._primaryParent = 0;
                        }
                    }
                    edges.push({
                        data: edgeData,
                    });
                }
            }
        }

        // === set up cytoscape ===

        debug("EczCodeGraph: initGraph() setting up cytoscape object");

        let cytoscapeConfig = {};

        // debug('nodes = ', nodes);
        // debug('edges = ', edges);

        cytoscapeConfig.elements = {
            nodes: nodes,
            edges: edges,
            //animate: 'during',
        };
        
        // the stylesheet for the graph
        cytoscapeConfig.style = cyBaseStyleJson;

        // create the cytoscape object
        this.cy = cytoscape(cytoscapeConfig);

        // // Find out where to position the graph root nodes

        // const {
        //     rootAbstractCodesXSpacing,
        //     rootAbstractCodesYPosition,
        //     rootAbstractCodesYPositionSingleOffset,
        //     domainNodesXSpacing,
        //     domainNodesYPosition,
        //     domainNodesYPositionSingleOffset,
        // } = this.graphOptions.rootPositioning;

        // let graphRootNodesPrelayoutHints = {};
        // let domainIds = Object.keys(this.eczoodb.objects.domain);

        // debug(`Domains before custom ordering: ${domainIds}`);
        // // hard-code some constraints on the order:
        // // put 'classical_domain' first, and 'quantum_domain' last
        // const customDomainIdsOrder = {
        //     classical_domain: -100,
        //     quantum_domain: 100,
        // };
        // domainIds.sort(
        //     (aId, bId) => (customDomainIdsOrder[aId] ?? 0) - (customDomainIdsOrder[bId] ?? 0)
        // );
        // debug(`Domains after custom ordering: ${domainIds}`);

        // for (const [j, domainId] of domainIds.entries()) {
        //     const nodeId = this.getNodeIdDomain(domainId);
        //     graphRootNodesPrelayoutHints[nodeId] = {
        //         position: {
        //             x: (j - (domainIds.length-1)/2) * domainNodesXSpacing,
        //             y: domainNodesYPosition
        //                + Math.min(j, domainIds.length-1-j) * domainNodesYPositionSingleOffset
        //         },
        //         radiusOffset: 50,
        //         direction: Math.PI - Math.PI * (j+0.5) / domainIds.length,
        //         angularSpread: Math.PI / domainIds.length,
        //     };
        // }
        // // these are abstract property codes:
        // let rootCodeNodeIds = this.getOverallRootNodeIds({ includeDomains: false });
        // //debug(`rootCodeNodeIds = `, rootCodeNodeIds);
        // for (const [j, codeNodeId] of rootCodeNodeIds.entries()) {
        //     graphRootNodesPrelayoutHints[codeNodeId] = {
        //         position: {
        //             x: (j - (rootCodeNodeIds.length-1)/2) * rootAbstractCodesXSpacing,
        //             y: rootAbstractCodesYPosition
        //                - Math.min(j, rootCodeNodeIds.length-1-j) * rootAbstractCodesYPositionSingleOffset
        //         },
        //         radiusOffset: 50,
        //         direction: Math.PI + Math.PI * (j+0.5) / rootCodeNodeIds.length,
        //         angularSpread: Math.PI / rootCodeNodeIds.length,
        //     };
        // }

        // //debug(`graphRootNodesPrelayoutHints = `, graphRootNodesPrelayoutHints);

        // this.graphOptions.graphRootNodesPrelayoutHints = graphRootNodesPrelayoutHints;

        // for (const graphRootNodeId
        //      of Object.keys( this.graphOptions.graphRootNodesPrelayoutHints )) {
        //     let graphRootNode = this.cy.getElementById(graphRootNodeId);
        //     graphRootNode.addClass('graphRoot');
        // }

        // // Apply the current settings already stored in this.displayOptions to set
        // // all the graph classes correctly according to the display options.
        // this._applyDisplayMode();
        // this._applyDomainColoring();
        // this._applyCousinEdgesShown();
        // this._applySecondaryParentEdgesShown();
        // this._applyLowDegreeNodesDimmed();

        debug("EczCodeGraph: initGraph() done");
    }
    
    mountInDom(cyDomNode, { bgColor, styleOptions }={})
    {
        // background color
        this.bgColor = bgColor ?? this.bgColor;
        cyDomNode.style.backgroundColor = this.bgColor;

        this.cy.mount( cyDomNode );

        styleOptions = loMerge( {}, styleOptions );
        styleOptions.matchWebPageFonts ??= true; // default to True

        const newCyStyleJson = getCyStyleJson( styleOptions );

        this.cy.style()
            .resetToDefault()
            .fromJson(newCyStyleJson)
            .update();
    }


    // ---------------------------


    // domainColoring()
    // {
    //     return this.displayOptions.domainColoring;
    // }

    // setDomainColoring(coloringOn)
    // {
    //     coloringOn = !! coloringOn;
    //     if (coloringOn === this.displayOptions.domainColoring) {
    //         return false; // nothing to update
    //     }
    //     this.displayOptions.domainColoring = coloringOn;

    //     this._applyDomainColoring();
    //     return true;
    // }
    // _applyDomainColoring()
    // {
    //     // apply setting stored in this.displayOptions.domainColoring
    //     if (this.displayOptions.domainColoring) {
    //         this.cy.nodes().addClass('useDomainColors');
    //     } else {
    //         this.cy.nodes().removeClass('useDomainColors');
    //     }
    // }

    // cousinEdgesShown()
    // {
    //     return this.displayOptions.cousinEdgesShown;
    // }

    // setCousinEdgesShown(show)
    // {
    //     show = !!show; // make sure the value is boolean
    //     if (show === this.displayOptions.cousinEdgesShown) {
    //         // no update required
    //         return false;
    //     }
    //     this.displayOptions.cousinEdgesShown = show;

    //     this._applyCousinEdgesShown();
    //     return true;
    // }
    // _applyCousinEdgesShown()
    // {
    //     let cousinEdges = this.cy.edges('[_relType="cousin"]');
    //     if (this.displayOptions.cousinEdgesShown) {
    //         cousinEdges.removeClass("hidden"); 
    //     } else {
    //         cousinEdges.addClass("hidden"); 
    //     }
    // }

    // secondaryParentEdgesShown()
    // {
    //     return this.displayOptions.secondaryParentEdgesShown;
    // }

    // setSecondaryParentEdgesShown(show)
    // {
    //     show = !!show; // make sure the value is boolean
    //     if (show === this.displayOptions.secondaryParentEdgesShown) {
    //         // no update required
    //         return false;
    //     }
    //     this.displayOptions.secondaryParentEdgesShown = show;
    //     this._applySecondaryParentEdgesShown();
    //     return true;
    // }
    // _applySecondaryParentEdgesShown()
    // {
    //     let secondaryParentEdges =
    //         this.cy.edges('[_primaryParent=0]');
    //     if (this.displayOptions.secondaryParentEdgesShown) {
    //         secondaryParentEdges.removeClass("hidden"); 
    //     } else {
    //         secondaryParentEdges.addClass("hidden"); 
    //     }
    // }

    // lowDegreeNodesDimmed()
    // {
    //     return this.displayOptions.lowDegreeNodesDimmed;
    // }

    // setLowDegreeNodesDimmed(options)
    // {
    //     if (_.isEqual(this.displayOptions.lowDegreeNodesDimmed, options)) {
    //         // no update needed
    //         return false;
    //     }
    //     this.displayOptions.lowDegreeNodesDimmed = options;
    //     this._applyLowDegreeNodesDimmed();
    //     return true;
    // }
    // _applyLowDegreeNodesDimmed()
    // {
    //     let {enabled, degree, dimLeaf} = this.displayOptions.lowDegreeNodesDimmed;

    //     this.cy.elements().removeClass('lowDegreeDimmed');
    //     if (!enabled) {
    //         return;
    //     }
    //     // dim "unimportant" codes based on their degree
    //     degree ??= 8;
    //     dimLeaf ??= true; //false;
    //     let dimSelector = `[[degree < ${degree}]]`;
    //     if (!dimLeaf) {
    //         dimSelector += `[[indegree >= 1]]`;
    //     }
    //     this.cy.nodes(dimSelector).addClass("lowDegreeDimmed");
    //     // also edges between dimmed nodes
    //     this.cy
    //         .edges( (edge) => (edge.source().is('.lowDegreeDimmed')
    //                            || edge.target().is('.lowDegreeDimmed')) )
    //         .addClass("lowDegreeDimmed")
    //     ;
    // }


    // displayMode()
    // {
    //     return this.displayOptions.displayMode;
    // }
    // modeIsolateNodesOptions()
    // {
    //     return this.displayOptions.modeIsolateNodesOptions;
    // }

    // setDisplayMode(displayMode, { modeIsolateNodesOptions }={})
    // {
    //     debug('setDisplayMode(): ', { displayMode, modeIsolateNodesOptions });

    //     if (displayMode === this.displayOptions.displayMode) {
    //         if (displayMode === 'all') {
    //             return false; // no options to compare
    //         } else if (displayMode === 'isolate-nodes') {
    //             if (_.isEqual(modeIsolateNodesOptions,
    //                           this.displayOptions.modeIsolateNodesOptions)) {
    //                 // debug('setDisplayMode(): (nothing to update). ',
    //                 //       { 'this.displayOptions': this.displayOptions,
    //                 //         modeIsolateNodesOptions });
    //                 return false;
    //             }
    //         } else {
    //             throw new Error(`Invalid display mode: ${displayMode}`);
    //         }
    //     }
    //     this.displayOptions.displayMode = displayMode;
    //     if (displayMode === 'all') {
    //         // no options to update
    //     } else if (displayMode === 'isolate-nodes') {
    //         this.displayOptions = this.getMergedDisplayOptions(
    //             this.displayOptions.modeIsolateNodesOptions,
    //             { displayMode, modeIsolateNodesOptions, }
    //         );
    //     } else {
    //         throw new Error(`Invalid display mode: ${displayMode}`);
    //     }

    //     this._applyDisplayMode();
    //     return true;
    // }
    // _applyDisplayMode()
    // {
    //     debug(`_applyDisplayMode()`, { displayOptions: this.displayOptions });

    //     // remove any display-mode related classes, we'll recompute them
    //     this.cy.elements().removeClass(
    //         ['isolationRoot', 'isolationSelected', 'isolationSecondary', 'isolationHidden']
    //     );

    //     //
    //     // Here we don't actually lay out the items, we simply mark labels with
    //     // corresponding classes to show/hide them.  A separate call to the
    //     // layout() function will actually compute, animate, and display the
    //     // positions of the nodes.
    //     //

    //     if (this.displayOptions.displayMode === 'all') {
            
    //         debug(`displayMode is 'all'`);

    //         // nothing particular to do, all nodes are to be displayed

    //     } else if (this.displayOptions.displayMode === 'isolate-nodes') {

    //         // debug(`applying displayMode=${this.displayOptions.displayMode} with`,
    //         //       { displayOptions: this.displayOptions });

    //         const {
    //             nodeIds,
    //             //redoLayout,
    //             range,
    //         } = this.displayOptions.modeIsolateNodesOptions;

    //         //
    //         // FIXME! Add a cutoff to the maximum number of nodes to include.
    //         // Include more children & parents at a constant rate until range is
    //         // reached or until max nodes is reached.
    //         //

    //         let relationEdgesGetters = {};
    //         for (const whichTree of ['parents', 'children']) {
    //             relationEdgesGetters[whichTree] = {};
    //             for (const whichRelationStrength of ['primary', 'secondary']) {
    //                 const selector =
    //                       this.graphOptions.isolationRelationSelector[whichRelationStrength];
    //                 if (selector === false) {
    //                     relationEdgesGetters[whichTree][whichRelationStrength] = false;
    //                     continue;
    //                 }
    //                 const fn = mkRelationEdgesGetterWithTreeDirection(
    //                     selector, whichTree
    //                 );
    //                 relationEdgesGetters[whichTree][whichRelationStrength] = fn;
    //             }
    //         }
    //         //debug({ relationEdgesGetters });

    //         let elxroot = this.cy.collection();
    //         nodeIds.forEach( (nodeId) => elxroot.merge(this.cy.getElementById(nodeId)) );

    //         let elx1 = elxroot;
    //         let elx2 = elxroot;

    //         // select children
    //         for (let j = 0; j < range.children.primary; ++j) {
    //             //debug(`computing isolation mode elements, elx1 = `, elx1);
    //             // range only includes parent relations
    //             let edges = relationEdgesGetters.children.primary(elx1);
    //             elx1 = elx1.union(edges).union(edges.connectedNodes());
    //         }
    //         let elx1secondary = elx1;
    //         for (let j = 0; j < range.children.secondary; ++j) {
    //             let elx1secedges = relationEdgesGetters.children.secondary(elx1secondary);
    //             elx1secondary = elx1.union(elx1secedges).union(elx1secedges.connectedNodes());
    //         }

    //         // select parents
    //         for (let j = 0; j < range.parents.primary; ++j) {
    //             //debug(`computing isolation mode elements, elx2 = `, elx2);
    //             // range only includes parent relations
    //             let edges = relationEdgesGetters.parents.primary(elx2);
    //             elx2 = elx2.union(edges).union(edges.connectedNodes());
    //         }
    //         let elx2secondary = elx2;
    //         for (let j = 0; j < range.parents.secondary; ++j) {
    //             let elx2secedges = relationEdgesGetters.parents.secondary(elx2);
    //             elx2secondary = elx2.union(elx2secedges).union(elx2secedges.connectedNodes());
    //         }

    //         // and always add one level of cousins from any element that we've captured.
    //         let elx = elx1.union(elx2);
    //         let elxlasted = elx1secondary.union(elx2secondary);
    //         let elxall = elxlasted.union(elxlasted.connectedNodes()).union(elx);
    //         let elxlast = elxall.not(elx);

    //         //debug(`elxall = `, elxall);
    //         //debug(`elxlast = `, elxlast);

    //         elxroot.addClass('isolationRoot');
    //         elx.addClass('isolationSelected');
    //         elxlast.addClass(['isolationSelected', 'isolationSecondary']);
    //         this.cy.elements()
    //             .not(elxall)
    //             .addClass('isolationHidden');

    //     } else {

    //         throw new Error(`Unknown displayMode = ${this.displayOptions.displayMode}`);

    //     }

    // }

    // initialLayoutInvalidated()
    // {
    //     return this._initialLayoutInvalidated;
    // }

    getOverallRootNodeIds({ includeDomains }={})
    {
        includeDomains ??= true;

        let rootNodeIdsDomains = [];
        if (includeDomains) {
            rootNodeIdsDomains = Object.keys(this.eczoodb.objects.domain).map(
                (domainId) => this.getNodeIdDomain(domainId)
            );
        }
        let rootNodeIdsCodes = Object.entries(this.eczoodb.objects.code).filter(
            ([/*codeId*/, code]) => (
                !(code.relations?.parents?.length) && !(code.relations?.root_for_kingdom)
                && !(code.relations?.root_for_kingdom?.length)
            )
        ).map( ([codeId, /*code*/]) => this.getNodeIdCode(codeId) );

        return [].concat(rootNodeIdsDomains, rootNodeIdsCodes);
    }



    async layout({ animate, forceRelayout, skipCoseLayout }={})
    {
        animate ??= true;
        forceRelayout ??= false;
        //skipCoseLayout ??= false;
        skipCoseLayout ??= true; // DEBUG DEBUG !

        let {
            reusePreviousLayoutPositions,
            rootNodesPrelayoutInfo,
            prelayoutOptions
         } = this.subgraphSelector.getSubgraphLayoutInformation();

        if (forceRelayout) {
            reusePreviousLayoutPositions = false;
        }

        debug('code graph layout()', { forceRelayout, animate }, { reusePreviousLayoutPositions } );

        // Make visible those elements that should be visible, and hiding those that shouldn't.
        // Cy doesn't have setVisible(), rather we set the class 'hidden' that sets the
        // style 'display: none', causing the element to be hidden.
        this.cy.elements().forEach(
            (ele) => ele.toggleClass('hidden', !ele.hasClass('layoutVisible'))
        );

        let rootNodeIds = null;

        let shouldApplyPrelayout = true;
        let shouldApplyCoseLayout = true;

        if (reusePreviousLayoutPositions) {
            shouldApplyPrelayout = false;
            shouldApplyCoseLayout = false;
        }
        if (skipCoseLayout) {
            shouldApplyCoseLayout = false;
        }

        rootNodeIds = this.cy.nodes('.layoutRoot').map( (node) => node.id );

        if (shouldApplyPrelayout) {
            await this._runPrelayout({ rootNodeIds, rootNodesPrelayoutInfo, prelayoutOptions });
        }

        if (!shouldApplyCoseLayout) {
            //this.cy.fit();
            return;
        }

        debug(`Running fcose layout ...`);

        await this._runCoseLayout({ rootNodeIds, animate });
    }

    async _runPrelayout({ rootNodeIds, rootNodesPrelayoutInfo, prelayoutOptions })
    {
        // compute an initial position of the nodes to reflect the tree
        // structure of the codes

        // prelayoutOptions = loMerge({
        //     origin: {
        //         position: { x: 0, y: 0 },
        //         angularSpread: 2*Math.PI,
        //         useWeights: false,
        //     },
        //     // layoutParentEdgeSelector: '.layoutParent',
        //     weightCalcLevels: 6,
        //     weightCalcSecondaryFactor: 0.3,
        // }, prelayoutOptions);

        debug(`_runPrelayout(): Using rootNodeIds =`, rootNodeIds);

        let prelayout = new PrelayoutRadialTree({
            cy: this.cy,
            rootNodeIds,
            rootNodesPrelayoutInfo,
            options: prelayoutOptions,
        });

        this.cy.batch( () => {
            // clear all CY markings
            this.cy.elements().removeClass(
                [ "prelayoutPositioned",
                  "prelayoutOutOfLayoutTree",
                  "prelayoutRoot" ]
            );

            try {
                prelayout.run();
            } catch (err) {
                console.error(err);
                return;
            }

            // mark edges between two marked nodes as well
            this.cy
                .edges( (edge) => (edge.target().is('.prelayoutPositioned')
                                   && edge.source().is('.prelayoutPositioned')) )
                .addClass('prelayoutPositioned');
            
            // anything that is not marked but visible is probably a bug; mark it
            // visually so we can debug that
            this.cy.elements(':visible').not('.prelayoutPositioned')
                .addClass('prelayoutOutOfLayoutTree');
        } );
       
    }


    async _runCoseLayout({ rootNodeIds, animate })
    {
        // Fix root node positioning to how our prelayout arranged it.
        // Format for fixedNodeConstraint is =
        // [{nodeId: 'n1', position: {x: 100, y: 200}}, {...}]
        const fixedNodeConstraint = [].concat(
            rootNodeIds.map( (nodeId) => ({
                nodeId,
                position: this.cy.getElementById(nodeId).position(),
            }) ),
            // further constraints can be added here in the future
        );

        const layoutOptions = {
            name: 'fcose', //'cose-bilkent',
            quality: 'proof',
            randomize: false,

            animate,

            fit: true,

            sampleSize: 500,
            
            // Whether to include labels in node dimensions. Valid in "proof" quality
            nodeDimensionsIncludeLabels: true,

            // Node repulsion (non overlapping) multiplier
            nodeRepulsion: (/*node*/) => 100000,
            // Ideal edge (non nested) length
            idealEdgeLength: (edge_) => {
                //if (edge.is('.layoutParent')) {
                return 100;
                // } else {
                //     return 300;
                // }
            },
            // Divisor to compute edge forces
            edgeElasticity: (edge_) => {
                //if (edge.is('.layoutParent')) {
                return 0.3;
                // } else {
                //     return 0; //0.01;
                // }
            },

            // Maximum number of iterations to perform - this is a suggested
            // value and might be adjusted by the algorithm as required
            numIter: 50000,

            // Gravity force (constant)
            gravity: 0, //.25,
            // Gravity range (constant) for compounds
            gravityRangeCompound: 1.5,
            // Gravity force (constant) for compounds
            gravityCompound: 1.0,
            // Gravity range (constant)
            gravityRange: 3.8, 
            // Initial cooling factor for incremental layout  
            initialEnergyOnIncremental: 0.3,

            // Fix desired nodes to predefined positions
            // [{nodeId: 'n1', position: {x: 100, y: 200}}, {...}]
            fixedNodeConstraint,

            // alignmentConstraint: {vertical: [], horizontal: []},
            // relativePlacementConstraint: [],
        };

        let p = new Promise( (resolve) => {
            debug('in promise - creating and running layout');
            let layout = this.cy
                // .elements('node, edge[_primaryParent=1]').not('[display="none"]')
                .elements( (el) => (
                    el.visible() && (el.isNode() || el.is('.layoutParent'))
                ) )
                .layout(layoutOptions);
            layout.on('layoutstop', resolve);
            layout.run();
        } );

        debug('laying out (fcose) - waiting for promise.');

        await p;
        
        debug('_runCoseLayout() done!');
    }




    // //
    // // Search tool
    // //

    // search({text, caseSensitive})
    // {
    //     caseSensitive ??= false;

    //     // const selFn = (n) => {
    //     //     if (!n.visible()) {
    //     //         return false;
    //     //     }
    //     //     const nData = n.data();
    //     //     if (nData.label?.includes(text) || nData._objectName?.includes(text)) {
    //     //         return true;
    //     //     }
    //     // };
    //     // const eles = this.cy.nodes(selFn);

    //     const textEsc = JSON.stringify(text);
    //     const eles = this.cy.nodes(
    //         `[label @*= ${textEsc}], [_objectName @*= ${textEsc}]`
    //     );

    //     return eles;
    // }
}

