
let cached_eczoodb = null;

module.exports = async (configData) => {

    const eczoo_config = configData.eczoo_config;

    if (cached_eczoodb == null) {
        const fs = await import('fs');

        const { EcZooDb } = await import('@errorcorrectionzoo/eczoodb/eczoodb.js');
        const { get_eczoo_full_options } =
              await import('@errorcorrectionzoo/eczoodb/fullopts.js');

        const { EcZooDbYamlDataLoader } =
              await import('@errorcorrectionzoo/eczoodb/load_yamldb.js');

        try {

            cached_eczoodb = new EcZooDb({
                fs,
                fs_data_dir: eczoo_config.data_dir,
                ... get_eczoo_full_options()
            });
            cached_eczoodb.install_zoo_loader(new EcZooDbYamlDataLoader({ }));

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
