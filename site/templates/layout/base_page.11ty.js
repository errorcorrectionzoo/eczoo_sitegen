
const debug = require('debug')('eczoo_sitegen.templates.layout.base_page');

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const escape = require('escape-html');

const sitePackageJson = require('../../package.json');
const node_modules = '../../../node_modules';
const jscomponentsPackageJson = require('../../../jscomponents/package.json');


const data = {
};


const get_page_header_navigation_links_default = async (data) => {

    const { eczoodb } = data;

    let zoollm = await import('@phfaist/zoodb/zoollm');
    let html_fragment_renderer = zoollm.ZooHtmlFragmentRenderer();
    let llmrender = (value) => value.render_standalone(html_fragment_renderer);

    let page_header_navigation_links = [
        {
            heading: null,
            links: [
                { href: '/', html: 'Home' },
                { href: '/code_graph', html: 'Code graph' },
                { href: '/lists', html: 'Code lists' },
                { href: '/concepts', html: 'Concepts glossary' },
                { href: '/search', html: 'Search' },
            ],
        },
    ];

    for (const [domain_id, domain] of Object.entries(eczoodb.objects.domain)) {
        page_header_navigation_links.push({
            heading: {
                href: eczoodb.zoo_object_permalink('domain', domain.domain_id),
                html: llmrender(domain.name),
            },
            links: (domain.kingdoms || []).map( (kingdom_ref) => ({
                href: eczoodb.zoo_object_permalink('kingdom', kingdom_ref.kingdom_id),
                html: llmrender(kingdom_ref.kingdom.name),
            }) ),
        });
    }

    page_header_navigation_links.push({
        heading: null,
        links: [
            { href: '/edit_code', html: 'Add new code' },
            { href: '/additional_resources', html: 'Additional resources' },
            { href: '/team', html: 'Team' },
            { href: '/about', html: 'About' },
        ]
    })

    return page_header_navigation_links;
};




const _getExternalDependenciesData = async () => {
    let deps = [];

    for (const depSrcInfo of jscomponentsPackageJson.externalDependencies.src) {
        const depName = depSrcInfo.name;

        let cdnUrl = null;
        if (depSrcInfo.cdn === 'unpkg') {
            let unpkgVersion = depSrcInfo.version;
            if (unpkgVersion == null) {
                // find currently installed package version in node_modules.
                const pkgjson = (
                    await import(path.join(node_modules, `${depName}/package.json`),
                                 { assert: {type: 'json'} })
                ).default;
                unpkgVersion = pkgjson.version;
            }
            const unpkgSrcPath = depSrcInfo.path ?? '';
            cdnUrl =
                `https://unpkg.com/${depName}@${unpkgVersion}${unpkgSrcPath}`;
        } else {
            throw new Error(`Invalid/unknown CDN: ‘${depSrcInfo.cdn}’`);
        }

        deps.push({
            name: depName,
            cdnUrl,
        });
    }
    return deps;
};
const jscomponentsExternalDependenciesDataPromise = _getExternalDependenciesData();


const render = async function (data) {

    const eleventy = this;

    let jscomponentsExternalDependenciesData =
        await jscomponentsExternalDependenciesDataPromise;

    const { sqzhtml } = await import('@errorcorrectionzoo/eczoodb/render_utils.js');

    let s = '';
    s += sqzhtml`<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
`;

    // favicon
    s += await eleventy.favicon('eczoo_icon.svg');

    let page_layout_info = data.page_layout_info ?? {};
    
    let eczoo_cite_year = (new Date()).getFullYear();
    let meta_citation_info = data.meta_citation_info ?? [
        ['citation_language', 'en'],
        ['citation_author', 'Victor V. Albert'],
        ['citation_author', 'Philippe Faist'],
        ['citation_title', 'The Error Correction Zoo'],
        ['citation_publication_date', eczoo_cite_year],
        ['citation_date', eczoo_cite_year],
        //['citation_doi', ????],
        ['DC.title', 'The Error Correction Zoo'],
        ['DC.author', 'Victor V. Albert'],
        ['DC.author', 'Philippe Faist'],
        ['DC.issued', eczoo_cite_year],
    ];
    for (const [meta_name, meta_content] of meta_citation_info) {
        s += sqzhtml`
<meta name="${escape(meta_name)}" content="${escape(meta_content)}" />`;
    }

    s += sqzhtml`
  <title>
    ${ data.title } — Error Correction Zoo
  </title>`;

    // <!-- favicon generated with https://realfavicongenerator.net/ -->
    // <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    // <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    // <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    // <!--<link rel="manifest" href="/site.webmanifest">-->
    // <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#00007f">
    // <meta name="msapplication-TileColor" content="#da532c">
    // <meta name="theme-color" content="#ffffff">
    // <!-- end favicon code -->
    
    s += sqzhtml`
  <link type="text/css" rel="stylesheet" href="/cssbundle/main.css" />`;

    for (const extra_css of page_layout_info.extra_css ?? []) {
        s += sqzhtml`
  <link type="text/css" rel="stylesheet" href="${escape(extra_css)}" />`;
    }
    for (const extra_js of page_layout_info.extra_js ?? []) {
        s += sqzhtml`
  <script type="text/javascript" async src="${ extra_js }"></script>`;
    }
    for (const extra_jsmod of page_layout_info.extra_jsmod ?? []) {
        s += sqzhtml`
  <script type="module" async src="${ extra_jsmod }"></script>`;
    }

    const jscomponents = Object.assign(
        {
            mathjax: true,
            linkanchorvisualhighlight: true,
        },
        page_layout_info.jscomponents
    );

    let skip_jscomponents = null;
    if (data.eczoo_config.run_options.development_mode
        && data.eczoo_config.development_mode_skip_jscomponents) {
        skip_jscomponents = data.eczoo_config.development_mode_skip_jscomponents;
    }

    // external/global component dependencies
    let external_dependencies = [...jscomponentsPackageJson.externalDependencies.base];

    let s_jscomponents_jsmod = ''

    for (const [jscomponent, jscomponent_is_enabled] of Object.entries(jscomponents)) {
        if (skip_jscomponents && skip_jscomponents.includes(jscomponent)) {
            continue;
        }
        if (jscomponent_is_enabled) {
            external_dependencies.push(
                ... jscomponentsPackageJson.externalDependencies.jscomponents[jscomponent] ?? []
            );
            s_jscomponents_jsmod += sqzhtml`
  <link type="text/css" rel="stylesheet" href="/jsbundle/${ jscomponent }/setup.css" />
  <script type="module" defer src="/jsbundle/${ jscomponent }/setup.js"></script>`;
        }
    }

    // Add external dependencies via CDNs.  Do this by iterating over the list
    // of all possible dependencies *in order* (so that they are loaded in the
    // correct order), including only those that are needed.

    for (const depData of jscomponentsExternalDependenciesData) {
        if (!external_dependencies.includes(depData.name)) {
            // external dependency not needed
            continue;
        }
        s += sqzhtml`
  <script type="text/javascript" crossorigin defer src="${depData.cdnUrl}"></script>`;
    }

    s += s_jscomponents_jsmod;


    if (page_layout_info.extra_head_content) {
        s += extra_head_content;
    }
    
    s += sqzhtml`
</head>
<body>
`;
    
    let div_bodycontents_classes = [];
    if (page_layout_info.div_bodycontents_classes) {
        div_bodycontents_classes.push(... page_layout_info.div_bodycontents_classes);
    }
    if (page_layout_info.app_full_width) {
        div_bodycontents_classes.push('app-full-width');
    }
    if (page_layout_info.wide_layout) {
        div_bodycontents_classes.push('page-wide-layout');
    }
    if (!page_layout_info.header_navigation_links) {
        div_bodycontents_classes.push('page-no-navigation-links');
    }
    if (page_layout_info.header_large_text) {
        div_bodycontents_classes.push('page-header-has-text');
    }

    s += sqzhtml`
<div
  id="bodycontents"
  class="${ div_bodycontents_classes.join(' ') }"
  >`;

    s += sqzhtml`
  <div id="header-bg-decoration"></div>`;

    // the logo with home page link
    s += sqzhtml`
  <a id="logo" href="/"></a>`;

    // header element with the logo and possible large text, but not the navigation links
    s += sqzhtml`
  <header id="header">`;
    if (page_layout_info.header_large_text) {
        s += sqzhtml`
    <h1>${page_layout_info.header_large_text}</h1>
`;
    }
    s += sqzhtml`
  </header>`;

    // MAIN CONTAINER
    s += sqzhtml`
  <main id="main">
`;
    s += data.content;

    s += sqzhtml`
  </main><!-- #main -->
`;

    let header_navigation_links = page_layout_info.header_navigation_links;
    if (header_navigation_links == null && !page_layout_info.header_large_text) {
        // default is to have links, unless header has large text (like home page)
        header_navigation_links = true;
    }

    if (header_navigation_links) {
        let navigation_links = '';

        // FIXME: is there a way to compile the default set of navigation links
        // only once with eleventy?
        if (header_navigation_links === true) {
            // use the default set of navigation links
            header_navigation_links = await get_page_header_navigation_links_default(data);
        }

        //debug('using header_navigation_links = ', header_navigation_links);

        for (const [nav_links_block_j, nav_links_block] of header_navigation_links.entries()) {
            if (nav_links_block.heading != null) {
                let head_html = nav_links_block.heading.html;
                if (nav_links_block.heading.href != null) {
                    head_html = `<a href="${nav_links_block.heading.href}">${head_html}</a>`;
                }
                navigation_links += `<h1>${head_html}</h1>`;
            } else if (nav_links_block_j != 0) {
                navigation_links += `<h1></h1>`; // use empty <h1> for new nav links block
            }
            if (nav_links_block.links != null && nav_links_block.links.length) {
                navigation_links += `<ul class="navlinks">`;
                for (const link of nav_links_block.links) {
                    navigation_links += `<li><a href="${link.href}">${link.html}</a></li>`;
                }
                navigation_links += `</ul>`;
            }
        }

        s += sqzhtml`
  <nav id="navigation">
${navigation_links}
  </nav><!-- #navigation -->

  <nav id="navigation-shortcuts">
    <a href="#navigation" id="nav-shortcut-to-navigation-links">&#8801;</a>
  </nav>
`;
    }

    const footer_content = require('./base_page_footer.11ty.js');

    // hide footer on code graph page
    if (!page_layout_info.app_full_width) {
        s += `
  <footer id="footer"><div class="footer-stuff">${footer_content}</div></footer>`;
    }

    s += `
</div>
</body>
</html>`;

    return s;
}


module.exports = {
    data,
    render,
}
