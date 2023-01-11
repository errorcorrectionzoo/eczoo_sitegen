
const data = {
    layout: null,
    permalink: 'dat/eczoodata.json',
};

const render = async (data) => {

    const eczoodb = data.eczoodb;

    return JSON.stringify(eczoodb.raw_data_db_dump());
}

module.exports = { data, render, };
