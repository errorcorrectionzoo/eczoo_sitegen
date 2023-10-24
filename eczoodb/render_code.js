import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_code");

import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
const { $$kw, repr } = zooflm;
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog
} from './render_utils.js';
    

// ------


export function render_code_page(
    code, { zoo_flm_environment, doc_metadata, extra_html_after_title,
            additional_setup_render_context, render_meta_changelog_options }
)
{
    //debug(`render_code_page(): Rendering code page for ‘${code.code_id}’ ...`);
    
    const render_doc_fn = (render_context) => {

        // debug(`Rendering code information. render_context =`, render_context,
        //       `; zoo_flm_environment =`, zoo_flm_environment);

        if (additional_setup_render_context) {
            additional_setup_render_context(render_context);
        }

        const R = zooflm.make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let html = '';

        html += sqzhtml`
<div class="sectioncontent code-name">
  <span class="code-name-cell">
    <h1 class="code-name">
      ${rdr(code.name)}`;
        if (ne(code.introduced)) {
            html += sqzhtml`
      <span class="code-introduced">${rdr(code.introduced)}</span>
`;
        }
        if (extra_html_after_title != null) {
            html += extra_html_after_title;
        }
        html += sqzhtml`
    </h1>
  </span>
</div>`;

        if (code.alternative_names && code.alternative_names.length) {
            const alt_names_joined =
                code.alternative_names
                .map( (n) => `<span class="code-alternative-name">${ rdr(n) }</span>` )
                .join(', ');
            html += sqzhtml`
<div class="sectioncontent code-alternative-names">
  Also known as ${alt_names_joined}.
</div>
`
        }

        const kingdomRelList = code.relations?.root_for_kingdom;
        if (kingdomRelList != null && kingdomRelList.length > 1) {
            for (const { kingdom } of kingdomRelList) {
                html += sqzhtml`
<div class="sectioncontent code-defines-kingdom-name">
    <span class="kingdom-name-label">
      Root code for the
    </span> <!-- space -->${
   ref('kingdom', kingdom.kingdom_id)
}</div>
<div class="kingdom-description">${ rdr(kingdom.description) }</div>
`;
            }
        }

        if (code._meta?.stub) {
            html += sqzhtml`
<div class="sectioncontent code-is-stub">
  This page is a stub.  We hope to complete the
  information here soon!  We are very grateful
  if you are interested in helping out —
  see our <a href="https://github.com/errorcorrectionzoo/eczoo_data/blob/main/CONTRIBUTING.md">contributing guidelines</a>.
</div>
`;
        }


        const display_field = (fieldname, title) => {
            const value = getfield(code, fieldname);
            if ( ! ne(value) ) {
                // nothing to display
                //debug(`Field ${fieldname} of ${code.code_id} is empty.`);
                return ``;
            }
            const parts = fieldname.split('.');
            let classlist = [];
            let clname = 'code';
            for (const p of parts) {
                clname += `-${p}`;
                classlist.push(clname);
            }
            const classnames = classlist.join(' '); // eg. "code-feature code-feature-rate"
            return `
<h2 id="${fieldname.replace('.', '_')}" class="${classnames}">${title}</h2>
<div class="sectioncontent ${classnames}">${rdr(value)}</div>`;
        };

        html += display_field('description', 'Description');

        html += display_field('protection', 'Protection');

        html += display_field('features.rate', 'Rate');

        html += display_field('features.magic_scaling_exponent', 'Magic');

        html += display_field('features.encoders', 'Encoding');

        html += display_field('features.transversal_gates', 'Transversal Gates');

        html += display_field('features.general_gates', 'Gates');

        html += display_field('features.decoders', 'Decoding');

        html += display_field('features.fault_tolerance', 'Fault Tolerance');

        html += display_field('features.code_capacity_threshold', 'Code Capacity Threshold');

        html += display_field('features.threshold', 'Threshold');

        html += display_field('realizations', 'Realizations');

        html += display_field('notes', 'Notes');

        // Relationships to other codes

        const display_code_relation = (relation_fieldname, relation_list, [singular, plural]) => {
            if (!relation_list || !relation_list.length) {
                return ``;
            }

            let result = `
<h2 id="relations_${relation_fieldname}" class="code-${relation_fieldname}">
  ${ (relation_list.length > 1) ? plural : singular }
</h2>
<div class="sectioncontent code-${relation_fieldname}">`;
            // if (relation_list.length == 0) {
            //     return `<span class="na">(none)</span>`;
            // }
            result += `
  <ul class="code-relations-list code-${relation_fieldname}-list">`;
            for (const rel of relation_list) {
                result += `
    <li class="paragraph-in-list">
      <span class="code-${relation_fieldname}}-1-code">${
        ref('code', rel.code_id)
      }</span>`;
                if (ne(rel.detail)) {
                    result += `
      <span class="code-${relation_fieldname}-1-detail">${''
        }<!-- whitespace, em dash, no-break space -->${''
        }&#x2014;&nbsp;${rdr(rel.detail)}</span>`;
                }
                result += `
    </li>` .trim();
            }
            result += `
  </ul>
</div>` .trim();
            return result;
        };

        const relations = code.relations ?? {};

        html += display_code_relation('parents', relations.parents ?? [],
                                      ['Parent', 'Parents']);

        html += display_code_relation('parent_of', relations.parent_of ?? [],
                                      ['Child', 'Children']);


        html += display_code_relation(
            'cousins',
            [].concat(relations.cousins ?? [], relations.cousin_of ?? []),
            ['Cousin', 'Cousins']
        );


        html += `

<RENDER_ENDNOTES/>

`;

        const changelog = code._meta?.changelog;
        if (changelog != null) {
            html += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        return html;
    };

    return zooflm.make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        doc_metadata,
        render_endnotes: {
            annotations: ['sectioncontent'],
        }
    });
};


