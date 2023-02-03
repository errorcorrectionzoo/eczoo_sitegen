//
// Run from 11ty / build time / server side
//

import * as zoollm from '@phfaist/zoodb/zoollm';
const { $$kw, repr } = zoollm;


const truncate_description_at_length = 360;

const rx_stub = /^[ \t\n.;_-]*stub[ \t\n.;!_-]*$/i;


export function generate_random_code_data({eczoodb})
{
    let codes = {};

    let html_fragment_renderer = new zoollm.ZooHtmlFragmentRenderer();

    for (const [code_id, code] of Object.entries(eczoodb.objects.code)) {

        // make sure the code isn't a simple empty "stub"
        if (code.description.llm_text.match(rx_stub)) {
            continue;
        }

        const name_html = code.name.render_standalone(html_fragment_renderer);

        const description_truncated = code.description.truncate_to(
            truncate_description_at_length
        );

        let description_html = zoollm.make_and_render_document({
            zoo_llm_environment: eczoodb.zoo_llm_environment,
            render_doc_fn: description_truncated.render,
            //doc_metadata,
            feature_document_options: {
                // citations: {
                //     use_endnotes: false,
                // },
            },
            render_endnotes: false
        });

        // Remove all the citations altogether. Define the regex HERE! It needs
        // the global, stateful flag to capture all matches.
        let rx_cite_foot = /<a[ ][^>]*href="#citation-[^"]*"[^>]*>[^<]+<\/a>/g;
        description_html = description_html.replace(rx_cite_foot, '');

        codes[code_id] = {
            name_html,
            description_html,
        };

    }

    return { codes, };
}
