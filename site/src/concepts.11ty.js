import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.concepts');


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
    const { format_diagnostic } = await import('@phfaist/zoodb/zooflm/engine');

    debug(`concepts.11ty.js -- render()`);

    const { eczoodb } = data;

    const zoo_flm_engine = eczoodb.zoo_flm_engine;

    // What the FLM processor's scan found, per object: the term definitions
    // (`terms`: their labels, anchor, term and body) and the references
    // (`refs`), in the order of the zoo's objects.
    const scanned_objects = [ ...eczoodb.zoo_flm_processor.scan_results.objects.values() ];

    // The fragments made for this page only (the terms and their bodies),
    // released once the page is rendered.
    let page_fragments = [];
    const make_page_fragment = (source, options) => {
        const fragment = zoo_flm_engine.make_fragment(source, options);
        page_fragments.push(fragment);
        return fragment;
    };

    // Everything from the first fragment made on is inside the `try`, so that
    // the fragments made so far are released whatever throws.
    try {
        let glossary_terms = [];
        for (const scanned_object of scanned_objects) {
            const { object_type, object_id } = scanned_object;
            for (const term of scanned_object.terms) {
                let href = eczoodb.zoo_object_permalink(object_type, object_id);
                if (term.anchor != null) {
                    href += '#' + term.anchor;
                }
                // the term, as written in the definition (the origin: the
                // field's, without a file position, and the term)
                const { label, field, source_path } = term.fragment.origin;
                const term_fragment = make_page_fragment(term.display, {
                    origin: { label, object_type, object_id, field, source_path, term: term.labels[0] },
                    layout: 'inline',
                });
                // the body of the definition, with the origin (the field's, with
                // the file position of the body) that the scan gives it
                const body_fragment = (term.body != null)
                    ? make_page_fragment(term.body, { origin: term.body_origin, layout: 'blocks' })
                    : null;
                // the other objects that refer to the term (one of its labels)
                const referenced_in = scanned_objects.filter(
                    (o) => ( !(o.object_type === object_type && o.object_id === object_id)
                             && o.refs.some( (r) => term.labels.includes(r.label) ) )
                );
                glossary_terms.push({
                    object_type, object_id, href, term_fragment, body_fragment, referenced_in,
                });
            }
        }
        debug(`concepts.11ty.js: ${glossary_terms.length} term definition(s)`);

        const compose = (R) => {

            const { rdr, rdrblock, ref, endnotes } = R;

            let s = '';

            s += sqzhtml`
<h1>Glossary of concepts</h1>

<dl class="glossary-defterm-list">`;
            for (const {
                object_type, object_id, href, term_fragment, body_fragment, referenced_in,
            } of glossary_terms) {

                // the display of the defining object (its name)
                const defining_obj = eczoodb.objects[object_type][object_id];
                const defining_obj_name = defining_obj.name ?? defining_obj.title ?? object_id;

                let concept_referenced_in_list = '';
                if (referenced_in.length) {
                    concept_referenced_in_list = 
                        `<div class="glossary-referenced-in-list">Referenced in: `;
                    concept_referenced_in_list += referenced_in.map(
                        (o) => `<span class="glossary-referenced-in-item">${
                                ref(o.object_type, o.object_id)
                            }</span>`
                    ) .join(', ');
                    concept_referenced_in_list += `</div>`;
                }

                s += sqzhtml`
  <dt class="glossary-defterm-term-name">
    <a href="${ href }">
      ${ rdr(term_fragment) }
    </a>
  </dt>
  <dd class="glossary-defterm-body">
    ${ (body_fragment != null) ? rdrblock(body_fragment) : '' }
    <div class="glossary-defined-in">Defined in: <a href="${href}">${
            rdr(defining_obj_name)
        }</a></div>
    ${ concept_referenced_in_list }
  </dd>`;
            } // end for

            s += sqzhtml`
</dl>
${ endnotes() }`;
            return s;
        };

        const result = zoo_flm_engine.render_document({ compose });
        // An error in the page's content has thrown (the 'abort' policy); the
        // warnings are returned.
        for (const diagnostic of result.diagnostics) {
            console.warn(`${data.page.url}: ${format_diagnostic(diagnostic)}`);
        }
        return result.html;
    } finally {
        zoo_flm_engine.release(page_fragments);
        page_fragments = [];
    }
};


export default { data, render, }
