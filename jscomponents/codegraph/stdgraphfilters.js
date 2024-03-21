import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.stdgraphfilters');

import { EczCodeGraphFilter } from './graphfilter.js';
import { cyStyleNumDomainColors } from './style.js';


export class EczCodeGraphFilterDomainColors extends EczCodeGraphFilter
{
    constructor(eczCodeGraph, filterOptions)
    {
        super(eczCodeGraph, Object.assign({ enabled: true }, filterOptions ?? {}));
        this.domainColorIndexByDomainId = {};

        let domainColorIndexCounter = 0;
        for (const domainId of Object.keys(this.eczoodb.objects.domain)) {

            const thisDomainColorIndex = domainColorIndexCounter;
            this.domainColorIndexByDomainId[domainId] = thisDomainColorIndex;

            domainColorIndexCounter = parseInt(
                (domainColorIndexCounter + 1) % cyStyleNumDomainColors
            );
        }
        debug(`Got domain color indexes for domain id's:`, this.domainColorIndexByDomainId);
    }
    applyFilter({ eles })
    {
        if (!this.filterOptions.enabled) {
            // ensure all coloring is removed
            this.removeFilter({ eles });
            return;
        }
        this.cy.batch( () => {
            eles.nodes().forEach( (node) => {
                const domainId = node.data('_domainId');
                const parentDomainId = node.data('_parentDomainId');
                if (domainId) {
                    node.data('_domainColorIndex', this.domainColorIndexByDomainId[domainId]);
                    node.addClass('useDomainColors');
                } else if (parentDomainId) {
                    node.data('_domainColorIndex', this.domainColorIndexByDomainId[parentDomainId]);
                    node.addClass('useDomainColors');
                } else {
                    node.removeData('_domainColorIndex');
                }
            });
        } );
    }
    removeFilter({ eles })
    {
        eles.removeClass('useDomainColors');
        eles.removeData('_domainColorId');
    }
}

export class EczCodeGraphFilterHideSecondaryEdges extends EczCodeGraphFilter
{
    constructor(eczCodeGraph, filterOptions)
    {
        super(eczCodeGraph, Object.assign({
            cousinEdgesShown: false,
            secondaryParentEdgesShown: false,
        }, filterOptions ?? {}));
    }
    applyFilter({ eles })
    {
        this.cy.batch( () => {
            eles.edges().forEach( (edge) => {
                const { _primaryParent: primaryParent, _relType: relType } = edge.data();
                // 1) never hide an edge that serves as a layout-parent (it would make the graph
                //    disconnected and it's confusing to see
                // 2) hide edge if it is a secondary parent relation and if we want to hide such edges
                // 3) hide edge if it is a cousin relation and if we want to hide such edges
                const hidden = !edge.hasClass('layoutParent') && (
                    (primaryParent === 0 && !this.filterOptions.secondaryParentEdgesShown)
                    || (relType === 'cousin' && !this.filterOptions.cousinEdgesShown)
                );
                edge.toggleClass('hiddenSecondaryEdge', hidden);
            });
        } );
    }
    removeFilter({ eles })
    {
        eles.edges().removeClass('hiddenSecondaryEdge');
    }
}


export class EczCodeGraphFilterHighlightImportantNodes extends EczCodeGraphFilter
{
    constructor(eczCodeGraph, filterOptions)
    {
        super(eczCodeGraph, Object.assign({
            highlightImportantNodes: true,
            degreeThreshold: 8,
            highlightPrimaryParents: true,
        }, filterOptions ?? {}));
    }
    applyFilter({ eles })
    {
        const {
            highlightImportantNodes,
            degreeThreshold,
            highlightPrimaryParents,
        } = this.filterOptions;
        this.cy.batch( () => {
            if (highlightImportantNodes) {
                eles.nodes().forEach( (node) => {
                    const isImportantNode =
                        (node.data('_isKingdom') === 1)
                        || (node.data('_isDomain') === 1)
                        || (node.degree() > degreeThreshold);
                    node.toggleClass('importantNode', isImportantNode);
                    node.toggleClass('notImportantNode', !isImportantNode);
                });
            }
            eles.edges().toggleClass('enableHighlightPrimaryParents', highlightPrimaryParents);
        } );
    }
    removeFilter({ eles })
    {
        eles.removeClass(['importantNode', 'enableHighlightPrimaryParents']);
    }
}


export class EczCodeGraphFilterSearchHighlight extends EczCodeGraphFilter
{
    applyFilter({ eles })
    {
        const searchText = this.filterOptions.searchText || '';

        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);

        if (searchText === '') {
            // all good, no search to perform
            return;
        }

        const textEsc = JSON.stringify(searchText);
        const matchEles = eles.nodes(
            `[label @*= ${textEsc}], [_objectName @*= ${textEsc}]`
        );

        debug(`Applying search graph filter for ${JSON.stringify(searchText)}; `
              + `matched ${matchEles.length} node elements`);

        matchEles.addClass('searchMatchHighlight');
        
        // also, move the view to highligh the search matches
        const cy = this.cy;
        cy.stop();
        cy.animate({
            fit: {
                eles: matchEles,
            },
            duration: 80,
        });

        eles.not('.searchMatchHighlight').addClass('searchNoMatchDimmed');
    }
    removeFilter({ eles })
    {
        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);
    }
}

