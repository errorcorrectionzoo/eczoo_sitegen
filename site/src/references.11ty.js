import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.references');

import _ from 'lodash';

const data = {
    title: 'References',
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

    debug(`references.11ty.js -- render()`);

    const { eczoodb } = data;

    const zoo_flm_engine = eczoodb.zoo_flm_engine;

    const ecz_bibliorefs_collector = eczoodb.site_ecz_bibliorefs_collector;

    // The citation texts (FLM text from the citation compiler) as ad hoc
    // fragments of this page, released when the page is done.
    let fragments = [];
    try {
        const entries = ecz_bibliorefs_collector.bib_db_sorted.map( (bibentry) => {
            const { compiled_flm, cite_prefix_key } = bibentry;
            let fragment = null;
            if (compiled_flm != null) {
                fragment = zoo_flm_engine.make_fragment(compiled_flm, {
                    origin: { label: `references: ${cite_prefix_key}` },
                    layout: 'inline',
                });
                fragments.push(fragment);
            }
            return { bibentry, fragment };
        });

        const compose = (R) => {
            const { rdr, ref } = R;

            let s = '';

            s += sqzhtml`
<h1>References</h1>

<p><i>Download all: <a href="/dat/bibreferences.bib" download>BibTeX</a>, <a href="/dat/bibreferences_csl.json" download>CSL-JSON</a></i></p>

<ul class="bibliography-list">`;
            for (const { bibentry, fragment } of entries) {
                const { encountered_in_object_list, sort_key } = bibentry;
                const encountered_in_object_list_sorted_strings =
                    [... Object.keys(encountered_in_object_list)].sort();
                let backrefs = [];
                for (const obj_type_id of encountered_in_object_list_sorted_strings) {
                    const { object_type, object_id } = encountered_in_object_list[obj_type_id];
                    // (an object without a page, such as a space, is not linked to)
                    if (eczoodb.zoo_object_permalink(object_type, object_id) == null) {
                        continue;
                    }
                    backrefs.push(ref(object_type, object_id));
                }
                s += sqzhtml`
<li data-sort-key="${_.escape(sort_key)}">
    <span class="bibliography-ref">${rdr(fragment)}</span>.<span> </span>
    <span class="bibliography-backref">Appears in: ${backrefs.join(', ')}</span>
</li>
`;
            }

            s += sqzhtml`
</ul>`;

            return s;
        };

        const result = zoo_flm_engine.render_document({ compose });
        // An error in the content has thrown (the 'abort' policy); the
        // warnings are returned.
        for (const diagnostic of result.diagnostics) {
            console.warn(`${data.page.url}: ${format_diagnostic(diagnostic)}`);
        }
        return result.html;

    } finally {
        zoo_flm_engine.release(fragments);
    }
};


export default { data, render, }
