
let cached_eczoodb = null;

module.exports = async (configData) => {

    const eczoo_config = configData.eczoo_config;

    if (cached_eczoodb == null) {
        const fs = await import('fs');

        const { EcZooDb } = await import('@errorcorrectionzoo/eczoodb/eczoodb.js');
        const { eczoo_full_options } = await import('@errorcorrectionzoo/eczoodb/fullopts.js');

        const { EcZooDbYamlDataLoader } =
              await import('@errorcorrectionzoo/eczoodb/load_yamldb.js');

        cached_eczoodb = new EcZooDb({
            fs,
            fs_data_dir: eczoo_config.data_dir,
            ... eczoo_full_options
        });
        cached_eczoodb.install_zoo_loader(new EcZooDbYamlDataLoader({ }));
    }

    await cached_eczoodb.load();

    return cached_eczoodb;
};
