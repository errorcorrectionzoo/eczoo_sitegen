
import { cyStyleNumDomainColors } from './style.js';

import loMerge from 'lodash/merge.js';

// for: search highlights, dim nodes, domain coloring, etc.
export class EczCodeGraphFilter
{
    constructor(eczCodeGraph, filterOptions=null)
    {
        this.eczCodeGraph = eczCodeGraph;
        this.cy = eczCodeGraph.cy;
        this.filterOptions = Object.assign({}, filterOptions);
        this.mergeResetFilterOptions = {};
    }
    /**
     * Set the filter options.  This is an object whose keys and values are
     * solely understood and used by the relevant filter subclass.  Newly
     * given filter options are merged with existing filter options.
     * 
     * To avoid merging some filter option properties, subclasses may
     * initialize `this.mergeResetFilterOptions = { propertyName: null }` in
     * their constructor to inhibit merging the property `propertyName`.
     * These properties are set to `null` if they are not specified in the
     * new `filterOptions`.  Internally, this method applies
     * `_.merge(this.filterOptions, this.mergeResetFilterOptions, filterOptions)`.
     * 
     */
    setFilterOptions(filterOptions)
    {
        this.filterOptions = loMerge(
            this.filterOptions,
            this.mergeResetFilterOptions,
            filterOptions
        );
    }
    /**
     * Set any style classes relevant for this display filter.  Do not assume any current
     * state for style classes.
     */
    applyFilter(/* { eles } */)
    {
    }
    /**
     * Remove any trace from the graph that this filter might have been applied in the past.
     */
    removeFilter(/* { eles } */)
    {
    }
}



export class EczCodeGraphFilterDomainColors extends EczCodeGraphFilter
{
    constructor(eczCodeGraph)
    {
        super(eczCodeGraph);
        this.domainColorIndexByDomainId = {};

        let domainColorIndexCounter = 0;
        for (const domainId of Object.keys(this.eczoodb.objects.domain)) {

            const thisDomainColorIndex = domainColorIndexCounter;
            this.domainColorIndexByDomainId[domainId] = thisDomainColorIndex;

            domainColorIndexCounter =
                (domainColorIndexCounter + 1) % cyStyleNumDomainColors;
        }
    }
    applyFilter({ eles })
    {
        eles.nodes().forEach( (node) => {
            const domainId = node.data('_domainId');
            const parentDomainId = node.data('_parentDomainId');
            if (domainId) {
                node.data('_domainColorId', this.domainColorIndexByDomainId[domainId]);
            } else if (parentDomainId) {
                node.data('_domainColorId', this.domainColorIndexByDomainId[parentDomainId]);
            } else {
                node.removeData('_domainColorId');
            }
        });
    }
    removeFilter({ eles })
    {
        eles.nodes().removeData('_domainColorId');
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

        matchEles.addClass('searchMatchHighlight');
        eles.not('.searchMatchHighlight').addClass('searchNoMatchDimmed');
    }
    removeFilter({ eles })
    {
        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);
    }
}

