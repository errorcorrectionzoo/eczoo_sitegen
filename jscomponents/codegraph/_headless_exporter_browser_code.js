//
// PUPPETEER IN-BROWSER CODE
//

console.log(`Executing in-browser code now`);

function isStrict() { return !this; }
if (!isStrict()) {
    console.error(`Not strict mode!`);
    throw new Error(`Not strict mode!`);
}

// -----

import debugm from 'debug'; const debug = debugm('_headless_exporter_browser_code');

import loMerge from 'lodash/merge.js';

import { load_eczoodb_from_data } from './setup_eczoodb.js';

import { EczCodeGraph } from './index.js';
import { EczCodeGraphViewController } from './eczcodegraphviewcontroller.js';
import { PrelayoutRadialTree } from './prelayout.js';
import { getCyStyleJson } from './style.js';

import cytoscape from 'cytoscape';
import cySvg from 'cytoscape-svg';
cytoscape.use( cySvg );


//
// The zoo, loaded once from the data dump `window.eczoodbData` (which the
// Node-side exporter's loadEcZooDbData() sets) and shared by all the graphs.
// The promise is memoized, so that concurrent first calls share it; it is
// loaded again when `window.eczoodbData` is set to another object.  The graph
// code only reads the zoo.
//
let _eczoodbPromise = null;
let _eczoodbPromiseData = null;

function _getLoadedEcZooDb()
{
    const eczoodbData = window.eczoodbData;
    if (!eczoodbData) {
        throw new Error(
            "Missing eczoodbData. Did you forget to call loadEcZooDbData() on your "
            + "CodeGraphSvgExporter instance?"
        );
    }
    if (_eczoodbPromise == null || _eczoodbPromiseData !== eczoodbData) {
        debug(`Loading the zoo from the data dump ...`);
        const promise = load_eczoodb_from_data(eczoodbData);
        _eczoodbPromise = promise;
        _eczoodbPromiseData = eczoodbData;
        // a failed load is not memoized: the next call tries again
        promise.catch( () => {
            if (_eczoodbPromise === promise) {
                _eczoodbPromise = null;
                _eczoodbPromiseData = null;
            }
        } );
    }
    return _eczoodbPromise;
}


//
// The prepared graphs, by handle: built, with the subgraph selection and the
// graph filters applied, but neither mounted nor laid out.  Compiling or
// releasing a graph removes it from this map and destroys its cytoscape
// instance (and its DOM node).
//
const _preparedGraphs = new Map();
let _nextPreparedGraphHandle = 1;


// A JSON copy of `value` with the keys of its objects sorted (recursively),
// so that the same value always gives the same JSON text.
function _canonicalJsonValue(value)
{
    const sortKeys = (v) => {
        if (Array.isArray(v)) {
            return v.map(sortKeys);
        }
        if (v !== null && typeof v === 'object') {
            return Object.fromEntries(
                Object.keys(v).sort().map( (k) => [k, sortKeys(v[k])] )
            );
        }
        return v;
    };
    const json = JSON.stringify(value);
    if (json === undefined) {
        return null;
    }
    return sortKeys(JSON.parse(json));
}

function _elementKeyData(ele)
{
    let data = Object.assign({}, ele.data());
    if (ele.isEdge()) {
        // cytoscape's automatic edge ids are not stable
        delete data.id;
    }
    return {
        data: _canonicalJsonValue(data),
        classes: ele.classes().slice().sort(),
    };
}


// Widths of a sample text in the label font of the graph, in its four
// variants (normal / italic, normal / bold weight), as the browser measures
// them: the layout (labels are included in the node dimensions, and the
// post-layout pushes overlapping labels apart) depends on the font that the
// browser uses for the labels.
const _fontMetricsSampleText =
    "The quick brown fox jumps over the lazy dog. 0123456789 ()[]{}<>-+=/,;:'\"!?&%"
    + " ÄÖÜäöüéèàçñ αβγδεθλμπρστφχψω ΓΔΘΛΠΣΦΨΩ ⊗⊕→∞≤≥";

function _labelFontMetrics(cyStyleOptions)
{
    const styleJson = getCyStyleJson(Object.assign(
        { matchWebPageFonts: false, window: window },
        cyStyleOptions
    ));
    const fontFamily = (
        styleJson.find( (s) => s.selector === '*' )?.style?.['font-family']
        // cytoscape's default font family
        ?? 'Helvetica Neue, Helvetica, sans-serif'
    );
    const canvas = window.document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let widths = {};
    for (const fontStyle of ['normal', 'italic']) {
        for (const fontWeight of ['normal', 'bold']) {
            ctx.font = `${fontStyle} ${fontWeight} 100px ${fontFamily}`;
            widths[`${fontStyle} ${fontWeight}`] = ctx.measureText(_fontMetricsSampleText).width;
        }
    }
    return { fontFamily, widths };
}


//
// Everything that the layout and the SVG export of a prepared graph depend on,
// besides the code itself: computed from the graph's subgraph selection and
// filters, without any layout.  It is a JSON-serializable value, always the
// same for the same graph (sorted keys, no cytoscape edge ids).
//
// What is read, and by whom (keep this in sync with the graph code):
//
// - The elements: the nodes and edges that have the class `layoutVisible`,
//   and the end nodes of those edges, with their data and their classes (the
//   style, the prelayout, the fcose layout -- which runs on the visible nodes
//   and the visible `layoutParent` edges --, the post-layout and the SVG
//   export).  They are listed in the graph's order (the order in which the
//   elements were added), which the prelayout (order of the edges of a node,
//   of the root nodes), the fcose layout and the SVG export (drawing order)
//   depend on.  When the post-layout pulls nodes together
//   (`globalLayoutOptions.pullNodesTogether`), it also reads the hidden edges
//   between visible nodes: they are then included too.
//
// - The layout: the merged global graph options, the subgraph selector's
//   layout options, the root nodes (`.layoutRoot.layoutVisible`), the
//   prelayout's options and the prelayout information of each root node (for
//   instance, the global root positioning computed by
//   EczCodeGraph._initGlobalGraphRootNodesInfo(), which the isolate mode
//   uses).
//
// - The options of the call (display options, graph global options, layout,
//   style and SVG options, fitWidth, importSourceSansFonts).
//
// - The environment: the browser's user agent and exact version, its device
//   pixel ratio (the SVG export's scale) and the widths of a sample text in
//   the label font.
//
function _computeGraphKeyData(prepared)
{
    const { eczCodeGraph } = prepared;
    const cy = eczCodeGraph.cy;

    const globalLayoutOptions = eczCodeGraph.graphGlobalOptions.globalLayoutOptions ?? {};
    const includeHiddenEdgesBetweenVisibleNodes =
        !! (globalLayoutOptions.pullNodesTogether?.enabled ?? false);

    const keyEdges = cy.edges().filter( (edge) => (
        edge.hasClass('layoutVisible')
        || (includeHiddenEdgesBetweenVisibleNodes
            && edge.source().hasClass('layoutVisible')
            && edge.target().hasClass('layoutVisible'))
    ) );
    const keyNodeIds = new Set();
    cy.nodes('.layoutVisible').forEach( (node) => { keyNodeIds.add(node.id()); } );
    keyEdges.forEach( (edge) => {
        keyNodeIds.add(edge.source().id());
        keyNodeIds.add(edge.target().id());
    } );
    const keyNodes = cy.nodes().filter( (node) => keyNodeIds.has(node.id()) );

    // what the prelayout reads (see EczCodeGraph._runPrelayout())
    const subgraphSelector = eczCodeGraph.subgraphSelector;
    const rootNodeIds = cy.nodes('.layoutRoot.layoutVisible').map( (n) => n.id() );
    const prelayout = subgraphSelector.createPrelayoutInstance({ rootNodeIds });
    if (!(prelayout instanceof PrelayoutRadialTree)) {
        throw new Error(
            `The graph's key data does not know what this prelayout reads; please update `
            + `_computeGraphKeyData() in _headless_exporter_browser_code.js`
        );
    }
    const rootNodesPrelayoutInfo = Object.fromEntries(
        rootNodeIds.map( (nodeId) => [
            nodeId, prelayout.rootNodesPrelayoutInfo?.[nodeId] ?? null
        ] )
    );

    return _canonicalJsonValue({
        graph: {
            nodes: keyNodes.map(_elementKeyData),
            edges: keyEdges.map(_elementKeyData),
        },
        layout: {
            graphGlobalOptions: eczCodeGraph.graphGlobalOptions,
            subgraphLayoutOptions: subgraphSelector.getSubgraphLayoutOptions(),
            rootNodeIds,
            rootNodesPrelayoutInfo,
            prelayoutOptions: prelayout.prelayoutOptions,
        },
    });
}

// The browser's exact version (the user agent string only gives the major
// version), memoized.  (Not the operating system's version, which changes
// often and which the label font metrics below cover.)
let _browserVersionInfoPromise = null;
function _getBrowserVersionInfo()
{
    _browserVersionInfoPromise ??= (async () => {
        let info = { userAgent: window.navigator.userAgent };
        try {
            const highEntropyValues = await window.navigator.userAgentData
                ?.getHighEntropyValues(['fullVersionList', 'architecture']);
            if (highEntropyValues != null) {
                info.userAgentData = highEntropyValues;
            }
        } catch (err) {
            console.warn(`Cannot get the browser's version information: `, err);
        }
        return _canonicalJsonValue(info);
    })();
    return _browserVersionInfoPromise;
}

async function _computeKeyData({ options, graphKeyData })
{
    return _canonicalJsonValue({
        options,
        ...graphKeyData,
        environment: {
            browser: await _getBrowserVersionInfo(),
            devicePixelRatio: window.devicePixelRatio,
            labelFontMetrics: _labelFontMetrics(options.cyStyleOptions),
        },
    });
}


function _destroyPreparedGraph(prepared)
{
    try {
        prepared.eczCodeGraph.cy?.destroy();
    } finally {
        if (prepared.domNode != null) {
            prepared.domNode.remove();
            prepared.domNode = null;
        }
    }
}


//
// Builds the code graph and its view controller with the display options,
// which applies the subgraph selection and the graph filters (no mount, no
// layout).  Returns `{ handle, keyData }`.
//
// Options: { graphGlobalOptions, displayOptions, updateLayoutOptions,
// cyStyleOptions, svgOptions, fitWidth, importSourceSansFonts } (the last two
// are applied by the Node side, they are only part of the key data here).
//
async function _prepareCodeGraph(options)
{
    debug('prepareCodeGraph(): options = ', JSON.stringify(options));

    options ??= {};
    const { graphGlobalOptions, displayOptions } = options;
    // a copy of the options for the key data (the graph code is given the
    // options themselves)
    const keyDataOptions = _canonicalJsonValue(options);

    const eczoodb = await _getLoadedEcZooDb();

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
        graphGlobalOptions,
    });

    await eczCodeGraph.initialize();

    let prepared = { options, eczCodeGraph, eczCodeGraphViewController: null, domNode: null };

    try {
        let eczCodeGraphViewController =
            new EczCodeGraphViewController(eczCodeGraph, displayOptions);

        await eczCodeGraphViewController.initialize();

        prepared.eczCodeGraphViewController = eczCodeGraphViewController;

        debug(`Code graph loaded.`);

        const graphKeyData = _computeGraphKeyData(prepared);
        prepared.graphKeyDataJson = JSON.stringify(graphKeyData);
        prepared.keyData = await _computeKeyData({ options: keyDataOptions, graphKeyData });

    } catch (err) {
        _destroyPreparedGraph(prepared);
        throw err;
    }

    const handle = _nextPreparedGraphHandle++;
    _preparedGraphs.set(handle, prepared);

    return { handle, keyData: prepared.keyData };
}


//
// Mounts a prepared graph in the DOM, sets its display options, lays it out,
// fits it and exports it to SVG; then destroys it.  Returns `{ svgData }`.
//
async function _compilePreparedCodeGraph(handle)
{
    const prepared = _preparedGraphs.get(handle);
    if (prepared == null) {
        throw new Error(`No prepared code graph with handle ${JSON.stringify(handle)}`);
    }
    // a graph is compiled once; a release during the compilation does nothing
    _preparedGraphs.delete(handle);

    try {
        const {
            eczCodeGraph,
            eczCodeGraphViewController,
            options: { displayOptions, updateLayoutOptions, cyStyleOptions, svgOptions },
        } = prepared;

        const domNode = window.document.createElement('div');
        prepared.domNode = domNode;
        window.document.body.appendChild(domNode);
        domNode.style.width = '800px';
        domNode.style.height = '600px';

        await eczCodeGraph.mountInDom(
            domNode,
            {
                styleOptions: Object.assign(
                    {
                        matchWebPageFonts: false,
                        window: window,
                    },
                    cyStyleOptions,
                ),
            }
        );

        debug(`Mounted in DOM!`);

        eczCodeGraphViewController.setDisplayOptions(displayOptions);

        debug(`set display options!`);

        // The key data must describe the graph that is laid out.
        if (JSON.stringify(_computeGraphKeyData(prepared)) !== prepared.graphKeyDataJson) {
            console.warn(
                `Code graph SVG export: the graph changed between its preparation and its `
                + `layout; its key data does not describe it (graph handle ${handle}).`
            );
        }

        // perform layout !
        await eczCodeGraph.updateLayout(loMerge(
            {
                animate: false
            },
            updateLayoutOptions
        ));

        debug(`ran updateLayout()!`);

        const cy = eczCodeGraph.cy;

        // fit into view
        await cy.fit();

        debug(`fit cy canvas view to graph. Done!`);

        debug(`There are ${cy.nodes().length} nodes in the graph.`);

        const svgData = cy.svg(Object.assign(
            {
                full: true,
            },
            svgOptions
        ));

        return { svgData };

    } finally {
        _destroyPreparedGraph(prepared);
    }
}


//
// Destroys a prepared graph that will not be compiled.  Returns whether there
// was such a graph.
//
function _releasePreparedCodeGraph(handle)
{
    const prepared = _preparedGraphs.get(handle);
    if (prepared == null) {
        return false;
    }
    _preparedGraphs.delete(handle);
    _destroyPreparedGraph(prepared);
    return true;
}


window.prepareCodeGraph = _prepareCodeGraph;
window.compilePreparedCodeGraph = _compilePreparedCodeGraph;
window.releasePreparedCodeGraph = _releasePreparedCodeGraph;

window.localStorage.debug = '*';

console.log('Loaded (msg via console.log())');
debug(`Loaded (msg via debug()).`);
console.debug('Loaded (msg via console.debug())');

window.finished_loading = true;
