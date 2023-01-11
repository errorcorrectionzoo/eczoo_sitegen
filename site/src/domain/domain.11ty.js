const debug = require('debug')('eczoo_sitegen.src.domain')


// ---------------------------------------------------------

const data = async () => {
    
    const zoollm = await import('@phfaist/zoodb/zoollm');

    // let html_fragment_renderer = zoollm.ZooHtmlFragmentRenderer();
    // let llmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.domain',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'domain',
        },
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('domain', data.domain.domain_id) + '.html',
            title: (data) => zoollm.render_text_standalone(data.domain.name),
        },
    };

};




const render = async (data) => {
    const {
        sqzhtml, mkrenderutils, render_document
    } = await import('@errorcorrectionzoo/eczoodb/render_utils.js');

    const { eczoodb, domain } = data;

    const zoo_llm_environment = eczoodb.zoo_llm_environment;

    const render_doc = (render_context) => {

        const { ne, rdr, ref } = mkrenderutils({render_context});

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


<div style="margin-top: 2rem; overflow: auto;">
  <a style="margin: auto; display: inline-block;"
     href="/code_graph#domain_${domain.domain_id}">
    <img src="/domain/kgraph_${domain.domain_id}.svg"
         style="max-width: 100%">
  </a>
</div>


<RENDER_ENDNOTES/>`;

        return s;
    };

    
    return render_document({
        zoo_llm_environment,
        render_doc,
        //doc_metadata,
        render_endnotes: {
            // annotations: ['sectioncontent'],
        }
    });
}



module.exports = { data, render };
