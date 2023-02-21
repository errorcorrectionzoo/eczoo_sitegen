import debugm from 'debug';
const debug = debugm('eczoo.jscomponents.editcodelegacy.setup_app');

import React from "react";
import { createRoot } from "react-dom/client";

import { parse as YAML_parse } from 'yaml'; // yaml fails to parse multi-line strings !?
//import jsyaml from 'js-yaml';

import EczSchemaRefResolver from './eczschemarefresolver.js';

import EczEditCodeApp from "./EczEditCodeApp.jsx";

export default EczEditCodeApp;



class EczEditCodeAppInstaller {
    constructor(root_element, code_id, code_yml_filename)
    {
        let _this = this;

        this.root_element = root_element;
        this.code_id = code_id || '';
        this.code_yml_filename = code_yml_filename;

        this.schema_resolver = new EczSchemaRefResolver();

        // Fetch schema, we'll need it.
        this.resolve_ecc_schema_promise =
            this.schema_resolver.resolve('/schemas/code')
            .then( (schema) => {
                console.log("resolved ecc schema."); //: ", schema);
                _this.code_schema = schema;
            } );
        
        this.ready_to_install_promise = this.resolve_ecc_schema_promise;

        if (code_yml_filename) {

            //
            // Fetch the code data that we should edit, and fetch the 
            //
            const fetch_codeyml_url = (
                'https://raw.githubusercontent.com/errorcorrectionzoo/eczoo_data/main/'
                    + code_yml_filename
            );
            this.fetch_code_data_promise = fetch(fetch_codeyml_url).then(
                async (response) => {
                    const response_data = await response.text();
                    try {
                        _this.code_data = YAML_parse( response_data );
                        // = jsyaml.load( response_data );
                    } catch (e) {
                        console.log("Error in YAML source file.", response_data);
                        console.log(e);
                        alert(
                            "Sorry! There is an error in the source YAML file.  Please "
                           +"report this issue to us. You could file an issue on our "
                           +"github repo at "
                           +"https://github.com/errorcorrectionzoo/eczoo_data/issues .\n\n"
                           +e
                        );
                        _this.code_yml_filename = null;
                        _this.code_data = {};
                    }
                    console.log("Got code data."); // -> ", _this.code_data);
                }
            );

            this.ready_to_install_promise = Promise.all([
                this.resolve_ecc_schema_promise,
                this.fetch_code_data_promise
            ]);

        } else {

            // prepare empty data structure
            if (code_id) {
                this.code_data = { code_id: code_id };
            } else {
                this.code_data = { };
            }

        }

        this.ready_to_install_promise.then( () => { _this.install() } );
    };

    
    install()
    {
        //
        // Render the app
        //
        debug('installing app into', this.root_element,
              'component object is', EczEditCodeApp);
        const root = createRoot( this.root_element );
        root.render(
            (<EczEditCodeApp
                    code_id={this.code_id}
                    code_yml_basename={(this.code_yml_filename||'').split('/').pop()}
                    code_schema={this.code_schema}
                    code_data={this.code_data} />)
        );
    }

};




window.addEventListener('load', () => {

    //
    // Find where to install our JS App
    //
    let root_element = document.getElementById("main");

    //
    // find the code that we are editing
    //
    const urlhash = window.location.hash;
    let loadInfo = {};
    //console.log('urlhash: ', {urlhash});
    if (urlhash.startsWith('#')) {
        // there is indeed a URL hash
        let urlhashValue = decodeURIComponent(urlhash.slice(1));
        if (urlhashValue.startsWith('{')) {
            loadInfo = JSON.parse(urlhashValue);
        } else {
            console.log('Unknown hash :/');
        }
        console.log("Loading code info.", { urlhash, loadInfo });
    }
    const code_id = loadInfo.code_id ?? null;
    const code_yml_filename = loadInfo.code_yml_filename ?? null;

    console.log("Preparing to install the edit code app. code_id = ", code_id,
                "; code_yml_filename = ", code_yml_filename);

    window.ecz_edit_code_app_installer =
        new EczEditCodeAppInstaller(root_element, code_id, code_yml_filename);
});
