import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_code");

import { getfield } from '@phfaist/zoodb/util';

import * as zooflm from '@phfaist/zoodb/zooflm';
//const { $$kw, repr } = zooflm;
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import {
    render_meta_changelog
} from './render_utils.js';
    

// ------


function get_code_hierarchy_info(code, eczoodb)
{
    // produce an overview of the top-down code parents hierarchy
    let hierarchy_items = {
        primary_parent_chain: [],
        secondary_parents: [],
        self: [],
        children: [],
    };

    let seen_parent_ids = {};

    const set_code_seen = (seen_code_id, what) => {
        const seen_where = seen_parent_ids[seen_code_id];
        if (seen_where == null) {
            seen_parent_ids[seen_code_id] = what;
            return null;
        } else {
            const already_seen_where = seen_parent_ids[seen_code_id];
            debug(`Code ${seen_code_id} (${what}) was already seen as `
                  + `${already_seen_where} of ${code.code_id}`);
            return already_seen_where;
        }
    };

    // first, the code itself.
    hierarchy_items.self.push( {
        code: code,
        object_type: 'code',
        object_id: code.code_id,
        name: code.name,
    } );
    set_code_seen(code.code_id, 'self');

    // display immediate children at the end of the hierarchy items list
    const children = code.relations?.parent_of;
    if (children && children.length > 0) {
        for (const child_info of children) {
            const ccode = child_info.code;
            set_code_seen(ccode.code_id, 'child');
            hierarchy_items.children.push( {
                code: ccode,
                object_type: 'code',
                object_id: ccode.code_id,
                name: ccode.name,
                detail: child_info.detail,
            } );
        }
    }

    // now, get secondary parents
    const secondary_parents_relations = eczoodb.code_get_secondary_parents(code);
    if (secondary_parents_relations && secondary_parents_relations.length > 0) {
        for (const secparent_info of secondary_parents_relations) {
            const spcode = secparent_info.code;
            set_code_seen(spcode.code_id, 'secondary-parent');
            hierarchy_items.secondary_parents.push( {
                code: spcode,
                object_type: 'code',
                object_id: spcode.code_id,
                name: spcode.name,
                detail: secparent_info.detail,
            }) ;
        }
    }

    // go up the primary parents chain
    let primparent_info = eczoodb.code_get_primary_parent(code);
    while (primparent_info != null) {
        if (primparent_info.domain != null) {
            const domain = primparent_info.domain;
            hierarchy_items.primary_parent_chain.unshift({
                domain: domain,
                object_type: 'domain',
                object_id: domain.domain_id,
                name: domain.name,
                detail: null, // not '', because this will be processed with render_value()
                secondary_parents: [],
            })
            primparent_info = null;
        } else if (primparent_info.kingdom != null) {
            const kingdom = primparent_info.kingdom;
            hierarchy_items.primary_parent_chain.unshift({
                kingdom: kingdom,
                object_type: 'kingdom',
                object_id: kingdom.kingdom_id,
                name: kingdom.name,
                detail: null, // not '', because this will be processed with render_value()
                secondary_parents: [],
            });
            primparent_info = {
                domain: kingdom.parent_domain.domain,
            };
        } else if (primparent_info.code != null) {
            const parent_code = primparent_info.code;
            set_code_seen(parent_code.code_id, 'primary-parent-chain');
            const rel_obj = primparent_info.relation_object;
            hierarchy_items.primary_parent_chain.unshift({
                code: parent_code,
                object_type: 'code',
                object_id: parent_code.code_id,
                name: parent_code.name,
                detail: rel_obj.detail,
                secondary_parents: [],
            });
            primparent_info = eczoodb.code_get_primary_parent(parent_code);
        } else {
            console.error('Invalid primary parent?? ', primparent_info);
            // wtf?
            throw Error(`???`);
        }
    }

    // now that we've established the primary-parent chain, go take note of all
    // ancestor codes of each parent in the primary parent chain.  Mark
    // duplicates, which correspond to cycles in the nondirected code parent-child
    // hierarchy.
    //
    // It's important we do this step *after* establishing the full primary parent
    // tree, so that the secondary parents/property codes are marked as duplicates,
    // not the main codes in the primary parent tree.
    for (let primary_parent_item of hierarchy_items.primary_parent_chain) {
        const pcode = primary_parent_item.code;
        if (pcode == null) {
            continue;
        }
        const psecparents = eczoodb.code_get_secondary_parents(pcode);
        for (const psecparentcoderel of psecparents) {
            const psecparentcode = psecparentcoderel.code;
            let duplicate_where = set_code_seen(psecparentcode.code_id);
            primary_parent_item.secondary_parents.push({
                code: psecparentcode,
                name: psecparentcode.name,
                //detail: psecparentcoderel.detail,
                duplicate_where,
                object_type: 'code',
                object_id: psecparentcode.code_id,
            });
        }
    }

    return hierarchy_items;
}




export function render_code_page(
    code, { zoo_flm_environment, doc_metadata, extra_html_after_title,
            additional_setup_render_context, render_meta_changelog_options,
            eczoodb }
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
        const { ne, rdr, //rdrblock,
             ref, refhref } = R;

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

        const domainRelList = code.relations?.root_for_domain;
        if (domainRelList != null && domainRelList.length >= 1) {
            for (const { domain } of domainRelList) {
                html += sqzhtml`
<div class="sectioncontent code-root-code-domain-name">
    <span class="domain-name-label">
      Root code for the
    </span> <!-- space -->${
   ref('domain', domain.domain_id)
}</div>
<div class="domain-description">${ rdr(domain.description) }</div>
`;
            }
        }

        const kingdomRelList = code.relations?.root_for_kingdom;
        if (kingdomRelList != null && kingdomRelList.length >= 1) {
            for (const { kingdom } of kingdomRelList) {
                html += sqzhtml`
<div class="sectioncontent code-root-code-kingdom-name">
    <span class="kingdom-name-label">
      Root code for the
    </span> <!-- space -->${
   ref('kingdom', kingdom.kingdom_id)
}</div>
<div class="sectioncontent kingdom-description">${ rdr(kingdom.description) }</div>
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
            return sqzhtml`
<div class="sectioncontent ${classnames}">
<h2 id="${fieldname.replace('.', '_')}" class="${classnames}">${title}</h2>
${rdr(value)}
</div>
`;
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


        // ---------------------
        // FORMAT CODE HIERARCHY
        // ---------------------

        const hierarchy_items = get_code_hierarchy_info(code, eczoodb);

        let code_hierarchy_content = '';
        
        // display elements of the primary parent chain first:
        for (const ppitem of hierarchy_items.primary_parent_chain) {

            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-${ppitem.object_type}">
  <div class="code-hierarchy-item-name">${ ref(ppitem.object_type, ppitem.object_id) }</div>`;

            if (ppitem.secondary_parents && ppitem.secondary_parents.length) {
                code_hierarchy_content += sqzhtml`
  <div class="code-hierarchy-item-inner-ancestors">`;
                for (const spar of ppitem.secondary_parents) {
                    const is_duplicate = (spar.duplicate_where ? true : false);
                    code_hierarchy_content += sqzhtml`
    <a class="code-hierarchy-item-inner-ancestor${
        is_duplicate ? ' code-hierarchy-item-is-duplicate' : ''
    }" href="${
        refhref(spar.object_type, spar.object_id)
    }">${ rdr(eczoodb.code_short_name(spar.code)) }</a>  <!-- space -->`;
                }
                code_hierarchy_content += sqzhtml`
  </div>`;
            }
            code_hierarchy_content += sqzhtml`
  <div class="code-hierarchy-item-relation-detail">${ rdr(ppitem.detail) }</div>
</div>`;
        }

        // then, the secondary parents of the present specific code
        if ( hierarchy_items.secondary_parents &&  hierarchy_items.secondary_parents.length ) {
            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-secondary-parents">`;
            for (const spitem of hierarchy_items.secondary_parents) {
                code_hierarchy_content += sqzhtml`
  <div class="code-hierarchy-item-secondary-parent">
    <div class="code-hierarchy-item-name">${ref(spitem.object_type, spitem.object_id)}</div>
    <div class="code-hierarchy-item-relation-detail">${rdr(spitem.detail)}</div>
  </div>`;
            }
            code_hierarchy_content += sqzhtml`
</div>`;
        }

        // then, the code itself
        code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-code code-hierarchy-item-self">
  <div class="code-hierarchy-item-name">${ rdr(code.name) }</div>
</div>
`;
        // finally, the child items.
        if ( hierarchy_items.children &&  hierarchy_items.children.length ) {
            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-children">`;
            for (const citem of hierarchy_items.children) {
                code_hierarchy_content += sqzhtml`
  <div class="code-hierarchy-item-child">
    <div class="code-hierarchy-item-name">${ref(citem.object_type, citem.object_id)}</div>
    <div class="code-hierarchy-item-relation-detail">${rdr(citem.detail)}</div>
  </div>`;
            }
            code_hierarchy_content += sqzhtml`
</div>`;
        }
        
        html += sqzhtml`
<div class="sectioncontent code-hierarchy">
<h2 id="code_hierarchy" class="code-hierarchy">Code Hierarchy</h2>
${code_hierarchy_content}
</div>`;

        // ------------------

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
}


