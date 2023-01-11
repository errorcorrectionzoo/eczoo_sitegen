
const debug = require('debug')('eczoo_sitegen.src.list')


// ---------------------------------------------------------

const data = async () => {
    
    const zoollm = await import('@phfaist/zoodb/zoollm');

    // let html_fragment_renderer = zoollm.ZooHtmlFragmentRenderer();
    // let llmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.codelist',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'codelist',
        },
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('codelist', data.codelist.list_id),
            title: (data) => zoollm.render_text_standalone(data.codelist.title),
        },
    };

};


const render = async (data) => {

    const codelist = data.codelist;

    const { render_codelist_page } = await import('@errorcorrectionzoo/eczoodb/render_codelist.js');

    const doc_metadata = {};
    const eczoodb = data.eczoodb;

    debug(`Rendering list ‘${codelist.list_id}’ ...`);

    const run = () => render_codelist_page(codelist, {eczoodb, doc_metadata});

    // if (codelist.list_id === 'good_qldpc') { // profile this specific list which is slow
    //     const { run_and_dump_profile } = await import('../../sitelib/run_profiler.js');
    //     return run_and_dump_profile( run , './_profile_gen_list_good_qldpc' );
    // }

    return run();

};


module.exports = { data, render };
