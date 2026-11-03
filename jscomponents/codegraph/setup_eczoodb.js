import debug_module from 'debug';
const debug = debug_module('eczoo_site.jscomponents.codegraph.setup_eczoodb');


import { use_relations_populator } from '@phfaist/zoodb/std/use_relations_populator';
import { use_flm_engine } from '@phfaist/zoodb/std/use_flm_engine';
import { FLMSimpleContentCompiler } from '@phfaist/zoodb/dbprocessor/flmsimplecontent';
import { format_diagnostic } from '@phfaist/zoodb/zooflm/engine';

import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';


//
// The code graph runs in the browser (the /code_graph page, and the headless
// SVG exporter in Puppeteer) on the zoo's data dump (`dat/eczoodata.json`),
// without the FLM processor: the zoo's objects come from the dump's `db`, and
// the FLM engine renders their fields with the data the FLM processor
// computed at build time, from the dump's `zooflm` (the index of
// cross-references, the citations, the images and the snippets of the names
// and titles).  The fields are compiled when they are shown, by the field
// compiler (`eczoodb.codegraph_flm_compiler`), except the names of the codes,
// domains and kingdoms, which the graph's labels need and which are compiled
// in place when the zoo is loaded (their text snippets come from the dump, so
// nothing is rendered for them).
//


//
// The output context of the FLM engine's index in which the information pane
// renders: the dump's `default` index with the links to codes, domains and
// kingdoms made `#jsCallbackRef:TYPE/ID` addresses, which the pane turns into
// callbacks that select the object in the graph.  (An address of the form
// `jsCallbackRef:TYPE/ID`, as the pane used before zoodb 0.3, has a scheme
// that the FLM engine's HTML output refuses in a reference written in content,
// such as `\ref{code:ID}`: it writes the link without its address and reports
// the Error `flm.html.refused-address`.  A fragment address has no scheme.)
//
export const codegraph_flm_context = 'codegraph';

export const codegraph_captured_object_types = [ 'code', 'domain', 'kingdom' ];

function codegraph_index_entries(default_index_entries)
{
    return default_index_entries.map( (entry) => {
        const sep = entry.label.indexOf(':');
        const object_type = entry.label.slice(0, sep);
        const object_id = entry.label.slice(sep + 1);
        if (codegraph_captured_object_types.includes(object_type)) {
            return { ...entry, href: `#jsCallbackRef:${object_type}/${object_id}` };
        }
        return entry;
    } );
}

// Prints the diagnostics of an engine call on the console (under the error
// policy 'continue' an Error does not throw; the information pane prints the
// diagnostics of its renders likewise).
function warn_diagnostics(what, { diagnostics })
{
    for (const diagnostic of diagnostics) {
        console.warn(`Code graph, ${what}: ${format_diagnostic(diagnostic)}`);
    }
}


/**
 * Creates the EC zoo from its data dump, for the code graph.
 */
export async function load_eczoodb_from_data(eczoodbData)
{
    if (eczoodbData?.zooflm == null) {
        throw new Error(
            `The zoo's data dump holds no FLM data (‘zooflm’): it was not written by `
            + `the zoo's FLM processor (zoodb 0.3 or later)`
        );
    }

    let eczoodbOpts = {
        use_relations_populator,

        // In the future, maybe use ecz stats processor? currently it's not needed.

        // The FLM engine, created with the zoo's own core configuration
        // (`flm_options.engine` of eczoodb.js), so that it installs the dump's
        // FLM data (engine.load() refuses data made under another
        // configuration) ...
        use_flm_engine,
        // ... but not the FLM processor: the fields are compiled when shown.
        use_flm_processor: false,

        flm_options: {
            // A reference that resolves to nothing is a Warning, not an Error.
            allow_unresolved_references: true,
        },

        use_searchable_text_processor: false,

        fs: null,

        // the FLM error policy 'continue': what cannot be rendered shows the
        // engine's recovery markup
        continue_with_errors: true,
    };

    let eczoodb = await createEcZooDb(eczoodbOpts, { use_schemas_loader: false });

    const engine = eczoodb.zoo_flm_engine;

    debug(`Created eczoodb, loading the FLM data (index, citations, graphics, snippets) ...`);

    warn_diagnostics(
        `the FLM data of the zoo's data dump`,
        engine.load(eczoodbData.zooflm)
    );
    warn_diagnostics(
        `the index of the FLM context ‘${codegraph_flm_context}’`,
        engine.set_index(
            codegraph_index_entries(eczoodbData.zooflm.index?.default ?? []),
            { context: codegraph_flm_context }
        )
    );

    debug(`Loaded the FLM data, loading the zoo's data ...`);

    await eczoodb.load_data(eczoodbData.db);

    const flm_compiler = new FLMSimpleContentCompiler({
        engine,
        error_policy: 'continue',
    });
    eczoodb.codegraph_flm_compiler = flm_compiler;

    // The names, compiled in place (the graph's labels; the pane shows them).
    for (const object_type of codegraph_captured_object_types) {
        const object_schema = eczoodb.schema(object_type);
        for (const object of Object.values(eczoodb.objects[object_type] ?? {})) {
            object.name = flm_compiler.compile_flm(object.name, {
                object_type,
                object_schema,
                object,
                fieldname: 'name',
            });
        }
    }

    debug(`Loaded the zoo.`);

    return eczoodb;
}
