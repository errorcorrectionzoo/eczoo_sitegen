import debugm from 'debug';
const debug = debugm('eczoo_sitegen.previewtool.previewApp');

import React from 'react';
import { createRoot } from 'react-dom/client';

import path from 'path';

import {
    ZooDbPreviewComponent,
    CitationSourceApiPlaceholder,
    //installFlmContentStyles,
    //simpleRenderObjectWithFlm,
    installZooFlmEnvironmentLinksAndGraphicsHandlers,
} from '@phfaist/zoodbtools_preview';

import { fsRemoteCreateClient } from '@phfaist/zoodbtools_previewremote/useFsRemote.js';

import loMerge from 'lodash/merge.js';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';
import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { renderObject } from '../jscomponents/gitzoopreview/renderObject.js';



// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


window.addEventListener('load', async () => {


    //
    // Preliminary setup steps
    //

    if (localStorage.debug == null) {
        localStorage.debug = 'ecz*,zoo*';
    }
    debug("Load!");

    const container = document.getElementById('AppContainer');

    const loadZooDb = async () => {
        //
        // create our ZooDb instance for our previews
        //

        //
        // Get any information provided by the server
        //

        const serverData = await (await fetch("/appData.json")).json();

        //
        // Set up remote filesystem & fs object
        //

        const fs = fsRemoteCreateClient();

        //
        // Prepare the ZooDb default options
        //

        let defaultAppZooDbOptions = get_eczoo_full_options();

        //
        // load any existing citations cache to help our citations resolver
        // because we don't have access to DOI & arXiv APIs due to their strict
        // CORS settings
        //

        let loadedCitationsCache = {};
        const fnameCitationsInfoCache = path.join(serverData.citationsinfo_cache_dir_default,
                                                  'cache_compiled_citations.json');
        try {
            loadedCitationsCache = JSON.parse(
                await fs.promises.readFile(fnameCitationsInfoCache)
            );
            debug(`Loaded citations cache file ‘${fnameCitationsInfoCache}’`,
                  loadedCitationsCache);
        } catch (error) {
            console.warn(`Failed to load citations cache file ‘${fnameCitationsInfoCache}’, `
                         + `will proceed without cached info.`, error);
        }


        //
        // Finalize the ZooDb Options & load !
        //

        let appZooDbOptions = loMerge(
            //
            // our built-in default options/settings
            //
            defaultAppZooDbOptions,

            //
            // custom options & settings
            //
            {
                fs,
                fs_data_dir: serverData.eczoo_data_dir,

                use_gitlastmodified_processor: false,
                use_searchable_text_processor: false,

                continue_with_errors: true,

                flm_options: {
                    citations: {
                        sources: {
                            // latch custom placeholder onto arxiv & doi, since
                            // their public APIs seem to have strict CORS settings
                            // meaning we can't call them from other web apps
                            doi: new CitationSourceApiPlaceholder({
                                title: (doi) => `[DOI \\verbcode{${doi}}; citation text will appear on production zoo website]`,
                                cite_prefix: 'doi',
                                test_url: (_, cite_key) => `https://doi.org/${cite_key}`,
                                search_in_compiled_cache: loadedCitationsCache,
                            }),
                            arxiv: new CitationSourceApiPlaceholder({
                                title: (arxivid) => `[arXiv:${arxivid}; citation text will appear on production zoo website (& via DOI if published)]`,
                                cite_prefix: 'arxiv',
                                test_url: (_, cite_key) => `https://arxiv.org/abs/${cite_key}`,
                                search_in_compiled_cache: loadedCitationsCache,
                            }),
                        },

                        cache_dir: '_zoodb_live_preview_dummy_cache_shouldnt_be_created',
                        cache_dir_create: false,

                        skip_save_cache: true,
                    },
                    allow_unresolved_references: true,
                    allow_unresolved_citations: true,
                },
                zoo_permalinks: {
                    object: (objectType, objectId) => (
                        `invalid:zooObjectLink/${objectType}/${objectId}`
                    ),
                    graphics_resource: (graphics_resource) => (
                        `invalid:graphicsResource/${graphics_resource.src_url}`
                    ),
                },
            }
        );

        let zoodb = await createEcZooDb( appZooDbOptions , {
            schema_root: serverData.schema_root_dir,
        } );
        const loader = await createEcZooYamlDbDataLoader(zoodb);
        const loader_handler = new ZooDbDataLoaderHandler(loader);
        await zoodb.install_zoo_loader_handler(loader_handler);


        await zoodb.load();

        // for quick access & debugging in the browser's console
        window.zoodb = zoodb;

        installZooFlmEnvironmentLinksAndGraphicsHandlers(
            zoodb.zoo_flm_environment,
            {
                getGraphicsFileContents: (fname) => {
                    return fs.readFileSync(path.join(appZooDbOptions.fs_data_dir, fname));
                }
            }
        );

        return zoodb;
    };


    const reloadZooDb = async (zoodb) => {

        await zoodb.load();

        debug(`EC Zoo successfully reloaded.`);

        return zoodb;
    };

    let getMathJax = () => {
        return window.MathJax;
    };

    //
    // Render the app
    //
    const reactRoot = createRoot(container);
    reactRoot.render(
        <ZooDbPreviewComponent
            loadZooDb={loadZooDb}
            reloadZooDb={reloadZooDb}
            renderObject={renderObject}
            getMathJax={getMathJax}
            initialObjectType={'code'}
            initialObjectId={null}
            commandButtonsUseReload={true}
            commandButtonsToggleDarkModeCallback={
                () => { window.eczColorSchemeHandler?.toggle() }
            }
        />
    );


});
