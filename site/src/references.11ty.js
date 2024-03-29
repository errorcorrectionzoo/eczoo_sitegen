const debug = require('debug')('eczoo_sitegen.src.concepts');

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

    let citation_compiler = eczoodb.zoo_flm_processor.citation_compiler;

    const all_citations =
          eczoodb.zoo_flm_processor.scanner.get_encountered('citations');
    
    let bib_db = {};

    for (const { cite_prefix, cite_key, encountered_in } of all_citations) {
        let cite_prefixkey = `${cite_prefix}:${cite_key}`;
        if (!Object.hasOwn(bib_db, cite_prefixkey)) {
            let compiled_flm = citation_compiler.get_compiled_citation(cite_prefix, cite_key);
            let sort_key = compiled_flm.flm_text ?? compiled_flm;
            sort_key = sort_key.replace(/\b\w\b\.?[ -]*| and /g, ''); // attempt to remove initials & "and"
            sort_key = sort_key.replace(/\W/g, ''); // remove all non-alphanum chars
            //debug(`sort_key: ${compiled_flm.flm_text} -> ${sort_key}`);

            bib_db[cite_prefixkey] = {
                cite_prefix,
                cite_key,
                compiled_flm,
                sort_key,
                encountered_in_list: [],
            };
        }
        let { resource_info } = encountered_in;
        let encountered_in_list = bib_db[cite_prefixkey].encountered_in_list;
        let obj_type_id = `${resource_info.object_type}:${resource_info.object_id}`;
        if (!encountered_in_list.includes(obj_type_id)) {
            encountered_in_list.push(obj_type_id);
        }
    }

    // sort the database by final citation text (argh..), i.e. roughly by first author last name ... argh
    let bib_db_sorted = Object.values(bib_db).sort(
        (obj1, obj2) => obj1.sort_key.localeCompare(obj2.sort_key)
    );

    const render_doc_fn = (render_context) => {

        const R = make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let s = '';

        s += sqzhtml`
<h1>References</h1>

<ul class="bibliography-list">`;
        for (let { compiled_flm, encountered_in_list } of bib_db_sorted) {
            encountered_in_list = [...encountered_in_list].sort();
            let backrefs = encountered_in_list.map( (obj_type_id) => {
                // [_,a,b] = /^([^:]+)\:(.*)$/.exec('code:duisnosaf')
                let [_, object_type, object_id] = /^([^:]+):(.*)$/.exec(obj_type_id);
                //debug(`ref(): ${JSON.stringify(obj_type_id)} - `, {object_type, object_id});
                return ref(object_type, object_id);
            });
            s += sqzhtml`
<li>
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


module.exports = { data, render, }
