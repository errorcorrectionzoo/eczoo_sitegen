import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';

import * as gitzoopreview from '@errorcorrectionzoo/jscomponents/gitzoopreview/setup.js';


window.addEventListener('load', async function() {
    console.log('Setting up!');
    console.log('to turn on debugging messages and/or to monitor zoo loading progress, copy-paste the following text in the console below and hit ENTER: ', 'localStorage.debug="zoo*,ecz*"');

    await mathjax.load();
    await linkanchorvisualhighlight.load();

    await gitzoopreview.setup();
});
