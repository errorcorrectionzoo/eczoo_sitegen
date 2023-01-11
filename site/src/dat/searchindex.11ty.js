
const data = {
    layout: null,
    permalink: 'dat/searchindex.json',
}

const render = async (data) => {

    const { generate_search_index } =
          await import('@errorcorrectionzoo/jscomponents/search/generate_index.js');

    const search_index_data = generate_search_index({ eczoodb: data.eczoodb });

    return JSON.stringify(search_index_data); //, undefined, 4);
};


module.exports = { data, render, };
