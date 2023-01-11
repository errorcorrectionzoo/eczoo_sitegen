module.exports = async (configData) => {

    const eczoo_config = configData.eczoo_config;

    const fs = await import('fs');
    const { load_eczoo_cached } = await import('@errorcorrectionzoo/eczoodb/load_yamldb.js');

    let config = Object.assign(
        {
            fs,
        },
        eczoo_config
    );

    return await load_eczoo_cached(config);
};
