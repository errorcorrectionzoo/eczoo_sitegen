const debug = require('debug')('eczoo_sitegen.src.domain.domaingraph');

const data = {
    pagination: {
        data: 'eczoodb.objects.domain',
        size: 1,
        resolve: 'values',
        addAllPagesToCollections: false,
        alias: 'domain',
    },
    eleventyComputed: {
        permalink: (data) => `/domain/kgraph_${data.domain.domain_id}.svg`,
    },
    layout: null,
};

const render = async (data) => {

    if (data.eczoo_config.run_options.development_mode) {
        // Skip full rendering in devel mode & render placeholder
        const { placeholdersSvg } = await import('../../sitelib/generatePlaceholderSvg.js');
        return placeholdersSvg.notBuiltInDevelMode;
    }

    const { domain, eczoodb } = data;

    debug(`Rendering domain graph for domain ‘${domain.domain_id}’`);


    const { EczCodeGraph } = await import('@errorcorrectionzoo/jscomponents/codegraph/index.js');
    const { exportCodeGraphToSvg } =
          await import('@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js');

    const displayOptions = {
        displayMode: 'isolate-nodes',
        modeIsolateNodesOptions: {
            nodeIds: [
                EczCodeGraph.getNodeIdDomain( domain.domain_id )
            ],
            redoLayout: true,
            range: {
                parents: {
                    primary: 5,
                    secondary: 1,
                },
                children: {
                    primary: 2,
                    secondary: 1,
                },
            },
        },
    };

    let eczCodeGraph = new EczCodeGraph({
        eczoodb,
        displayOptions,
    });

    await eczCodeGraph.initialize();

    await eczCodeGraph.layout({ animate: false });

    // now, export to SVG:

    const svgData = await exportCodeGraphToSvg(eczCodeGraph, {
        cyStyleJsonOptions: {
            fontFamily: 'Source Sans Pro',
            fontSize: '18px',
        },
    });

    return svgData;
};

module.exports = { data, render, };
