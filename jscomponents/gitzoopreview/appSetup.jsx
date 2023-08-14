import debugm from 'debug';
const debug = debugm('eczoo_sitegen.previewtool.previewApp');

import React from 'react';
import { createRoot } from 'react-dom/client';

import csl_style_json_data_str from 'bundle-text:@errorcorrectionzoo/eczoodb/eczoo-bib-style.json';

import './appSetupStyle.scss';

//import path from 'path';
//import mime from 'mime-types';

import {
    //ZooDbPreviewComponent,
    CitationSourceApiPlaceholder,
    //installFlmContentStyles,
    simpleRenderObjectWithFlm,
    installZooFlmEnvironmentLinksAndGraphicsHandlers,
} from '@phfaist/zoodbtools_preview';

import { setupBrowserFs, ZooDbGithubRepoPreviewComponent } from '@phfaist/zoodbtools_gitpreview';

import loMerge from 'lodash/merge.js';

import { ZooDbDataLoaderHandler } from '@phfaist/zoodb';
import { createEcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';
import { createEcZooYamlDbDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';


import { renderObject } from './renderObject.js';



// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++



export async function installApp({ elementId })
{

    const domContainer = document.getElementById(elementId);

    //
    // Preliminary setup steps
    //

    if (localStorage.debug == null) {
        localStorage.debug = 'ecz*,zoo*';
    }
    debug("Load!");

    //
    // Set up our persistent in-browser FS
    //

    const fs = await setupBrowserFs({
        fs: "IndexedDB",
        options: {}
    });

    const loadZooDbFromFsDir = async ({ fsRepoDir }) => {
        //
        // create our ZooDb instance for our previews
        //

        debug(`Initiating zoo load...`);

        //
        // Prepare the ZooDb default options
        //

        let csl_style_json_data = JSON.parse(csl_style_json_data_str);
        //debug(`Imported CSL data is `, csl_style_json_data);
        let defaultAppZooDbOptions = get_eczoo_full_options({
            csl_style_data: csl_style_json_data.data,
        });
        debug(`Using default app options`, defaultAppZooDbOptions);

        //
        // load any existing citations cache to help our citations resolver
        // because we don't have access to DOI & arXiv APIs due to their strict
        // CORS settings
        //

        // fetch our current eczoo data, including refs_data and citations database
        let eczooData = await (await fetch('/dat/eczoodata.json')).json();
        debug(`Fetched eczooData`, eczooData);
        
        let loadedCitationsCache = eczooData?.refs_data?.citations?.citations_database;
        // const fnameCitationsInfoCache = path.join(serverData.citationsinfo_cache_dir_default,
        //                                           'cache_compiled_citations.json');
        // try {
        //     loadedCitationsCache = JSON.parse(
        //         await fs.promises.readFile(fnameCitationsInfoCache)
        //     );
        //     debug(`Loaded citations cache file ‘${fnameCitationsInfoCache}’`,
        //           loadedCitationsCache);
        // } catch (error) {
        //     console.warn(`Failed to load citations cache file ‘${fnameCitationsInfoCache}’, `
        //                  + `will proceed without cached info.`, error);
        // }


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
                fs_data_dir: fsRepoDir,

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
                                placeholder_name: 'DOI citation API',
                                cite_prefix: 'doi',
                                test_url: (_, cite_key) => `https://doi.org/${cite_key}`,
                                search_in_compiled_cache: loadedCitationsCache,
                            }),
                            arxiv: new CitationSourceApiPlaceholder({
                                title: (arxivid) => `[arXiv:${arxivid}; citation text will appear on production zoo website (& via DOI if published)]`,
                                placeholder_name: 'arXiv citation API',
                                cite_prefix: 'arxiv',
                                test_url: (_, cite_key) => `https://arxiv.org/abs/${cite_key}`,
                                search_in_compiled_cache: loadedCitationsCache,
                            }),
                        },

                        resources: {
                            read_file_data: true,
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

        debug(`about to createEcZooDb with options`, appZooDbOptions);

        let zoodb = await createEcZooDb( appZooDbOptions );
        const loader = await createEcZooYamlDbDataLoader(zoodb, {
            //schema_root: `https://errorcorrectionzoo.org/`, // why not?
            schema_root: (new URL(`/`, window.location.href)).href, // why not?
            schema_add_extension: '.json',
        });
        const loader_handler = new ZooDbDataLoaderHandler(loader);
        zoodb.install_zoo_loader_handler(loader_handler);

        await zoodb.load();

        // for quick access & debugging in the browser's console
        window.zoodb = zoodb;

        installZooFlmEnvironmentLinksAndGraphicsHandlers(
            zoodb.zoo_flm_environment,
            {
                getGraphicsFileContents: (fname, { graphics_resource, }) => {
                    return graphics_resource.source_info.file_content;
                }
            }
        );

        return zoodb;
    };

    let getMathJax = () => {
        return window.MathJax;
    };

    //
    // Render the app
    //
    const reactRoot = createRoot(domContainer);
    reactRoot.render(
        <ZooDbGithubRepoPreviewComponent
            githubUser={'errorcorrectionzoo'}
            githubRepo={'eczoo_data'}
            allowChoosePullRequest={true}
            fs={fs}
            loadZooDbFromFsDir={loadZooDbFromFsDir}
            initialBranchName={'main'}
            renderObject={renderObject}
            getMathJax={getMathJax}
            initialObjectType={'code'}
            initialObjectId={''}
            commandButtonsToggleDarkModeCallback={false}
        />
    );

    return;
}
