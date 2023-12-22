//import debug_mod from 'debug';
//const debug = debug_mod("eczoodbjs.render_kingdom");

//import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
//const { $$kw, repr } = zooflm;
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog
} from './render_utils.js';
    

// ------


export function render_kingdom(
    kingdom,
    {
        eczoodb,
        zoo_flm_environment,
        doc_metadata,
        include_code_graph_excerpt,
        additional_setup_render_context,
        render_meta_changelog_options,
    }
)
{
    const stats = eczoodb.ecz_stats_processor?.stats;

    const render_doc_fn = (render_context) => {

        if (additional_setup_render_context) {
            additional_setup_render_context(render_context);
        }

        const R = zooflm.make_render_shorthands({render_context});
        const { ne, rdr, ref } = R;

        let s = '';

        s += sqzhtml`
<h1>${ rdr(kingdom.name) }</h1>`;

        s += sqzhtml`
<p>Kingdom in the ${ ref('domain', kingdom.parent_domain.domain_id) }.</p>
<p>Root codes of the ${ rdr(kingdom.name) }:</p>
<ul>`;
    for (const rootCodeRel of kingdom.root_codes ?? []) {
        const { code_id } = rootCodeRel;
        s += sqzhtml`
  <li>
    ${ ref('code', code_id) }
        `;
        if (stats != null) {
            s += sqzhtml`
    <!-- space --> <span class="num-codes-per-kingdom-root-code">(<span class="stat-number">${
        stats.num_codes_per_kingdom_root_code[code_id].value
    }</span> codes)</span>
            `;
        }
        s += sqzhtml`
  </li>`;
    }
    s += sqzhtml`
</ul>
`;
        if (include_code_graph_excerpt) {
            s += sqzhtml`
<div class="code-graph-excerpt">
  <a href="${include_code_graph_excerpt.href}">
    <img src="${include_code_graph_excerpt.graphic_url}">
  </a>
</div>
`;
        }

        s += `

<RENDER_ENDNOTES/>

`;

        const changelog = kingdom._meta?.changelog;
        if (changelog != null) {
            s += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        return s;
    };

    return zooflm.make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        doc_metadata,
        render_endnotes: {
            annotations: ['sectioncontent'],
        }
    });
}
