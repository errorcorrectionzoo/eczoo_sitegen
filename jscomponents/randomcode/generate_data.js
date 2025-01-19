//
// Run from 11ty / build time / server side
//

import * as zooflm from '@phfaist/zoodb/zooflm';
const {
    // $$kw, repr,
    __class__, __get__,
    // __super__
} = zooflm;

import { docrefs_placeholder_ref_resolver } from '@errorcorrectionzoo/eczoodb/render_utils.js';


//const truncate_description_at_length = 360;

const rx_stub = /^[ \t\n.;_-]*stub[ \t\n.;!_-]*$/i;



const CustomHtmlFragmentRenderer = __class__(
    'CustomHtmlFragmentRenderer', // class name
    [ zooflm.ZooHtmlFragmentRenderer ], // base classes
    {
        // class members

        get render_float () {return __get__ (this, function
        (self_, float_instance_, render_context_) {

            return '<!-- do not render floats in random code preview -->';

        });},

    }
);



export function generate_random_code_data({eczoodb})
{
    let codes = {};

    let html_fragment_renderer = new CustomHtmlFragmentRenderer();

    for (const [code_id, code] of Object.entries(eczoodb.objects.code)) {

        // make sure the code isn't a simple empty "stub"
        if (code.description.flm_text.match(rx_stub)) {
            continue;
        }

        const name_html = code.name.render_standalone(html_fragment_renderer);

        // const description_truncated = code.description.truncate_to(
        //     truncate_description_at_length
        // );
        const description_truncated = code.description.get_first_paragraph();

        let description_html = zooflm.make_and_render_document({
            zoo_flm_environment: eczoodb.zoo_flm_environment,
            fragment_renderer: html_fragment_renderer,
            render_doc_fn: description_truncated.render,
            //doc_metadata,
            feature_document_options: {
            },
            feature_render_options: {
                endnotes: {
                    inhibit_render_endnote_marks: true,
                },
                refs: {
                    // use placeholder_ref_resolver to ignore any undefined references -- e.g. a
                    // figure reference in the first paragraph of a description text that was
                    // used as a snippet
                    add_external_ref_resolvers: [ docrefs_placeholder_ref_resolver ],
                },
            },
            render_endnotes: false,
        });

        codes[code_id] = {
            name_html,
            description_html,
        };

    }

    return { codes, };
}
