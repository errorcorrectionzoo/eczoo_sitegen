import debug_module from 'debug';
const debug = debug_module('eczoodbjs.render_utils');

import * as zoollm from '@phfaist/zoodb/zoollm';
const { $$kw, repr } = zoollm;


const render_value_options = {
    list_joiner: '',
    list_item_wrapper: (x) => `<span class="paragraph-in-list">${x}</span>`,
};


// cf https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
export function sqzhtml(strings, ...values)
{
    //
    // "Squeeze" HTML template strings (only the template strings themselves,
    // the interpolated values are not touched) -- remove newlines and
    // accompanying whitespace immediately before/after tag beginning/end.  Keep
    // all other newlines and whitespace.
    //
    const lastIndex = strings.length - 1;
    let collapsed_strings = strings.map(
        (x, index) => {
            let s = x.replace(/>\n+ */g, '>').replace(/\n+ *</g, '<');
            if (index === 0) {
                return s.trimStart();
            } else if (index === lastIndex) {
                return s.trimEnd();
            }
            return s;
        }
    );
    return String.raw({ raw: collapsed_strings }, ...values);
}




export function mkrenderutils({render_context})
{
    const ne = zoollm.value_not_empty;
    const rdr = (x) => zoollm.render_value(x, render_context, render_value_options);
    const ref = (object_type, object_id, {display_llm}={}) => {
        const refsmgr = render_context.feature_render_manager('refs');
        return refsmgr.render_ref(object_type, object_id, display_llm ?? null,
                                  null, render_context);
    };

    return {ne, rdr, ref};
}


export function render_document({
    zoo_llm_environment,
    render_doc,
    doc_metadata,
    render_endnotes,
    fragment_renderer,
    llm_error_policy,
    feature_document_options,
    feature_render_options,
})
{
    llm_error_policy ??= 'abort';

    let kwargs = {};
    if (doc_metadata != null) {
        kwargs.metadata = doc_metadata;
    }
    if (feature_document_options != null) {
        kwargs.feature_document_options = feature_document_options;
    }

    fragment_renderer ??= new zoollm.ZooHtmlFragmentRenderer();

    const doc = zoo_llm_environment.make_document( render_doc, $$kw(kwargs) );
    try {
        let [rendered_html, render_context] =
            doc.render( fragment_renderer, feature_render_options );
        if (render_endnotes) {
            let endnotes_kwargs = {
                endnotes_heading_title: 'References',
                endnotes_heading_level: 2,
                //annotations: [], //render_endnotes_block_annotations,
            };
            if (typeof render_endnotes === 'object') {
                Object.assign(endnotes_kwargs, render_endnotes);
            }
            const rendered_endnotes =
                render_context.feature_render_manager('endnotes').render_endnotes($$kw(
                    endnotes_kwargs
                ));
            rendered_html = rendered_html.replace('<RENDER_ENDNOTES/>', rendered_endnotes);
        }
        return rendered_html;
    } catch (err) {
        let errstr = '<??>';
        try {
            errstr = ((err && err.__class__ != null) ? repr(err) : ''+err);
        } catch (tostrerr) {}
        console.error("\n🚨🚨🚨 LLM RENDERING ERROR 🚨🚨🚨\n\n" + errstr, err);

        if (llm_error_policy === 'abort') {
            debug(`LLM Error & policy is 'abort', aborting compilation`);
            throw err;
        } else if (llm_error_policy == 'continue') {
            // report the error in the resulting text itself so it can be
            // debugged.
            debug(`Continuing despite LLM Error (llm_error_policy is 'continue')`);
            return sqzhtml`
  <div class="llm-html-error">
    <b>🚨 LLM ERROR 🚨</b>
    <pre>${errstr}</pre>
  </div>`;
        } else {
            throw new Error(
                `Invalid llm_error_policy: ‘${llm_error_policy}’, `
                    + `expected 'abort' or 'continue'`
            );
        }
    }
}




export function render_meta_changelog(changelog, {ne,rdr,ref})
{
    let html = '';

    html += `
<details class="sectioncontent code-contributors">
<summary><span>Page edit log</span></summary>
<ul>`;
    let most_recent = true;
    for (const chg of changelog) {
        html += `
  <li>${ ref('user', chg.user_id) } (${ chg.date })`;
        if (most_recent) {
            html += ` — most recent`;
            most_recent = false;
        }
        html += `</li>`;
    }
    html += `
</ul>
</details>
`;
    return html;
}
