const debug = require('debug')('eczoo_sitegen.src.domain')


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
    const {
        make_render_shorthands, make_and_render_document
    } = await import('@phfaist/zoodb/zooflm');
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');

    const { eczoodb, domain } = data;

    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const render_doc_fn = (render_context) => {

        const { ne, rdr, ref } = make_render_shorthands({render_context});

        let s = '';

        s += sqzhtml`
<h1>${ rdr(domain.name) }</h1>

<p>Welcome to the ${ rdr(domain.name) }`;
        if (ne(domain.description)) {
            s += sqzhtml`
<!-- --> — ${ rdr(domain.description) }`;
        }
        s += sqzhtml`
</p>`;

        s += sqzhtml`
<p>Kingdoms:</p>
<ul>`;

        //debug(`domain's kingdoms: `, domain.kingdoms);

        // iterate over kingdom relation object instances
        for (const { kingdom_id, kingdom } of domain.kingdoms ?? []) {
            s += sqzhtml`
  <li>
    <a href="${ eczoodb.zoo_object_permalink('kingdom', kingdom_id) }">
      ${ rdr(kingdom.name) }
    </a>
  </li>`;
        }

        s += sqzhtml`
</ul>


<div class="code-graph-excerpt">
  <a style="margin: auto; display: inline-block;"
     href="/code_graph#domain_${domain.domain_id}">
    <img src="/domain/kgraph_${domain.domain_id}.svg">
  </a>
</div>


<RENDER_ENDNOTES/>`;

        return s;
    };

    
    return make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        //doc_metadata,
        render_endnotes: {
            // annotations: ['sectioncontent'],
        }
    });
}



module.exports = { data, render };
