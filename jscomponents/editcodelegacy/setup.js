import { EczEditCodeAppInstaller } from './setup_app.jsx';


export function load()
{

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
}
