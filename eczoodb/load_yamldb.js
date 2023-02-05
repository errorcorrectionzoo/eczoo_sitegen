import debugm from 'debug';
const debug = debugm('eczoodb.load_yamldb');

import { StandardZooDbYamlDataLoader } from '@phfaist/zoodb/std/load_yamldb';

// support __filename & __dirname here
import path from 'path';
import url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export class EcZooDbYamlDataLoader extends StandardZooDbYamlDataLoader
{
    constructor({ schema_root }={})
    {
        schema_root ??= `file://${__dirname}/`;

        debug('schema_root is ', { schema_root });

        super({
            //
            // specify objects & where to find them
            //
            objects: {
                code: {
                    schema_name: 'code',
                    data_src_path: 'codes/',
                    load_objects: (codefiledata) => {
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
            
            //
            // specify where to find schemas
            //
            schemas: {
                schema_root: schema_root,
                schema_rel_path: 'schemas/',
                schema_add_extension: '.yml',
            },

        });
        this.schema_root = schema_root;
    }
};
