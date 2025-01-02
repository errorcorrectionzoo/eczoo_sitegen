// ### Let's avoid bloating modules on the home page -- don't use debug() here
//
// import debug_mod from 'debug';
// const debug = debug_mod('eczoo_sitegen.jscomponents.randomcode');

import './randomcode.scss';

import { zoo_object_permalink } from '@errorcorrectionzoo/eczoodb/permalinks.js';


const window_fetch = window.fetch;


export class RandomCodeShower
{
    constructor({container, random_codes_data, random_codes_data_url})
    {
        this.element_container = container;

        this.random_codes_data = null;

        if (random_codes_data != null) {
            this.random_codes_data = random_codes_data;
            this.pick_and_show_random_code();
        } else {
            window_fetch(random_codes_data_url).then(
                (response) => response.json()
            ).then(
                (data) => {
                    this.random_codes_data = data;
                    this.pick_and_show_random_code();
                }
            )
        }
    }

    pick_and_show_random_code()
    {
        if (this.random_codes_data == null) {
            throw new Error("RandomCodeShower.pick_and_show_random_code() called before "+
                            "data was loaded");
        }

        //debug("Choosing a random code to show ... ");

        const code_ids = Object.keys( this.random_codes_data.codes );

        const random_code_id = code_ids[ parseInt(code_ids.length * Math.random(), 0) ];
        const random_code = this.random_codes_data.codes[random_code_id];

        this._show_code(random_code_id, random_code);
    }

    _show_code(code_id, code)
    {
        let desc_html = code.description_html;

        const code_url = zoo_object_permalink('code', code_id);

        this.element_container.innerHTML = '';

        const h1 = document.createElement('h1');
        h1.innerHTML = `Your Random Code Pick: ${code.name_html}`;

        const a_go = document.createElement('a');
        a_go.setAttribute('href', code_url);
        a_go.classList.add('random-code-quick-link');
        a_go.classList.add('random-code-quick-link-go');
        a_go.innerText = 'go →';

        const a_new_random = document.createElement('a');
        a_new_random.classList.add('random-code-quick-link');
        a_new_random.classList.add('random-code-quick-link-refresh');
        a_new_random.textContent = 'refresh';
        a_new_random.href = 'javascript:void(0);'
        a_new_random.setAttribute('rel', 'nofollow');
        a_new_random.addEventListener('click', () => this.pick_and_show_random_code());

        const p_desc = document.createElement('p');
        p_desc.classList.add('random-code-content');
        p_desc.innerHTML = desc_html;

        this.element_container.appendChild(h1);
        this.element_container.appendChild(a_go);
        this.element_container.appendChild(a_new_random);
        this.element_container.appendChild(p_desc);
        
        if (window?.MathJax?.typesetPromise != null) {
            window.MathJax.typesetPromise([this.element_container]);
        }
    }
}


