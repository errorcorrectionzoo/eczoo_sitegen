import fs from 'fs';

import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';

import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';



let cached_eczoodb = null;


function format_flm_diagnostics(diagnostics)
{
    let slist = [];
    for (const d of diagnostics) {
        let {message, origin, line, col} = d;
        try {
            line = origin.start_line + line - 1;
            col = origin.start_col-1 + col-1;
        } catch (_) { }
        slist.push(`${message}

@: ${origin.source_path}
   line ${line} col ${col}  [${origin.object_type}:${origin.object_id} → .${origin.field}]
`);
    }
    if (slist.length > 0) {
        return `
🚨🚨🚨 FLM ERROR(S) 🚨🚨🚨
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

${slist.join('\n\n++++++++++++++++++++++++++++++++++++++++++++++++++\n\n')}

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
🚨🚨🚨 🚨🚨🚨 🚨🚨🚨
`;
    }
    return '<??ZooFlmError WITH NO DIAGNOSTICS??>';
}

function get_error_string(err)
{
    if (err && err.constructor && err.constructor.name === 'ZooFlmError') {
        return format_flm_diagnostics(err.diagnostics);
    }
    return ''+err; // convert to string so we can show something to the user
}


export async function load_or_reload_eczoodb(eczoo_config)
{
    if (cached_eczoodb == null) {

        try {

            cached_eczoodb = await createEcZooDb({
                fs,
                fs_data_dir: eczoo_config.data_dir,
                ... get_eczoo_full_options({
                    citationsinfo_cache_dir: eczoo_config.citationsinfo_cache_dir
                })
            });
            const loader = await createEcZooYamlDbDataLoader(cached_eczoodb);

            const loader_handler = new ZooDbDataLoaderHandler(
                loader,
                {
                    throw_reload_errors: false, // for when in devel mode with eleventy
                }
            );
            await cached_eczoodb.install_zoo_loader_handler(loader_handler);

        } catch (err) {
            console.error(`ERROR INITIALIZING ZOO:\n${get_error_string(err)}`);
            console.error(err);
            throw err;
        }
    }

    try {

        await cached_eczoodb.load();

    } catch (err) {
        console.error(`ERROR LOADING ZOO [raised by site/site_data/eczoodb.js]:\n${get_error_string(err)}`);
        console.error(err);
        throw err;
    }

    return cached_eczoodb;
};
