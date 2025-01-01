// import debugm from 'debug';
// const debug = debugm('eczoo_sitegen.src.fig');

import fsPromises from 'fs/promises';


const data = async () => {
    return {
        pagination: {
            data: 'eczoodb.zoo_flm_processor.resource_collector.collected_resources.graphics_path',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: false,
            alias: 'graphics_resource_data',
        },
        layout: null,
        eleventyComputed: {
            permalink:
                (data) => `/fig/${ data.graphics_resource_data.target_info.target_name }`,
            target_name:
                (data) => data.graphics_resource_data.target_info.target_name,
        }
    };
};

const render = async (data) => {
    const graphics_resource_data = data.graphics_resource_data;
    const full_source_path = graphics_resource_data.resolved_info.full_source_path;
    return await fsPromises.readFile(full_source_path);
};

export default { data, render, }
