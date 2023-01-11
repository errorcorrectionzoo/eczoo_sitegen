//const debug = require('debug')('eczoo_sitegen.src.dat.eczoorefsdata');

const data = {
    layout: null,
    permalink: 'dat/eczoorefsdata.json',
};

const render = async (data) => {

    const refs_data = {
        refs:
            data.eczoodb.zoo_llm_environment.ref_resolver.dump_database(),
        citations:
            data.eczoodb.zoo_llm_environment.citations_provider.dump_database(),
    };

    return JSON.stringify(refs_data);

};

module.exports = { data, render, };
