//
// Eleventy site configuration
//
import process from 'node:process';

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.eleventyConfigJs');

import path from 'path';
import faviconPlugin from 'eleventy-favicon';
import eleventyParcelPlugin from '@kitschpatrol/eleventy-plugin-parcel';

// NOTE: eleventy fails to enter dev (watch/serve) mode with the following line :/
// Use the fs.readFileSync() version to make eleventy work.  But then parcel also
// appears to fail to integrate correctly. TODO: debug, or wait until these issues
// have been fixed upstream.
//
import packageJson from './package.json' with { type: 'json' };
//
//import fs from 'fs';
//const packageJson = JSON.parse(fs.readFileSync('./package.json'));


const __dirname = import.meta.dirname;
//const __filename = import.meta.filename;


import { load_or_reload_eczoodb } from './sitelib/build_eczoo.js';
import { prepareEczooBibReferences } from './sitelib/prepare_eczoo_bibreferences.js';

// The search index generator (src/dat/searchindex.11ty.js imports it again)
// is loaded with the configuration, before any build: lunr, which it loads
// through @phfaist/zoodbtools_search, sets `QueryParseError.prototype = new
// Error` when it is first loaded, and that Error keeps the call sites of its
// stack trace, with the objects they were called on, as long as the process
// runs.  Loaded by the first build that renders the search index, it kept
// that build's TemplateMap, and with it the content of every page (about
// 270 MB in watch mode).
import '@errorcorrectionzoo/jscomponents/search/generate_index.js';


Error.stackTraceLimit = 999;



export default async function (eleventyConfig)
{
    debug(`eleventyConfig main function running.`);

    const eczoo_run_options = ((env) => {
        // Use "!=" such that the string "0" also counts as false
        const use_test_data = ((env.ECZOO_USE_TEST_DATA ?? 0) != 0);
        const run_11ty_parcel = ((env.ECZOO_RUN_11TY_PARCEL ?? 1) != 0);
        const run_11ty_parcel_lazy = ((env.ECZOO_RUN_11TY_PARCEL_LAZY ?? 0) != 0);
        const development_mode = ((env.ECZOO_DEVELOPMENT_MODE ?? 0) != 0);
        const citations_cache_dir = (
            process.env.ECZOO_CITATIONS_CACHE_DIR
            ?? (use_test_data ? '_TEST_zoodb_citations_cache' : '_zoodb_citations_cache')
        );
        // The cache of the code graph SVGs (relative to the repository root)
        const graph_svg_cache_dir = (
            env.ECZOO_GRAPH_SVG_CACHE_DIR
            ?? (use_test_data ? '_TEST_eczoo_graph_svg_cache' : '_eczoo_graph_svg_cache')
        );
        // '1': use the cache, '0': neither read nor write it, 'refresh': render
        // every graph and store it, 'verify': render every graph and compare it
        // with the cached SVG
        const graph_svg_cache_mode = String(env.ECZOO_GRAPH_SVG_CACHE ?? '').trim() || '1';
        if ( ! ['1', '0', 'refresh', 'verify'].includes(graph_svg_cache_mode) ) {
            throw new Error(
                `Invalid value of ECZOO_GRAPH_SVG_CACHE: ‘${graph_svg_cache_mode}’ (expected `
                + `1, 0, refresh or verify)`
            );
        }
        return {
            run_11ty_parcel,
            run_11ty_parcel_lazy,
            use_test_data,
            development_mode,
            citations_cache_dir,
            graph_svg_cache_dir,
            graph_svg_cache_mode,
        };
    })(process.env);

    const eczoo_config = {
        data_dir: 
            eczoo_run_options.use_test_data
            ? path.resolve(__dirname, '../eczoodb/test_data/')
            : path.resolve(__dirname, '..', '..', 'eczoo_data'),
        run_options: eczoo_run_options,
        site_base_url_host_name: 'https://errorcorrectionzoo.org/',
        citationsinfo_cache_dir: path.join(
            __dirname,
            '..',
            eczoo_run_options.citations_cache_dir,
        ),
        graph_svg_cache_root_dir: path.resolve(
            __dirname,
            '..',
            eczoo_run_options.graph_svg_cache_dir,
        ),
    };

    eczoo_config.generate_code_graph_svg_exports
        = ! eczoo_config.run_options.development_mode;

    eleventyConfig.addGlobalData("eczoo_config", eczoo_config);

    // Watch .yml files!
    eleventyConfig.addDataExtension(
        "yml, yaml", (contents_) => ({ IDidntConfigure11tyToLoadYamlFiles: true })
    );
    eleventyConfig.addWatchTarget( eczoo_config.data_dir );

    let _eczoo_code_graph_svg_exporter_instance = null;

    // The manager of the code graph SVG cache: opened once per process, by the
    // first build that renders the graphs (undefined: not opened yet; null: no
    // cache).
    let _graph_svg_cache_manager = undefined;

    // Build the EC zoo and include it in the 11ty structure as global data.
    // The callback will be executed again on subsequent builds in dev mode.
    eleventyConfig.addGlobalData("eczoodb", async () => {

        //
        // (Re)load the EC Zoo Database.
        //
        const eczoodb = await load_or_reload_eczoodb(eczoo_config);
        //
        // Prepare data dump of the EC Zoo.
        //
        const eczoodbData = await eczoodb.data_dump({});
        eczoodb.cached_data_dump = eczoodbData;

        //
        // Prepare a code graph SVG generator instance (use single instance across
        // all generated graphs because an instance spins up a Chrome puppeteer
        // instance!)  
        //
        //
        if ( eczoo_config.generate_code_graph_svg_exports ) {
            const { init_headless_graph_exporter, open_graph_svg_cache_manager } =
                await import('./sitelib/init_headless_graph_exporter.js');
            if (_eczoo_code_graph_svg_exporter_instance != null) {
                // the previous build did not finish (it failed): shut its
                // exporter down and close its cache
                await _eczoo_code_graph_svg_exporter_instance.done();
                _eczoo_code_graph_svg_exporter_instance = null;
            }
            if (_graph_svg_cache_manager === undefined) {
                _graph_svg_cache_manager = (
                    (eczoo_run_options.graph_svg_cache_mode === '0')
                    ? null
                    : open_graph_svg_cache_manager({
                        rootDir: eczoo_config.graph_svg_cache_root_dir,
                    })
                );
            }
            _eczoo_code_graph_svg_exporter_instance = await init_headless_graph_exporter({
                cacheManager: _graph_svg_cache_manager,
                cacheMode: eczoo_run_options.graph_svg_cache_mode,
            });
        }

        // save the exporter (whether or not it is null) directly as an attribute of the eczoodb
        // object. This is how domain-graph and kingdom-graph pages access the instance.
        eczoodb.site_custom_headless_graph_exporter_instance = _eczoo_code_graph_svg_exporter_instance;

        if (_eczoo_code_graph_svg_exporter_instance != null) {
            
            try {
                await _eczoo_code_graph_svg_exporter_instance.loadEcZooDbData(eczoodbData);
            } catch (err) {
                console.error(`Problem initializing code graph exporter!`, err);
                process.exit(1);
            }

        }

        //
        // Prepare bibliography references. Compile list of used citations, etc.
        // Here we put the code that is used in common between the "/references" page
        // and the "/dat/bibreferences*" pages (Bibtex/CSL-JSON)
        //
        eczoodb.site_ecz_bibliorefs_collector = await prepareEczooBibReferences(eczoodb);

        return eczoodb;
    });
    if ( eczoo_config.generate_code_graph_svg_exports ) {
        eleventyConfig.on('eleventy.after', async ({ runMode }) => {
            if (_eczoo_code_graph_svg_exporter_instance != null) {
                // (also closes the graph SVG cache, which records the uses of
                // its values)
                await _eczoo_code_graph_svg_exporter_instance.done();
                console.log(_eczoo_code_graph_svg_exporter_instance.summaryLine());
                _eczoo_code_graph_svg_exporter_instance = null;
            }
            if (_graph_svg_cache_manager != null) {
                const { maintain_graph_svg_cache, close_graph_svg_cache_manager } =
                    await import('./sitelib/init_headless_graph_exporter.js');
                maintain_graph_svg_cache(_graph_svg_cache_manager);
                if (runMode !== 'watch' && runMode !== 'serve') {
                    close_graph_svg_cache_manager(_graph_svg_cache_manager);
                    _graph_svg_cache_manager = undefined;
                }
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




