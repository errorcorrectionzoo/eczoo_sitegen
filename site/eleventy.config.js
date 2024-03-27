//
// Eleventy site configuration
//

const debug = require('debug')('eczoo_sitegen.eleventyConfigJs');

const path = require('path');

const faviconPlugin = require("eleventy-favicon");

const eleventyParcelPlugin = require("@kitschpatrol/eleventy-plugin-parcel");

const packageJson = require('./package.json');


Error.stackTraceLimit = 999;



let _eczoo_code_graph_svg_exporter_instance = null;



module.exports = (eleventyConfig) => {

    const eczoo_run_options = {
        // Use "!=" such that the string "0" also counts as false
        run_11ty_parcel: ((process.env.ECZOO_RUN_11TY_PARCEL ?? 1) != 0),
        run_11ty_parcel_lazy: ((process.env.ECZOO_RUN_11TY_PARCEL_LAZY ?? 0) != 0),

        use_test_data: ((process.env.ECZOO_USE_TEST_DATA ?? 0) != 0),
        development_mode: ((process.env.ECZOO_DEVELOPMENT_MODE ?? 0) != 0),
    };

    const eczoo_config = {
        data_dir: path.resolve(__dirname, '..', '..', 'eczoo_data'),
        run_options: eczoo_run_options,
        site_base_url_host_name: 'https://errorcorrectionzoo.org/',
    };
    if (eczoo_run_options.use_test_data) {
        eczoo_config.data_dir =
            path.resolve(__dirname, '../eczoodb/test_data/');
    }

    eczoo_config.generate_code_graph_svg_exports
        = ! eczoo_config.run_options.development_mode;

    eleventyConfig.addGlobalData("eczoo_config", eczoo_config);

    // Watch .yml files!
    eleventyConfig.addDataExtension(
        "yml, yaml", (contents_) => ({ IDidntConfigure11tyToLoadYamlFiles: true })
    );
    eleventyConfig.addWatchTarget( eczoo_config.data_dir );

    let _eczoo_code_graph_svg_exporter_instance = null;

    // Build the EC zoo and include it in the 11ty structure as global data.
    // The callback will be executed again on subsequent builds in dev mode.
    eleventyConfig.addGlobalData("eczoodb", async () => {

        //
        // Prepare a code graph SVG generator instance (use single instance across
        // all generated graphs because an instance spins up a Chrome puppeteer
        // instance!)  
        //
        // TODO: Don't wait until this is finished before starting to load the EcZoo.
        //
        if ( eczoo_config.generate_code_graph_svg_exports ) {
            const { init_headless_graph_exporter } =
                await import('./sitelib/init_headless_graph_exporter.js');
            _eczoo_code_graph_svg_exporter_instance = await init_headless_graph_exporter();
        }

        //
        // (Re)load the EC Zoo Database.
        //
        const { load_or_reload_eczoodb } = await import('./sitelib/build_eczoo.js');
        const eczoodb = await load_or_reload_eczoodb(eczoo_config);
        //
        // Prepare data dump of the EC Zoo.
        //
        const eczoodbData = await eczoodb.data_dump({});
        eczoodb.cached_data_dump = eczoodbData;

        // save the exporter (whether or not it is null) directly as an attribute of the eczoodb
        // object. This is how domain-graph and kingdom-graph pages access the instance.
        eczoodb.custom_headless_graph_exporter_instance = _eczoo_code_graph_svg_exporter_instance;

        if (_eczoo_code_graph_svg_exporter_instance != null) {
            
            try {
                await _eczoo_code_graph_svg_exporter_instance.loadEcZooDbData(eczoodbData);
            } catch (err) {
                console.error(`Problem initializing code graph exporter!`);
                process.exit(1);
            }
        }
        return eczoodb;
    });
    if ( eczoo_config.generate_code_graph_svg_exports ) {
        eleventyConfig.on('eleventy.after', async () => {
            if (_eczoo_code_graph_svg_exporter_instance != null) {
                await _eczoo_code_graph_svg_exporter_instance.done();
                _eczoo_code_graph_svg_exporter_instance = null;
            }
        });
    }

    // building the zoo is pretty consequential, even incrementally, so don't
    // react right away but wait for a couple seconds first
    eleventyConfig.setWatchThrottleWaitTime(5000); // in milliseconds

    eleventyConfig.addLayoutAlias('base_page', 'base_page.11ty.js');

    eleventyConfig.setTemplateFormats(['html','md','njk','11ty.js']);

    eleventyConfig.addPlugin(faviconPlugin, {
        destination: packageJson.config.output,
    });

    eleventyConfig.addFilter("getEczooAbsoluteUrl", function(page_url) {
        const absoluteUrlObject = new URL(
            this.url(page_url .replace(/\.html$/, '')),
            eczoo_config.site_base_url_host_name
        );
        return absoluteUrlObject.href;
    });


    // //
    // // Prepare a code graph SVG generator instance (use single instance across
    // // all generated graphs because an instance spins up a Chrome puppeteer
    // // instance!)
    // //
    // if ( eczoo_config.generate_code_graph_svg_exports ) {
    //     debug('Setting up the code graph SVG exporter instance');
    //     eleventyConfig.on('eleventy.before', async () => {
    //         try {
    //             const { CodeGraphSvgExporter } = await import(
    //                 '@errorcorrectionzoo/jscomponents/codegraph/headlessGraphExporter.js'
    //             );
    //             if (_eczoo_code_graph_svg_exporter_instance != null) {
    //                 throw new Error(
    //                     `There is already an instance set in `
    //                     + `_eczoo_code_graph_svg_exporter_instance!!`
    //                 );
    //             }
    //             _eczoo_code_graph_svg_exporter_instance = new CodeGraphSvgExporter({
    //                 autoCloseMs: 5 * 60 * 1000, // 5 minutes
    //             });
    //             await _eczoo_code_graph_svg_exporter_instance.setup();
    //         } catch (error) {
    //             console.error('Failed to initialize the SVG code graph exporter!');
    //             console.error(error);
    //             _eczoo_code_graph_svg_exporter_instance = null;
    //             //throw new Error(`Failed to initialize the SVG code graph exporter.`);
    //             console.error('process.exit now');
    //             process.exit(101); // otherwise it looks like end up with pending promises ...
    //         }
    //     });
    //     eleventyConfig.on('eleventy.after', async () => {
    //         if (_eczoo_code_graph_svg_exporter_instance) {
    //             await _eczoo_code_graph_svg_exporter_instance.done();
    //             _eczoo_code_graph_svg_exporter_instance = null;
    //         }
    //     });
    // }
    // eleventyConfig.addGlobalData(
    //     "get_eczoo_code_graph_svg_exporter", {
    //         getInstance() {
    //             return _eczoo_code_graph_svg_exporter_instance;
    //         }
    //     }
    // );



    if (eczoo_run_options.run_11ty_parcel) {

        const pathRewrite = (p, req_) => {
            console.log(`Request ${p}`);
            let finalPath = p;
            if (/^(\/[^.]+)$/.test(p)) {
                // page requested -- rewrite path to include .html
                finalPath = `${p}.html`;
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
                    // parcel paths to include -- configered in ./package.json ->
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
                        sourceMaps: (
                            eczoo_run_options.run_11ty_parcel_lazy
                            && eczoo_run_options.development_mode ? true : false
                        ),
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

    }

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




