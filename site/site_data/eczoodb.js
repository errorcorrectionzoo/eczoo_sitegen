
let cached_eczoodb = null;

module.exports = async (configData) => {

    const eczoo_config = configData.eczoo_config;

    if (cached_eczoodb == null) {
        const fs = await import('fs');

        const { createEcZooDb } = await import('@errorcorrectionzoo/eczoodb/eczoodb.js');
        const { get_eczoo_full_options } =
              await import('@errorcorrectionzoo/eczoodb/fullopts.js');

        const { createEcZooYamlDbDataLoader } =
              await import('@errorcorrectionzoo/eczoodb/load_yamldb.js');

        const { ZooDbDataLoaderHandler } = await import('@phfaist/zoodb');

        try {

            cached_eczoodb = await createEcZooDb({
                fs,
                fs_data_dir: eczoo_config.data_dir,
                ... get_eczoo_full_options()
            });
            const loader = await createEcZooYamlDbDataLoader(cached_eczoodb);

            const loader_handler = new ZooDbDataLoaderHandler(
                loader,
                {
                    throw_reload_errors: false, // for when in devel mode with eleventy
                }
            );
            cached_eczoodb.install_zoo_loader_handler(loader_handler);

        } catch (err) {
            console.error(err);
            console.err(`ERROR INITIALIZING ZOO: ${err}`);
            throw err;
        }
    }

    try {

        await cached_eczoodb.load();

    } catch (err) {
        console.error(err);
        console.err(`ERROR LOADING ZOO: ${err}`);
        throw err;
    }

    return cached_eczoodb;
};
