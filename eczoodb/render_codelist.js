import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_codelist");

import { getfield } from '@phfaist/zoodb/util';

import { is_fragment } from '@phfaist/zoodb/zooflm/engine';
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog,
} from './render_utils.js';

import { get_list_data, describe_codelist } from './compile_codelist.js';


const get_code_relationship_to = (code, reference_code_id) => {
    for (const rel_type of ['parents', 'parent_of', 'cousins', 'cousin_of']) {
        for (const rel_obj of code.relations?.[rel_type] ?? []) {
            if (rel_obj.code_id === reference_code_id) {
                return rel_obj;
            }
        }
    }
    return null;
};


const styles = {

    table: ({codelist, list_data, R, preview}) => {

        const display_options = codelist.display?.options ?? {};
        const {ne, rdr, ref} = R;

        let html = '';
        
        html += `
<table class="codelistpage-table ${display_options.cssclass ?? ''}">
<thead>
<tr>`;
        
        for (const column_info of display_options.columns) {
            html += `
  <th>${column_info.title}</th>`;
        }

        html += `
</tr>
</thead>
<tbody>`;

        for (const [code_j, code] of list_data.entries()) {
            html += `
<tr>`;
            for (const column_info of display_options.columns) {
                const col_cssclass =
                    (column_info.cssclass != null) ? `class="${column_info.cssclass}"` : '';
                html += `
  <td ${ col_cssclass }>`;
                if (column_info.predefined != null) {
                    if (column_info.predefined === 'counter') {
                        html += `${code_j}`;
                    } else {
                        throw new Error(`Unknown 'predefined' value in column_info:`
                                        + ` ‘${column_info.predefined}’`);
                    }
                } else {
                    
                    let display_value = null;

                    if (column_info.relationship_property != null) {
                        // the `relationship_property` field is a code_id; we will
                        // find that reference code in the present code's
                        // relationships (parent or cousin), and extract the
                        // associated field given in `property` (e.g., 'detail').
                        let relobj = get_code_relationship_to(
                            code, column_info.relationship_property
                        );
                        if (relobj != null) {
                            display_value = getfield(relobj, column_info.property ?? 'detail');
                        }
                    } else if (column_info.property != null) {
                        // pick out this property of the code
                        display_value = getfield(code, column_info.property);
                    }

                    // maybe fix the display_value
                    if (ne(display_value)
                        && (column_info.first_paragraph_only
                            || column_info.truncate_to != null)) {
                        display_value = preview(display_value, {
                            first_paragraph: column_info.first_paragraph_only,
                            truncate_to: column_info.truncate_to,
                        });
                    }

                    // render the value itself
                    let rendered_value;
                    if (column_info.link_to_code) {
                        rendered_value = ref( 'code', code.code_id,
                                              {display_flm: display_value} );
                    } else {
                        rendered_value = rdr( display_value );
                    }

                    html += rendered_value;
                    
                }
                html += `
  </td>`;
            }
            html += `
</tr>`;
        }
        html += `
</tbody>
</table>
`;

        return html;
    },

    index: ({codelist, list_data, R, preview}) => {

        const display_options = codelist.display?.options ?? {};
        const {ne, rdr, ref} = R;

        let html = '';

        if (display_options.show_description) {
            html += `
<div class="code-index-control-display"><a href="javascript:void(0);" onClick="document.getElementById('main').classList.toggle('code-index-with-descriptions');">[<span class="code-index-ctrl-label-show">Show</span><span class="code-index-ctrl-label-hide">Hide</span> short descriptions]</a></div>
<ol class="code-index">`;
        }
        for (const code of list_data) {
            html += sqzhtml`
  <li>
    <span class="code-name">`;
            html += ref('code', code.code_id);
            if (display_options.show_introduced && ne(code.introduced)) {
                html += sqzhtml`
        <span class="code-introduced">${ rdr(code.introduced) }</span>`;
            }
            html += `
    </span>`;
            if (display_options.show_alternative_names
                && code.alternative_names && code.alternative_names.length) {
                const alt_names_joined =
                    code.alternative_names
                    .map( (n) => `<span class="code-alternative-name">${ rdr(n) }</span>` )
                    .join(', ');
                html += sqzhtml`
        <span class="sectioncontent code-alternative-names">
          a.k.a. ${alt_names_joined}.
        </span>
        `
            }
            if (display_options.show_description) {
                let description = code.description;
                if (ne(description)
                    && (display_options.description_first_paragraph
                        || display_options.description_truncate_to)) {
                    description = preview(description, {
                        first_paragraph: display_options.description_first_paragraph,
                        truncate_to: display_options.description_truncate_to,
                    });
                }
                html += `
      <div class="code-description code-index-code-description-start-hidden">${ rdr(description) }</div>` .trim();
            }
            html += `
  </li>` .trim();
        }
        html += `
</ol>`;
        
        return html;
    },

};





/**
 * Renders a code list's page with the zoo's FLM engine (`zoo_flm_engine`, by
 * default `eczoodb.zoo_flm_engine`).  Returns the result of the engine's
 * `render_document()`, `{ html, diagnostics, ... }`; the caller prints the
 * diagnostics.  The fragments this page makes (the truncated descriptions
 * and the automatic description) are released once the page is rendered.
 * `render_document_options` are passed on to `render_document()` (e.g.,
 * `context`).
 */
export function render_codelist_page(
    codelist,
    {
        eczoodb, zoo_flm_engine,
        render_meta_changelog_options,
        include_code_graph_excerpt,
        include_auto_description,
        render_document_options,
    }
)
{
    debug(`render_codelist_page(): Rendering list ‘${codelist.list_id}’ ...`);

    include_code_graph_excerpt ??= false;
    include_auto_description ??= true;

    zoo_flm_engine ??= eczoodb.zoo_flm_engine;

    const styles_render_fn = styles[codelist.display?.style ?? 'index']
    const list_data = get_list_data({codelist, eczoodb});

    // The fragments made for this page only, released when it is rendered.
    let page_fragments = [];

    // A shortened copy of a field for a column or a description: its first
    // paragraph and/or about `truncate_to` characters.  (A value that is not
    // a fragment is shown as it is.)
    const preview = (value, { first_paragraph, truncate_to }) => {
        if (!is_fragment(value)) {
            return value;
        }
        const { fragment } = zoo_flm_engine.truncate(value, {
            first_paragraph: Boolean(first_paragraph),
            // without a length, the whole first paragraph
            chars: truncate_to ?? (value.source.length + 1),
        });
        page_fragments.push(fragment);
        return fragment;
    };

    let auto_description_fragment = null;
    if (include_auto_description) {
        const { pattern, description_flm } = describe_codelist({eczoodb, codelist});
        let heading = 'List';
        if (pattern && pattern.type && pattern.type !== 'custom') {
            heading += ` (\\verba{${pattern.type}})`;
        }
        auto_description_fragment = zoo_flm_engine.make_fragment(
            heading + ': ' + description_flm,
            {
                origin: {
                    object_type: 'codelist',
                    object_id: codelist.list_id,
                    field: 'auto_description',
                    label: `codelist:${codelist.list_id}#auto_description`,
                },
            }
        );
        page_fragments.push(auto_description_fragment);
    }
    
    const compose = (R) => {

        const { ne, rdr, ref, endnotes } = R;

        let html = '';

        html += sqzhtml`
<article class="ecc-codelist-page" id="codelist_${codelist.list_id}">` .trim();

        if (ne(codelist.intro)) {
            html += sqzhtml`
<div class="codelist-intro">${ rdr(codelist.intro) }</div>`;
        }

        if (include_code_graph_excerpt) {
            html += sqzhtml`
<div class="codelist-jump-to-code-graph-excerpt"><p><a href="#idCodeGraphExcerpt">[Jump to code graph excerpt]</a></p></div>
`;
        }

        html += styles_render_fn( {codelist, list_data, R, preview} );

        if (include_auto_description) {
            html += sqzhtml`
<div class="codelist-autodescription">${rdr(auto_description_fragment)}</div>
`;
        }

        if (include_code_graph_excerpt) {
            html += sqzhtml`
<div class="code-graph-excerpt" id="idCodeGraphExcerpt">
  <a href="${include_code_graph_excerpt.href}">
    <img src="${include_code_graph_excerpt.graphic_url}">
  </a>
</div>
`;
        }

        html += `

${ endnotes() }

`;

        const changelog = codelist._meta?.changelog;
        if (changelog != null) {
            html += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        html += `
</article>`;

        return html;
    };

    // (A reference in a truncated description to a label of the code's page,
    // such as a figure's, resolves through the zoo's index: it links to the
    // code's page.)

    try {
        return zoo_flm_engine.render_document({
            compose,
            ...(render_document_options ?? {}),
        });
    } finally {
        zoo_flm_engine.release(page_fragments);
        page_fragments = [];
    }

};


