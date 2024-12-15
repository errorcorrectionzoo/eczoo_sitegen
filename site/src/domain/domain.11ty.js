import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.domain')


// ---------------------------------------------------------

const data = async () => {
    
    const zooflm = await import('@phfaist/zoodb/zooflm');

    // let html_fragment_renderer = zooflm.ZooHtmlFragmentRenderer();
    // let flmrender = (value) => value && value.render_standalone(html_fragment_renderer);

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
            title: (data) => zooflm.render_text_standalone(data.domain.name),
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
    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const { render_domain } = await import('@errorcorrectionzoo/eczoodb/render_domain.js');

    return render_domain(domain, {
        eczoodb,
        zoo_flm_environment,
        include_code_graph_excerpt: {
            href: `/code_graph#domain_${domain.domain_id}`,
            graphic_url: `/domain/kgraph_${domain.domain_id}.svg`,
        }
    });
}



export default { data, render };
