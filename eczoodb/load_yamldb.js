import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.load_yamldb");

import path from 'path';

import { YamlDbZooDataLoader } from '@phfaist/zoodb/dbdataloader/yamldb';

import { EcZooDb } from './eczoodb.js';


import { use_relations_populator } from './use_relations_populator.js';
import { use_llm_environment } from './use_llm_environment.js';
import { use_llm_processor } from './use_llm_processor.js';
import { use_searchable_text_processor } from './use_searchable_text_processor.js';


// support __filename & __dirname here
import url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//
// Load & reload zoo from our YAML files database
//


// -----------------------------------------------------------------------------

class EcZooDbYamlDataLoader
{
    constructor({ eczoodb })
    {
        this.eczoodb = eczoodb;
        this._currently_loading = null;

        // easy access method on the eczoodb object itself. -- HHMMM ZooDb
        // should support some ZooLoader() type interface!!
        //
        // this.eczoodb.reload_yamldb = async () => await this.reload_yamldb();
    }

    async load({data_dir, schema_root})
    {
        debug(`Loading YAML data from ‘${data_dir}’`);

        this._currently_loading = true;

        if (schema_root == null) { // null or undefined
            schema_root = `file:///${__dirname}/`;
        }

        this.yamldb_loader = new YamlDbZooDataLoader({
            resource_file_extensions: this.eczoodb.config.resource_file_extensions,
            objects: {
                code: {
                    schema_name: 'code',
                    data_src_path: 'codes/',
                    load_objects: (codefiledata) => {
                        // map 'physical', 'logical' string field values
                        // directly to space: space_id: object relationships
                        // TODO: HANDLE THIS IN ZOODB RELATIONS PROCESSOR!!
                        // codefiledata.physical = { space_id: codefiledata.physical };
                        // codefiledata.logical = { space_id: codefiledata.logical };
                        return [ codefiledata ];
                    },
                },
                space: {
                    schema_name: 'space',
                    data_src_path: 'code_extra/spaces.yml',
                    load_objects: (lst) => lst,
                },
                domain: {
                    schema_name: 'domain',
                    data_src_path: 'codetree/domains.yml',
                    load_objects: (lst) => lst,
                },
                kingdom: {
                    schema_name: 'kingdom',
                    data_src_path: 'codetree/kingdoms.yml',
                    load_objects: (fdata) => {
                        //debug(`Loading kingdoms from file data = `, fdata);
                        let kingdoms_data = [];
                        for (const [domain_id, kingdom_data_list]
                             of Object.entries(fdata.kingdoms_by_domain_id)) {
                            for (const kingdom_data of kingdom_data_list) {
                                kingdoms_data.push(
                                    Object.assign(
                                        { parent_domain: { domain_id, }, },
                                        kingdom_data
                                    )
                                );
                            }
                        }
                        return kingdoms_data;
                    }
                },
                codelist: {
                    schema_name: 'codelist',
                    data_src_path: 'codelists/',
                },
                user: {
                    schema_name: 'user',
                    data_src_path: 'users/users_db.yml',
                    load_objects: (lst) => lst,
                },
            },
            object_defaults: { },
            root_data_dir: data_dir,
            schemas: {
                schema_root: schema_root,
                schema_rel_path: 'schemas/',
                schema_add_extension: '.yml',
            },
        });

        //
        // Load the zoo from the data files
        //
        // Load the Zoo's data!
        await this.eczoodb.load_data( await this.yamldb_loader.load() );

        debug("Zoo is now loaded!");
        this._currently_loading = false;
    }

    async reload()
    {
        if (this._currently_loading) {
            console.error("The zoo is already currently being loaded! Will not "
                          + "reload again at this time.");
            return;
        }
        this._currently_loading = true;

        try {
            debug("Reloading Zoo!");
            const { dbdata, reload_info } = await this.yamldb_loader.reload(this.eczoodb.db);
            await this.eczoodb.update_objects(reload_info.reloaded_objects);
            debug("Finished reloading Zoo.");
            return true;
        } catch (err) {
            console.error('ERROR RELOADING DATA: ', err);
        } finally {
            this._currently_loading = false;
        }
    }

};


// -----------------------------------------------------------------------------


// thanks https://stackoverflow.com/a/35820220/1694896 !
function promiseState(p) {
  const t = {};
  return Promise.race([p, t])
    .then((v) => (v === t) ? "pending" : "fulfilled", () => "rejected");
}


let _cached = null;
let _cached_loading_promise = null;
let _cached_reloading_promise = null;

export async function load_eczoo_cached({data_dir, fs})
{
    if (_cached != null) {
        await _cached_loading_promise;
        if ( (await promiseState(_cached_reloading_promise)) === 'pending') {
            // It's already reloading. Simply wait for current reload to finish;
            // don't start a new reload.
            await _cached_reloading_promise;
        } else {
            // It's not currently reloading. Start reloading!
            _cached_reloading_promise = _cached.eczoodb_loader.reload();
            await _cached_reloading_promise;
        }
        return _cached.eczoodb;
    }
    _cached = {};

    // don't use "await" so that we get the promise instance instead
    _cached_loading_promise = load_eczoo({
        data_dir,
        fs,
        eczoodb_options: {},
        _set_cache(d) { Object.assign(_cached, d) },
    });
    const { eczoodb, eczoodb_loader } = await _cached_loading_promise;
    return eczoodb;
}

export async function load_eczoo({data_dir, fs, eczoodb_options, _set_cache})
{
    let opts = Object.assign(
        {},
        {
            use_relations_populator,
            use_llm_environment,
            use_llm_processor,
            use_searchable_text_processor,
            fs,
            llm_processor_graphics_resources_fs_data_dir: data_dir,    
            llm_processor_citations_override_arxiv_dois_file:
            path.join(data_dir, 'code_extra', 'override_arxiv_dois.yml'),
            llm_processor_citations_preset_bibliography_files: [
                path.join(data_dir, 'code_extra', 'bib_preset.yml'),
            ],
        },
        eczoodb_options
    );

    let eczoodb = new EcZooDb(opts);
    let eczoodb_loader = new EcZooDbYamlDataLoader({ eczoodb, });

    _set_cache?.({ eczoodb, eczoodb_loader, });

    await eczoodb_loader.load({data_dir, });

    return { eczoodb, eczoodb_loader };
}
