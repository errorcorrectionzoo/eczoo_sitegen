// import debugm from 'debug';
// const debug = debugm('eczoo_sitegen.src.domain');


// ---------------------------------------------------------

const data = async () => {
    
    return {
        pagination: {
            data: 'eczoodb.objects.domain',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'domain',
        },
        tags: ['sitePage'],
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('domain', data.domain.domain_id) + '.html',
            title: (data) => data.eczoodb.zoo_flm_engine.snippet(data.domain.name, 'text'),
            // ---
            // injection hack to get correct page date property!
            // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
            date: (data) => {
                data.page.date = new Date(data.domain._zoodb.git_last_modified_date);
                return data.page.date;
            },
            // ---
        },
    };

};




const render = async (data) => {

    const { eczoodb, domain } = data;

    const { render_domain } = await import('@errorcorrectionzoo/eczoodb/render_domain.js');
    const { format_diagnostic } = await import('@phfaist/zoodb/zooflm/engine');

    const result = render_domain(domain, {
        eczoodb,
        include_code_graph_excerpt: {
            href: `/code_graph#domain_${domain.domain_id}`,
            graphic_url: `/domain/kgraph_${domain.domain_id}.svg`,
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
