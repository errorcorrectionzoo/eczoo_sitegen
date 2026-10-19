//
// Run from 11ty / build time / server side
//

import { format_diagnostic } from '@phfaist/zoodb/zooflm/engine';


const truncate_description_at_length = 500;

const rx_stub = /^[ \t\n.;_-]*stub[ \t\n.;!_-]*$/i;


//
// A preview places no endnotes: its render leaves out the lists of footnotes
// and of citations, which are then not built.  (The marks of footnotes and
// citations stay, linking to notes that are not on the page: flm-rs has no
// render option that leaves them out.)  The floats are left out by the
// truncation to the first paragraph (the EC zoo writes floats as paragraphs
// of their own).
//
const preview_render_options = {
    pieces: {
        exclude: [ 'flm.xnotes.list.footnote', 'flm.citations.bibliography' ],
    },
};


export function generate_random_code_data({eczoodb})
{
    const zoo_flm_engine = eczoodb.zoo_flm_engine;

    let codes = {};

    for (const [code_id, code] of Object.entries(eczoodb.objects.code)) {

        // make sure the code isn't a simple empty "stub"
        if (code.description.source.match(rx_stub)) {
            continue;
        }

        const name_html = zoo_flm_engine.snippet(code.name, 'html');

        // The first paragraph of the description, cut at about 500
        // characters: a fragment of its own, released once rendered.
        const { fragment: description_truncated } = zoo_flm_engine.truncate(
            code.description,
            {
                first_paragraph: true,
                chars: truncate_description_at_length,
            }
        );

        let description_html;
        try {
            const result = zoo_flm_engine.render_document({
                compose: ({ rdr }) => rdr(description_truncated),
                render_options: preview_render_options,
            });
            // An error in the content has thrown (the 'abort' policy); the
            // warnings are returned.
            for (const diagnostic of result.diagnostics) {
                console.warn(`Random code data, ${code_id}: ${format_diagnostic(diagnostic)}`);
            }
            description_html = result.html;
        } finally {
            zoo_flm_engine.release(description_truncated);
        }

        codes[code_id] = {
            name_html,
            description_html,
        };

    }

    return { codes, };
}
