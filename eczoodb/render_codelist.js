import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_codelist");

import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
const { $$kw, repr } = zooflm;

import { render_meta_changelog } from './render_utils.js';

import { get_list_data } from './compile_codelist.js';


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

    table: ({codelist, list_data, R}) => {

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
                    if (ne(display_value) && column_info.first_paragraph_only) {
                        // must be an FLMFragment for this to make sense.
                        display_value = display_value.get_first_paragraph();
                    }
                    if (ne(display_value) && column_info.truncate_to != null) {
                        // must be an FLMFragment for this to make sense.
                        display_value = display_value.truncate_to(column_info.truncate_to);
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

    index: ({codelist, list_data, R}) => {

        const display_options = codelist.display?.options ?? {};
        const {ne, rdr, ref} = R;

        let html = '';

        html += `
<ol class="code-index">`;
        for (const code of list_data) {
            html += `
  <li>
    <span class="code-name">`;
            html += ref('code', code.code_id);
            if (display_options.show_introduced && ne(code.introduced)) {
                html += `
        <span class="code-introduced">${ rdr(code.introduced) }</span>` .trim();
            }
            html += `
    </span>` .trim();
            if (display_options.show_description) {
                let description = code.description;
                if (ne(description) && display_options.description_first_paragraph) {
                    description = description.get_first_paragraph();
                }
                if (ne(description) && display_options.description_truncate_to) {
                    description = description.truncate_to(
                        display_options.description_truncate_to
                    );
                }
                html += `
      <span class="code-description">${ rdr(description) }</span>` .trim();
            }
            html += `
  </li>` .trim();
        }
        html += `
</ol>`;
        
        return html;
    },

};






export function render_codelist_page(
    codelist,
    { eczoodb, doc_metadata, additional_setup_render_context }
)
{
    debug(`render_codelist_page(): Rendering list ‘${codelist.list_id}’ ...`);

    const zoo_flm_environment = eczoodb.zoo_flm_environment;

    const styles_render_fn = styles[codelist.display?.style ?? 'index']
    const list_data = get_list_data({codelist, eczoodb});
    
    const render_doc_fn = (render_context) => {

        if (additional_setup_render_context) {
            additional_setup_render_context(render_context);
        }

        const R = zooflm.make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let html = '';

        html += `
<article class="ecc-codelist-page" id="codelist_${codelist.list_id}">` .trim();

        if (ne(codelist.intro)) {
            html += `
<div class="codelist-intro">${ rdr(codelist.intro) }</div>`;
        }

        html += styles_render_fn( {codelist, list_data, R} );

        html += `
</article>`;


        html += `

<RENDER_ENDNOTES/>

`;

        const changelog = codelist._meta?.changelog;
        if (changelog != null) {
            html += render_meta_changelog(changelog, R);
        }

        html += `
</article>`;

        return html;
    };

    return zooflm.make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        doc_metadata,
        render_endnotes: true
    });

};


