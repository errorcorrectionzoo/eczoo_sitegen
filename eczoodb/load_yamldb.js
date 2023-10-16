//import debugm from 'debug';
//const debug = debugm('eczoodb.load_yamldb');

import { makeStandardYamlDbDataLoader } from '@phfaist/zoodb/std/stdyamldbdataloader';

import { objects_config } from './objects_config.js';


export async function createEcZooYamlDbDataLoader(zoodb)
{
    const config = {

        //
        // specify objects & where to find them
        //
        objects: objects_config
        
    };

    return await makeStandardYamlDbDataLoader(zoodb, config);
};
