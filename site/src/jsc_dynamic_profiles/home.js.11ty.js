
import {
    generate_random_code_data
} from '@errorcorrectionzoo/jscomponents/randomcode/generate_data.js';


const data = {
    layout: false,
    permalink: '/jsc_dynamic_profiles/home.js',
};

const render = async function (data)
{
    const random_code_data = generate_random_code_data({ eczoodb: data.eczoodb });

    const randomCodeDataStr = JSON.stringify(random_code_data); //, undefined, 4);

    return `
import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';

import { RandomCodeShower } from '@errorcorrectionzoo/jscomponents/randomcode/index.js';

const randomCodeData = ${randomCodeDataStr};

//console.log('randomCodeData =', randomCodeData);

window.addEventListener('load', function () {

    mathjax.load();
    linkanchorvisualhighlight.load();

    // load -- random code

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
`;
};


export default {data, render};
