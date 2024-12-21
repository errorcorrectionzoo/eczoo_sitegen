import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.render_code");

import { getfield } from '@phfaist/zoodb/util';

import {
    // $$kw, repr
    make_render_shorthands,
    render_text_standalone,
    make_and_render_document,
} from '@phfaist/zoodb/zooflm';
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
        first_parent_is_primary_parent: null,
        parents: [],
        self: [],
        children: [],
    };

    let seen_parent_ids = {};

    let fetch_ancestors_for_items = [];

    const mark_code_seen = (seen_code_id, what) => {
        const seen_where = seen_parent_ids[seen_code_id];
        if (seen_where == null) {
            seen_parent_ids[seen_code_id] = what;
            return null;
        }
        // debug(`Code ${seen_code_id} (${what}) was already seen as `
        //       + `${seen_where} of ${code.code_id}`);
        return seen_where;
    };

    // first, the code itself.
    hierarchy_items.self.push( {
        code: code,
        object_type: 'code',
        object_id: code.code_id,
        name: code.name,
    } );
    mark_code_seen(code.code_id, 'self');

    // display immediate children at the end of the hierarchy items list
    const children = code.relations?.parent_of;
    if (children && children.length > 0) {
        for (const child_info of children) {
            const ccode = child_info.code;
            mark_code_seen(ccode.code_id, 'child');
            hierarchy_items.children.push( {
                code: ccode,
                object_type: 'code',
                object_id: ccode.code_id,
                name: ccode.name,
                detail: child_info.detail,
                descendants: [],
            } );
        }
    }

    const parents_relations = code.relations?.parents;

    let primparent_info = eczoodb.code_get_primary_parent(code);
    if (parents_relations != null && parents_relations.length
        && primparent_info.code != null && primparent_info.code === parents_relations[0].code) {
        hierarchy_items.first_parent_is_primary_parent = true;
    } else {
        hierarchy_items.first_parent_is_primary_parent = false;
    }

    // now, get first-level parents & info
    if (parents_relations != null && parents_relations.length > 0) {
        for (const [j,parent_info] of parents_relations.entries()) {
            const pcode = parent_info.code;
            mark_code_seen(pcode.code_id, 'parent');
            let is_primary_parent = (j == 0 && hierarchy_items.first_parent_is_primary_parent);
            const item = {
                code: pcode,
                object_type: 'code',
                object_id: pcode.code_id,
                name: pcode.name,
                detail: parent_info.detail,
                ancestors: [],
                //ancestor_search_skip_primary_parent: is_primary_parent,
            };
            hierarchy_items.parents.push( item );
            if (!is_primary_parent) {
                // primary parent's ancestors will be shown above
                fetch_ancestors_for_items.push( item );
            }
        }
    }

    // go up the primary parents chain
    while (primparent_info != null) {
        if (primparent_info.domain != null) {
            const domain = primparent_info.domain;
            hierarchy_items.primary_parent_chain.unshift({
                domain: domain,
                object_type: 'domain',
                object_id: domain.domain_id,
                name: domain.name,
                detail: null, // not '', because this will be processed with render_value()
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
            });
            primparent_info = {
                domain: kingdom.parent_domain.domain,
            };
        } else if (primparent_info.code != null) {
            const parent_code = primparent_info.code;
            mark_code_seen(parent_code.code_id, 'primary-parent-chain');
            const rel_obj = primparent_info.relation_object;
            const item = {
                code: parent_code,
                object_type: 'code',
                object_id: parent_code.code_id,
                name: parent_code.name,
                detail: rel_obj.detail,
                ancestors: [],
                ancestor_search_skip_primary_parent: true,
            };
            hierarchy_items.primary_parent_chain.unshift(item);
            fetch_ancestors_for_items.push(item);
            primparent_info = eczoodb.code_get_primary_parent(parent_code);
        } else {
            console.error('Invalid primary parent?? ', primparent_info);
            // wtf?
            throw Error(`???`);
        }
    }

    // now that we've established the primary-parent chain, go take note of all
    // ancestor codes of each parent in the primary parent chain.
    for (let primary_parent_item of fetch_ancestors_for_items) {
        const pcode = primary_parent_item.code;
        if (pcode == null) {
            continue;
        }
        const pancestors = eczoodb.code_get_ancestors(pcode, {
            return_relation_info: true,
            skip_first_primary_parent_relation: primary_parent_item.ancestor_search_skip_primary_parent,
            //parent_child_sort: true,
        });
        for (const pancestorcodeinfo of pancestors) {
            if (pancestorcodeinfo.code === pcode) {
                continue; // skip the primary parent code itself
            }
            const pancestorcode = pancestorcodeinfo.code;
            let ancestor_relation_info_chain = [];
            let pintermediatecodeinfo = pancestorcodeinfo;
            while (pintermediatecodeinfo != null) {
                ancestor_relation_info_chain.push(pintermediatecodeinfo);
                pintermediatecodeinfo = pintermediatecodeinfo.reached_from_code_info;
            }
            ancestor_relation_info_chain.reverse();
            primary_parent_item.ancestors.push({
                code: pancestorcode,
                name: pancestorcode.name,
                object_type: 'code',
                object_id: pancestorcode.code_id,
                ancestor_relation_info_chain,
            });
        }
    }

    // also, fetch descendants of children.
    for (let child_item of hierarchy_items.children) {
        const ccode = child_item.code;
        const cdescendants = eczoodb.code_get_family_tree(ccode, {
            return_relation_info: true,
            parent_child_sort: true,
        });
        for (const cdescendantinfo of cdescendants) {
            if (cdescendantinfo.code === ccode) {
                continue; // skip the child code itself
            }
            const cdescendantcode = cdescendantinfo.code;
            let descendant_relation_info_chain = [];
            let cintermediatecodeinfo = cdescendantinfo;
            while (cintermediatecodeinfo != null) {
                descendant_relation_info_chain.push(cintermediatecodeinfo);
                cintermediatecodeinfo = cintermediatecodeinfo.reached_from_code_info;
            }
            descendant_relation_info_chain.reverse();
            child_item.descendants.push({
                code: cdescendantcode,
                name: cdescendantcode.name,
                object_type: 'code',
                object_id: cdescendantcode.code_id,
                descendant_relation_info_chain,
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
    const code_id = code.code_id;

    debug(`render_code_page(): Rendering code page for ‘${code_id}’ ...`);
    
    const render_doc_fn = (render_context) => {

        // debug(`Rendering code information. render_context =`, render_context,
        //       `; zoo_flm_environment =`, zoo_flm_environment);

        if (additional_setup_render_context) {
            additional_setup_render_context(render_context);
        }

        const R = make_render_shorthands({render_context});
        const { ne, rdr, //rdrblock,
             ref, refhref } = R;

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

        html += `
<RENDER_ENDNOTES/>
`;
        const changelog = code._meta?.changelog;
        if (changelog != null) {
            html += render_meta_changelog(changelog, R, render_meta_changelog_options);
        }

        html += sqzhtml`
</div>`; // .code-main-section

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

        const rdrtext = (fragment) => render_text_standalone(fragment);

        let code_hierarchy_content = '';

        let leftdecorationelements = sqzhtml`
<span class="code-hierarchy-item-leftdecoration-symbol"></span>
<span class="code-hierarchy-item-leftdecoration-b1"></span>
<span class="code-hierarchy-item-leftdecoration-b2"></span>
        `;

        code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-items">`;

        const gen_ancestors = (ppitemancestors) => {
            if (ppitemancestors == null || !ppitemancestors.length) {
                return '';
            }
            let s = sqzhtml`
    <span class="code-hierarchy-item-inner-ancestors">
        ${leftdecorationelements}`;
            for (const spar of ppitemancestors) {
                const sparcode = spar.code;
                s += sqzhtml`
        <a class="code-hierarchy-item-inner-ancestor" href="${
            refhref(spar.object_type, spar.object_id).replace('"', '&quot;')
        }" title="${
            (spar.ancestor_relation_info_chain.map( (cinfo) => rdrtext(cinfo.code.name) )
             .join(' ← ')).replace('"', '&quot;')
        }">${ rdr(sparcode ? eczoodb.code_short_name(sparcode) : spar.name) }</a>  <!-- space -->`;
            }
            s += sqzhtml`
    </span>`;
            return s;
        };
        
        const gen_descendants = (citemdescendants) => {
            if (citemdescendants == null || !citemdescendants.length) {
                return '';
            }
            let s = sqzhtml`
    <span class="code-hierarchy-item-inner-descendants">
        ${leftdecorationelements}`;
            for (const ccinfo of citemdescendants) {
                const ccode = ccinfo.code;
                s += sqzhtml`
        <a class="code-hierarchy-item-inner-descendant" href="${
            refhref(ccinfo.object_type, ccinfo.object_id).replace('"', '&quot;')
        }" title="${
            (ccinfo.descendant_relation_info_chain.map( (cinfo) => rdrtext(cinfo.code.name) )
             .join(' → ')).replace('"', '&quot;')
        }">${ rdr(ccode ? eczoodb.code_short_name(ccode) : ccinfo.name) }</a>  <!-- space -->`;
            }
            s += sqzhtml`
    </span>`;
            return s;
        };
        
        // display elements of the primary parent chain first:
        for (const ppitem of hierarchy_items.primary_parent_chain) {

            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-${ppitem.object_type}">
    <div class="code-hierarchy-item-row code-hierarchy-item-name">
        ${leftdecorationelements}
        <span class="code-hierarchy-item-content">${ ref(ppitem.object_type, ppitem.object_id) }`;

            // gen_ancestors() simply returns an empty string if its argument is invalid/undefined
            code_hierarchy_content += gen_ancestors(ppitem.ancestors);
            code_hierarchy_content += sqzhtml`</span>
    </div>`;

    //         code_hierarchy_content += sqzhtml`
    // <div class="code-hierarchy-item-row ${
    //     ne(ppitem.detail) ? '' : 'code-hierarchy-item-row-thin'
    // } code-hierarchy-item-relation-detail">
    //     ${leftdecorationelements}
    //     <span class="code-hierarchy-item-content">${ rdr(ppitem.detail) }</span>
    // </div>`;
            code_hierarchy_content += sqzhtml`
    <div class="code-hierarchy-item-row code-hierarchy-item-row-thin code-hierarchy-item-relation-detail">
        ${leftdecorationelements}
        <span class="code-hierarchy-item-content"></span>
    </div>`;

            code_hierarchy_content += sqzhtml`
</div>`;
        }

        // then, the parents of the present specific code
        if ( hierarchy_items.parents &&  hierarchy_items.parents.length ) {
            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-section code-hierarchy-item-section-parents">
    <div class="code-hierarchy-item-row code-hierarchy-item-sectiontitle">
        ${leftdecorationelements}
        <span class="code-hierarchy-item-content">Parents</span>
    </div>
</div>`;
            for (const pitem of hierarchy_items.parents) {
                code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-parent">
    <div class="code-hierarchy-item-row code-hierarchy-item-name">
        ${leftdecorationelements}
        <div class="code-hierarchy-item-leftdecoration-notch"></div>
        <span class="code-hierarchy-item-content">${ref(pitem.object_type, pitem.object_id)}`;
                // ancestors
                // gen_ancestors() simply returns an empty string if its argument is invalid/undefined
                code_hierarchy_content += gen_ancestors(pitem.ancestors);
                code_hierarchy_content += sqzhtml`</span>
    </div>`;

                code_hierarchy_content += sqzhtml`
    <div class="code-hierarchy-item-row ${
        ne(pitem.detail) ? '' : 'code-hierarchy-item-row-thin'
    } code-hierarchy-item-relation-detail">
        ${leftdecorationelements}
        <div class="code-hierarchy-item-leftdecoration-notch"></div>
        <span class="code-hierarchy-item-content">${rdr(pitem.detail)}</span>
    </div>
</div>`;
            }
        }

        // then, the code itself
        code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-code code-hierarchy-item-self">
    <div class="code-hierarchy-item-row code-hierarchy-item-name">
        ${leftdecorationelements}
        <span class="code-hierarchy-item-content">${ rdr(code.name) }</span>
    </div>
</div>
`;
        // finally, the child items.
        if ( hierarchy_items.children &&  hierarchy_items.children.length ) {
            code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-section code-hierarchy-item-section-children">
    <div class="code-hierarchy-item-row code-hierarchy-item-sectiontitle">
        ${leftdecorationelements}
        <span class="code-hierarchy-item-content">Children</span>
    </div>
</div>`;
            for (const citem of hierarchy_items.children) {
                code_hierarchy_content += sqzhtml`
<div class="code-hierarchy-item code-hierarchy-item-child">
    <div class="code-hierarchy-item-row code-hierarchy-item-name">
        ${leftdecorationelements}
        <div class="code-hierarchy-item-leftdecoration-notch"></div>
        <span class="code-hierarchy-item-content">
            ${ref(citem.object_type, citem.object_id)}`;
                // descendants
                // gen_descendants() simply returns an empty string if its argument is invalid/undefined
                code_hierarchy_content += gen_descendants(citem.descendants);
                code_hierarchy_content += sqzhtml`</span>
    </div>`;
                code_hierarchy_content += sqzhtml`
    <div class="code-hierarchy-item-row ${
        ne(citem.detail) ? '' : 'code-hierarchy-item-row-thin'
    } code-hierarchy-item-relation-detail">
        ${leftdecorationelements}
        <div class="code-hierarchy-item-leftdecoration-notch"></div>
        <span class="code-hierarchy-item-content">${rdr(citem.detail)}</span>
    </div>
</div>`;
            }
        }
        code_hierarchy_content += sqzhtml`
</div>`; // .code-hierarchy-items
        
        html += sqzhtml`
<div class="sectioncontent code-hierarchy">
<h2 id="code_hierarchy" class="code-hierarchy">Code Hierarchy</h2>
${code_hierarchy_content}`;

        const relations = code.relations ?? {};
        // html += display_code_relation('parents', relations.parents ?? [],
        //                               ['Parent', 'Parents']);
        // html += display_code_relation('parent_of', relations.parent_of ?? [],
        //                               ['Child', 'Children']);

        html += display_code_relation(
            'cousins',
            [].concat(relations.cousins ?? [], relations.cousin_of ?? []),
            ['Cousin', 'Cousins']
        );

        // Also add information about which lists this code appears in.
        let appears_in_codelists = Object.values(eczoodb.objects.codelist).filter(
            (codelist) => eczoodb.codelist_compiled_code_id_set(codelist).has(code_id)
        );
        if (appears_in_codelists.length !== 0) {
            appears_in_codelists.sort(
                (a,b) => a.title.flm_text.localeCompare(b.title.flm_text)
            );
            debug(`${code_id} appears in code lists: ${
                appears_in_codelists.map(l => l.list_id).join(', ') }`);
            html += sqzhtml`
<div class="sectioncontent code-codelist-membership">
<h2 id="code_codelist_membership">Member of code lists</h2>
<ul class="code-codelist-membership-list">`;
            for (const codelist of appears_in_codelists) {
                debug(`Including codelist:`, codelist);
                html += sqzhtml`
    <li>${ref('codelist', codelist.list_id)}</li>
`;
            }
            html += `</ul></div>`;
        }


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


