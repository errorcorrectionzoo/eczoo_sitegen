//
// MathJax: the page's <head> configures and loads MathJax 4 with the FLM
// engine's scripts (`html_scripts()`, written by the page layout
// site/templates/layout/base_page.11ty.js): the configuration typesets the
// formulas of the FLM content (the elements `.flm-pres-math--passthrough`)
// when MathJax starts, and the loader is `async`.  load() configures and
// loads nothing; it resolves once MathJax has started and typeset the page
// (`MathJax.startup.promise`), whether MathJax was loaded before or after this
// module runs.
//


function mathjax_loaded()
{
    // Before the loader has run, window.MathJax is the configuration object;
    // MathJax replaces it with its own object, which has a version.
    return (window.MathJax?.version != null && window.MathJax?.startup?.promise != null);
}


export async function load()
{
    if (window.MathJax == null) {
        throw new Error(
            `No MathJax configuration on this page: the page layout writes the FLM `
            + `engine's scripts (html_scripts()) in <head>.`
        );
    }

    if (!mathjax_loaded()) {
        // Not loaded yet: be called when MathJax is ready, after the default
        // startup (which typesets the page through the configuration's
        // pageReady).
        await new Promise( (resolve) => {
            const startup = window.MathJax.startup ??= {};
            const ready = startup.ready;
            startup.ready = function () {
                if (ready != null) {
                    ready();
                } else {
                    window.MathJax.startup.defaultReady();
                }
                resolve();
            };
        } );
    }

    console.log('Typesetting math...');
    return await window.MathJax.startup.promise;
}
