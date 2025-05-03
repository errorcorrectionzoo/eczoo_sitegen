import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.bibreferences_csl');

const data = {
    layout: null,
    permalink: `/dat/bibreferences_csl.json`,
    eleventyComputed: {
        // ---
        // injection hack to get correct page date property!
        // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
        date: (data) => {
            data.page.date = new Date(
                data.eczoodb.zoo_gitlastmodified_processor.get_latest_modification_date()
            );
            return data.page.date;
        },
        // ---
    },
};

const render = async (data) => {

    debug(`references_bib.11ty.js -- render()`);

    const { eczoodb } = data;

    const ecz_bibliorefs_collector = eczoodb.site_ecz_bibliorefs_collector;

    //debug('dumping csl-json data', bibrefsdata.bibdb_csl_json);

    return JSON.stringify(ecz_bibliorefs_collector.generateCslJsonEntries());
};


export default { data, render, };
