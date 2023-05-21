import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph');

import _ from 'lodash';


import cytoscape from 'cytoscape';
//import cyNavigator from 'cytoscape-navigator';
//import cyCoseBilkent from 'cytoscape-cose-bilkent';
import cyFcose from 'cytoscape-fcose';


import { RelationsPopulator } from '@phfaist/zoodb/dbprocessor/relations';

import { FLMSimpleContentCompiler } from '@phfaist/zoodb/dbprocessor/flmsimplecontent';

import {
    render_text_standalone, is_flm_fragment, $$kw
} from '@phfaist/zoodb/zooflm';



//cytoscape.use( cyCoseBilkent );
cytoscape.use( cyFcose );
//cytoscape.use( cyNavigator );



// helper for exploring a tree
function mkRelationEdgesGetterWithTreeDirection(selector, treeDirection)
{
    if (selector.indexOf('[TREEDIRECTION]') === -1) {
        return (eles) => eles.connectedEdges(selector);
    }
    let farNodeWhich, closeNodeWhich;
    if (treeDirection === 'children') {
        closeNodeWhich = 'target'; // the parent is close to the origin
        farNodeWhich = 'source';
    } else if (treeDirection === 'parents') {
        closeNodeWhich = 'source';
        farNodeWhich = 'target';
    } else {
        throw new Error(`treeDirection must be 'children' or 'parents'`);
    }
    return (eles) => {
        let filteredCollection = eles.cy().collection();
        eles.forEach( (el) => {
            if (el.isNode()) {
                let newSelector =
                    selector.replace('[TREEDIRECTION]', `[${closeNodeWhich}="${el.id()}"]`);
                let newEdges = el.connectedEdges(newSelector);
                // debug(
                //     `getting edges (${selector}) connected to ‘${el.id()}’, `
                //     + `using ‘${newSelector}’ ->`,
                //     newEdges
                // );
                filteredCollection.merge( newEdges );
            }
        } );
        return filteredCollection;
    };
}






export class EczCodeGraph
{
    constructor({ eczoodb, graphOptions, displayOptions })
    {
        debug('EczCodeGraph constructor');

        // expose static methods via "this.XXX()"
        this.getNodeIdCode = EczCodeGraph.getNodeIdCode;
        this.getNodeIdDomain = EczCodeGraph.getNodeIdDomain;

        // the eczoodb
        this.eczoodb = eczoodb;

        // options that define properties of the graph
        this.graphOptions = _.merge(
            {
                graphRootNodesPrelayoutHints: {
                    // keys are nodeId's and values are { position: {x:, y:},
                    // direction:, angularSpread: }
                },

                isolationRelationSelector: {
                    primary: '[TREEDIRECTION][_primaryParent=1]',
                    secondary: '[TREEDIRECTION], [_relType="cousin"]',
                },

                rootPositioning: {
                    rootAbstractCodesXSpacing: 180,
                    rootAbstractCodesYPosition: 100,
                    domainNodesXSpacing: 180,
                    domainNodesYPosition: 0,
                },
            },
            graphOptions ?? {},
        );

        // options that define how the graph is displayed
        this.displayOptions = _.merge({
            displayMode: 'all', // 'all', 'isolate-nodes'
            modeIsolateNodesOptions: {
                nodeIds: null,
                redoLayout: false,
                range: {
                    parents: {
                        primary: 5,
                        secondary: 1,
                    },
                    children: {
                        primary: 2,
                        secondary: 1,
                    },
                },
            },
            domainColoring: true,
            cousinEdgesShown: false, //true,
            secondaryParentEdgesShown: false, //true,
            lowDegreeNodesDimmed: {
                enabled: false,
                degree: 8,
                dimLeaf: false,
            },
        }, displayOptions ?? {});

        this._initialLayoutInvalidated = true;
    }

    async initialize()
    {
        debug('EczCodeGraph initialize()');

        await this.initGraph();

        debug('EczCodeGraph initialize() done');
    }

    static getNodeIdCode(codeId)
    {
        return `c_${codeId}`;
    }

    // Kingdoms don't get separate nodes, they have their defining code
    //
    // static getNodeIdKingdom(kingdomId)
    // {
    //     return `k_${kingdomId}`;
    // }

    static getNodeIdDomain(domainId)
    {
        return `d_${domainId}`;
    }

    async initGraph(options)
    {
        debug("EczCodeGraph: initGraph() ...");

        // ### seems to cause problems because later cy.style() is undefined?
        //
        //let { initStyle } = options ?? {};
        //initStyle ??= true;

        let nodes = [];
        let edges = [];

        // === domains ===

        let domainColorIndexCounter = 0;
        let domainColorIndexByDomainId = {};

        for (const [domainId, domain] of Object.entries(this.eczoodb.objects.domain)) {

            //debug(`Adding domain =`, domain);

            const thisDomainNodeId = this.getNodeIdDomain(domainId);
            let label = domain.name;
            if (is_flm_fragment(label)) {
                label = render_text_standalone(domain.name);
            }
            nodes.push({
                data: {
                    id: thisDomainNodeId,
                    label: label,
                    _isDomain: 1,
                    _domainId: domainId,
                    _domainColorIndex: domainColorIndexCounter,
                }
            });
            domainColorIndexByDomainId[domainId] = domainColorIndexCounter;

            domainColorIndexCounter =
                (domainColorIndexCounter + 1) % cyStyleNumDomainColors;

        }

        // === codes ===

        for (const [codeId, code] of Object.entries(this.eczoodb.objects.code)) {

            //debug(`adding code =`, code);

            const codeShortName = this.eczoodb.code_short_name(code);

            let label = codeShortName;

            if (is_flm_fragment(codeShortName)) {
                label = render_text_standalone(codeShortName);
            }
            // remove math "\(" & "\)" since we need to produce text here
            // ... (FIXME, Find out how to display math in the CY graph?)
            label = label.replace(/\\\(|\\\)/g, '');

            const thisCodeNodeId = this.getNodeIdCode(codeId);

            let nodeData = {
                id: thisCodeNodeId,
                label: label,
                _codeId: codeId,
                _isCode: 1,
            };

            nodes.push({
                data: nodeData,
                //position: { x: Math.random()*1500, y: Math.random()*1500 },
            });

            // we can still mutate the nodeData object to add more data
            // properties to the node's data

            let definesKingdomRelation = code.relations.defines_kingdom;

            //debug({ code, thisCodeNodeId, definesKingdomRelation });

            if (definesKingdomRelation && definesKingdomRelation.length) {

                // it's a kingdom!
                const kingdom = definesKingdomRelation[0].kingdom;
                const kingdomId = kingdom.kingdom_id;

                const domain = kingdom.parent_domain;
                const domainId = domain.domain_id;
                const thisDomainNodeId = this.getNodeIdDomain(domainId);

                let kingdomName = kingdom.name;
                if (is_flm_fragment(kingdomName)) {
                    kingdomName = render_text_standalone(kingdomName);
                }

                Object.assign(nodeData, {
                    _isKingdom: 1,
                    _kingdomId: kingdomId,
                    _kingdomName: kingdomName,
                    _parentDomainId: domainId,
                    _domainColorIndex: domainColorIndexByDomainId[domainId],
                })

                edges.push({
                    data: {
                        _relType: 'parent',
                        _primaryParent: 1,
                        source: thisCodeNodeId,
                        target: thisDomainNodeId,
                    }
                });

            } else {

                // debug(`Searching for ${codeId}'s primary-parent root code`);

                // follow primary parent relationship to determine whether we're
                // part of a kingdom.
                let primaryParentRootCode = code;
                // detect any cycles so we can report an error.
                let primaryParentVisitSeenCodeIds = [ codeId ];
                while ( (primaryParentRootCode.relations?.defines_kingdom == null
                         || primaryParentRootCode.relations?.defines_kingdom?.length == 0)
                        && primaryParentRootCode.relations?.parents?.length > 0 ) {
                    primaryParentRootCode = primaryParentRootCode.relations.parents[0].code;
                    const primaryParentRootCodeId = primaryParentRootCode.code_id;
                    if (primaryParentVisitSeenCodeIds.includes(primaryParentRootCodeId)) {
                        const seenCodeChainNames = [].concat(
                            primaryParentVisitSeenCodeIds,
                            [ primaryParentRootCodeId ]
                        ).map( (cId) => {
                            let c = this.eczoodb.objects.code[cId];
                            return `‘${c.name.flm_text ?? c.name}’ (${c.code_id})`;
                        } );
                        throw new Error(
                            `Detected cycle in primary-parent relationships: `
                            + seenCodeChainNames.join(' → ')
                        );
                    } else {
                        primaryParentVisitSeenCodeIds.push( primaryParentRootCodeId );
                    }
                }
                // debug(`Code ‘${codeId}’'s primary-parent-root is `
                //       + `${primaryParentRootCode && primaryParentRootCode.code_id}`);
                if (primaryParentRootCode.relations?.defines_kingdom != null
                    && primaryParentRootCode.relations?.defines_kingdom.length > 0) {
                    const parentKingdom =
                          primaryParentRootCode.relations.defines_kingdom[0].kingdom;
                    const parentKingdomId = parentKingdom.kingdom_id;
                    const parentDomainId = parentKingdom.parent_domain.domain_id;

                    Object.assign(nodeData, {
                        _hasParentKingdom: 1,
                        _parentKingdomId: parentKingdomId,
                        _parentDomainId: parentDomainId,
                        _domainColorIndex: domainColorIndexByDomainId[parentDomainId],
                    });
                } else {
                    Object.assign(nodeData, {
                        _hasParentKingdom: 0,
                    });
                }
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
                    // let edgeId =
                    //     `${relationType}__${codeId}__${relationInstance.code.code_id}`;
                    let edgeData = {
                        // id: edgeId, // let cytoscape assign ID automatically
                        _relType: relationType,
                        source: thisCodeNodeId,
                        target: this.getNodeIdCode(relationInstance.code.code_id),
                    };
                    if (relationType === 'parent') {
                        if (j == 0 && definesKingdomRelation == null) {
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
        //if (initStyle) {
        cytoscapeConfig.style = cyBaseStyleJson;
        //}

        // create the cytoscape object
        this.cy = cytoscape(cytoscapeConfig);

        // === do some graph topology processing (e.g. root nodes, belonging to
        // kingdoms, etc.) ===

        // // Belonging to a kingdom? do a breadth-first search on the CY graph
        // this.cy.nodes('[_isCode=1]').forEach( (codeNode) => {
        //     const foundParentKingdom = this.cy.elements(
        //         'node[_isCode=1], edge[_relationType="parent"]'
        //     ).breadthFirstSearch({
        //         root: codeNode,
        //         visit(currentNode, lastEdge, previousNode, numVisits, visitDepth) {
        //             if (currentNode.data('_isKingdom') === 1) {
        //                 return true;
        //             }
        //         }
        //     });
        //     if (foundParentKingdom?.found != null) {
        //         const foundNode = foundParentKingdom.found;
        //         codeNode.data({
        //             // update node's data fields with these ones
        //             _hasParentKingdom: 1,
        //             _parentKingdomNodeId: foundNode.id(),
        //             _parentKingdomId: foundNode._kingdomId,
        //         });
        //     } else {
        //         codeNode.data('_hasParentKingdom', 0);
        //     }
        // } );

        // Find out where to position the graph root nodes

        const {
            rootAbstractCodesXSpacing,
            rootAbstractCodesYPosition,
            domainNodesXSpacing,
            domainNodesYPosition,
        } = this.graphOptions.rootPositioning;

        let graphRootNodesPrelayoutHints = {};
        let domainIds = Object.keys(this.eczoodb.objects.domain);
        for (const [j, domainId] of domainIds.entries()) {
            const nodeId = this.getNodeIdDomain(domainId);
            graphRootNodesPrelayoutHints[nodeId] = {
                position: {x: (j - (domainIds.length-1)/2) * rootAbstractCodesXSpacing,
                           y: rootAbstractCodesYPosition},
                radiusOffset: 50,
                direction: Math.PI - Math.PI * (j+0.5) / domainIds.length,
                angularSpread: Math.PI / domainIds.length,
            };
        }
        // these are abstract property codes:
        let rootCodeNodeIds = this.getOverallRootNodeIds({ includeDomains: false });
        //debug(`rootCodeNodeIds = `, rootCodeNodeIds);
        for (const [j, codeNodeId] of rootCodeNodeIds.entries()) {
            graphRootNodesPrelayoutHints[codeNodeId] = {
                position: {x: (j - (rootCodeNodeIds.length-1)/2) * domainNodesXSpacing,
                           y: domainNodesYPosition},
                radiusOffset: 50,
                direction: Math.PI + Math.PI * (j+0.5) / rootCodeNodeIds.length,
                angularSpread: Math.PI / rootCodeNodeIds.length,
            };
        }

        //debug(`graphRootNodesPrelayoutHints = `, graphRootNodesPrelayoutHints);

        this.graphOptions.graphRootNodesPrelayoutHints = graphRootNodesPrelayoutHints;

        for (const graphRootNodeId
             of Object.keys( this.graphOptions.graphRootNodesPrelayoutHints )) {
            let graphRootNode = this.cy.getElementById(graphRootNodeId);
            graphRootNode.addClass('graphRoot');
        }

        // === finalize UI state etc. ===

        // use 'null' arguments to apply the settings already stored in
        // this.displayOptions
        this.setDisplayMode(null);
        this.setDomainColoring(null);
        this.setCousinEdgesShown(null);
        this.setSecondaryParentEdgesShown(null);
        this.setLowDegreeNodesDimmed(null);

        debug("EczCodeGraph: initGraph() done");
    }
    
    mountInDom(cyDomNode, options={})
    {
        // background color
        cyDomNode.style.backgroundColor = 'rgb(255, 236, 217)';

        this.cy.mount( cyDomNode );

        let styleOptions = _.merge( {}, options );
        styleOptions.matchWebPageFonts ??= true; // default to True

        const newCyStyleJson = getCyStyleJson( styleOptions );

        this.cy.style()
            .resetToDefault()
            .fromJson(newCyStyleJson)
            .update();
    }

    // toSvg(options)
    // {
    //     return this.cy.svg(options);
    // }

    // ---------------------------


    domainColoring()
    {
        return this.displayOptions.domainColoring;
    }

    setDomainColoring(coloringOn)
    {
        if (coloringOn != null) {
            coloringOn = !! coloringOn;
            if (coloringOn === this.displayOptions.domainColoring) {
                return; // nothing to update
            }
            this.displayOptions.domainColoring = coloringOn;
        }
        
        // apply setting stored in this.displayOptions.domainColoring

        if (this.displayOptions.domainColoring) {
            this.cy.nodes().addClass('useDomainColors');
        } else {
            this.cy.nodes().removeClass('useDomainColors');
        }
    }

    cousinEdgesShown()
    {
        return this.displayOptions.cousinEdgesShown;
    }

    setCousinEdgesShown(show)
    {
        if (show != null) {
            show = !!show; // make sure the value is boolean
            if (show === this.displayOptions.cousinEdgesShown) {
                // no update required
                return;
            }
            this.displayOptions.cousinEdgesShown = show;
        }

        let cousinEdges = this.cy.edges('[_relType="cousin"]');
        if (this.displayOptions.cousinEdgesShown) {
            cousinEdges.removeClass("hidden"); 
        } else {
            cousinEdges.addClass("hidden"); 
        }
    }

    secondaryParentEdgesShown()
    {
        return this.displayOptions.secondaryParentEdgesShown;
    }

    setSecondaryParentEdgesShown(show)
    {
        if (show != null) {
            show = !!show; // make sure the value is boolean
            if (show === this.displayOptions.secondaryParentEdgesShown) {
                // no update required
                return;
            }
            this.displayOptions.secondaryParentEdgesShown = show;
        }

        let secondaryParentEdges =
            this.cy.edges('[_primaryParent=0]');
        if (this.displayOptions.secondaryParentEdgesShown) {
            secondaryParentEdges.removeClass("hidden"); 
        } else {
            secondaryParentEdges.addClass("hidden"); 
        }
    }

    lowDegreeNodesDimmed()
    {
        return this.displayOptions.lowDegreeNodesDimmed;
    }

    setLowDegreeNodesDimmed(options)
    {
        if (options != null) {
            if (_.isEqual(this.displayOptions.lowDegreeNodesDimmed, options)) {
                // no update needed
                return;
            }
            this.displayOptions.lowDegreeNodesDimmed = options;
        }
        const {enabled, degree, dimLeaf} = this.displayOptions.lowDegreeNodesDimmed;

        this.cy.elements().removeClass('lowDegreeDimmed');
        if (!enabled) {
            return;
        }
        // dim "unimportant" codes based on their degree
        degree ??= 8;
        dimLeaf ??= true; //false;
        let dimSelector = `[[degree < ${degree}]]`;
        if (!dimLeaf) {
            dimSelector += `[[indegree >= 1]]`;
        }
        this.cy.nodes(dimSelector).addClass("lowDegreeDimmed");
        // also edges between dimmed nodes
        this.cy
            .edges( (edge) => (edge.source().is('.lowDegreeDimmed')
                               || edge.target().is('.lowDegreeDimmed')) )
            .addClass("lowDegreeDimmed")
        ;
    }


    displayMode()
    {
        return this.displayOptions.displayMode;
    }
    modeIsolateNodesOptions()
    {
        return this.displayOptions.modeIsolateNodesOptions;
    }

    setDisplayMode(displayMode, { modeIsolateNodesOptions }={})
    {
        debug('setDisplayMode(): ', { displayMode, modeIsolateNodesOptions });

        if (displayMode != null) {
            if (displayMode === this.displayOptions.displayMode) {
                if (displayMode === 'all') {
                    return; // no options to compare
                } else if (displayMode === 'isolate-nodes') {
                    if (_.isEqual(modeIsolateNodesOptions,
                                  this.displayOptions.modeIsolateNodesOptions)) {
                        // debug('setDisplayMode(): (nothing to update). ',
                        //       { 'this.displayOptions': this.displayOptions,
                        //         modeIsolateNodesOptions });
                        return;
                    }
                } else {
                    throw new Error(`Invalid display mode: ${displayMode}`);
                }
            }
            this.displayOptions.displayMode = displayMode;
            if (displayMode === 'all') {
                // no options to update
            } else if (displayMode === 'isolate-nodes') {
                _.merge(this.displayOptions.modeIsolateNodesOptions, modeIsolateNodesOptions);
            } else {
                throw new Error(`Invalid display mode: ${displayMode}`);
            }
        }

        // remove any display-mode related classes, we'll recompute them
        this.cy.elements().removeClass(
            ['isolationRoot', 'isolationSelected', 'isolationSecondary', 'isolationHidden']
        );

        //
        // Here we don't actually lay out the items, we simply mark labels with
        // corresponding classes to show/hide them.  A separate call to the
        // layout() function will actually compute, animate, and display the
        // positions of the nodes.
        //

        if (this.displayOptions.displayMode === 'all') {
            
            debug(`displayMode is 'all'`);

            // nothing particular to do, all nodes ar to be displayed

        } else if (this.displayOptions.displayMode === 'isolate-nodes') {

            debug(`applying displayMode=${this.displayOptions.displayMode} with`,
                  { displayOptions: this.displayOptions });

            const {
                nodeIds,
                redoLayout,
                range,
            } = this.displayOptions.modeIsolateNodesOptions;

            //
            // FIXME! Add a cutoff to the maximum number of nodes to include.
            // Include more children & parents at a constant rate until range is
            // reached or until max nodes is reached.
            //

            let relationEdgesGetters = {};
            for (const whichTree of ['parents', 'children']) {
                relationEdgesGetters[whichTree] = {};
                for (const whichRelationStrength of ['primary', 'secondary']) {
                    const selector =
                          this.graphOptions.isolationRelationSelector[whichRelationStrength];
                    if (selector === false) {
                        relationEdgesGetters[whichTree][whichRelationStrength] = false;
                        continue;
                    }
                    const fn = mkRelationEdgesGetterWithTreeDirection(
                        selector, whichTree
                    );
                    relationEdgesGetters[whichTree][whichRelationStrength] = fn;
                }
            }
            //debug({ relationEdgesGetters });

            let elxroot = this.cy.collection();
            nodeIds.forEach( (nodeId) => elxroot.merge(this.cy.getElementById(nodeId)) );

            let elx1 = elxroot;
            let elx2 = elxroot;

            // select children
            for (let j = 0; j < range.children.primary; ++j) {
                //debug(`computing isolation mode elements, elx1 = `, elx1);
                // range only includes parent relations
                let edges = relationEdgesGetters.children.primary(elx1);
                elx1 = elx1.union(edges).union(edges.connectedNodes());
            }
            let elx1secondary = elx1;
            for (let j = 0; j < range.children.secondary; ++j) {
                let elx1secedges = relationEdgesGetters.children.secondary(elx1secondary);
                elx1secondary = elx1.union(elx1secedges).union(elx1secedges.connectedNodes());
            }

            // select parents
            for (let j = 0; j < range.parents.primary; ++j) {
                //debug(`computing isolation mode elements, elx2 = `, elx2);
                // range only includes parent relations
                let edges = relationEdgesGetters.parents.primary(elx2);
                elx2 = elx2.union(edges).union(edges.connectedNodes());
            }
            let elx2secondary = elx2;
            for (let j = 0; j < range.parents.secondary; ++j) {
                let elx2secedges = relationEdgesGetters.parents.secondary(elx2);
                elx2secondary = elx2.union(elx2secedges).union(elx2secedges.connectedNodes());
            }

            // and always add one level of cousins from any element that we've captured.
            let elx = elx1.union(elx2);
            let elxlasted = elx1secondary.union(elx2secondary);
            let elxall = elxlasted.union(elxlasted.connectedNodes()).union(elx);
            let elxlast = elxall.not(elx);

            //debug(`elxall = `, elxall);
            //debug(`elxlast = `, elxlast);

            elxroot.addClass('isolationRoot');
            elx.addClass('isolationSelected');
            elxlast.addClass(['isolationSelected', 'isolationSecondary']);
            this.cy.elements()
                .not(elxall)
                .addClass('isolationHidden');

        } else {

            throw new Error(`Unknown displayMode = ${this.displayOptions.displayMode}`);

        }

    }

    initialLayoutInvalidated()
    {
        return this._initialLayoutInvalidated;
    }


    async prelayout(rootNodeIds, options)
    {
        // compute an initial position of the nodes to reflect the tree
        // structure of the codes

        let relationSelector;
        if (this.displayOptions.displayMode === 'all') {
            relationSelector = {
                primary: '[TREEDIRECTION][_primaryParent=1]',
                // don't follow secondary nodes because all nodes are related as
                // primary node w.r.t SOME root node
                secondary: false,
            }
        } else if (this.displayOptions.displayMode === 'isolate-nodes') {
            relationSelector = this.graphOptions.isolationRelationSelector;
        } else {
            throw new Error(`unknown displayMode=${this.displayOptions.displayMode}`);
        }

        options = _.merge({
            origin: {
                position: { x: 0, y: 0 },
                angularSpread: 2*Math.PI,
                useWeights: false,
            },
            relationSelector,
            weightCalcLevels: 6,
            weightCalcSecondaryFactor: 0.3,
        }, options);


        debug(`prelayout(): Using rootNodeIds =`, rootNodeIds);


        let prelayout = new PrelayoutRadialTree({
            cy: this.cy,
            rootNodeIds, options,
            graphRootNodesPrelayoutHints: this.graphOptions.graphRootNodesPrelayoutHints
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
            ([codeId, code]) => (
                !(code.relations?.parents?.length) && !(code.relations?.defines_kingdom)
            )
        ).map( ([codeId, code]) => this.getNodeIdCode(codeId) );

        return [].concat(rootNodeIdsDomains, rootNodeIdsCodes);
    }

    async layout({ animate, forceRelayout, prelayoutOptions }={})
    {
        animate ??= true;

        if (forceRelayout) {
            this._initialLayoutInvalidated = true;
        }

        debug('code graph layout()');

        let rootNodeIds = null;

        let shouldApplyPrelayout = true;
        let shouldApplyCoseLayout = true;

        if (this.displayOptions.displayMode === 'all') {

            if (!this._initialLayoutInvalidated) {
                shouldApplyPrelayout = false;
                shouldApplyCoseLayout = false;
            }

            rootNodeIds = this.getOverallRootNodeIds();

            prelayoutOptions = _.merge({
            }, prelayoutOptions);

        } else if (this.displayOptions.displayMode === 'isolate-nodes') {

            const { nodeIds, redoLayout } = this.displayOptions.modeIsolateNodesOptions;

            if (redoLayout) {
                rootNodeIds = nodeIds;
            } else {
                shouldApplyPrelayout = false;
                rootNodeIds = this.getOverallRootNodeIds();
            }

            let origin = {
                position: {x: 0, y: 0},
                radius: 80,
            };
            // FIXME: this is buggy, why??
            if (nodeIds.length === 1) {
                // keep that node where it is
                _.merge(origin, {
                    //position: this.cy.getElementById(nodeIds[0]).position(), // BUGGY??
                    radius: 0,
                });
            }

            prelayoutOptions = _.merge({
                origin: _.merge({
                    direction: Math.PI/2,
                    angularSpread: Math.PI,
                }, origin),
            }, prelayoutOptions);

            if (!redoLayout) {
                shouldApplyCoseLayout = false;
            }
            if ( this.cy.nodes('.prelayoutPositioned').size < 20) {
                // No need to run fcose if we have few nodes.

                // FIXME: check all pairs of nodes to make sure they aren't too
                // close to each other and that their labels don't overlap.

                //shouldApplyCoseLayout = false;
            }                

            if (shouldApplyPrelayout || shouldApplyCoseLayout) {
                this._initialLayoutInvalidated = true;
            }
        }

        if (shouldApplyPrelayout) {
            await this.prelayout(rootNodeIds, prelayoutOptions);
        }

        if (!shouldApplyCoseLayout) {
            //this.cy.fit();
            return;
        }

        debug(`Running fcose layout ...`);

        //### DEBUG: FIXME:  RETURN HERE TO CHECK/DEBUG PRELAYOUT POSITIONNING
        //return;

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
            nodeRepulsion: (node) => 100000,
            // Ideal edge (non nested) length
            idealEdgeLength: (edge) => {
                if (edge.data('_primaryParent') === 1) {
                    return 100;
                } else {
                    return 300;
                }
            },
            // Divisor to compute edge forces
            edgeElasticity: (edge) => {
                if (edge.data('_primaryParent') === 1) {
                    return 0.3;
                } else {
                    return 0.01;
                }
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
                    el.visible() //&& (el.isNode() || el.data('_primaryParent') === 1)
                ) )
                .layout(
                    _.merge(
                        {
                            ready: () => resolve(),
                            stop: () => resolve(),
                        },
                        layoutOptions,
                    ),
                );
            layout.run();
        } );

        debug('laying out (fcose) - waiting for promise.');

        await p;

        if (this.displayOptions.displayMode === 'all'
            && shouldApplyPrelayout && shouldApplyCoseLayout) {
            this._initialLayoutInvalidated = false;
        }
        
        debug('done!');
    }

};



class PrelayoutRadialTree
{
    constructor({cy, rootNodeIds, options, graphRootNodesPrelayoutHints})
    {
        this.cy = cy;
        this.rootNodeIds = rootNodeIds;

        this.graphRootNodesPrelayoutHints = graphRootNodesPrelayoutHints;

        this.options = _.merge({

            trees: {
                children: {
                    primary: true,
                    secondary: 1,
                },
                parents: {
                    primary: true,
                    secondary: 1,
                },
            },

            relationSelector: {
                primary: '', // should be set by caller
                secondary: '', // empty means all edge count as secondary
            },

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
            
        }, options);
    }


    run()
    {
        let pBranches = [];

        let positionedNodesData = {};

        // position the root nodes & set branch "layouters" instances
        let rootNodeHints = {};
        let rootNodeIdsToBePositioned = [];
        for (const rootNodeId of this.rootNodeIds) {
            let hints = this.graphRootNodesPrelayoutHints[rootNodeId];
            if (hints != null) {
                rootNodeHints[rootNodeId] = hints;
            } else {
                rootNodeIdsToBePositioned.push(rootNodeId);
            }
        }
        // create "hints" for any root nodes that haven't been manually
        // positioned & directed
        const numJ = rootNodeIdsToBePositioned.length;
        const maxJ = Math.max(rootNodeIdsToBePositioned.length - 1, 1);
        const origin = this.options.origin;
        debug(`Will need to auto position ${numJ} root nodes`, { origin });
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
            rootNodeHints[rootNodeId] = {
                position,
                radiusOffset: R,
                direction: angle,
                angularSpread: origin.angularSpread / numJ,
            };
        }
        
        for (const [rootNodeId, hints] of Object.entries(rootNodeHints)) {

            debug(`Prelayout - Prepping root node ${rootNodeId}`, { hints });

            positionedNodesData[rootNodeId] = {
                position: hints.position,
                isRoot: true,
                relatedAs: 'root',
            };

            if (this.options.trees.children) {
                const tree = this.options.trees.children;
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: hints.radiusOffset,
                        position: hints.position,
                        direction: hints.direction,
                        angularSpread: hints.angularSpread,
                    },
                    options: this.options,
                    branchOptions: {
                        treeDirection: 'children',
                        flipDirection: false,
                        tree,
                    },
                    positionedNodesData,
                }));
            }
            if (this.options.trees.parents) {
                const tree = this.options.trees.parents;
                pBranches.push(new _PrelayoutRadialTreeBranchSet({
                    cy: this.cy,
                    root: {
                        nodeId: rootNodeId,
                        radius: hints.radiusOffset,
                        position: hints.position,
                        direction: hints.direction,
                        angularSpread: hints.angularSpread,
                    },
                    options: this.options,
                    branchOptions: {
                        treeDirection: 'parents',
                        flipDirection: true,
                        tree,
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

};


//
// FIXME: Also include one last additional outgoing edge on each of the
// prelayout-computed nodes so that we can see all outgoing edges!! (including
// cousins etc.)
//

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

        let seenNodes = new Set();

        let thisLevelNodes = [ {
            nodeId: this.root.nodeId,
            level: 0,
            treeDepthRemaining: Object.assign({}, this.branchOptions.tree),
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
        let relationEdgesGetters = {};
        for (const whichRelationStrength of ['primary', 'secondary']) {
            const selector = options.relationSelector[whichRelationStrength];
            if (selector === false) {
                relationEdgesGetters[whichRelationStrength] = false;
                continue;
            }
            const fn = mkRelationEdgesGetterWithTreeDirection(
                selector, this.branchOptions.treeDirection
            );
            relationEdgesGetters[whichRelationStrength] = fn;
        }
        // debug({ relationEdgesGetters });

        nodeOrderinginfoByLevel.push(thisLevelNodes);
        let level = 0;
        while (thisLevelNodes.length) {
            let nextLevelNodes = [];

            for (const nodeOrderingInfo of thisLevelNodes) {

                const {
                    nodeId, parentNodeOrderingInfo, treeDepthRemaining
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
                    // see if we're still allowed to expand in that tree direction
                    if (treeDepthRemaining[whichRelationStrength] === 0) {
                        // not true and not a strictly positive number -> cannot
                        // continue exploring relations of this type beyond this
                        // tree node
                        continue;
                    }
                    let relationEdgesGetter = relationEdgesGetters[whichRelationStrength];
                    if (relationEdgesGetter === false) {
                        continue;
                    }

                    // find children through primary parent relation and add them
                    // for next level's processing
                    // let selector = (
                    //     `${options.relationSelector[whichRelationStrength]}`
                    //     + `[${closeNodeWhich}="${nodeId}"]`
                    // );
                    // debug(`selector =`, selector);
                    let connectedEdges = relationEdgesGetter(this.cy.getElementById(nodeId));
                    let connectedNodesInfos = []
                    for (const edge of connectedEdges) {
                        const connectedNode = otherConnectedNode(edge, nodeId);
                        const connectedNodeId = connectedNode.id();
                        if (this.positionedNodesData.hasOwnProperty(connectedNodeId)
                            || seenNodes.has(connectedNodeId)) {
                            continue;
                        }
                        seenNodes.add(connectedNodeId);

                        let nextTreeDepthRemaining = Object.assign({}, treeDepthRemaining);
                        if (nextTreeDepthRemaining[whichRelationStrength] !== true) {
                            // decrease the remaining quota for this whichRelationStrength
                            nextTreeDepthRemaining[whichRelationStrength] -= 1;
                        }
                        if (whichRelationStrength === 'secondary') {
                            // never consider primary connections of secondary connections
                            nextTreeDepthRemaining.primary = 0;
                        }

                        connectedNodesInfos.push({
                            nodeId: connectedNodeId,
                            level: level+1,
                            parentNodeOrderingInfo: nodeOrderingInfo,
                            connectedNodesInfos: [],
                            totalNumDescendants: 0,
                            numDescendants: [],
                            treeDepthRemaining: nextTreeDepthRemaining,
                            relatedAs: whichRelationStrength,
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
        for (const [level, orderinginfoList] of this.nodeOrderinginfoByLevel.entries()) {
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

        if (this.positionedNodesData.hasOwnProperty(nodeId)) {
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
    _positionNodeChildren({node, nodePosition, nodeInfo, level, angularSpread, direction})
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

};



// -----------------------------------------------------------------------------

export const cyStyleNumDomainColors = 3;
const cyBaseStyleJson = [
    
    // style nodes:
    {
        selector: 'node',
        style: {
            'color': 'rgb(127, 48, 0)',
            'background-color': 'rgb(127, 48, 0)',
            label: 'data(label)',
            width: 15,
            height: 15,

            'min-zoomed-font-size': 10,
        }
    },
    {
        selector: 'node[_isDomain=1]',
        style: {
            'shape': 'round-rectangle',
            //'background-color': '#00007f',
            //'color': '#00007f',
            width: 25,
            height: 25,
        },
    },
    {
        selector: 'node[_isKingdom=1]',
        style: {
            'shape': 'diamond',
            width: 25,
            height: 25,
            // 'background-color': '#5e3834',
            // 'color': '#5e3834',
        }
    },
    {
        selector: 'node[_hasParentKingdom=0]',
        style: {
            'shape': 'round-diamond',
            color: 'rgb(136, 91, 7)',
            'background-color': 'rgb(136, 91, 7)',
            width: 20,
            height: 20,
        }
    },

    // domain coloring
    {
        selector: 'node.useDomainColors[_domainColorIndex=0]',
        style: {
            color: 'rgb(95,69,130)',
            'background-color': 'rgb(95,69,130)',
        },
    },
    {
        selector: 'node.useDomainColors[_domainColorIndex=1]',
        style: {
            color: 'rgb(50,108,110)',
            'background-color': 'rgb(50,108,110)',
        },
    },
    {
        selector: 'node.useDomainColors[_domainColorIndex=2]',
        style: {
            color: 'rgb(111,50,72)',
            'background-color': 'rgb(111,50,72)',
        },
    },

    // style edges:
    {
        selector: 'edge',
        style: {
            'width': 1,
            'opacity': 0.5,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            //'label': 'data(label)',
            'font-size': '12px'
        }
    },
    {
        selector: 'edge[_relType="parent"]',
        style: {
            'width': 1,
            'line-color': '#00307f',
            'target-arrow-color': '#00307f',
            'color': '#00307f'
        }
    },
    {
        selector: 'edge[_primaryParent=0]',
        style: {
            opacity: 0.25,
        }
    },
    {
        selector: 'edge[_relType="cousin"]',
        style: {
            'width': 1,
            'target-arrow-shape': 'none',
            'line-style': 'dotted',
            'line-color': '#00883f',
            'target-arrow-color': '#00883f',
            'color': '#00883f'
        }
    },

    //
    // special styling & style classes - e.g., hidden, dimmed.
    //

    // nodes marked at root --- heads of families / nodes selected for
    // isolated display
    {
        selector: '.graphRoot[_isDomain!=1]', //', .prelayoutRoot',
        style: {
            // color: 'rgb(180,50,50)',
            // 'background-color': 'rgb(180,50,50)',
            width: 25,
            height: 25,
        }
    },
    {
        selector: '.isolationRoot',
        style: {
            color: 'rgb(230,50,50)',
            'font-weight': 'bold',
            'background-color': 'rgb(230,50,50)',
        }
    },

    // isolation style
    {
        selector: '.isolationSecondary',
        style: {
            opacity: 0.3,
        }
    },
    {
        selector: 'node.isolationSecondary',
        style: {
            width: 10,
            height: 10,
        }
    },

    // items that our prelayout couldn't handle -- mark visually because the
    // existence of such visible nodes is a bug
    {
        selector: '.prelayoutOutOfLayoutTree',
        style: {
            color: 'rgb(120,0,50)',
            'background-color': 'rgb(120,0,50)',
            //opacity: 1,
        }
    },

    // hide anything with the 'hidden' class
    {
        selector: '.hidden, .isolationHidden', //', .prelayoutHidden',
        style: {
            display: 'none',
        }
    },

    // style nodes that we want to dim out to de-clutter the graph
    {
        selector: '.lowDegreeDimmed',
        style: {
            opacity: 0.15,
            label: '',
        }
    },
    {
        selector: 'node.lowDegreeDimmed',
        style: {
            width: 10,
            height: 10,
        }
    },

    // custom highlight & dimmed class
    {
        selector: '.highlight',
        style: {
            opacity: 1,
            color: 'rgb(220,80,0)',
            'background-color': 'rgb(220,80,0)',
            width: 40,
            height: 40,
            'font-size': 20,
        }
    },
    {
        selector: '.dimmed',
        style: {
            opacity: 0.3,
        }
    },

];


export function getCyStyleJson(options)
{
    let customFontStyle = {};

    options ??= {};

    if (options.matchWebPageFonts) {
        let windowObject = (options.window ?? window);
        let computedStyle = windowObject.getComputedStyle(windowObject.document.body);
        customFontStyle['font-family'] = computedStyle.getPropertyValue('font-family');
        customFontStyle['font-size'] = computedStyle.getPropertyValue('font-size');
        customFontStyle['font-weight'] = computedStyle.getPropertyValue('font-weight');
        customFontStyle['font-style'] = computedStyle.getPropertyValue('font-style');
    }

    // individual options.fontFamily, options.fontSize, options.fontWeight
    // override web page defaults
    if (options.fontFamily != null) {
        customFontStyle['font-family'] = options.fontFamily;
    }
    if (options.fontSize != null) {
        customFontStyle['font-size'] = options.fontSize;
    }
    if (options.fontWeight != null) {
        customFontStyle['font-weight'] = options.fontWeight;
    }
    if (options.fontStyle != null) {
        customFontStyle['font-style'] = options.fontStyle;
    }

    if (_.isEmpty(customFontStyle)) {
        return cyBaseStyleJson;
    }

    return [].concat(
        [
            {
                selector: '*',
                style: customFontStyle
            }
        ],
        cyBaseStyleJson,
    );
}
