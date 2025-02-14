import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.eczcodegraph');

import loMerge from 'lodash/merge.js';
import loIsEqual from 'lodash/isEqual.js';

import cytoscape from 'cytoscape';
//import cyNavigator from 'cytoscape-navigator';
//import cyCoseBilkent from 'cytoscape-cose-bilkent';
import cyFcose from 'cytoscape-fcose';

import {
    render_text_standalone, is_flm_fragment,
    // $$kw,
} from '@phfaist/zoodb/zooflm';

import { cyBaseStyleJson, getCyStyleJson } from './style.js';

import { 
    EczCodeGraphSubgraphSelector,
} from './subgraphselector.js';

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
    constructor({ eczoodb, graphGlobalOptions })
    {
        debug('EczCodeGraph constructor');

        // expose static methods via "this.XXX()"
        this.getNodeIdCode = EczCodeGraph.getNodeIdCode;
        this.getNodeIdDomain = EczCodeGraph.getNodeIdDomain;
        this.getNodeIdKingdom = EczCodeGraph.getNodeIdKingdom;

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

        // global options for this code graph.
        this.graphGlobalOptions = loMerge(
            {
                rootPositioning: {
                    
                    // rootAbstractCodesXSpacing: 750,
                    // rootAbstractCodesYPosition: 0,
                    // rootAbstractCodesYPositionSingleOffset: 150,
                    // domainNodesXSpacing: 750,
                    // domainNodesYPosition: 250,
                    // domainNodesYPositionSingleOffset: 150,

                    rootNodesCircleXRadius: 500,
                    rootNodesCircleYRadius: 300,
                },
                customDomainIdsOrder:  {
                    classical_domain: -100,
                    quantum_domain: 100,
                },
                useCodeShortNamesForLabels: false, //true,
                alwaysSkipCoseLayout: false, // can set this to true to debug prelayouts.
                overrideCoseLayoutOptions: null, // specify dict to override individual layout options for fcose
            },
            graphGlobalOptions
        );

        debug(`EczCodeGraph(): using graphGlobalOptions = ${
                JSON.stringify(this.graphGlobalOptions, undefined, 4) }`);

        // whether we should update the layout at the next opportunity.
        this._pendingUpdateLayout = false;

        // computed when the graph is initialized
        this.globalGraphRootNodesInfo = null;
    }

    // --------------------------------

    async initialize()
    {
        debug('EczCodeGraph initialize()');

        await this.initGraph();

        debug(`EczCodeGraph initialize() done.  Don't forget to install a subgraph selector, `
              + `for instance, via a EczCodeGraphViewController instance.`);
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

    setGraphFilterOptions(filterOptionsDict, { skipGraphFilterApplyUpdates }={})
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
            if (!skipGraphFilterApplyUpdates) {
                graphFilter.applyFilter({ eles });
            }
        }
    }

    _unapplyGraphFilters({ eles }={})
    {
        eles ??= this.cy.elements('.layoutVisible');
        for (const { graphFilterName_, graphFilter } of this.graphFilters) {
            debug(`removeFilter for`, graphFilter);
            graphFilter.removeFilter({ eles });
        }
    }
    _applyGraphFilters({ eles }={})
    {
        eles ??= this.cy.elements('.layoutVisible');
        for (const { graphFilterName_, graphFilter } of this.graphFilters) {
            graphFilter.applyFilter({ eles });
        }
    }

    // --------------------------------

    installSubgraphSelector(subgraphSelector, { skipGraphFilterUpdates }={})
    {
        debug(`installSubgraphSelector()`, { subgraphSelector });

        // clean the graph from any display filters
        if (!skipGraphFilterUpdates) {
            this._unapplyGraphFilters();
        }

        EczCodeGraphSubgraphSelector.clear(this);

        if (this.subgraphSelector != null) {
            // clean up any custom classes set by this subgraph selector.
            this.subgraphSelector.uninstallSubgraph();
        }

        this.subgraphSelector = subgraphSelector;
        const resultInfo = this.subgraphSelector.installSubgraph();
        const { pendingUpdateLayout } = resultInfo ?? {};

        debug(
            `installSubgraphSelector(): applied subgraph selection. # of visible nodes = `,
            this.cy.nodes('.layoutVisible').length
        );

        if (!skipGraphFilterUpdates) {
            this._applyGraphFilters();
        }

        if (pendingUpdateLayout ?? true) {
            // request new layout calculation with new subgraph selector.
            this._setPendingUpdateLayout();
        }
    }

    setSubgraphSelectorOptions(options)
    {
        if (this.subgraphSelector == null) {
            throw new Error(`Can't set subgraph selector options, none set`);
        }

        // clean the graph from any display filters
        this._unapplyGraphFilters();

        const resultInfo = this.subgraphSelector.setOptions(options);
        const { pendingUpdateLayout } = resultInfo ?? {};

        if (pendingUpdateLayout ?? true) {
            this._setPendingUpdateLayout();
        }

        this._applyGraphFilters();
    }

    // --------------------------------

    updateSubgraphSelectorAndSetGraphFilterOptions(
        subgraphSelector, subgraphSelectorOptions, filterOptionsDict
    )
    {
        debug(`updateSubgraphSelectorAndSetGraphFilterOptions()`);

        if (subgraphSelector === this.subgraphSelector
            && loIsEqual(subgraphSelectorOptions, this.subgraphSelector.options)
            && loIsEqual(filterOptionsDict, Object.fromEntries(
                this.graphFilters.map(
                    ({ graphFilterName, graphFilter }) =>
                        [graphFilterName, graphFilter.filterOptions]
                )
            ))) {
            debug(`... unchanged options, return early`);
            return;
        }

        this._unapplyGraphFilters();

        let subgraphSelectorReturnInfo = { pendingUpdateLayout: false };
        if (this.subgraphSelector !== subgraphSelector) {
            subgraphSelector.setOptions(subgraphSelectorOptions);
            subgraphSelectorReturnInfo = this.installSubgraphSelector(
                subgraphSelector,
                { skipGraphFilterUpdates: true }
            );
        } else {
            // simply set options to the subgraphSelector.
            // NB: The setOptions() method should make sure the options are
            // different before taking computationally-intensive action!
            subgraphSelectorReturnInfo =
                this.subgraphSelector.setOptions(subgraphSelectorOptions);
        }
        subgraphSelectorReturnInfo ??= {};

        this.setGraphFilterOptions(filterOptionsDict, { skipGraphFilterApplyUpdates: true });

        this._applyGraphFilters();

        if (subgraphSelectorReturnInfo.pendingUpdateLayout ?? true) {
            // request new layout calculation with new subgraph selector.
            this._setPendingUpdateLayout();
        }

        debug(`updateSubgraphSelectorAndSetGraphFilterOptions() done.`);
    }

    // --------------------------------

    isPendingUpdateLayout()
    {
        return this._pendingUpdateLayout;
    }

    _setPendingUpdateLayout(pendingUpdateLayout)
    {
        pendingUpdateLayout ??= true;
        this._pendingUpdateLayout = pendingUpdateLayout;
    }

    // --------------------------------
    
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
                !(code.relations?.parents?.length)
                && !(code.relations?.root_for_kingdom)
                && !(code.relations?.root_for_kingdom?.length)
                && !(code.relations?.root_for_domain)
                && !(code.relations?.root_for_domain?.length)
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

        if (this.graphGlobalOptions.alwaysSkipCoseLayout) {
            skipCoseLayout = true;
        }

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

        const nodeIdsInLayout = this.cy.nodes('.layoutVisible').map( (n) => n.id() );
        const rootNodeIds = this.cy.nodes('.layoutRoot.layoutVisible').map( (n) => n.id() );

        debug(
            `updateLayout(): ${nodeIdsInLayout.length} nodes participate in the layout `
            + `(.layoutVisible):`, nodeIdsInLayout, `; and ${rootNodeIds.length} nodes are `
            + `listed as 'root' nodes (.layoutRoot.layoutVisible):`, rootNodeIds
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

        if (shouldApplyPrelayout || shouldApplyCoseLayout) {
            // invalidate any currently laid out nodes
            this.cy.elements().removeClass('_layoutPositioned');
        }

        if (shouldApplyPrelayout) {
            debug(`Running prelayout ...`);
            await this._runPrelayout({ rootNodeIds });
        }

        if (shouldApplyCoseLayout) {
            debug(`Running fcose layout ...`);
            await this._runCoseLayout({ rootNodeIds, animate });
        }

        this.cy.nodes('.layoutVisible').addClass('_layoutPositioned');

        debug(`updateLayout() done!`);
    }

    async _runPrelayout({ rootNodeIds })
    {
        // compute an initial position of the nodes to reflect the tree
        // structure of the codes

        debug(`_runPrelayout(): Using rootNodeIds =`, rootNodeIds);

        let prelayout = this.subgraphSelector.createPrelayoutInstance({ rootNodeIds });

        let layoutVisibleNodes = this.cy.elements('.layoutVisible');

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
            layoutVisibleNodes
                .edges( (edge) => (edge.target().is('.prelayoutPositioned')
                                   && edge.source().is('.prelayoutPositioned')) )
                .addClass('prelayoutPositioned');
            
            // anything that is not marked but visible is probably a bug; mark it
            // visually so we can debug that
            layoutVisibleNodes.not('.prelayoutPositioned').addClass('prelayoutOutOfLayoutTree');
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

        let layoutOptions = {
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
        if (this.graphGlobalOptions.overrideCoseLayoutOptions != null) {
            layoutOptions =
                loMerge(layoutOptions, this.graphGlobalOptions.overrideCoseLayoutOptions);
        }

        let p = new Promise( (resolve) => {
            debug('in promise - creating and running layout');
            let layout = this.cy
                // .elements('node, edge[_primaryParent=1]').not('[display="none"]')
                .elements( (el) => (
                    el.visible() && (el.isNode() || el.is('.layoutParent'))
                ) )
                .layout(layoutOptions);
            layout.on('layoutstop', () => {
                debug(`in promise - layoutstop event received, resolving promise.`);
                resolve();
            });
            debug('in promise - running layout');
            layout.run();
            debug('in promise - ran layout');
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

        const nodeLabelsByNodeId = {};

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

            nodeLabelsByNodeId[thisDomainNodeId] = thisDomainLabel;

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

                nodeLabelsByNodeId[thisKingdomNodeId] = label;

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

            const codeName = contentToText(code.name);
            const codeShortName = contentToText(this.eczoodb.code_short_name(code));

            const label = contentToNodeLabel(
                this.graphGlobalOptions.useCodeShortNamesForLabels ? codeShortName : codeName
            );

            const thisCodeNodeId = this.getNodeIdCode(codeId);

            nodeLabelsByNodeId[thisCodeNodeId] = label;

            let nodeData = {
                id: thisCodeNodeId,
                label: label,
                _codeId: codeId,
                _isCode: 1,
                _objectName: codeName,
                _codeShortName: codeShortName,
            };

            // debug(`Searching for ${codeId}'s primary-parent root code`);

            const primaryParentRootCodeInfo =
                this.eczoodb.code_get_primary_parent_root(
                    code,
                    { include_domain_kingdom_root_info: true }
                );
            const primaryParentRootCode =
                primaryParentRootCodeInfo.primary_parent_root_code;

            const parentDomain = primaryParentRootCodeInfo.parent_domain;
            const parentKingdom = primaryParentRootCodeInfo.parent_kingdom;
            const isDomainRootCode = primaryParentRootCodeInfo.is_domain_root_code;
            const isKingdomRootCode = primaryParentRootCodeInfo.is_kingdom_root_code;
            const isPropertyCode = (parentKingdom == null) ;

            if (parentDomain != null) {
                const parentDomainId = parentDomain.domain_id;
                if (isDomainRootCode) {
                    Object.assign(nodeData, {
                        _isDomainRootCode: 1,
                    });
                }
                Object.assign(nodeData, {
                    _parentDomainId: parentDomainId,
                })
            }
            if (parentKingdom != null) {
                const parentKingdomRootCodeId = primaryParentRootCode.code_id;
                const parentKingdomId = parentKingdom.kingdom_id;
                if (isKingdomRootCode) {
                    Object.assign(nodeData, {
                        _isKingdomRootCode: 1,
                    });
                }
                Object.assign(nodeData, {
                    _hasParentKingdom: 1,
                    _parentKingdomRootCodeId: parentKingdomRootCodeId,
                    _parentKingdomId: parentKingdomId,
                });
            }
            if (parentKingdom == null) {
                Object.assign(nodeData, {
                    _hasParentKingdom: 0,
                });
            }
            if (isPropertyCode) {
                Object.assign(nodeData, {
                    _isPropertyCode: 1,
                });
            }

            nodes.push({
                data: nodeData,
            });

            // if this code is a domain root code, add an edge to the domain node.
            if (isDomainRootCode) {
                edges.push({
                    data: {
                        _relType: 'parent',
                        _primaryParent: 1,
                        source: thisCodeNodeId,
                        target: this.getNodeIdDomain(parentDomain.domain_id),
                    }
                });
            }
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
                let relationInstances = code.relations?.[relationType + 's'];
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
                        if (j === 0 && !isDomainRootCode && !isKingdomRootCode) {
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

        // add source_label and target_label to all edge infos:
        for (const edgeData of edges) {
            edgeData.data.source_label = nodeLabelsByNodeId[edgeData.data.source];
            edgeData.data.target_label = nodeLabelsByNodeId[edgeData.data.target];
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

        debug(`About to initialize cytoscape graph w/ ${nodes.length} nodes & ${edges.length} edges`);

        // create the cytoscape object
        this.cy = cytoscape(cytoscapeConfig);

        // compute positions of root nodes in our default global layout
        this._initGlobalGraphRootNodesInfo();

        debug("EczCodeGraph: initGraph() done");
    }

    //
    // Find out where to position the graph root nodes
    //
    _initGlobalGraphRootNodesInfo()
    {
        const {
            rootPositioning,
            customDomainIdsOrder
        } = this.graphGlobalOptions;
        
        let rootNodesPrelayoutInfo = {};
        let domainIds = [ ... Object.keys(this.eczoodb.objects.domain) ];

        debug(`Domains before custom ordering: ${domainIds}`);

        domainIds.sort(
            (aId, bId) => (customDomainIdsOrder[aId] ?? 0) - (customDomainIdsOrder[bId] ?? 0)
        );
        debug(`Domains after custom ordering: ${domainIds}`);

        let rootCodeNodeIds = this.getOverallRootNodeIds({ includeDomains: false });

        // this._positionRootNodes_domainsBelow_propertyCodesAbove(
        //     rootNodesPrelayoutInfo,
        //     domainIds,
        //     rootCodeNodeIds,
        //     rootPositioning,
        // )
        this._positionRootNodes_allAround(
            rootNodesPrelayoutInfo,
            domainIds,
            rootCodeNodeIds,
            rootPositioning,
        )

        this.globalGraphRootNodesInfo = {
            radialPrelayoutRootNodesPrelayoutInfo: rootNodesPrelayoutInfo,
            rootNodeIds: Object.keys(rootNodesPrelayoutInfo),
        };

        debug(`globalGraphRootNodesInfo = `, this.globalGraphRootNodesInfo);
    }


    // _positionRootNodes_domainsBelow_propertyCodesAbove(
    //     rootNodesPrelayoutInfo,
    //     domainIds,
    //     rootCodeNodeIds,
    //     rootPositioning,
    // )
    // {
    //     const {
    //         rootAbstractCodesXSpacing,
    //         rootAbstractCodesYPosition,
    //         rootAbstractCodesYPositionSingleOffset,
    //         domainNodesXSpacing,
    //         domainNodesYPosition,
    //         domainNodesYPositionSingleOffset,
    //     } = rootPositioning;

    //     for (const [j, domainId] of domainIds.entries()) {
    //         const nodeId = this.getNodeIdDomain(domainId);
    //         rootNodesPrelayoutInfo[nodeId] = {
    //             position: {
    //                 x: (j - (domainIds.length-1)/2) * domainNodesXSpacing,
    //                 y: domainNodesYPosition
    //                    + Math.min(j, domainIds.length-1-j) * domainNodesYPositionSingleOffset
    //             },
    //             radiusOffset: 50,
    //             direction: Math.PI - Math.PI * (j+0.5) / domainIds.length,
    //             angularSpread: Math.PI / domainIds.length,
    //         };
    //     }
    //     // these are abstract property codes:
    //     //debug(`rootCodeNodeIds = `, rootCodeNodeIds);
    //     for (const [j, codeNodeId] of rootCodeNodeIds.entries()) {
    //         rootNodesPrelayoutInfo[codeNodeId] = {
    //             position: {
    //                 x: (j - (rootCodeNodeIds.length-1)/2) * rootAbstractCodesXSpacing,
    //                 y: rootAbstractCodesYPosition
    //                    - Math.min(j, rootCodeNodeIds.length-1-j) * rootAbstractCodesYPositionSingleOffset
    //             },
    //             radiusOffset: 50,
    //             direction: Math.PI + Math.PI * (j+0.5) / rootCodeNodeIds.length,
    //             angularSpread: Math.PI / rootCodeNodeIds.length,
    //         };
    //     }
    // }

    _positionRootNodes_allAround(
        rootNodesPrelayoutInfo,
        domainIds,
        rootCodeNodeIds,
        rootPositioning,
    )
    {
        const {
            rootNodesCircleXRadius,
            rootNodesCircleYRadius,
        } = rootPositioning;

        let numDomains = domainIds.length;
        let numPropertyCodes = rootCodeNodeIds.length;
        let numTotal = numDomains + numPropertyCodes;

        let startAngle = - Math.PI / 2.0 + 1.0 * (numPropertyCodes-1) / (numTotal-1);

        let domainNodeIds = domainIds.map( (domainId) => this.getNodeIdDomain(domainId) );
        domainNodeIds.reverse()

        let rootNodeIds = [
            ... rootCodeNodeIds,
            ... domainNodeIds,
        ];

        for (const [j, nodeId] of rootNodeIds.entries()) {
            const a = startAngle + 2*Math.PI * j / numTotal;
            rootNodesPrelayoutInfo[nodeId] = {
                position: {
                    x: rootNodesCircleXRadius * Math.cos(a),
                    y: rootNodesCircleYRadius * Math.sin(a),
                },
                radiusOffset: 200,
                direction: a,
                angularSpread: 2*Math.PI / numTotal,
                // if we have property and non-property child codes, sort
                // them first or last?
                propertyCodesSortOrder: Math.cos(a) > 0 ? +1 : -1,
            };
        }
    }
}