//
// Initialize MathJax configuration.
//


const typesetPageMathPromise = function()
{
    const elements = window.document.querySelectorAll('.display-math, .inline-math');
    return window.MathJax.typesetPromise(elements);
};


export async function load()
{
    let setupPromise = new Promise( (resolve) => {

        window.MathJax = {
            tex: {
                inlineMath: [['\\(', '\\)']],
                displayMath: [['\\[', '\\]']],
                processEnvironments: true,
                processRefs: true,

                // equation numbering on
                tags: 'ams',
            },
            options: {
                // all MathJax content is marked with CSS classes
                // skipHtmlTags: 'body',
                // processHtmlClass: 'display-math|inline-math',
            },
            startup: {
                pageReady: function() {
                    // override the default "typeset everything on the page" behavior to
                    // only typeset whatever we have explicitly marked as math
                    console.log('Typesetting math...');
                    return typesetPageMathPromise().then(resolve);
                },
            },
        };

        // -- go! --

        let script = window.document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-chtml.min.js';
        script.async = true;
        window.document.head.appendChild(script);
    } );

    return await setupPromise;
}
