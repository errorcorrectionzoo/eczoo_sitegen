
const debug = require('debug')('eczoo_sitegen.src.kingdom');


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
    const {
        make_render_shorthands, make_and_render_document
    } = await import('@phfaist/zoodb/zooflm');
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');

    const { eczoodb, kingdom } = data;

    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const render_doc_fn = (render_context) => {

        const { ne, rdr, ref } = make_render_shorthands({render_context});

        let s = '';

        s += sqzhtml`
<h1>${ rdr(kingdom.name) }</h1>`;
        //<p>Welcome to the ${ rdr(kingdom.name) }</p>`;

        s += sqzhtml`
<p>Root codes of the ${ rdr(kingdom.name) }:</p>
<ul>
    ${
        kingdom.root_codes.map( (rootCodeRel) =>
            `<li>${ ref('code', rootCodeRel.code_id) }</li>`
        ).join('')
    }
</ul>

<div class="code-graph-excerpt">
  <a href="/code_graph#k_${kingdom.kingdom_id}">
    <img src="/kingdom/kgraph_${kingdom.kingdom_id}.svg">
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
