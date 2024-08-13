import debugm from 'debug';
const debug = debugm('eczoo_sitegen.jscomponents.gitzoopreview.renderObject');

import html_escape from 'escape-html';

import { render_code_page } from '@errorcorrectionzoo/eczoodb/render_code.js';
import { render_codelist_page } from '@errorcorrectionzoo/eczoodb/render_codelist.js';
import { render_person } from '@errorcorrectionzoo/eczoodb/render_person.js';
import { render_kingdom } from '@errorcorrectionzoo/eczoodb/render_kingdom.js';
import { render_domain } from '@errorcorrectionzoo/eczoodb/render_domain.js';

import { docrefs_placeholder_ref_resolver } from '@errorcorrectionzoo/eczoodb/render_utils.js';

import * as zooflm from '@phfaist/zoodb/zooflm';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import { simpleRenderObjectWithFlm } from '@phfaist/zoodbtools_preview';


const firstParaDescrExplain = `
The first paragraph of a code’s description is used as a snippet in various
places, e.g., as a short version of the code’s description
in code lists as well as a short description for web
search results.
`.trim();

function make_recommendation_ref_resolver(recHtmlList)
{
    return {
        get_ref(ref_type, ref_label, resource_info) {
            let docref_placeholder =
                docrefs_placeholder_ref_resolver.get_ref(ref_type, ref_label, resource_info);
            if (docref_placeholder == null) {
                // all ok, external reference to e.g. another code
                return null;
            }
            // internal doc reference, e.g. a figure.
            let theref = `${html_escape(ref_type)}:${html_escape(ref_label)}`;
            recHtmlList.push(sqzhtml`
<p>${firstParaDescrExplain}</p>
<p>It is recommended to avoid placing references to internal document
elements (e.g., figures or equations) in this paragraph,
to ensure that the first paragraph is meaningful
when read on its own.</p>
<pre>Found reference to: ‘<span class="highlight">${theref}</span>’.</pre>
`);
            // return a placeholder.
            return  new zooflm.RefInstance( zooflm.$$kw({
                ref_type, ref_label,
                formatted_ref_flm_text: `[${ref_type}]`,
                target_href: null,
                counter_value: null,
                counter_formatter_id: null
            }) );
        }
    };
}



async function getCodeRecommendationsHtml({ zoodb, objectType, objectId, object,
                                            additional_setup_render_context })
{
    let recommendationsHtml = [];

    // 
    // Recommend that the description renders cleanly with no internal references
    // to other parts of the code page.
    //

    try {

        let firstParagraphDescription = object.description.get_first_paragraph();

        const render_doc_fn = (render_context) => {
            if (additional_setup_render_context) {
                additional_setup_render_context(render_context);
            }
            const R = zooflm.make_render_shorthands({ render_context });
            const { ne, rdr, ref } = R;

            return rdr(firstParagraphDescription);
        };

        let text_fragment_renderer = zooflm.ZooTextFragmentRenderer();

        /*let result =*/
        zooflm.make_and_render_document({
            zoo_flm_environment: zoodb.zoo_flm_environment,
            render_doc_fn,
            doc_metadata: {},
            render_endnotes: false,
            fragment_renderer: text_fragment_renderer,
            feature_render_options: {
                refs: {
                    add_external_ref_resolvers: [
                        make_recommendation_ref_resolver(recommendationsHtml)
                    ],
                },
            },
        });


    } catch (err) {
        recommendationsHtml.push(sqzhtml`
<p>${firstParaDescrExplain}</p>
<p>This paragraph fails to compile when considered on its own (error message
below).  Please double-check this paragraph and ensure that it is meaningful
when considered on its own.</p>
<pre>${err}</pre>
`
        );
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


export async function renderObject({ zoodb, objectType, objectId, object,
                                     registerRenderPreviewCleanupCallback,
                                     includeRecommendations
                                   })
{
    includeRecommendations ??= true;

    let additional_setup_render_context = (render_context) => {
        render_context.registerRenderPreviewCleanupCallback =
            registerRenderPreviewCleanupCallback;
    };

    let htmlContent = null;

    if (objectType === 'code') {
        const code = zoodb.objects.code[objectId];
        const codeHtmlContent = render_code_page(
            code,
            {
                zoo_flm_environment: zoodb.zoo_flm_environment,
                additional_setup_render_context,
                render_meta_changelog_options: {
                    details_open: true
                },
                eczoodb: zoodb,
            }
        );

        let recommendationsHtml =
              includeRecommendations
              ? await getCodeRecommendationsHtml({ zoodb, objectType, objectId, object,
                                                   additional_setup_render_context })
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
<article class="ecc-code-page">
${recommendationsJoinedHtml}
${codeHtmlContent}
</article>
`;
    } else if (objectType === 'codelist') {

        const codelist = zoodb.objects.codelist[objectId];
        htmlContent = render_codelist_page(
            codelist,
            {
                eczoodb: zoodb,
                additional_setup_render_context,
                render_meta_changelog_options: {
                    details_open: true
                }
            }
        );

    } else if (objectType === 'user') {

        const user = zoodb.objects.user[objectId];
        htmlContent = sqzhtml`
            <article><div class="tiles-collection">
                ${render_person(user)}
            </div></article>
        `;

    } else if (objectType === 'kingdom') {

        const kingdom = zoodb.objects.kingdom[objectId];
        const kingdomHtmlRendered = render_kingdom(
            kingdom,
            {
                eczoodb: zoodb,
                zoo_flm_environment: zoodb.zoo_flm_environment,
                additional_setup_render_context,
                render_meta_changelog_options: {
                    details_open: true
                }
            }
        );
        htmlContent = sqzhtml`
            <article>
                ${kingdomHtmlRendered}
            </article>
        `;

    } else if (objectType === 'domain') {

        const domain = zoodb.objects.domain[objectId];
        const domainHtmlRendered = render_domain(
            domain,
            {
                eczoodb: zoodb,
                zoo_flm_environment: zoodb.zoo_flm_environment,
                additional_setup_render_context,
                render_meta_changelog_options: {
                    details_open: true
                }
            }
        );
        htmlContent = sqzhtml`
            <article>
                ${domainHtmlRendered}
            </article>
        `;

    } else {

        let result = await simpleRenderObjectWithFlm(
            { zoodb, objectType, objectId, object,
              registerRenderPreviewCleanupCallback }
        );
        htmlContent = result.htmlContent;

    }

    return { htmlContent };
}


