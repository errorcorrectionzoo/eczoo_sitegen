const debug = require('debug')('eczoo_sitegen.src.bibreferences_bib');

const data = {
    layout: null,
    permalink: `/dat/bibreferences.bib`,
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

    const bibrefsdata = eczoodb.site_bibrefsdata;

    const bibtex_list = bibrefsdata.bib_db_sorted.map( (d) => d.bibtex );

    return bibtex_list.join('\n');
};


module.exports = { data, render, }