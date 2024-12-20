
const data = {
    layout: null,
    permalink: 'dat/eczoodata.json',
};

const render = async (data) => {

    const eczoodb = data.eczoodb;

    let dbdump = eczoodb.cached_data_dump;

    return JSON.stringify(dbdump);
}

export default { data, render, };
