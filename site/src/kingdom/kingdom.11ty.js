
//const debug = require('debug')('eczoo_sitegen.src.kingdom');


// ---------------------------------------------------------

const data = async () => {
    
    const zooflm = await import('@phfaist/zoodb/zooflm');

    // let html_fragment_renderer = zooflm.ZooHtmlFragmentRenderer();
    // let flmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.kingdom',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'kingdom',
        },
        tags: ['sitePage'],
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('kingdom', data.kingdom.kingdom_id) + '.html',
            title: (data) => zooflm.render_text_standalone(data.kingdom.name),
            // ---
            // injection hack to get correct page date property!
            // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
            date: (data) => {
                data.page.date = new Date(data.kingdom._zoodb.git_last_modified_date);
                return data.page.date;
            },
            // ---
        },
    };

};




const render = async (data) => {

    const { eczoodb, kingdom } = data;
    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const { render_kingdom } = await import('@errorcorrectionzoo/eczoodb/render_kingdom.js');

    return render_kingdom(kingdom, {
        eczoodb,
        zoo_flm_environment,
        include_code_graph_excerpt: {
            href: `/code_graph#kingdom_${kingdom.kingdom_id}`,
            graphic_url: `/kingdom/kgraph_${kingdom.kingdom_id}.svg`,
        }
    });
}



export default { data, render };
