import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';
//import * as obnoxiouscookiebar from '@errorcorrectionzoo/jscomponents/obnoxiouscookiebar/setup.js';


window.addEventListener('load', async function() {
    console.log('Setting up!');
    linkanchorvisualhighlight.load();
    //obnoxiouscookiebar.load();
    await mathjax.load();
});
