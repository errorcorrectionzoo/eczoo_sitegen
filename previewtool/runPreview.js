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
