const debug = require('debug')('eczoo_sitegen.src.list.listgraph');

const data = {
    pagination: {
        data: 'eczoodb.objects.codelist',
        size: 1,
        resolve: 'values',
        addAllPagesToCollections: false,
        alias: 'codelist',
    },
    eleventyComputed: {
        permalink: (data) => `/list/lgraph_${data.codelist.list_id}.svg`,
    },
    layout: null,
};

const render = async (data) => {

    const { codelist, eczoodb } = data;

    const eczoo_code_graph_svg_exporter = eczoodb.site_custom_headless_graph_exporter_instance;

    if (eczoo_code_graph_svg_exporter == null) {
        // Skip full rendering in devel mode & render placeholder
        const { placeholdersSvg } = await import('../../sitelib/generatePlaceholderSvg.js');
        return placeholdersSvg.notBuiltInDevelMode;
    }

    debug(`Rendering graph for list ‘${codelist.list_id}’`);

    // const { EczCodeGraph } =
    //     await import('@errorcorrectionzoo/jscomponents/codegraph/index.js');

    const code_id_list = eczoodb.codelist_compiled_code_id_list(codelist);

    const displayOptions = {
        displayMode: 'subset',
        modeSubsetOptions: {
            codeIds: code_id_list,
        },
        highlightImportantNodes: {
            highlightImportantNodes: false,
            highlightPrimaryParents: false,
            highlightRootConnectingEdges: false,
        },
    };

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
