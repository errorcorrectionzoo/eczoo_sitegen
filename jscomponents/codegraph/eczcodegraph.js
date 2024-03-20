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

// import { 
//     EczCodeGraphSubgraphSelector,
//     // EczCodeGraphSubgraphSelectorAll
// } from './subgraphselector.js';

//import { EczCodeGraphFilterXYZ } from './graphfilter.js';

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

        // by default, we start as a headless graph not mounted in the DOM
        this.mountedDomNode = null;
        this.eventTapCallbackFn = null;

        // the background color to use
        this.bgColor = 'rgb(255, 236, 217)';

        // the subgraph selector.
        this.subgraphSelector = null; // initialize only after initial graph is initialized!
        // any display filters.
        this.graphFilters = [];

        // whether we should update the layout at the next opportunity.
        this._pendingUpdateLayout = false;
    }

    async initialize()
    {
        debug('EczCodeGraph initialize()');

        await this.initGraph();
        
        //EczCodeGraphSubgraphSelector.clear(this);
        // this.installSubgraphSelector(
        //     new EczCodeGraphSubgraphSelectorAll(this)
        // );

        debug("EczCodeGraph initialize() done.  Don't forget to install a subgraph selector.");
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
        // FIXME: Ensure that a filter of the same name hasn't already been installed
        
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

    _unapplyGraphFilters({ eles }={})
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
        debug(`installSubgraphSelector()`);

        // const previousSubgraphLayoutOptions =
        //     this.subgraphSelector.getSubgraphLayoutOptions();  // bad idea

        // clean the graph from any display filters
        this._unapplyGraphFilters();

        this.subgraphSelector = subgraphSelector;
        this.subgraphSelector.installSubgraph(); //{ previousSubgraphLayoutOptions });

        debug(
            `installSubgraphSelector(): applied subgraph selection. # of visible nodes = `,
            this.cy.nodes('.layoutVisible').length
        );

        this._applyGraphFilters();

        // request new layout calculation with new subgraph selector.
        this._pendingUpdateLayout = true;
    }

    isPendingUpdateLayout()
    {
        return this._pendingUpdateLayout;
    }

    // Should be called by subgraph selector instances to indicate that a new graph layout
    // calculation should be initiated at the next available opportunity.
    //
    // Call without arg to set this state to true, as
    // `eczCodeGraph.setPendingUpdateLayout()`.
    //
    setPendingUpdateLayout(pendingUpdateLayout)
    {
        pendingUpdateLayout ??= true;
        this._pendingUpdateLayout = pendingUpdateLayout;
    }
    
    mountInDom(cyDomNode, { bgColor, styleOptions }={})
    {
        // background color
        this.bgColor = bgColor ?? this.bgColor;
        cyDomNode.style.backgroundColor = this.bgColor;

        if (this.mountedDomNode != null) {
            this.cy.unmount();
            if (this.eventTapCallbackFn != null) {
                this.cy.removeListener('tap', this.eventTapCallbackFn);
            }
        }

        this.cy.mount( cyDomNode );
        this.mountedDomNode = cyDomNode;

        styleOptions = loMerge( {}, styleOptions );
        styleOptions.matchWebPageFonts ??= true; // default to True

        const newCyStyleJson = getCyStyleJson( styleOptions );
        debug(`Setting style: `, newCyStyleJson);

        this.cy.style()
            .resetToDefault()
            .fromJson(newCyStyleJson)
            .update();

        if (this.eventTapCallbackFn != null) {
            this.cy.addListener('tap', this.eventTapCallbackFn);
        }    
    }

    setUserTapCallback(userTapCallbackFn)
    {
        const eventCallbackFn = (event) => {
            const eventTarget = event.target;
            try {
                if ( ! eventTarget || ! eventTarget.isNode ) {
                    // tap on an edge or on the background -- hide info pane
                    debug('Unknown or non-node tap target.');
                    userTapCallbackFn({ background: true, event, eventTarget });
                    return;
                }
                if ( eventTarget.isEdge() ) {
                    // handle edge click
                    const edge = eventTarget;
                    debug(`Tapped edge ${edge.id()}`);
                    userTapCallbackFn({ edgeId: edge.id(), event, eventTarget });
                    return;
                }
                if ( eventTarget.isNode() ) {
                    const node = eventTarget;
                    debug(`Tapped node ${node.id()}`);
                    userTapCallbackFn({ nodeId: node.id(), event, eventTarget });
                    return;
                }
                debug('Unknown tap/click target ??!');
                return;
            } catch (err) {
                console.error(`Ignoring error while handling cytoscape canvas tap/click: `, err);
                return;
            }
        };
        if (this.mountedDomNode != null && this.eventTapCallbackFn != null) {
            this.cy.removeListener('tap', this.eventTapCallbackFn);
        }
        this.eventTapCallbackFn = eventCallbackFn;
        if (this.mountedDomNode != null) {
            this.cy.addListener('tap', this.eventTapCallbackFn);
        }
    }

    // ---------------------------

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

    // ---------------------------


    async updateLayout({ animate, forceRelayout, skipCoseLayout }={})
    {
        animate ??= true;
        forceRelayout ??= false;
        skipCoseLayout ??= false;
        //skipCoseLayout ??= true; // DEBUG DEBUG !

        if (this.subgraphSelector == null) {
            throw new Error(
                `You didn't install a subgraph selector, which is needed to lay out the code graph. `
                +`To install a simple "display all" subgraph selector, use  `
                +`eczCodeGraph.installSubgraphSelector(`
                +    `new EczCodeGraphSubgraphSelectorAll(eczCodeGraph))`
                +`  after initialization.`
            );
        }

        let {
            reusePreviousLayoutPositions,
            //rootNodesPrelayoutInfo,
            //prelayoutOptions
        } = this.subgraphSelector.getSubgraphLayoutOptions();

        if (this.cy.nodes('.layoutVisible').not('._layoutPositioned').length) {
            // if there are any nodes that belong to the layout but that are not yet
            // layout-positioned, we need to force a new layout update
            forceRelayout = true;
        }

        if (forceRelayout) {
            reusePreviousLayoutPositions = false;
        }

        debug('in updateLayout()',
              { animate, forceRelayout, skipCoseLayout, reusePreviousLayoutPositions } );

        // clear any pending layout update state.
        this._pendingUpdateLayout = false;

        // Make visible those elements that should be visible, and hiding those that shouldn't.
        // Cy doesn't have setVisible(), rather we set the class 'hidden' that sets the
        // style 'display: none', causing the element to be hidden.
        this.cy.elements().forEach(
            (ele) => {
                ele.toggleClass('hidden', !ele.hasClass('layoutVisible'));
            }
        );

        let shouldApplyPrelayout = true;
        let shouldApplyCoseLayout = true;

        if (reusePreviousLayoutPositions) {
            shouldApplyPrelayout = false;
            shouldApplyCoseLayout = false;
        }
        if (skipCoseLayout) {
            shouldApplyCoseLayout = false;
        }

        const rootNodeIds = this.cy.nodes('.layoutRoot').map( (node) => node.id() );

        if (shouldApplyPrelayout || shouldApplyCoseLayout) {
            // invalidate any currently laid out nodes
            this.cy.elements().removeClass('_layoutPositioned');
        }

        if (shouldApplyPrelayout) {
            debug(`Running prelayout ...`);
            await this._runPrelayout({ rootNodeIds }); //, rootNodesPrelayoutInfo, prelayoutOptions });
        }

        if (shouldApplyCoseLayout) {
            debug(`Running fcose layout ...`);
            await this._runCoseLayout({ rootNodeIds, animate });
        }

        this.cy.nodes('.layoutVisible').addClass('_layoutPositioned');
    }

    async _runPrelayout({ rootNodeIds }) //, rootNodesPrelayoutInfo, prelayoutOptions })
    {
        // compute an initial position of the nodes to reflect the tree
        // structure of the codes

        debug(`_runPrelayout(): Using rootNodeIds =`, rootNodeIds);

        let prelayout = this.subgraphSelector.createPrelayoutInstance({ rootNodeIds });

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




    // --------------------------------



    async initGraph()
    {
        debug("EczCodeGraph: initGraph() ...");

        let nodes = [];
        let edges = [];

        // === domains and kingdoms ===

        for (const [domainId, domain] of Object.entries(this.eczoodb.objects.domain)) {

            //debug(`Adding domain =`, domain);

            const thisDomainNodeId = this.getNodeIdDomain(domainId);

            const thisDomainName = contentToText(domain.name);
            const thisDomainLabel = contentToNodeLabel(thisDomainName);

            nodes.push({
                data: {
                    id: thisDomainNodeId,
                    label: thisDomainLabel,
                    _isDomain: 1,
                    _domainId: domainId,

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

        // // Apply the current settings already stored in this.displayOptions to set
        // // all the graph classes correctly according to the display options.
        // this._applyDisplayMode();
        // this._applyDomainColoring();
        // this._applyCousinEdgesShown();
        // this._applySecondaryParentEdgesShown();
        // this._applyLowDegreeNodesDimmed();

        debug("EczCodeGraph: initGraph() done");
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

