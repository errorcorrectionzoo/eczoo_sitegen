
//const debug = require('debug')('eczoo_sitegen.src.kingdom');


// ---------------------------------------------------------

const data = async () => {
    
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
            title: (data) => data.eczoodb.zoo_flm_engine.snippet(data.kingdom.name, 'text'),
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

    const { render_kingdom } = await import('@errorcorrectionzoo/eczoodb/render_kingdom.js');
    const { format_diagnostic } = await import('@phfaist/zoodb/zooflm/engine');

    const result = render_kingdom(kingdom, {
        eczoodb,
        include_code_graph_excerpt: {
            href: `/code_graph#kingdom_${kingdom.kingdom_id}`,
            graphic_url: `/kingdom/kgraph_${kingdom.kingdom_id}.svg`,
        }
    });
    // An error in the page's content has thrown (the 'abort' policy); the
    // warnings are returned.
    for (const diagnostic of result.diagnostics) {
        console.warn(`${data.page.url}: ${format_diagnostic(diagnostic)}`);
    }
    return result.html;
}



export default { data, render };
