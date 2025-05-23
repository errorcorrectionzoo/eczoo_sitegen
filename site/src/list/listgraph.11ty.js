import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.list.listgraph');

import {
    suggestedGraphExtractGraphGlobalOptions
} from '@errorcorrectionzoo/jscomponents/codegraph/eczcodegraph.js';


export function listGraphMakeDisplayOptions(codeIds) {
    return {
        displayMode: 'subset',

        modeSubsetOptions: {
            codeIds,
        },
        
        cousinEdgesShown: true,
        secondaryParentEdgesShown: true,

        highlightImportantNodes: {
            highlightImportantNodes: true,
            highlightPrimaryParents: true,
            highlightRootConnectingEdges: false,
        },
    };
}

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

    const displayOptions = listGraphMakeDisplayOptions(code_id_list);

    debug(`Setting list's graph's displayOptions to`, displayOptions);

    const svgData = await eczoo_code_graph_svg_exporter.compileLoadedEczCodeGraph({
        displayOptions,
        graphGlobalOptions: suggestedGraphExtractGraphGlobalOptions,
        //updateLayoutOptions: ...,
        cyStyleOptions: {
            fontFamily: 'Source Sans Pro',
            fontSize: 18,
        },
        //svgOptions: ...,
        fitWidth: 1200, // use wide page layout
        importSourceSansFonts: true,
    });

    return svgData;
};

export default { data, render };
