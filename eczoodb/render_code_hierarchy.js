// import debug_mod from 'debug';
// const debug = debug_mod("eczoodbjs.render_code_hierarchy");

import {
    render_text_standalone,
} from '@phfaist/zoodb/zooflm';
import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';


export function get_code_hierarchy_info({
    code,
    eczoodb,
    notable_codes
})
{
    const use_notable_codes = (notable_codes != null);
    const notable_code_set = new Set(notable_codes ?? []);

    //debug(`Using following set of notable codes:`, notable_code_set);

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
        const cur_parent_domain_id = eczoodb.code_get_parent_domain(pcode)?.domain_id;
        const pancestors = eczoodb.code_get_ancestors(pcode, {
            return_relation_info: true,
            skip_first_primary_parent_relation:
                primary_parent_item.ancestor_search_skip_primary_parent,
            //parent_child_sort: true,
            predicate_relation: (code, relation, relation_property_) => {
                // limit ancestors to those that belong to the same domain.
                return (
                    //eczoodb.code_is_primary_parent(relation.code, code) ||
                    eczoodb.code_get_parent_domain(relation.code)?.domain_id
                    === cur_parent_domain_id
                )
            }
        });
        for (const pancestorcodeinfo of pancestors) {
            if (pancestorcodeinfo.code === pcode) {
                continue; // skip the primary parent code itself
            }
            const pancestorcode = pancestorcodeinfo.code;

            // skip any code that is not a "notable code", if applicable
            if (use_notable_codes && !notable_code_set.has(pancestorcode.code_id)) {
                // skip non-notable code
                continue;
            }

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
                is_property_code: eczoodb.code_is_property_code(pancestorcode),
                ancestor_relation_info_chain,
            });
        }
    }

    // also, fetch descendants of children.
    for (let child_item of hierarchy_items.children) {
        const ccode = child_item.code;
        const cur_child_domain_id = eczoodb.code_get_parent_domain(ccode)?.domain_id;
        const cdescendants = eczoodb.code_get_family_tree(ccode, {
            return_relation_info: true,
            parent_child_sort: true,
            predicate_relation: (code, relation, relation_property_) => {
                // limit ancestors to those that belong to the same domain.
                return (
                    //eczoodb.code_is_primary_parent(code, relation.code) ||
                    eczoodb.code_get_parent_domain(relation.code)?.domain_id
                    === cur_child_domain_id
                )
            }
        });
        for (const cdescendantinfo of cdescendants) {
            if (cdescendantinfo.code === ccode) {
                continue; // skip the child code itself
            }
            const cdescendantcode = cdescendantinfo.code;

            // skip any code that is not a "notable code", if applicable
            if (use_notable_codes && !notable_code_set.has(cdescendantcode.code_id)) {
                // skip non-notable code
                continue;
            }

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
                is_property_code: eczoodb.code_is_property_code(cdescendantcode),
                descendant_relation_info_chain,
            });
        }
    }

    return hierarchy_items;
}

//
// ------------------------------------------------------------------
//


export function render_code_hierarchy_content({
    code, hierarchy_items, R, eczoodb,
})
{
    const { refhref, rdr, ref, ne } = R;
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
        for (const spar of [...ppitemancestors].reverse()) {
            const sparcode = spar.code;
            s += sqzhtml`
    <a class="code-hierarchy-item-inner-ancestor${
        spar.is_property_code ? ' code-hierarchy-item-inner-ancdesc-propertycode' : ''
    }" href="${
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
    <a class="code-hierarchy-item-inner-descendant${
        ccinfo.is_property_code ? ' code-hierarchy-item-inner-ancdesc-propertycode' : ''
    }" href="${
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

    return code_hierarchy_content;
}