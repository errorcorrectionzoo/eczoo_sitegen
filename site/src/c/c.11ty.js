
const debug = require('debug')('eczoo_sitegen.src.c')

const show_max_rel_by_reltype = {
    parents: 4,
    parent_of: 4,
    cousins: 3,
    cousin_of: 3,
};



const generate_navigation_links = ({code, eczoodb, flmrender}) => {

    //debug('generating navigation links for code = ', code);

    let page_header_navigation_links = [];
    
    let related_codes_links = [];
    for (const reltype of ['parents', 'parent_of', 'cousins', 'cousin_of']) {
        const max_rel = show_max_rel_by_reltype[reltype];

        const code_relations = code.relations?.[reltype];
        //debug('code_relations = ', code_relations);

        if (code_relations == null) {
            continue;
        }

        for (const [rel_j, rel] of code_relations.slice(0, max_rel).entries()) {
            //debug("got relation, rel =", rel);
            if (rel == null) {
                continue;
            }

            related_codes_links.push({
                href: eczoodb.zoo_object_permalink('code', rel.code_id),
                html: flmrender(eczoodb.code_short_name(rel.code)),
            })

            // climb up the direct parent hierarchy (first parents only) a couple levels
            if (reltype === 'parents' && rel_j === 0
                && rel.code.relations != null && rel.code.relations.parents != null
                && rel.code.relations.parents.length) {
                const relcode2 = rel.code.relations.parents[0];
                related_codes_links.push({
                    href: eczoodb.zoo_object_permalink('code', relcode2.code_id),
                    html: flmrender(eczoodb.code_short_name(relcode2.code)),
                });
                if (relcode2.code.relations != null && relcode2.code.relations.parents != null
                    && relcode2.code.relations.parents.length) {
                    const relcode3 = relcode2.code.relations.parents[0];
                    related_codes_links.push({
                        href: eczoodb.zoo_object_permalink('code', relcode3.code_id),
                        html: flmrender(eczoodb.code_short_name(relcode3.code)),
                    });
                }
            }
        }
    }
    page_header_navigation_links.push({
        heading_html: null,
        links: related_codes_links,
    });

    for (const [domain_id, domain] of Object.entries(eczoodb.objects.domain)) {
        page_header_navigation_links.push({
            heading: {
                href: eczoodb.zoo_object_permalink('domain', domain_id),
                html: flmrender(domain.name)
            },
            links: null,
        });
    }

    page_header_navigation_links.push({
        heading_html: null,
        links: [
            { href: '/', html: 'Home' },
            { href: '/team', html: 'Team' },
            { href: '/about', html: 'About' },
            { href: '/code_graph', html: 'Code graph' },
            { href: '/lists', html: 'Lists' },
            { href: '/concepts', html: 'Concepts glossary' },
            { href: '/edit_code', html: 'Add new code' },
            { href: '/search', html: 'Search' },
        ],
    });

    return page_header_navigation_links;
};


function get_code_citation_year(code)
{
    // find year of last contribution
    let mostRecentYear = null;
    for (const change of code?._meta?.changelog ?? []) {
        const changeDate = new Date(change.date);
        const changeYear = changeDate.getFullYear();
        if (mostRecentYear == null || changeYear > mostRecentYear) {
            mostRecentYear = changeYear;
        }
    }
    return mostRecentYear ?? (new Date()).getFullYear();
}

// ---------------------------------------------------------



const data = async () => {
    
    const zooflm = await import('@phfaist/zoodb/zooflm');
    const { docrefs_placeholder_ref_resolver } =
          await import('@errorcorrectionzoo/eczoodb/render_utils.js');

    let text_fragment_renderer = zooflm.ZooTextFragmentRenderer();
    let html_fragment_renderer = zooflm.ZooHtmlFragmentRenderer();
    let flmrender = (value) => value && value.render_standalone(html_fragment_renderer);

    return {
        pagination: {
            data: 'eczoodb.objects.code',
            size: 1,
            resolve: 'values',
            addAllPagesToCollections: true,
            alias: 'code',
        },
        tags: ['sitePage'],
        eleventyComputed: {
            permalink: (data) =>
                data.eczoodb.zoo_object_permalink('code', data.code.code_id) + '.html',
            title: (data) => zooflm.render_text_standalone(data.code.name),
            // ---
            // injection hack to get correct page date property!
            // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
            date: (data) => {
                data.page.date = new Date(data.code._zoodb.git_last_modified_date);
                return data.page.date;
            },
            // ---
            page_layout_info: (data) => ({
                jscomponents_profile: 'code_page',
                // jscomponents: {
                //     popuptippy: true,
                // },
                header_navigation_links: generate_navigation_links({
                    code: data.code, eczoodb: data.eczoodb, flmrender
                }),
            }),

            page_description_text: (data) => {
                const fragment = data.code.description?.get_first_paragraph();
                const render_doc_fn = (render_context) => {
                    if (fragment == null) {
                        return '';
                    }
                    return fragment.render(render_context);
                };
                try {
                    //
                    // Allow unresolved references in the first paragraph.  It's
                    // normal, it's a snippet!
                    //
                    return zooflm.make_and_render_document({
                        zoo_flm_environment: data.eczoodb.zoo_flm_environment,
                        render_doc_fn,
                        doc_metadata: {},
                        fragment_renderer: text_fragment_renderer,
                        render_endnotes: false,
                        feature_render_options: {
                            refs: {
                                add_external_ref_resolvers: [
                                    docrefs_placeholder_ref_resolver
                                ],
                            },
                        },
                    });
                } catch (err) {
                    throw new Error(
                        `\n\nCannot render the first paragraph of the code ‘${data.code_id}’'s `
                        + `description on its own.  We use the first paragraph of a code's `
                        + `description in a few places, including as a snippet for web `
                        + `crawlers (e.g. for search results).  If you don't recognize `
                        + `the reported error (e.g. an unresolved reference for a figure `
                        + `that does exist), it might be a bug.  Please get in touch!\n\n`
                        + (''+err)
                    );
                }
            },

            meta_citation_info: (data) => {
                const code_name = zooflm.render_text_standalone(data.code.name);
                const cite_year = get_code_citation_year(data.code);
                return [
                    ["citation_language", "en"],
                    ["citation_book_title", "The Error Correction Zoo"],
                    ["citation_inbook_title", "The Error Correction Zoo"],
                    ["citation_title", `${code_name}`],
                    ["citation_publication_date", `${ cite_year }`],
                    ["citation_date", `${ cite_year }`],
                    ["citation_editor", "Albert, Victor V."],
                    ["citation_editor", "Faist, Philippe"],
                    //<!--<meta name="citation_doi" content="10.zzzz/wwwwww"/>-->
                    ["DC.title", `${code_name}` ],
                    ["DC.issued", `${ cite_year }` ],
                    ["DC.relation.ispartof",
                     "The Error Correction Zoo (V. V. Albert, Ph. Faist, eds.)"],
                ];
            },
        },
    };

};


const render = async (data) => {

    const code = data.code;
    const eczoodb = data.eczoodb;

    const zooflm = await import('@phfaist/zoodb/zooflm');
    const { $$kw } = zooflm;
    const { sqzhtml } = await import('@phfaist/zoodb/util/sqzhtml');

    let html_fragment_renderer = new zooflm.ZooHtmlFragmentRenderer();
    let text_fragment_renderer = new zooflm.ZooTextFragmentRenderer();
    let flmrender = (value) => value && value.render_standalone(html_fragment_renderer);
    let flmrendertext = (value) => value && value.render_standalone(text_fragment_renderer);

    const rendercodepage = await import('@errorcorrectionzoo/eczoodb/render_code.js');

    const doc_metadata = {};
    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    debug(`Rendering code page for ‘${code.code_id}’ ...`);

    // link to code page
    const extra_html_after_title = sqzhtml`
    <a href="/code_graph#code_${code.code_id}" class="linkcodegraph">&nbsp;</a>
`;

    // RENDER THE BULK OF THE CODE PAGE
    const code_page_html =
          rendercodepage.render_code_page(code, {zoo_flm_environment, doc_metadata,
                                                 extra_html_after_title});

    // additional info for popups, etc.

    const code_ref_href =
          eczoodb.zoo_object_permalink('code', code.code_id);
    const code_ref_link = code_ref_href;
    const code_citation_year = new Date(code._meta?.changelog?.[0]?.date).getFullYear();
    const code_text_citation = (
        `“${flmrender(code.name)}”, The Error Correction Zoo `
        + `(V. V. Albert & P. Faist, eds.), ${code_citation_year}. `
        + `https://errorcorrectionzoo.org${ code_ref_link }`
    );
    const code_edit_github_url = (
        `https://github.com/errorcorrectionzoo/eczoo_data`
        + `/edit/main/${code._zoodb.source_file_path}`
    ); // e.g. https://github.com/errorcorrectionzoo/eczoo_data/edit/main/codes/approximate_oaecc.yml
    const code_edit_onsite_url = (
        `/edit_code#${encodeURIComponent(JSON.stringify({
              code_id: code.code_id,
              code_yml_filename: code._zoodb.source_file_path}))}`
    );
    const code_bibtex = `@incollection{eczoo_${code.code_id},
  title={${ code.name.flm_text }},
  booktitle={The Error Correction Zoo},
  year={${code_citation_year}},
  editor={Albert, Victor V. and Faist, Philippe},
  url={https://errorcorrectionzoo.org${code_ref_link}}
}`;
    
    const code_name_text = flmrendertext(code.name);
    const code_encurl_name = encodeURIComponent(code_name_text);
    const code_encurl_name_link = encodeURIComponent(
        code_name_text + ' https://errorcorrectionzoo.org' + code_ref_link
    );


    let s = '';

    s += sqzhtml`
<article class="ecc-code-page info-popup-button-zone" id="ecc_${code.code_id}">`;

    s += sqzhtml`
<div class="sectioncontent info-popup-button-container"></div>
`;

    s += code_page_html;

    s += sqzhtml`

<!-- zoo-related information and how to edit -->

<div class="sectioncontent display-code-id redundant-if-info-popup-button-installed">
  <div class="code-popup-info-frame"
       data-is-code-info-popup="1"
       data-popup-button-label="edit"
       data-popup-button-class-list="code-self-edit">
    <h3>Your contribution is welcome!</h3>
    <p><a class="code-link-with-icon code-show-github"
          target="_blank"
          title="Edit code information directly on github.com"
          href="${ code_edit_github_url }">on github.com (edit &amp; pull request)</a>
          — see <a title="edit source instructions" target="_blank"
                   href="https://github.com/errorcorrectionzoo/eczoo_data/blob/main/README.md">instructions</a></p>
    <p><a class="code-link-with-icon code-self-edit"
          target="_blank"
          title="edit code information on this site without using github"
          href="${ code_edit_onsite_url }">edit on this site</a></p>
    <p class="zoo-code-id">Zoo Code ID: <code>${code.code_id}</code>
  </div>
  <div class="code-popup-info-frame"
       data-is-code-info-popup="1"
       data-popup-button-label="cite"
       data-popup-button-class-list="code-show-citation">
  <dl class="show-citation">
    <dt>Cite as:</dt>
    <dd class="boxedcontent">${ code_text_citation }</dd>
    <dt>BibTeX:</dt>
    <dd class="boxedcontent bibtex">${ code_bibtex }</dd>
  </dl>
  </div>
  <div class="code-popup-info-frame"
       data-is-code-info-popup="1"
       data-popup-button-label="share"
       data-popup-button-class-list="code-show-share">
  <dl class="show-share-social">
    <dt>Share via:</dt>
    <dd>
      <!-- Twitter -->
      <a href="https://twitter.com/intent/tweet?text=${code_encurl_name_link}"
         target="_blank">Twitter</a>
      &nbsp;|&nbsp;
      <!-- Mastodon -->
      <a href="https://toot.kytta.dev/?text=${code_encurl_name_link}&instance=${
                encodeURIComponent('https://qubit-social.xyz')
               }" target="_blank">Mastodon</a>
      &nbsp;|&nbsp;
      <!-- Facebook -->
      <a href="http://www.facebook.com/sharer/sharer.php?u=${
                  encodeURIComponent('https://errorcorrectionzoo.org'+code_ref_link)
               }&t=${ code_encurl_name }"
         target="_blank" class="share-popup">Facebook</a>
      &nbsp;|&nbsp;
      <!-- Email -->
      <a href="mailto:?subject=${code_encurl_name}&body=${code_encurl_name_link}">E-mail</a>
    </dd>
    <dt>Permanent link:</dt>
    <dd class="boxedcontent">https://errorcorrectionzoo.org${code_ref_link}</dd>
  </dl>
  </div>
</div>

<!-- "Cite As" citation, for paper printouts -->

<h2 class="display-print-citation">
  Cite as:
</h2>
<div class="sectioncontent display-print-citation">
  <p>${ code_text_citation }</p>

  <p>Github: <a href="${ code_edit_github_url }"
                class="ashowurl"
                target="_blank">${ code_edit_github_url }</a>.</p>
</div>
</article>
`;
    return s;

};

module.exports = { data, render };
