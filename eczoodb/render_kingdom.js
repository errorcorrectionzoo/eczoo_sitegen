//import debug_mod from 'debug';
//const debug = debug_mod("eczoodbjs.render_kingdom");

//import { getfield } from '@phfaist/zoodb/util';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog,
    render_stat_num_codes
} from './render_utils.js';
    

// ------


/**
 * Renders a kingdom's page with the zoo's FLM engine (`zoo_flm_engine`, by
 * default `eczoodb.zoo_flm_engine`).  Returns the result of the engine's
 * `render_document()`, `{ html, diagnostics, ... }`; the caller prints the
 * diagnostics.  `render_document_options` are passed on to
 * `render_document()` (e.g., `context`).
 */
export function render_kingdom(
    kingdom,
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

        const { ne, rdr, ref } = R;
        const { endnotes } = R;

        let s = '';

        s += sqzhtml`
<h1>${ rdr(kingdom.name) }</h1>
`;
        if (ne(kingdom.epigraph)) {
            s += sqzhtml`
${rdr(kingdom.epigraph)}
`;
        }
        s += sqzhtml`
<p>The ${ rdr(kingdom.name) } lies in the ${ ref('domain', kingdom.parent_domain.domain_id) }.</p>
`;
        if (ne(kingdom.description)) {
            s += sqzhtml`
${ rdr(kingdom.description) }
`;
        }

        s += sqzhtml`
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
    <!-- space --> <span class="num-codes-per-kingdom-root-code">(${
        render_stat_num_codes(stats.num_codes_per_kingdom_root_code[code_id].value)
    })</span>
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

${ endnotes() }

`;

        const changelog = kingdom._meta?.changelog;
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
