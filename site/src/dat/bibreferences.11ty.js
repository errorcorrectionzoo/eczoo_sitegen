
const data = {
    layout: null,
    permalink: 'dat/bibreferences.json',
}

const render = async (data) => {

    const { eczoodb } = data;

    const encountered_citations = eczoodb.zoo_flm_processor.scanner.get_encountered('citations');

    return JSON.stringify(encountered_citations, null, 4);
};


module.exports = { data, render, };
