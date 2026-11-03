//
// NOT PORTED to zoodb 0.3 (gap G5 of the zoodb 0.3.0 port, brief 13 of zoodb's
// dev-docs/initial-design/): @phfaist/zoodbtools_preview 0.2 and the renderer
// that this app shares with /gitpreview
// (../jscomponents/gitzoopreview/renderObject.js) are on 0.3, but
// previewApp.jsx still sets the zoo up for 0.2: it calls
// installZooFlmEnvironmentLinksAndGraphicsHandlers(), which throws since
// zoodbtools 0.2, and gives the objects and images `invalid:` addresses,
// which the FLM engine's HTML output refuses.  The setup of
// ../jscomponents/gitzoopreview/appSetup.jsx is the one for 0.3.
//
import process from 'node:process';
import fs from 'fs';
import path from 'path';

import { PreviewAppServer } from '@phfaist/zoodbtools_previewremote/startRemotePreviewApp.js';

import { citationsinfo_cache_dir_default } from '../eczoodb/dirs_defaults.js';

const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;



const settings = {
    appFilesDir: "dist/", // where parcel will create the app distribution files
    appFileMain: "previewApp.html",
    parcelCommandLineOptions: ['--no-cache', '--no-optimize'], //, '--no-scope-hoist'],
    runParcel: true,

    //serveFilesDir: '../../eczoo_data/',

    serveFiles: {
        'appData.json': {
            eczoo_data_dir: path.join(__dirname, '../../eczoo_data/'),
            schema_root_dir: path.join(__dirname, '../eczoodb/'),
            citationsinfo_cache_dir_default,
        }
    },

    // set START_USER_BROWSER="0" to avoid launching the users' browser
    // automatically
    startUserBrowser: (process.env.START_USER_BROWSER !== '0')
};

// completely clean the dist/ dir to avoid files accumulating there
await fs.promises.rm("dist/", { force: true, recursive: true });

const appServer = new PreviewAppServer(settings);

await appServer.compileAppAndRunServer();
