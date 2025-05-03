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
    const {
        make_render_shorthands, make_and_render_document
    } = await import('@phfaist/zoodb/zooflm');

    debug(`references.11ty.js -- render()`);

    const { eczoodb } = data;

    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const ecz_bibliorefs_collector = eczoodb.site_ecz_bibliorefs_collector;

    const render_doc_fn = (render_context) => {

        const R = make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let s = '';

        s += sqzhtml`
<h1>References</h1>

<p><i>Download all: <a href="/dat/bibreferences.bib" download>BibTeX</a>, <a href="/dat/bibreferences_csl.json" download>CSL-JSON</a></i></p>

<ul class="bibliography-list">`;
        for (let { compiled_flm, encountered_in_object_list, sort_key } of ecz_bibliorefs_collector.bib_db_sorted) {
            const encountered_in_object_list_sorted_strings =
                [... Object.keys(encountered_in_object_list)].sort();
            let backrefs = encountered_in_object_list_sorted_strings.map( (obj_type_id) => {
                const { object_type, object_id } = encountered_in_object_list[obj_type_id];
                return ref(object_type, object_id);
            });
            s += sqzhtml`
<li data-sort-key="${_.escape(sort_key)}">
    <span class="bibliography-ref">${rdr(compiled_flm)}</span>.<span> </span>
    <span class="bibliography-backref">Appears in: ${backrefs.join(', ')}</span>
</li>
`;
        }

        s += sqzhtml`
</ul>`;

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


export default { data, render, }
