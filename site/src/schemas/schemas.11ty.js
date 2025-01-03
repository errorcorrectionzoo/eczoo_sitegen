
const data = {
    pagination: {
        data: 'eczoodb.schemas',
        size: 1,
        addAllPagesToCollections: true,
        alias: 'schemaName',
    },
    layout: null,
    eleventyComputed: {
        permalink: (data) => `/schemas/${data.schemaName}.json`,
    },
};

const render = async (data) => {

    const schemaData = data.eczoodb.schemas[ data.schemaName ];

    return JSON.stringify(schemaData) ;
};

export default { data, render };
