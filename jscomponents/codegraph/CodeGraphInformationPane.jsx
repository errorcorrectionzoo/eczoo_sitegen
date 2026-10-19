/* eslint-disable react/prop-types */

import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.CodeGraphInformationPane');

import React, {
    //useEffect,
    useState,
    useRef,
    useLayoutEffect
} from 'react';

import { format_diagnostic } from '@phfaist/zoodb/zooflm/engine';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';

import { codegraph_flm_context } from './setup_eczoodb.js';


import './CodeGraphInformationPane_style.scss';




//
// The pane is rendered by the FLM engine of the code graph's zoo
// (setup_eczoodb.js) in its output context `codegraph_flm_context`, whose
// index gives the links to codes, domains and kingdoms the addresses
// `#jsCallbackRef:TYPE/ID` (the component below turns them into callbacks).
// The fields shown are compiled by the zoo's field compiler for each
// rendering (the names are fragments already), and the fragments made for a
// rendering (the fields and the truncated description) are released once its
// HTML is rendered.  The engine's error policy is 'continue' and its
// unresolved references are Warnings (setup_eczoodb.js); the diagnostics are
// printed on the console.
//
function mkRenderWrapUtils({ eczoodb })
{
    const zoo_flm_engine = eczoodb.zoo_flm_engine;
    const flm_compiler = eczoodb.codegraph_flm_compiler;

    const fragments_made = [];

    const compile_field = (object_type, object, fieldname) => {
        const value = object[fieldname];
        const fragment = flm_compiler.compile_flm(value, {
            object_type,
            object_schema: eczoodb.schema(object_type),
            object,
            fieldname,
        });
        if (fragment !== value) {
            fragments_made.push(fragment);
        }
        return fragment;
    };

    const truncate = (fragment, chars) => {
        const { fragment: truncated } = zoo_flm_engine.truncate(fragment, { chars });
        fragments_made.push(truncated);
        return truncated;
    };

    return {
        compile_field,
        truncate,
        render: (compose) => {
            try {
                const { html, diagnostics } = zoo_flm_engine.render_document({
                    compose,
                    context: codegraph_flm_context,
                });
                for (const diagnostic of diagnostics) {
                    console.warn(`Code graph information pane: ${format_diagnostic(diagnostic)}`);
                }
                debug("Got HTML: ", html);
                return html;
            } finally {
                zoo_flm_engine.release(fragments_made);
            }
        }
    };
}




function renderHtmlCode({ eczoodb, code, displayInformationOptions, })
{
    const { compile_field, truncate, render } = mkRenderWrapUtils({ eczoodb });

    let { truncateDescriptionLength } = displayInformationOptions ?? {};
    truncateDescriptionLength ??= 700;

    // -----------------

    debug(`Rendering code information ...`);

    const code_id = code.code_id;
    const code_ref_link = eczoodb.zoo_object_permalink('code', code_id);

    let code_name = compile_field('code', code, 'name');

    let code_introduced = compile_field('code', code, 'introduced');

    let code_description = compile_field('code', code, 'description');

    let short_description = truncate(code_description, truncateDescriptionLength);

    let kingdom = code.relations?.root_for_kingdom?.[0]?.kingdom ?? null;
    // let kingdom_name = null;
    // if (kingdom != null) {
    //     debug(`code is a root code for kingdom,`, kingdom.kingdom_id);
    //     let kingdom_schema = eczoodb.schemas.kingdom;
    //     kingdom_name = flm_simple_content.compile_flm(
    //         kingdom.name,
    //         {
    //             object_type: 'kingdom',
    //             object_schema: kingdom_schema,
    //             object: kingdom,
    //             fieldname: 'name',
    //         }
    //     );
    // }

    const compose = ({ rdr, ref, endnotes }) => {

        let s = '';

        s += sqzhtml`
  <div class="code-name-introduced">
    <span class="code-name" title="${code_id}">
      ${ rdr(code_name) }
    </span>
    <span class="code-introduced">${ rdr(code_introduced) }</span>
    <a class="code-link" href="${code_ref_link}">go to page →</a>
    </div>`;

        if (kingdom != null) {
            s += sqzhtml`
  <div class="kingdom-name">
    <span class="kingdom-name-label">
      This code is a root code for the
    </span>&nbsp;${ ref('kingdom', kingdom.kingdom_id) }
  </div>`;
        }

        s += sqzhtml`
  <div class="code-description">${ rdr(short_description) }</div>`;

        if (code.relations != null) {
            for (const [singular, plural, relations]
                 of [ ['Parent', 'Parents', code.relations?.parents ?? [] ],
                      ['Child', 'Children', code.relations?.parent_of ?? [] ],
                      ['Cousin', 'Cousins', [].concat(
                          code.relations?.cousins ?? [],
                          code.relations?.cousin_of ?? []
                      ) ] ]) {
                if (relations.length === 0) {
                    continue;
                }
                let rel_type_name = (relations.length === 1) ? singular : plural;
                let relation_content_html = relations.map(
                    (rel) => ('<li>' + ref('code', rel.code_id) + '</li>')
                ).join('');
                s += sqzhtml`
  <div class="code-relations">
    <span class="code-relation-type">${ rel_type_name }</span>
    <ul>${ relation_content_html }</ul>
  </div>`;
            }
        }
        
        s += endnotes();

        return s;
    };

    return render(compose);
}


function renderHtmlDomain({ eczoodb, domain, })
{
    const { compile_field, render } = mkRenderWrapUtils({ eczoodb });

    // -----------------

    debug(`Rendering domain information ...`);


    let domain_name = compile_field('domain', domain, 'name');

    let domain_description = compile_field('domain', domain, 'description');

    const domain_ref_link = eczoodb.zoo_object_permalink('domain', domain.domain_id);

    const compose = ({ rdr, ref }) => {

        let s = '';
        s += sqzhtml`
  <div class="domain-name">
    ${ rdr(domain_name) }
    <a class="domain-link" href="${domain_ref_link}">go to page →</a>
  </div>
  <div class="domain-description">${ rdr(domain_description) }</div>
  <div class="domain-kingdoms-list">
    <p>Kingdoms:</p>
    <ul>`;

        for (const kingdom_relation of domain.kingdoms ?? []) {
            const { kingdom_id } = kingdom_relation;
            s += sqzhtml`
      <li>${ ref('kingdom', kingdom_id) }</li>`;
        }
        s += `
    </ul>
  </div>`;
        return s;
    };

    return render(compose);
}



function renderHtmlKingdom({ eczoodb, kingdom, })
{
    const { compile_field, render } = mkRenderWrapUtils({ eczoodb });

    // -----------------

    debug(`Rendering kingdom information ...`);

    const kingdom_id = kingdom.kingdom_id;
    const kingdom_ref_link = eczoodb.zoo_object_permalink('kingdom', kingdom_id);

    const kingdom_name = compile_field('kingdom', kingdom, 'name');
    const kingdom_description = compile_field('kingdom', kingdom, 'description');

    const compose = ({ rdr, ref }) => {

        let s = '';
        s += sqzhtml`
  <div class="kingdom-name">
    ${ rdr(kingdom_name) }
    <a class="kingdom-link" href="${kingdom_ref_link}">go to page →</a>
  </div>
  <div class="kingdom-description">${ rdr(kingdom_description) }</div>
  <div class="kingdom-part-of-domain">Kingdom in the ${ ref('domain', kingdom.parent_domain.domain_id) }</div>
  <div class="kingdom-root-code-list">
    <p>Root codes:</p>
    <ul>`;

        for (const kingdom_root_code_relation of kingdom.root_codes ?? []) {
            const { code_id } = kingdom_root_code_relation;
            s += sqzhtml`
      <li>${ ref('code', code_id) }</li>`;
        }
        s += `
    </ul>
  </div>`;
        return s;
    };

    return render(compose);
}


function renderHtmlEmpty({ eczoodb, })
{
    const { render } = mkRenderWrapUtils({ eczoodb });

    // -----------------

    debug(`Rendering empty pane information ...`);

    const compose = ({ ref }) => {

        let s = '';
        s += sqzhtml`
      <div class="empty-info-pane">
        <p>
          Click on a node in the code graph
          to display additional information here.
        </p>
        <p style="margin-top: 2em">Zoom into:</p>
        <ul>`;
        
        for (const [domain_id, domain_] of Object.entries(eczoodb.objects.domain)) {
            s += sqzhtml`
          <li>${ ref('domain', domain_id) }</li>`;
        }

        s += sqzhtml`
        </ul>
      </div>
`;

        return s;
    }

    return render(compose);
}





export function CodeGraphInformationPane(props)
{
    //
    // Render some simple text/links widget that displays additional information
    // about the current state of the code graph (e.g., general information, or
    // information about the currently selected code)
    //

    //
    // React props.
    //

    let {
        eczoodb,
        currentCodeSelected,
        currentDomainSelected,
        currentKingdomSelected,
        onLinkToObjectActivated,
        displayInformationOptions,
    } = props;

    debug(`CodeGraphInformationPane component - render`, props);

    // (The links to codes, domains and kingdoms are captured: the index of the
    // FLM engine's output context in which the pane is rendered gives them
    // `#jsCallbackRef:` addresses, see setup_eczoodb.js.)

    //
    // React hooks.
    //

    let contentDomRef = useRef(null);

    let what = currentCodeSelected || currentDomainSelected || currentKingdomSelected;
    let [compiledHtmlContent, setCompiledHtmlContent] = useState({
        html: null,
        what,
    });

    useLayoutEffect( () => {
        debug('layout effect. gonna gotta have to set up some html.');
        const setupHtmlContent = async () => {
            debug('setupHtmlContent()...');
            if (compiledHtmlContent.html == null || compiledHtmlContent.what != what) {
                debug('setupHtmlContent() ... gotta render some HTML here');
                if (currentCodeSelected != null) {
                    let html = renderHtmlCode({
                        eczoodb,
                        displayInformationOptions,
                        code: currentCodeSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else if (currentDomainSelected != null) {
                    let html = renderHtmlDomain({
                        eczoodb,
                        displayInformationOptions,
                        domain: currentDomainSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else if (currentKingdomSelected != null) {
                    let html = renderHtmlKingdom({
                        eczoodb,
                        displayInformationOptions,
                        kingdom: currentKingdomSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else {
                    let html = renderHtmlEmpty({
                        eczoodb,
                        displayInformationOptions,
                    });
                    //debug('Gonna update panel html contents...');
                    setCompiledHtmlContent({ html, what, });
                }
            } else {
                let domNode = contentDomRef.current;
                if (domNode != null) {
                    // typeset the formulas: the FLM engine's convention for
                    // content updated in place, the event `flm:region-updated`
                    // on the element whose content is new, on which the
                    // MathJax configuration of the page (the engine's
                    // html_scripts()) typesets the formulas that are not
                    // typeset yet
                    domNode.dispatchEvent(new CustomEvent('flm:region-updated', {
                        bubbles: true,
                        detail: { region: null, artifacts: [] },
                    }));
                    // install link callbacks
                    for (const aNode of domNode.querySelectorAll('a')) {
                        let href = aNode.getAttribute("href");
                        let m = /^#jsCallbackRef:([^/]+)\/(.*)$/.exec(href);
                        if (m != null) {
                            (function() { // make closure for objectType & objectId.
                                let objectType = m[1];
                                let objectId = m[2];
                                debug('Setting up captured callback for',
                                      { objectType, objectId, });
                                aNode.addEventListener('click', () => {
                                    onLinkToObjectActivated(objectType, objectId);
                                });
                                aNode.removeAttribute("href", "");
                                aNode.style.cursor = 'pointer';
                            })();
                        }
                    }
                }
            }
        };
        setupHtmlContent();
        return;
    } );

    return (
        <div className="CodeGraphInformationPane"
             ref={contentDomRef}
             dangerouslySetInnerHTML={{__html: compiledHtmlContent.html}} />
    );
}


