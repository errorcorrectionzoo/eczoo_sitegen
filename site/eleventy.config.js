//
// Eleventy site configuration
//

const debug = require('debug')('eczoo_sitegen.eleventyConfigJs');

const path = require('path');
const fs = require('fs');

const faviconPlugin = require("eleventy-favicon");

/*
const eleventyParcelPlugin = require("@kitschpatrol/eleventy-plugin-parcel");
*/

const packageJson = require('./package.json');


Error.stackTraceLimit = 999;


/*
//
// Helper to force Parcel refresh because of sync issues when 11ty outputs its
// files & parcel refreshes
//
let _last_touch_dir_tree = null;
const min_touch_dir_tree_interval_ms = 1000;
function touchDirsTree(dirs, { predicate }={})
{
    console.log(`Request to touch dirs ‘${dirs}’ recursively`);

    const now = new Date();

    if (_last_touch_dir_tree != null
        && (now - _last_touch_dir_tree) < min_touch_dir_tree_interval_ms) {
        return;
    }
    _last_touch_dir_tree = now;

    function _touchDirTreeInner(dir) {
        fs.readdirSync(dir).forEach(file => {
            let fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                //console.log(fullPath);
                _touchDirTreeInner(fullPath);
            } else {
                //console.log(fullPath);
                // touch file
                if (predicate != null && !predicate(fullPath)) {
                    return;
                }
                console.log(`Touching ‘${fullPath}’`);
                fs.utimesSync(fullPath, now, now);
            }
        });
    };

    for (const dir of dirs) {
        console.log(`Touching tree ‘${dir}’ recursively`);
        _touchDirTreeInner(dir);
    }
};
*/



module.exports = (eleventyConfig) => {

    const eczoo_run_options = {
        // Use "!=" such that the string "0" also counts as false
        /*
          run_11ty_parcel: ((process.env.ECZOO_RUN_11TY_PARCEL ?? 1) != 0),
          run_11ty_parcel_lazy: ((process.env.ECZOO_RUN_11TY_PARCEL_LAZY ?? 0) != 0),
        */
        use_test_data: ((process.env.ECZOO_USE_TEST_DATA ?? 0) != 0),
        development_mode: ((process.env.ECZOO_DEVELOPMENT_MODE ?? 0) != 0),
    };

    const eczoo_config = {
        data_dir: path.resolve(__dirname, '..', '..', 'eczoo_data'),
        run_options: eczoo_run_options,
        //development_mode_skip_jscomponents: ['randomcode', 'linkanchorvisualhighlight'],
    };
    if (eczoo_run_options.use_test_data) {
        eczoo_config.data_dir =
            path.resolve(__dirname, '../eczoodb/test_data/');
    }

    eleventyConfig.addGlobalData("eczoo_config", eczoo_config);

    // Watch .yml files!
    eleventyConfig.addDataExtension(
        "yml, yaml", (contents) => ({ IDidntConfigure11tyToLoadYamlFiles: true })
    );
    eleventyConfig.addWatchTarget( eczoo_config.data_dir );

    // building the zoo is pretty consequential, even incrementally, so don't
    // react right away but wait for a couple seconds first
    eleventyConfig.setWatchThrottleWaitTime(5000); // in milliseconds

    eleventyConfig.addLayoutAlias('base_page', 'base_page.11ty.js');

    eleventyConfig.setTemplateFormats(['html','md','njk','11ty.js']);

    eleventyConfig.addPlugin(faviconPlugin, {
        destination: packageJson.config.output,
    });


    // // copy in the Old JS Edit Code Web App --- hmmm nope, seems too complicated to patch
    // eleventyConfig.addPassthroughCopy(
    //     {
    //         "old_edit_code_app_pkg/dist/*": ".",
    //     },
    // );

    // copy in the JS components needed in our site
    let jscomponentsDistDir = "./jscomponents_dist";
    eleventyConfig.addPassthroughCopy(
        {
            [jscomponentsDistDir]: "jsbundle",
        },
        {
            expand: true, // expand symbolic links
        }
    );

    /*
    if (eczoo_run_options.run_11ty_parcel) {

        const eleventy_out_dir = '_site/';

        //
        // Parcel 2.8 lazy seems to have issues with refreshing content when new
        // files are written.  Running 'touch _site/** / *.html' after eleventy
        // finished outputting its files immediately fixes the problem.  We try
        // to do this automatically here by hooking into the middleware's
        // pathRewrite() function.  Whenever a HTML page is requested, we touch
        // the entire 11ty output folder (so that dependent assets including
        // figures are also refreshed).
        //

        const pathRewrite = (p, req) => {
            console.log(`Request ${p}`);

            let finalPath = p;
            if (/^(\/[^.]+)$/.test(p)) {
                // page requested -- rewrite path to include .html
                finalPath = `${p}.html`;
            }
            // if we requested a HTML page, we should touch entire source tree
            // to force parcel to refresh
            if (finalPath === '/' || finalPath.endsWith('.html')) {
                touchDirsTree( [eleventy_out_dir] );
                // touchDirsTree(
                //     [ eleventy_out_dir, 'jscomponents' ],
                //     {
                //         predicate: (fname) => (
                //             fname.endsWith('.html')
                //             || fname.endsWith('.js') //(&& !fname.endsWith('/setup.js'))
                //         ),
                //     }
                // );
            }

            return finalPath;
        };

        //
        // Configure Parcel.  See https://github.com/kitschpatrol/eleventy-plugin-parcel
        //
        eleventyConfig.addPlugin(
            eleventyParcelPlugin,
            {
                parcelOptions: {
                    entries: packageJson.config.siteLandingPaths,
                    defaultConfig: "@parcel/config-default",
                    shouldDisableCache: true,
                    shouldAutoInstall: true,
                    serveOptions: {
                        port: 3000,
                    },
                    hmrOptions: {
                        port: 3001,
                    },
                    //logLevel: 'verbose',

                    defaultTargetOptions: {
                        sourceMaps: (eczoo_run_options.run_11ty_parcel_lazy && eczoo_run_options.development_mode ? true : false),
                    },

                    // build only the pages/modules that were requested
                    shouldBuildLazily: eczoo_run_options.run_11ty_parcel_lazy,

                },
                useMiddleware: true,
                middlewareOptions: {
                    pathRewrite: (path, req) => {
                        try {
                            return pathRewrite(path, req);
                        } catch(err) {
                            console.error("ERROR IN pathRewrite(): ", err);
                        }
                    },
                },
            },
        );

    }*/

    return {
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",

        dir: {
            input: 'src',
            output: '_site',

            includes: '../templates',
            layouts: '../templates/layout',
            data: '../site_data',
        },

        jsDataFileSuffix: '.11tydata',
    };
};




