
const debug = require('debug')('eczoo_sitegen.templates.layout.base_page');

const fs = require('fs');
const path = require('path');
//const child_process = require('child_process');

const escape = require('escape-html');

//const sitePackageJson = require('../../package.json');
//const node_modules = '../../../node_modules';
//const jscomponentsPackageJson = require('../../../jscomponents/package.json');


const data = {
};


const _eczpkgroot = path.join(__dirname, '..', '..', '..');


function read_source_file_contents(fileName) // relative to ~/
{
    if (!fileName.startsWith('~/')) {
        throw new Error("read_source_file_contents should start with ~/");
    }
    const relativeFileName = fileName.slice(2);
    const fullFileName = path.join(_eczpkgroot, relativeFileName);
    return fs.readFileSync(fullFileName);
};



const get_page_header_navigation_links_default = async (data) => {

    const { eczoodb } = data;

    let zooflm = await import('@phfaist/zoodb/zooflm');
    let html_fragment_renderer = zooflm.ZooHtmlFragmentRenderer();
    let flmrender = (value) => value.render_standalone(html_fragment_renderer);

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
                html: flmrender(domain.name),
            },
            links: (domain.kingdoms || []).map( (kingdom_ref) => ({
                href: eczoodb.zoo_object_permalink('kingdom', kingdom_ref.kingdom_id),
                html: flmrender(kingdom_ref.kingdom.name),
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




// const _getExternalDependenciesData = async () => {
//     let deps = [];
//
//     for (const depSrcInfo of jscomponentsPackageJson.externalDependencies.src) {
//         const depName = depSrcInfo.name;
//
//         let cdnUrl = null;
//         if (depSrcInfo.cdn === 'unpkg') {
//             let unpkgVersion = depSrcInfo.version;
//             if (unpkgVersion == null) {
//                 // find currently installed package version in node_modules.
//                 const pkgjson = (
//                     await import(path.join(node_modules, `${depName}/package.json`),
//                                  { assert: {type: 'json'} })
//                 ).default;
//                 unpkgVersion = pkgjson.version;
//             }
//             const unpkgSrcPath = depSrcInfo.path ?? '';
//             cdnUrl =
//                 `https://unpkg.com/${depName}@${unpkgVersion}${unpkgSrcPath}`;
//         } else {
//             throw new Error(`Invalid/unknown CDN: ‘${depSrcInfo.cdn}’`);
//         }
//
//         deps.push({
//             name: depName,
//             cdnUrl,
//         });
//     }
//     return deps;
// };
//const jscomponentsExternalDependenciesDataPromise = _getExternalDependenciesData();


const default_page_description_text =
      `The Error Correction Zoo collects and organizes error-correcting codes.`;


const render = async function (data) {

    const eleventy = this;
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');

    //
    // the template string content
    //
    let s = '';

    //
    // Start the HTML document
    //
    s += sqzhtml`<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
`;

    //
    // favicon
    //
    s += await eleventy.favicon('eczoo_icon.svg');

    //
    // Citation information in meta tags
    //
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

    //
    // More meta tags: title & description
    //
    let title = data.title;
    let title_escaped = escape(title);
    s += sqzhtml`
  <title>
    ${ title } | Error Correction Zoo
  </title>`;

    let page_description_text =
        data.page_description_text ?? default_page_description_text;
    // strip newlines and unnecessary space ---
    page_description_text = page_description_text.replace(/[\n\r\t ]+/g, ' ');
    // strip math delimiters [TODO: do this at FLM text rendering time!] ---
    page_description_text = page_description_text.replace(/\\[()]/g, '');
    page_description_text = page_description_text.trim();
    const page_description_text_escaped = escape(page_description_text);
    s += sqzhtml`
  <meta name="description" content="${ page_description_text_escaped }" />
`;

    //
    // Social Media Information: Twitter cards & OpenGraph meta tags.  Note that
    // twitter:title is not necessary as Twitter picks up OpenGraph information.
    //
    const absolutePageUrl = this.getEczooAbsoluteUrl(data.page.url);
    s += sqzhtml`
  <meta property="og:url" content="${ absolutePageUrl }" />
  <meta property="og:title" content="${ title_escaped }" />
  <meta property="og:description" content="${ page_description_text_escaped }" />
  <meta property="og:image" content="~/site/static/icons/eczogimage.png" />
  <meta property="og:type" content="article" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@theeczoo" />
  <meta name="twitter:creator" content="@victorvalbert" />
  <meta name="twitter:image" content="~/site/static/icons/eczogimage.png" />
`;

    //
    // Set up the page - title & layout
    //

    // get some information about the page layout
    let page_layout_info = data.page_layout_info ?? {};

    // fonts
    s += sqzhtml`
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link type="text/css" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap" />`;

    s += sqzhtml`
  <link type="text/css" rel="stylesheet" href="~/site/stylesheets/main.scss" />`;

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

    const jscomponents_profile = page_layout_info.jscomponents_profile ?? 'default';

    if (jscomponents_profile != null) {
        if (jscomponents_profile.dynamic != null) {
            s += sqzhtml`
  <script type="module" defer src="/jsc_dynamic_profiles/${ jscomponents_profile.dynamic }.js"></script>`;
        } else {
            s += sqzhtml`
  <script type="module" defer src="~/site/jsc_profiles/${ jscomponents_profile }.js"></script>`;
        }
    }

    //
    // Support for light/dark mode.  This is a script that executes immediately,
    // to avoid a flash of the wrong background color while the page loads.
    //
    s += sqzhtml`
<script type="text/javascript">
${read_source_file_contents('~/site/tinyjavascript/darkmode.js')}
</script>
`;


    if (page_layout_info.extra_head_content) {
        s += page_layout_info.extra_head_content;
    }
    
    s += sqzhtml`
</head>
`;


    //
    // Now, render the <BODY> !
    //

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

    const div_bodycontents_classes_joined = div_bodycontents_classes.join(' ');

    // let's repeat the bodycontent classes on the <body> element so that we can
    // apply selective CSS on <body>, too!
    s += sqzhtml`
<body class="${ div_bodycontents_classes_joined }">
`;
   

    s += sqzhtml`
<div
  id="bodycontents"
  class="${ div_bodycontents_classes_joined }"
  >`;

    s += sqzhtml`
  <div id="header-bg-decoration"></div>`;

    // the logo with home page link
    s += sqzhtml`
  <a id="logo" href="/" aria-label="Home page"></a>`;

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

        // add "navigation link" for dark mode toggle
        header_navigation_links = [].concat(header_navigation_links, [
            {
                heading: null,
                links: [
                    {
                        href: 'javascript:window.eczColorSchemeHandler.toggle();',
                        html: '🌒',
                    },
                ],
            }
        ]);

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
  <nav id="navigation" class="linkanchorvisualhighlight_direct_scroll">
${navigation_links}
  </nav><!-- #navigation -->

  <nav id="navigation-shortcuts">
    <a href="#navigation" id="nav-shortcut-to-navigation-links">&#8801;</a>
  </nav>
`;
        // note JavaScript to be added at the bottom of the <body> tag to help
        // trigger navigation
    }

    const footer_content = require('./base_page_footer.11ty.js');

    // hide footer on code graph page
    if (!page_layout_info.app_full_width) {
        s += `
  <footer id="footer"><div class="footer-stuff">${footer_content}</div></footer>`;
    }

    s += sqzhtml`
</div>`;

    // Helper script for navigation links
    s += sqzhtml`
  <script type="text/javascript">
  ${read_source_file_contents('~/site/tinyjavascript/expandnavlinks.js')}
  </script>
`;

    s += sqzhtml`
</body>
</html>`;

    return s;
}


module.exports = {
    data,
    render,
}
