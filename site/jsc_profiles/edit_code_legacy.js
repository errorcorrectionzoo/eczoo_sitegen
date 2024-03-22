import * as mathjax from '@errorcorrectionzoo/jscomponents/mathjax/setup.js';
import * as linkanchorvisualhighlight from '@errorcorrectionzoo/jscomponents/linkanchorvisualhighlight/setup.js';
import * as editcodelegacy from '@errorcorrectionzoo/jscomponents/editcodelegacy/setup.js';


window.addEventListener('load', async function() {
    linkanchorvisualhighlight.load();
    await mathjax.load();
    editcodelegacy.load();
});

