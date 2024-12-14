
const debug = require('debug')('eczoo_sitegen.src.list')


// ---------------------------------------------------------

const data = async () => {
    
    const zooflm = await import('@phfaist/zoodb/zooflm');

    // let html_fragment_renderer = zooflm.ZooHtmlFragmentRenderer();
    // let flmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.codelist',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'codelist',
        },
        tags: ['sitePage'],
        page_layout_info: {
            // provide wide page layouts in code lists
            wide_layout: true,
        },
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('codelist', data.codelist.list_id) + '.html',
            title: (data) => zooflm.render_text_standalone(data.codelist.title),
            // ---
            // injection hack to get correct page date property!
            // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
            date: (data) => {
                // don't get the date associated with the codelist object, get
                // the latest zoo modification date! we want to pick up
                // modification of the list contents, not only the list
                // specification.
                data.page.date = new Date(
                    data.eczoodb.zoo_gitlastmodified_processor.get_latest_modification_date()
                );
                return data.page.date;
            }
            // ---
        },
    };

};


const render = async (data) => {

    const codelist = data.codelist;

    const { render_codelist_page } = await import('@errorcorrectionzoo/eczoodb/render_codelist.js');

    const doc_metadata = {};
    const eczoodb = data.eczoodb;

    debug(`Rendering list ‘${codelist.list_id}’ ...`);

    const ecgDisplayOptions = {
        displayMode: 'subset',
        modeSubsetOptions: {
            codeIds: eczoodb.codelist_compiled_code_id_list(codelist),
        },
    };

    const run = () => render_codelist_page(
        codelist,
        {
            eczoodb,
            doc_metadata,
            include_code_graph_excerpt: {
                href: `/code_graph#J${encodeURIComponent(JSON.stringify(ecgDisplayOptions))}`,
                graphic_url: `/list/lgraph_${codelist.list_id}.svg`,
            }
            
        }
    );

    // if (codelist.list_id === 'good_qldpc') { // profile this specific list which is slow
    //     const { run_and_dump_profile } = await import('../../sitelib/run_profiler.js');
    //     return run_and_dump_profile( run , './_profile_gen_list_good_qldpc' );
    // }

    return run();

};


module.exports = { data, render };
