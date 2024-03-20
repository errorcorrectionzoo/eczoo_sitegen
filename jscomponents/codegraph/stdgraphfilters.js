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




export class EczCodeGraphFilterSearchHighlight extends EczCodeGraphFilter
{
    applyFilter({ eles })
    {
        const searchText = this.filterOptions.searchText;

        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);

        const textEsc = JSON.stringify(searchText);
        const matchEles = eles.nodes(
            `[label @*= ${textEsc}], [_objectName @*= ${textEsc}]`
        );

        debug(`Applying search graph filter for ${JSON.stringify(searchText)}; `
              + `matched ${matchEles.length} node elements`);

        matchEles.addClass('searchMatchHighlight');
        eles.not('.searchMatchHighlight').addClass('searchNoMatchDimmed');
    }
    removeFilter({ eles })
    {
        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);
    }
}

