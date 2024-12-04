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
        $$kw, make_render_shorthands, make_and_render_document
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

        const refsmgr = render_context.feature_render_manager('refs');

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
            const defining_object_ref_instance = refsmgr.get_ref(object_type, object_id);
            const defining_obj_name_flm = defining_object_ref_instance.formatted_ref_flm_text;
            const defining_obj_name = render_context.doc.environment.make_fragment(
                defining_obj_name_flm,
                $$kw({ standalone_mode: true }),
            );

            let concept_encountered_references =
                eczoodb.zoo_flm_processor.scanner.get_encountered_references_to_labels(
                    encountered_referenceable.referenceable_info.labels
                );
            let concept_referenced_in_list = '';
            if (concept_encountered_references.length) {
                concept_referenced_in_list =
                    `<div class="glossary-referenced-in-list">Referenced in: `;
                let concept_referenced_in_list_items = []
                for (const encountered_reference of concept_encountered_references) {
                    const ri = encountered_reference.resource_info;
                    if (ri.object_type === object_type && ri.object_id === object_id) {
                        // skip the object that defines the concept ("defined in")
                        continue;
                    }
                    concept_referenced_in_list_items.push(
                        `<span class="glossary-referenced-in-item">${
                            ref(ri.object_type, ri.object_id)
                        }</span>`
                    );
                }
                concept_referenced_in_list += concept_referenced_in_list_items.join(', ');
                concept_referenced_in_list += `</div>`;
            }

            s += sqzhtml`
  <dt class="glossary-defterm-term-name">
    <a href="${ href }">
      ${ rdr(flm_text) }
    </a>
  </dt>
    ${ /*<a href="${ href }"
       class="glossary-a-view-in-context"
       >view in context&nbsp;→</a> */ '' }
  <dd class="glossary-defterm-body">
    ${ rdr(flm_body) }
    <div class="glossary-defined-in">Defined in: <a href="${href}">${
        rdr(defining_obj_name)
    }</a></div>
    ${ concept_referenced_in_list }
  </dd>`;
        } // end for

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
