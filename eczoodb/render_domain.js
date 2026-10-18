//import debug_mod from 'debug';
//const debug = debug_mod("eczoodbjs.render_domain");

//import { getfield } from '@phfaist/zoodb/util';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog,
    render_stat_num_codes
} from './render_utils.js';
    

// ------


/**
 * Renders a domain's page with the zoo's FLM engine (`zoo_flm_engine`, by
 * default `eczoodb.zoo_flm_engine`).  Returns the result of the engine's
 * `render_document()`, `{ html, diagnostics, ... }`; the caller prints the
 * diagnostics.  `render_document_options` are passed on to
 * `render_document()` (e.g., `context`).
 */
export function render_domain(
    domain,
    {
        eczoodb,
        zoo_flm_engine,
        include_code_graph_excerpt,
        render_meta_changelog_options,
        render_document_options,
    }
)
{
    const stats = eczoodb.ecz_stats_processor?.stats;

    zoo_flm_engine ??= eczoodb.zoo_flm_engine;

    const compose = (R) => {

        const { ne, rdr, ref, refhref } = R;
        const { endnotes } = R;

        let s = '';

        s += sqzhtml`
<h1>${ rdr(domain.name) }</h1>
`;
        if (ne(domain.epigraph)) {
            s += sqzhtml`
${rdr(domain.epigraph)}
`;
        }
        s += sqzhtml`
<p>Welcome to the ${ rdr(domain.name) }</p>`;
        if (ne(domain.description)) {
            s += sqzhtml`
${ rdr(domain.description) }
`;
        }

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
    <!-- space --> <span class="num-codes-per-kingdom">(${render_stat_num_codes(stats.num_codes_per_kingdom[kingdom_id].value)})</span>
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

${ endnotes() }

`;

        const changelog = domain._meta?.changelog;
        if (changelog != null) {
            s += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        return s;
    };

    return zoo_flm_engine.render_document({
        compose,
        ...(render_document_options ?? {}),
    });
}
