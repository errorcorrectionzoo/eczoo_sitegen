const debug = require('debug')('eczoo_sitegen.src.list.listgraph');

const data = {
    pagination: {
        data: 'eczoodb.objects.list',
        size: 1,
        resolve: 'values',
        addAllPagesToCollections: false,
        alias: 'list',
    },
    eleventyComputed: {
        permalink: (data) => `/list/lgraph_${data.list.list_id}.svg`,
    },
    layout: null,
};

.......................

const render = async (data) => {

    const { kingdom, eczoodb } = data;

    const eczoo_code_graph_svg_exporter = eczoodb.custom_headless_graph_exporter_instance;

    if (eczoo_code_graph_svg_exporter == null) {
        // Skip full rendering in devel mode & render placeholder
        const { placeholdersSvg } = await import('../../sitelib/generatePlaceholderSvg.js');
        return placeholdersSvg.notBuiltInDevelMode;
    }

    debug(`Rendering kingdom graph for kingdom ‘${kingdom.kingdom_id}’`);

    const { EczCodeGraph } =
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

    // let eczCodeGraph = new EczCodeGraph({
    //     eczoodb,
    // });
    // await eczCodeGraph.initialize();

    // let eczCodeGraphViewController = new EczCodeGraphViewController(eczCodeGraph, displayOptions);
    // await eczCodeGraphViewController.initialize();

    // await eczCodeGraph.updateLayout({ animate: false });

    // // now, export to SVG:

    // let svgData = await eczoo_code_graph_svg_exporter.compile(
    //     eczCodeGraph,
    //     {
    //         fitWidth: 620,
    //     }
    // );

    const svgData = await eczoo_code_graph_svg_exporter.compileLoadedEczCodeGraph({
        displayOptions,
        //updateLayoutOptions: ...,
        cyStyleOptions: {
            fontFamily: 'Source Sans Pro',
            fontSize: 18,
        },
        //svgOptions: ...,
        fitWidth: 620,
        importSourceSansFonts: true,
    });

    return svgData;
};

module.exports = { data, render, };
