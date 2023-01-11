
const debug = require('debug')('eczoo_sitegen.src.kingdom')


// ---------------------------------------------------------

const data = async () => {
    
    const zoollm = await import('@phfaist/zoodb/zoollm');

    // let html_fragment_renderer = zoollm.ZooHtmlFragmentRenderer();
    // let llmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.kingdom',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'kingdom',
        },
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('kingdom', data.kingdom.kingdom_id) + '.html',
            title: (data) => zoollm.render_text_standalone(data.kingdom.name),
        },
    };

};




const render = async (data) => {
    const {
        sqzhtml, mkrenderutils, render_document
    } = await import('@errorcorrectionzoo/eczoodb/render_utils.js');

    const { eczoodb, kingdom } = data;

    const zoo_llm_environment = eczoodb.zoo_llm_environment;

    const render_doc = (render_context) => {

        const { ne, rdr, ref } = mkrenderutils({render_context});

        let s = '';

        s += sqzhtml`
<h1>${ rdr(kingdom.name) }</h1>

<p>Welcome to the ${ rdr(kingdom.name) }</p>`;

        s += sqzhtml`
<p>The ${ rdr(kingdom.name) } is defined by the code:
   ${ ref('code', kingdom.kingdom_code.code_id) }.</p>

<div style="margin-top: 2rem; overflow: auto;">
  <a style="margin: auto; display: inline-block;"
     href="/code_graph#code_${kingdom.kingdom_code.code_id}">
    <img src="/kingdom/kgraph_${kingdom.kingdom_id}.svg"
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
