import tippy from 'tippy.js';

//import 'tippy.js/dist/tippy.css'; // for styling

// we'll use our custom CSS styling
//import 'tippy.js/themes/light.css';

import './popuptippy.scss';


export class PopupInfoTool
{
    constructor(a)
    {
        this.popup_button_container = a.popup_button_container;
        this.popup_button_label = a.popup_button_label;
        this.popup_contents_element = a.popup_contents_element;

        this.popup_contents_element.style.display = 'block';

        // create our button
        let a_elem = document.createElement('a');
        a_elem.setAttribute('href', 'javascript:void(0)');
        a_elem.classList.add('popup-info-button');
        for (let x of a.popup_button_class_list) {
            a_elem.classList.add(x);
        }
        let span_elem = document.createElement('span');
        span_elem.textContent = this.popup_button_label;
        a_elem.appendChild(span_elem);

        this.popup_button_element = a_elem;

        // cf. https://atomiks.github.io/tippyjs/v6/accessibility/#interactivity
        let sole_parent_div = document.createElement('div');
        sole_parent_div.appendChild(this.popup_button_element);
        this.popup_button_container.appendChild(sole_parent_div);

        this.tippy_obj = tippy(
            this.popup_button_element,
            {
                content: this.popup_contents_element,
                allowHTML: true,
                trigger: 'click',
                interactive: true,
                interactiveBorder: 30,
                maxWidth: '450px',
                //boundary: 'viewport',
                //flip: false,
                placement: 'bottom',
                // popperOptions: {
                //     placement: 'bottom',
                // },
                // theme: 'light', // we'll use custom CSS styling in main.scss
            }
        );
    }
};
