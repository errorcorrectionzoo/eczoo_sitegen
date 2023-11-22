
let cached_eczoodb = null;


function get_error_string(err)
{
    let errstr = null;
    try {
        if (err && err.__class__ != null) {
            if (err.args) {
                errstr = `${err.__class__.__name__}: ${err.args}`;
            } else {
                errstr = `${err.__class__.__name__} (no information)`;
            }
        } else {
            errstr = ''+err;
        }
    } catch (tostrerr) {
        errstr = Object.toString(err);
    }
    return errstr;
}


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
            console.error(`ERROR INITIALIZING ZOO: ${get_error_string(err)}`);
            console.error(err);
            throw err;
        }
    }

    try {

        await cached_eczoodb.load();

    } catch (err) {
        console.error(`ERROR LOADING ZOO [site/site_data/eczoodb.js]: ${get_error_string(err)}`);
        console.error(err);
        throw err;
    }

    return cached_eczoodb;
};
