const debug = require('debug')('eczoo_sitegen.src.concepts');

const data = {
    title: 'Glossary of concepts',
};

const render = async (data) => {
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');
    const {
        make_render_shorthands, make_and_render_document
    } = await import('@phfaist/zoodb/zoollm');

    debug(`concepts.11ty.js -- render()`);

    const { eczoodb } = data;

    const zoo_llm_environment = eczoodb.zoo_llm_environment;

    const all_referenceables =
          eczoodb.zoo_llm_processor.scanner.get_encountered('referenceables');

    const all_defterms = all_referenceables.filter( (encountered_referenceable) =>
              (encountered_referenceable.defterm_body_llm != null)
          );

    const render_doc_fn = (render_context) => {

        const R = make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let s = '';

        s += sqzhtml`
<h1>Glossary of concepts</h1>

<dl class="glossary-defterm-list">`;
        for (const encountered_referenceable of all_defterms) {
            const llm_text =
                  encountered_referenceable.referenceable_info.formatted_ref_llm_text;
            const llm_body = encountered_referenceable.defterm_body_llm;

            const { object_type, object_id } =
                  encountered_referenceable.encountered_in.resource_info;
            let href = eczoodb.zoo_object_permalink(object_type, object_id);
            const referenceable_info_target_id =
                  encountered_referenceable.referenceable_info.get_target_id();
            if (referenceable_info_target_id != null) {
                href += '#' + referenceable_info_target_id;
            }

            s += sqzhtml`
  <dt class="glossary-defterm-term-name">
    <a href="${ href }">
      ${ rdr(llm_text) }
    </a>
  </dt>
    <a href="${ href }"
       class="glossary-a-view-in-context"
       >view in context&nbsp;→</a>
  <dd class="glossary-defterm-body">
    ${ rdr(llm_body) }
  </dd>`;
        }
        s += sqzhtml`
</dl>
<RENDER_ENDNOTES/>`;
        return s;
    };

    
    return make_and_render_document({
        zoo_llm_environment,
        render_doc_fn,
        //doc_metadata,
        render_endnotes: {
            // annotations: ['sectioncontent'],
        }
    });
};


module.exports = { data, render, }
