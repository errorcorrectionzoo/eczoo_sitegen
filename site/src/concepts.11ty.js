const debug = require('debug')('eczoo_sitegen.src.concepts');

const data = {
    title: 'Glossary of concepts',
    tags: ['sitePage'],
    eleventyComputed: {
        // ---
        // injection hack to get correct page date property!
        // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
        date: (data) => {
            data.page.date = new Date(
                data.eczoodb.zoo_gitlastmodified_processor.get_latest_modification_date()
            );
            return data.page.date;
        }
        // ---
    },
};

const render = async (data) => {
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');
    const {
        make_render_shorthands, make_and_render_document
    } = await import('@phfaist/zoodb/zooflm');

    debug(`concepts.11ty.js -- render()`);

    const { eczoodb } = data;

    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const all_referenceables =
          eczoodb.zoo_flm_processor.scanner.get_encountered('referenceables');

    const all_defterms = all_referenceables.filter( (encountered_referenceable) =>
              (encountered_referenceable.defterm_body_flm != null)
          );

    const render_doc_fn = (render_context) => {

        const R = make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let s = '';

        s += sqzhtml`
<h1>Glossary of concepts</h1>

<dl class="glossary-defterm-list">`;
        for (const encountered_referenceable of all_defterms) {
            const flm_text =
                  encountered_referenceable.referenceable_info.formatted_ref_flm_text;
            const flm_body = encountered_referenceable.defterm_body_flm;

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
      ${ rdr(flm_text) }
    </a>
  </dt>
    <a href="${ href }"
       class="glossary-a-view-in-context"
       >view in context&nbsp;→</a>
  <dd class="glossary-defterm-body">
    ${ rdr(flm_body) }
  </dd>`;
        }
        s += sqzhtml`
</dl>
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
};


module.exports = { data, render, }
