//import debug_mod from 'debug';
//const debug = debug_mod("eczoodbjs.render_domain");

//import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
//const { $$kw, repr } = zooflm;
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog
} from './render_utils.js';
    

// ------


export function render_domain(
    domain,
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
        const { ne, rdr, ref, refhref } = R;

        let s = '';

        s += sqzhtml`
<h1>${ rdr(domain.name) }</h1>

<p>Welcome to the ${ rdr(domain.name) }`;
        if (ne(domain.description)) {
            s += sqzhtml`
<!-- --> — ${ rdr(domain.description) }`;
        }
        s += sqzhtml`
</p>`;

        s += sqzhtml`
<p>Kingdoms:</p>
<ul>`;

        //debug(`domain's kingdoms: `, domain.kingdoms);

        // iterate over kingdom relation object instances
        for (const { kingdom_id, kingdom } of domain.kingdoms ?? []) {
            s += sqzhtml`
  <li>
    <a href="${ refhref('kingdom', kingdom_id) }">
      ${ rdr(kingdom.name) }
    </a>`;
            if (stats != null) {
                s += sqzhtml`
    <!-- space --> <span class="num-codes-per-kingdom">(<span class="stat-number">${stats.num_codes_per_kingdom[kingdom_id].value}</span> codes)</span>
                `;
            }
            s += sqzhtml`
  </li>`;
        }

        s += sqzhtml`
</ul>`;

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

        const changelog = domain._meta?.changelog;
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
