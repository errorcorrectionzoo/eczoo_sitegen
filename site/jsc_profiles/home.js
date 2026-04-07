import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';

import { RandomCodeShower } from '@errorcorrectionzoo/jscomponents/randomcode/index.js';

// // guess what, it's 4/1 again 😈😈😈
// import "@errorcorrectionzoo/jscomponents/aizoo20260401/setup.js";

//console.log('randomCodeData =', randomCodeData);

window.addEventListener('load', function () {

    mathjax.load();
    linkanchorvisualhighlight.load();

    // load -- random code

    // the home page sets the random code data in a <script> tag at the bottom of the page.  That
    // script runs synchronously with the page load, so the property already exists for sure when
    // the code here is executed (document 'load' event).
    const randomCodeData = window.eczoo_random_code_data;

    let random_code_element = document.getElementById('random-code-box');
    if (random_code_element) {
        random_code_element._ecz_random_code_shower =
            new RandomCodeShower({
                container: random_code_element,
                random_codes_data: randomCodeData,
                // random_codes_data_url: '/dat/randomcodedata.json'
            });
        console.log("RandomCodeShower attached to element = ", random_code_element);
    }

});
