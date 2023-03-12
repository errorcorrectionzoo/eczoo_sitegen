import { RandomCodeShower } from './index.js';

window.addEventListener('load', function () {

    let random_code_element = document.getElementById('random-code-box');
    if (random_code_element) {
        random_code_element._ecz_random_code_shower =
            new RandomCodeShower({container: random_code_element,
                                  random_codes_data_url: '/dat/randomcodedata.json'});
        console.log("RandomCodeShower attached to element = ", random_code_element);
    }

});
