import debugm from 'debug';
const debug = debugm('eczoo_sitegen.previewtool.previewApp');

import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';

import path from 'path';

import mime from 'mime-types';

import {
    ZooDbPreviewComponent,
    CitationSourceApiPlaceholder,
    //installFlmContentStyles,
    simpleRenderObjectWithFlm,
} from '@phfaist/zoodbtools_preview';

import { fsRemoteCreateClient } from '@phfaist/zoodbtools_previewremote/useFsRemote.js';

import loMerge from 'lodash/merge.js';

import { EcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';
import { EcZooDbYamlDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { render_code_page } from '@errorcorrectionzoo/eczoodb/render_code.js'
import { render_codelist_page } from '@errorcorrectionzoo/eczoodb/render_codelist.js'



// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++





function ReloadCommandButtonsComponent(props)
{
    const { zoodb, doRefreshPreview } = props;

    const btnDomRef = useRef(null);

    const doReloadZoo = async () => {
        const btnText = btnDomRef.current.innerText;
        btnDomRef.current.innerText = '⏳';
        btnDomRef.current.disabled = true;
        try {
            await zoodb.load()
            debug(`Finished reloading the zoo.`);
        } finally {
            btnDomRef.current.disabled = false;
            btnDomRef.current.innerText = btnText;
            doRefreshPreview();
        }
    };

    const doToggleDark = () => {
        window.eczColorSchemeHandler.toggle();
    };

    return (
        <div className="CommandButtonsComponent">
            <button onClick={doReloadZoo} ref={btnDomRef}>RELOAD ZOO</button>
            <button onClick={doToggleDark}>🌒</button>
        </div>
    );
}




// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

function renderObject(zoodb, objectType, objectId, object)
{
    if (objectType === 'code') {
        const code = zoodb.objects.code[objectId];
        return render_code_page(code, { zoo_flm_environment: zoodb.zoo_flm_environment });
    }
    if (objectType === 'codelist') {
        const codelist = zoodb.objects.codelist[objectId];
        return render_codelist_page(codelist, { eczoodb: zoodb });
    }
    return simpleRenderObjectWithFlm(zoodb, objectType, objectId, object);
}





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

    //installFlmContentStyles(); // not needed -- installed by main.scss already

    //
    // Get any information provided by the server
    //

    const serverData = await (await fetch("/appData.json")).json();


    //
    // Set up remote filesystem & fs object
    //

    const fs = fsRemoteCreateClient();


    //
    // load ZooDb 
    //

    let appZooDbOptions = loMerge(
        //
        // our built-in default options/settings
        //
        get_eczoo_full_options(),

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
                            title: "DOI citation",
                            cite_prefix: 'doi',
                            test_url: (_, cite_key) => `https://doi.org/${cite_key}`,
                        }),
                        arxiv: new CitationSourceApiPlaceholder({
                            title: "arXiv [& DOI?] citation",
                            cite_prefix: 'arxiv',
                            test_url: (_, cite_key) => `https://arxiv.org/abs/${cite_key}`,
                        }),
                    },
                    citation_manager_options: {
                        skip_save_cache: true,
                    }
                },
                allow_unresolved_references: true,
                allow_unresolved_citations: true,
            },
            zoo_permalinks: {
                // fixme! We shouldn't do this.  Instead, we should keep the
                // links in some standard convneitonal URL-type format, e.g. as
                // the zoodb internals do zoodbobject://xxx:xxx#, and capture a
                // link click with an event listener placed on the content DIV.
                // In this way we'd be able to process links to anchors and
                // anchors on other pages.
                object: (object_type, object_id) => (
                    `javascript:window.appFlmCallbackObjectLink(`
                        + `${JSON.stringify(object_type)},${JSON.stringify(object_id)}`
                        + `)`
                ),
                graphics_resource: (graphics_resource) => {
                    const imageData = fs.readFileSync(
                        path.join(appZooDbOptions.fs_data_dir,
                                  graphics_resource.source_info.resolved_source)
                    );
                    let mimeType = mime.lookup(
                        graphics_resource.source_info.resolved_source
                    );
                    if (!mimeType) { mimeType = 'image/*'; }
                    const blob = new Blob([ imageData ], { type: mimeType });
                    //window.zoodebugLastImageData = imageData;
                    //console.log(`blob = `, { blob, imageData });
                    console.error(`TODO: make sure we release the object URL `
                                  + `resource created by URL.createObjectURL!!!`);
                    return URL.createObjectURL(blob);
                },
            },
        }
    );

    let zoodb = new EcZooDb( appZooDbOptions );
    zoodb.install_zoo_loader(new EcZooDbYamlDataLoader({
        schema_root: `file://${serverData.schema_root_dir}/`,
    }));

    await zoodb.load();

    // for quick access & debugging in the browser's console
    window.zoodb = zoodb;


    //
    // Render the app
    //
    const reactRoot = createRoot(container);
    reactRoot.render(
        <ZooDbPreviewComponent
            zoodb={zoodb}
            renderObject={renderObject}
            getMathJax={() => window.MathJax}
            objectType={'code'}
            objectId={null}
            installFlmObjectLinkCallback={[window,'appFlmCallbackObjectLink']}
            CommandButtonsComponent={ReloadCommandButtonsComponent}
        />
    );


});
