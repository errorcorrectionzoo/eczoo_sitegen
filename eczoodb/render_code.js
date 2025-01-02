import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_code");

import { getfield } from '@phfaist/zoodb/util';

import {
    // $$kw, repr
    make_render_shorthands,
    //render_text_standalone,
    make_and_render_document,
} from '@phfaist/zoodb/zooflm';
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog
} from './render_utils.js';

import {
    get_code_hierarchy_info,
    render_code_hierarchy_content,
} from './render_code_hierarchy.js';



//
// Code render helpers
//

function display_code_field(code, fieldname, title, { R })
{
    const { ne, rdr } = R;
    const value = getfield(code, fieldname);
    if ( ! ne(value) ) {
        // nothing to display
        //debug(`Field ${fieldname} of ${code_id} is empty.`);
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
    return sqzhtml`
<div class="sectioncontent ${classnames}">
<h2 id="${fieldname.replace('.', '_')}" class="${classnames}">${title}</h2>
${rdr(value)}
</div>
`;
};


function display_code_relation(relation_fieldname, relation_list, [singular, plural], { R })
{
    const { ref, rdr, ne } = R;
    if (!relation_list || !relation_list.length) {
        return ``;
    }

    let result = sqzhtml`
<div class="sectioncontent code-${relation_fieldname}">
<h2 id="relations_${relation_fieldname}" class="code-${relation_fieldname}">
${ (relation_list.length > 1) ? plural : singular }
</h2>
`;
    // if (relation_list.length == 0) {
    //     return `<span class="na">(none)</span>`;
    // }
    result += sqzhtml`
<ul class="code-relations-list code-${relation_fieldname}-list">`;
    for (const rel of relation_list) {
        result += sqzhtml`
<li class="paragraph-in-list">
<span class="code-${relation_fieldname}}-1-code">${
ref('code', rel.code_id)
}</span>`;
        if (ne(rel.detail)) {
            result += sqzhtml`
<span class="code-${relation_fieldname}-1-detail">${''
}<!-- whitespace, em dash, no-break space -->${''
}&#x2014;&nbsp;${rdr(rel.detail)}</span>`;
        }
        result += sqzhtml`
</li>`;
    }
    result += sqzhtml`
</ul>
</div>`;
    return result;
};


function display_code_list_memberships({ eczoodb, code, R })
{
    const code_id = code.code_id;
    const { ref } = R;
    let html = '';

    // Display information about which lists this code appears in.
    let appears_in_codelists = Object.values(eczoodb.objects.codelist).filter(
        (codelist) => (
            codelist.list_id !== 'all'
            && eczoodb.codelist_compiled_code_id_set(codelist).has(code_id)
        )
    );
    if (appears_in_codelists.length !== 0) {
        appears_in_codelists.sort(
            (a,b) => a.title.flm_text.localeCompare(b.title.flm_text)
        );
        //debug(`${code_id} appears in code lists: ${ appears_in_codelists.map(l => l.list_id).join(', ') }`);
        html += sqzhtml`
<div class="sectioncontent code-codelist-membership">
<h2 id="code_codelist_membership">Member of code lists</h2>
<ul class="code-codelist-membership-list">`;
        for (const codelist of appears_in_codelists) {
            //debug(`Including codelist:`, codelist);
            html += sqzhtml`
<li>${ref('codelist', codelist.list_id)}</li>
`;
        }
        html += `</ul></div>`;
    }
    return html;
}


function makeLexicographicCompareFn(cmpArray, { cmpOps, cmpOpDefault }={})
{
    const iCmp = (a, b) => ( (a<b) ? -1 : ( (a === b) ? 0 : 1 ) );
    const cmpOpsFull = {
        auto: (a, b) => {
            if (typeof a !== typeof b) {
                console.warn(`Type mismatch in comparison`, a, b);
            }
            if (typeof a === 'number') {
                return iCmp(a, parseInt(b));
            }
            if (typeof a === 'string') {
                return a.localeCompare(b);
            }
            // stringify to JSON, hope for the best
            return JSON.stringify(a).localeCompare(JSON.stringify(b));
        },
        string: (a, b) => (''+a).localeCompare(b),
        int: (a, b) => iCmp(parseInt(a), parseInt(b)),
        ...(cmpOps ?? {}),
    };
    const cmpFns = (cmpArray??[]).map( (x) => (typeof x === 'string' ? cmpOpsFull[x] : x) );
    const cmpFnDefault = cmpOpsFull[cmpOpDefault ?? 'auto']

    const lxCmp = (arr1, arr2) => {
        const minLength = arr1.length < arr2.length ? arr1.length : arr2.length;
        
        for (let i = 0; i < minLength; i++) {
            const val1 = arr1[i];
            const val2 = arr2[i];
            const cmp = (i < cmpFns.length) ? cmpFns[i] : cmpFnDefault;
            const cmpValue = cmp(val1, val2);
            if (cmpValue !== 0) {
                return cmpValue;
            }
        }
        
        return arr1.length - arr2.length;
    }
    return lxCmp;
};
  


function display_code_href_references({ eczoodb, code, R })
{
    const code_id = code.code_id;
    const { ref } = R;
    let html = '';

    // Display information about which lists this code appears in.
    let encountered_refs =
        eczoodb.zoo_flm_processor.scanner.get_encountered_references_to_labels(
        [ ['code', code_id] ]
    );
    if (encountered_refs.length !== 0) {
        const lxCmp = makeLexicographicCompareFn();
        encountered_refs.sort(
            (a,b) => lxCmp(
                [a.resource_info.object_type, a.resource_info.object_id],
                [b.resource_info.object_type, b.resource_info.object_id],
            )
        );
        html += sqzhtml`
<div class="sectioncontent code-href-references">
<h2 id="code_href_references">Hyperlinks to this code</h2>
<ul class="code-href-references-list">`;
        for (const { resource_info } of encountered_refs) {
            const { object_type, object_id } = resource_info;
            if (object_type === 'codelist') {
                continue; // referring lists are already listed separately
            }
            html += sqzhtml`
<li>${ref(object_type, object_id)}</li>
`;
        }
        html += `</ul></div>`;
    }
    return html;
}




//
// Main Code Page Rendering Routine
//


export function render_code_page(
    code, {
        zoo_flm_environment, doc_metadata, extra_html_after_title,
        include_code_graph_link,
        additional_setup_render_context, render_meta_changelog_options,
        eczoodb, notable_codes
    }
)
{
    const code_id = code.code_id;

    debug(`render_code_page(): Rendering code page for ‘${code_id}’ ...`);
    
    const render_doc_fn = (render_context) => {

        // debug(`Rendering code information. render_context =`, render_context,
        //       `; zoo_flm_environment =`, zoo_flm_environment);

        if (additional_setup_render_context) {
            additional_setup_render_context(render_context);
        }

        const R = make_render_shorthands({render_context});
        const {
            ne, rdr, //rdrblock,
            ref
        } = R;

        let html = '';

        html += sqzhtml`
<div class="code-main-section">`;

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
        if (include_code_graph_link != null) {
            html += `<a href="${include_code_graph_link}" class="linkcodegraph"></a>`;
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
  Alternative names: ${alt_names_joined}.
</div>
`
        }

        const domainRelList = code.relations?.root_for_domain;
        if (domainRelList != null && domainRelList.length >= 1) {
            for (const { domain } of domainRelList) {
                html += sqzhtml`
<div class="sectioncontent code-root-code-domain">
    <div class="code-root-code-domain-name"><span class="domain-name-label">
      Root code for the
    </span> <!-- space -->${
   ref('domain', domain.domain_id)
}</div>`;
                if (ne(domain.description)) {
                    html += sqzhtml`
    <div class="code-root-code-domain-description">
        ${ rdr(domain.description) }
    </div>`;
                }
                html += sqzhtml`
</div>
`;
            }
        }

        const kingdomRelList = code.relations?.root_for_kingdom;
        if (kingdomRelList != null && kingdomRelList.length >= 1) {
            for (const { kingdom } of kingdomRelList) {
                html += sqzhtml`
<div class="sectioncontent code-root-code-kingdom">
    <div class="code-root-code-kingdom-name"><span class="kingdom-name-label">
      Root code for the
    </span> <!-- space -->${
   ref('kingdom', kingdom.kingdom_id)
}</div>`;
                if (ne(kingdom.description)) {
                    html += sqzhtml`
    <div class="code-root-code-kingdom-description">
        ${ rdr(kingdom.description) }
    </div>`;
                }
                html += sqzhtml`
</div>
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


        const display_field =
            (fieldname, title) => display_code_field(code, fieldname, title, { R });
        
        html += display_field('description', 'Description');

        html += display_field('protection', 'Protection');

        html += display_field('features.rate', 'Rate');

        html += display_field('features.magic_scaling_exponent', 'Magic');

        html += display_field('features.encoders', 'Encoding');

        html += display_field('features.transversal_gates', 'Transversal Gates');

        html += display_field('features.general_gates', 'Gates');

        html += display_field('features.decoders', 'Decoding');

        html += display_field('features.fault_tolerance', 'Fault Tolerance');

        html += display_field('features.code_capacity_threshold', 'Code Capacity Threshold');

        html += display_field('features.threshold', 'Threshold');

        html += display_field('realizations', 'Realizations');

        html += display_field('notes', 'Notes');


        const relations = code.relations ?? {};
        // ### parents & parent_of relations now displayed via "code hierarchy" tree
        // html += display_code_relation('parents', relations.parents ?? [],
        //                               ['Parent', 'Parents']);
        // html += display_code_relation('parent_of', relations.parent_of ?? [],
        //                               ['Child', 'Children']);
        html += display_code_relation(
            'cousins',
            [].concat(relations.cousins ?? [], relations.cousin_of ?? []),
            ['Cousin', 'Cousins'],
            {
                R
            }
        );

        html += display_code_list_memberships({
            eczoodb,
            code,
            R
        });

        html += display_code_href_references({
            eczoodb,
            code,
            R
        });


        html += `
<RENDER_ENDNOTES/>
`;
        const changelog = code._meta?.changelog;
        if (changelog != null) {
            html += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        html += sqzhtml`
</div>`; // .code-main-section



        // ---------------------
        // FORMAT CODE HIERARCHY
        // ---------------------

        const hierarchy_items = get_code_hierarchy_info(
            {
                code,
                eczoodb,
                notable_codes,
            }
        );

        const code_hierarchy_content = render_code_hierarchy_content({
            code,
            hierarchy_items,
            eczoodb,
            R
        });

        html += sqzhtml`
<div class="sectioncontent code-hierarchy">
<h2 id="code_hierarchy" class="code-hierarchy">Primary Hierarchy</h2>
${code_hierarchy_content}`;

        html += sqzhtml`
</div>`;

        // ------------------

        return html;
    };

    return make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        doc_metadata,
        render_endnotes: {
            annotations: ['sectioncontent'],
        }
    });
}


