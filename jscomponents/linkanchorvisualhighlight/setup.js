import { setupVisualHighlightLinkEventListener } from './index.js'; // 'eczjscomponents/linkanchorvisualhighlight'; //'./index.js';

import './mystyle.css';

//
// Install event listener(s) for visual highlight effects on internal links
// within EC Zoo pages
//

window.addEventListener("load", () => {

    setupVisualHighlightLinkEventListener('main');
    // also do this for our navigation shortcut "hamburger" button
    setupVisualHighlightLinkEventListener('nav-shortcut-to-navigation-links');

});

