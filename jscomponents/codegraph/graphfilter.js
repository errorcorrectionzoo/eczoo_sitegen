// import debug_module from 'debug';
// const debug = debug_module('eczoo_jscomponents.codegraph.graphfilter');

//import loMerge from 'lodash/merge.js';

// for: search highlights, dim nodes, domain coloring, etc.
export class EczCodeGraphFilter
{
    constructor(eczCodeGraph, filterOptions=null)
    {
        this.eczCodeGraph = eczCodeGraph;
        this.eczoodb = eczCodeGraph.eczoodb;
        this.cy = eczCodeGraph.cy;
        this.filterOptions = Object.assign({}, filterOptions);
    }
    /**
     * Set the filter options.  This is an object whose keys and values are
     * solely understood and used by the relevant filter subclass.  Newly
     * given filter options are merged with existing filter options in a very
     * crude way by using `Object.assign()` (does not recurse into
     * subproperties).
     * 
     * WARNING: This method should ONLY BE CALLED BY THE ECZCODEGRAPH instance.
     * If you want to change the options for a given graph filter, you should
     * use the method `eczCodeGraph.setGraphFilterOptions(...)` to ensure that
     * the options are correclty applied and the corresponding changes are
     * propagated through the graph.
     * 
     * Reimplement this method if you'd like finer control over how properties
     * are merged.
     */
    setFilterOptions(filterOptions)
    {
        this.filterOptions = Object.assign(
            {},
            this.filterOptions,
            filterOptions
        );
    }
    /**
     * Set any style classes relevant for this display filter.  Do not assume any current
     * state for style classes.
     * 
     * Basically, the only way the filter can interact with the display is by setting
     * filter-specific style classes.  To hide elements, define a filter-specific class
     * and associate to it a class style that has a style declaration 'display: none'.
     * 
     * Do NOT set classes 'hidden' or 'layoutXyz' (such as 'layoutVisible').
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
