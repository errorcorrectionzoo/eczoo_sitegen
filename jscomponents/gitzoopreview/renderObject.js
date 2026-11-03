import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.gitzoopreview.renderObject');

import html_escape from 'escape-html';

import { render_code_page } from '@errorcorrectionzoo/eczoodb/render_code.js';
import { render_codelist_page } from '@errorcorrectionzoo/eczoodb/render_codelist.js';
import { render_person } from '@errorcorrectionzoo/eczoodb/render_person.js';
import { render_kingdom } from '@errorcorrectionzoo/eczoodb/render_kingdom.js';
import { render_domain } from '@errorcorrectionzoo/eczoodb/render_domain.js';

import { format_diagnostic } from '@phfaist/zoodb/zooflm/engine';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import { simpleRenderObjectWithFlm } from '@phfaist/zoodbtools_preview';


// site's idea of which codes are notable codes
import site_notable_codes from '~/site/site_data/notable_codes_hierarchy.js';
const { notable_codes } = site_notable_codes;
//console.log(`Using following set of notable codes:`, notable_codes);


const firstParaDescrExplain = `
The first paragraph of a code’s description is used as a snippet in various
places, e.g., as a short version of the code’s description
in code lists as well as a short description for web
search results.
`.trim();

// The kinds of labels of the zoo's objects and of its glossary's terms (the
// part of a label before its colon): a reference to one of them is meaningful
// in the first paragraph on its own, unlike a reference to a figure or an
// equation of the code's page.
const external_ref_types = new Set([
    'code', 'domain', 'kingdom', 'codelist', 'user', 'space', 'topic', 'defterm',
]);



async function getCodeRecommendationsHtml({ zoodb, object })
{
    let recommendationsHtml = [];

    //
    // Recommend that the description renders cleanly with no internal references
    // to other parts of the code page.
    //

    const zoo_flm_engine = zoodb.zoo_flm_engine;
    let firstParagraphDescription = null;

    try {

        // The first paragraph alone, cut as the site's code pages cut it for
        // their meta description (site/src/c/c.11ty.js).
        firstParagraphDescription = zoo_flm_engine.truncate(object.description, {
            first_paragraph: true,
            chars: object.description.source.length + 1,
        }).fragment;

        // The references that the paragraph makes to labels that it does not
        // define itself and that belong to the code's page.
        const { trees } = zoo_flm_engine.scan([ firstParagraphDescription ]);
        for (const { label, resolved } of trees[0].refs) {
            const colonPos = label.indexOf(':');
            const ref_type = (colonPos === -1) ? '' : label.slice(0, colonPos);
            if (resolved || external_ref_types.has(ref_type)) {
                // all ok, a reference to e.g. another code
                continue;
            }
            // internal doc reference, e.g. a figure.
            recommendationsHtml.push(sqzhtml`
<p>${firstParaDescrExplain}</p>
<p>It is recommended to avoid placing references to internal document
elements (e.g., figures or equations) in this paragraph,
to ensure that the first paragraph is meaningful
when read on its own.</p>
<pre>Found reference to: ‘<span class="highlight">${html_escape(label)}</span>’.</pre>
`);
        }

        // An error of the paragraph on its own throws here (the 'abort'
        // policy), as it stops the site's build.
        zoo_flm_engine.render_text([ firstParagraphDescription ], { error_policy: 'abort' });

    } catch (err) {
        recommendationsHtml.push(sqzhtml`
<p>${firstParaDescrExplain}</p>
<p>This paragraph fails to compile when considered on its own (error message
below).  Please double-check this paragraph and ensure that it is meaningful
when considered on its own.</p>
<pre>${html_escape(String(err))}</pre>
`
        );
    } finally {
        if (firstParagraphDescription != null) {
            zoo_flm_engine.release(firstParagraphDescription);
        }
    }

    try {
        //
        // Check that all entries in the _meta.changelog are sorted chronologically,
        // most recent first
        //
        let lastDate = null;
        for (const chgEntry of object._meta?.changelog ?? []) {
            let date = new Date(chgEntry.date);
            if (lastDate != null && date > lastDate) {
                recommendationsHtml.push(sqzhtml`
<p>The change log in the <code>_meta:</code> tag should contain entries
sorted chronologically, most recent first.</p>
<pre>Found: ‘${date}’ is more recent than ‘${lastDate}’ but appears later in change log</p>
`);
            }
            lastDate = date;
        }

    } catch (err) {
        console.error(`Unexpected ERROR in getCodeRecommendationsHtml: `, err);
    }

    return recommendationsHtml;
}


//
// The diagnostics of the object's FLM content: those of the zoo's processing
// and those of the page's render, each once.  The preview's zoo has the
// 'continue' error policy, so the page shows the recovery markup of an error
// and this list says what the error is.  The list is the one that
// simpleRenderObjectWithFlm() of @phfaist/zoodbtools_preview writes, with its
// classes (styled by the preview component).
//
function diagnosticsHtml(object, renderDiagnostics)
{
    const seen = new Set();
    let items = '';
    for (const d of [ ...(object?._zoodb?.flm_diagnostics ?? []), ...renderDiagnostics ]) {
        const s = format_diagnostic(d);
        if (seen.has(s)) {
            continue;
        }
        seen.add(s);
        items += `<li class="zoodb-preview-diagnostic-${html_escape(d.severity)}">`
            + `${html_escape(s)}</li>`;
    }
    if (items === '') {
        return '';
    }
    return `<section class="zoodb-preview-diagnostics"><ul>${items}</ul></section>`;
}



//
// ----------------------------------------------------------------------------
//


export async function renderObject({ zoodb, objectType, objectId, object,
                                     registerRenderPreviewCleanupCallback,
                                     includeRecommendations
                                   })
{
    includeRecommendations ??= true;

    const zoo_flm_engine = zoodb.zoo_flm_engine;

    const render_meta_changelog_options = {
        details_open: true
    };

    let htmlContent = null;
    // the diagnostics of the page's render (its errors too: the preview's zoo
    // has the 'continue' error policy)
    let renderDiagnostics = [];

    if (objectType === 'code') {
        const code = zoodb.objects.code[objectId];
        const codePageResult = render_code_page(
            code,
            {
                zoo_flm_engine,
                render_meta_changelog_options,
                eczoodb: zoodb,
                notable_codes,
            }
        );
        renderDiagnostics = codePageResult.diagnostics;

        let recommendationsHtml =
              includeRecommendations
              ? await getCodeRecommendationsHtml({ zoodb, object })
              : [] ;

        if (recommendationsHtml.length > 0) {
            recommendationsHtml.push(sqzhtml`
<p>[These recommendations are not strictly errors; use your judgment if you think
the entry should be kept in this way!]</p>
`);
        }

        debug(`got recommendationsHtml = `, recommendationsHtml);

        let recommendationsJoinedHtml = '';
        if (recommendationsHtml.length > 0) {
            recommendationsJoinedHtml = (
                `<div class="ecz-preview-recommendation-list">`
                + recommendationsHtml
                  .map(
                      (rec_html) => `<div class="ecz-preview-recommendation">${rec_html}</div>`
                  )
                  .join('\n')
                + `</div>`
            );
        }

        htmlContent = sqzhtml`
${recommendationsJoinedHtml}
<article class="ecc-code-page">
${codePageResult.html}
</article>
`;
    } else if (objectType === 'codelist') {

        const codelist = zoodb.objects.codelist[objectId];
        const codelistPageResult = render_codelist_page(
            codelist,
            {
                eczoodb: zoodb,
                zoo_flm_engine,
                render_meta_changelog_options,
            }
        );
        renderDiagnostics = codelistPageResult.diagnostics;
        htmlContent = codelistPageResult.html;

    } else if (objectType === 'user') {

        const user = zoodb.objects.user[objectId];
        htmlContent = sqzhtml`
            <article><div class="tiles-collection">
                ${render_person(user)}
            </div></article>
        `;

    } else if (objectType === 'kingdom') {

        const kingdom = zoodb.objects.kingdom[objectId];
        const kingdomResult = render_kingdom(
            kingdom,
            {
                eczoodb: zoodb,
                zoo_flm_engine,
                render_meta_changelog_options,
            }
        );
        renderDiagnostics = kingdomResult.diagnostics;
        htmlContent = sqzhtml`
            <article>
                ${kingdomResult.html}
            </article>
        `;

    } else if (objectType === 'domain') {

        const domain = zoodb.objects.domain[objectId];
        const domainResult = render_domain(
            domain,
            {
                eczoodb: zoodb,
                zoo_flm_engine,
                render_meta_changelog_options,
            }
        );
        renderDiagnostics = domainResult.diagnostics;
        htmlContent = sqzhtml`
            <article>
                ${domainResult.html}
            </article>
        `;

    } else {

        // lists the diagnostics itself
        let result = await simpleRenderObjectWithFlm(
            { zoodb, objectType, objectId, object,
              registerRenderPreviewCleanupCallback }
        );
        return { htmlContent: result.htmlContent };

    }

    htmlContent = diagnosticsHtml(object, renderDiagnostics) + htmlContent;

    return { htmlContent };
}
