import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';

import * as gitzoopreview from '@errorcorrectionzoo/jscomponents/gitzoopreview/setup.js';


window.addEventListener('load', async function() {
    console.log('Setting up!');

    await mathjax.load();
    await linkanchorvisualhighlight.load();

    await gitzoopreview.setup();
});
