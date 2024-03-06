
import { cyStyleNumDomainColors } from './style.js';


// for: search highlights, dim nodes, domain coloring, etc.
export class EczCodeGraphFilter
{
    constructor(eczCodeGraph)
    {
        this.eczCodeGraph = eczCodeGraph;
        this.cy = eczCodeGraph.cy;
    }
    applyFilter(/* { eles } */)
    {
    }
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
    constructor(eczCodeGraph, { searchText })
    {
        super(eczCodeGraph);
        this.searchText = searchText;
    }
    applyFilter({ eles })
    {
        eles.removeClass(['searchMatchHighlight', 'searchNoMatchDimmed']);

        const textEsc = JSON.stringify(this.searchText);
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

