const debug = require('debug')('eczoo_sitegen.src.kingdom.kingdomgraph');

const data = {
    pagination: {
        data: 'eczoodb.objects.kingdom',
        size: 1,
        resolve: 'values',
        addAllPagesToCollections: false,
        alias: 'kingdom',
    },
    eleventyComputed: {
        permalink: (data) => `/kingdom/kgraph_${data.kingdom.kingdom_id}.svg`,
    },
    layout: null,
};

const render = async (data) => {

    const eczoo_code_graph_svg_exporter = data.get_eczoo_code_graph_svg_exporter.getInstance();

    if (eczoo_code_graph_svg_exporter == null) {
        // Skip full rendering in devel mode & render placeholder
        const { placeholdersSvg } = await import('../../sitelib/generatePlaceholderSvg.js');
        return placeholdersSvg.notBuiltInDevelMode;
    }

    const { kingdom, eczoodb } = data;

    debug(`Rendering kingdom graph for kingdom ‘${kingdom.kingdom_id}’`);

    const { EczCodeGraph, EczCodeGraphViewController } =
          await import('@errorcorrectionzoo/jscomponents/codegraph/index.js');

    const displayOptions = {
        displayMode: 'isolate-nodes',
        modeIsolateNodesOptions: {
            nodeIds: [
                EczCodeGraph.getNodeIdKingdom( kingdom.kingdom_id )
            ],
            range: {
                parents: {
                    primary: 5,
                    secondary: 3,
                    extra: 0,
                },
                children: {
                    primary: 2,
                    secondary: 2,
                    extra: 0,
                },
            },
        },
        highlightImportantNodes: {
            highlightImportantNodes: false,
            highlightPrimaryParents: false,
            highlightRootConnectingEdges: false,
        },
    };

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
    });
    await eczCodeGraph.initialize();

    let eczCodeGraphViewController = new EczCodeGraphViewController(eczCodeGraph, displayOptions);
    await eczCodeGraphViewController.initialize();

    await eczCodeGraph.updateLayout({ animate: false });

    // now, export to SVG:

    let svgData = await eczoo_code_graph_svg_exporter.compile(
        eczCodeGraph,
        {
            fitWidth: 620,
        }
    );

    return svgData;
};

module.exports = { data, render, };
