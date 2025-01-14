/* eslint-disable react/prop-types */

import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.CodeGraphInformationPane');

import React, {
    //useEffect,
    useState,
    useRef,
    useLayoutEffect
} from 'react';

import {
    FLMSimpleContentCompiler
} from '@phfaist/zoodb/dbprocessor/flmsimplecontent';

import {
    // render_text_standalone, is_flm_fragment,
    $$kw, // ZooHtmlFragmentRenderer,
    RefInstance,
    make_and_render_document, make_render_shorthands,
} from '@phfaist/zoodb/zooflm';

import { sqzhtml } from '@phfaist/zoodb/util/sqzhtml';


import './CodeGraphInformationPane_style.scss';




function mkRenderWrapUtils({ eczoodb, captureLinksToObjectTypes })
{
    let zoo_flm_environment = eczoodb.zoo_flm_environment;
    // let html_fragment_renderer = new ZooHtmlFragmentRenderer();
    
    let flm_simple_content = new FLMSimpleContentCompiler({
        flm_environment: zoo_flm_environment,
        flm_error_policy: 'continue',
    });

    let my_ref_resolver = {
        get_ref(ref_type, ref_label, resource_info) {
            let ref_instance = eczoodb.zoo_flm_environment.ref_resolver.get_ref(
                ref_type, ref_label, resource_info
            );
            if (captureLinksToObjectTypes.includes(ref_type)) {
                return new RefInstance( $$kw(
                    Object.assign({}, ref_instance.asdict(), {
                        target_href: `jsCallbackRef:${ref_type}/${ref_label}`,
                    })
                ) );
            }
            return null;
        }
    };

    return {
        zoo_flm_environment,
        flm_simple_content,
        render: (render_doc_fn) => {
            const html = make_and_render_document({
                zoo_flm_environment,
                render_doc_fn,
                render_endnotes: {
                    target_id: null,
                    include_headings_at_level: false,
                    endnotes_heading_title: null,
                    endnotes_heading_level: null,
                },
                feature_render_options: {
                    refs: {
                        add_external_ref_resolvers: [ my_ref_resolver ],
                    },
                },
                flm_error_policy: 'continue',
            });
            debug("Got HTML: ", html);
            return html;
        }
    };
}




function renderHtmlCode({ eczoodb, code, displayInformationOptions,
                          captureLinksToObjectTypes, })
{
    const { flm_simple_content, render } = mkRenderWrapUtils({
        eczoodb,
        captureLinksToObjectTypes,
    });

    let { truncateDescriptionLength } = displayInformationOptions ?? {};
    truncateDescriptionLength ??= 700;

    // -----------------

    debug(`Rendering code information ...`);

    const code_id = code.code_id;
    const code_ref_link = eczoodb.zoo_object_permalink('code', code_id);

    const code_schema = eczoodb.schemas.code;

    let code_name = flm_simple_content.compile_flm(
        code.name,
        { object_type: 'code',
          object_schema: code_schema,
          object: code,
          fieldname: 'name' }
    );

    let code_introduced = flm_simple_content.compile_flm(
        code.introduced,
        { object_type: 'code',
          object_schema: code_schema,
          object: code,
          fieldname: 'introduced' }
    );

    let code_description = flm_simple_content.compile_flm(
        code.description,
        { object_type: 'code',
          object_schema: code_schema,
          object: code,
          fieldname: 'description' }
    );

    let short_description = code_description.truncate_to( truncateDescriptionLength );

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

    const render_doc_fn = (render_context) => {
        
        const { ne, rdr, ref } = make_render_shorthands({render_context});

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
        
        s += sqzhtml`
  <RENDER_ENDNOTES/>`;

        return s;
    };

    return render(render_doc_fn);
}


function renderHtmlDomain({ eczoodb, domain, captureLinksToObjectTypes, })
{
    const { flm_simple_content, render } = mkRenderWrapUtils({
        eczoodb,
        captureLinksToObjectTypes,
    });

    // -----------------

    debug(`Rendering domain information ...`);


    const domain_schema = eczoodb.schemas.domain;

    let domain_name = flm_simple_content.compile_flm(
        domain.name,
        { object_type: 'domain',
          object_schema: domain_schema,
          object: domain,
          fieldname: 'name' }
    );

    let domain_description = flm_simple_content.compile_flm(
        domain.description,
        { object_type: 'domain',
          object_schema: domain_schema,
          object: domain,
          fieldname: 'description' }
    );

    const domain_ref_link = eczoodb.zoo_object_permalink('domain', domain.domain_id);

    let render_doc_fn = (render_context) => {

        const { ne, rdr, ref } = make_render_shorthands({render_context});

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

    return render(render_doc_fn);
}



function renderHtmlKingdom({ eczoodb, kingdom, captureLinksToObjectTypes, })
{
    const { flm_simple_content, render } = mkRenderWrapUtils({
        eczoodb,
        captureLinksToObjectTypes,
    });

    // -----------------

    debug(`Rendering kingdom information ...`);

    const kingdom_schema = eczoodb.schemas.kingdom;

    const kingdom_id = kingdom.kingdom_id;
    const kingdom_ref_link = eczoodb.zoo_object_permalink('kingdom', kingdom_id);

    const kingdom_name = flm_simple_content.compile_flm(
        kingdom.name,
        {
            object_type: 'kingdom',
            object_schema: kingdom_schema,
            object: kingdom,
            fieldname: 'name',
        }
    );
    const kingdom_description = flm_simple_content.compile_flm(
        kingdom.description,
        {
            object_type: 'kingdom',
            object_schema: kingdom_schema,
            object: kingdom,
            fieldname: 'description',
        }
    );

    let render_doc_fn = (render_context) => {

        const { ne, rdr, ref } = make_render_shorthands({render_context});

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

    return render(render_doc_fn);
}


function renderHtmlEmpty({ eczoodb, captureLinksToObjectTypes, })
{
    const { flm_simple_content_, render } = mkRenderWrapUtils({
        eczoodb,
        captureLinksToObjectTypes,
    });

    // -----------------

    debug(`Rendering empty pane information ...`);

    let render_doc_fn = (render_context) => {

        const { ne, rdr, ref } = make_render_shorthands({render_context});

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

    return render(render_doc_fn);
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
        captureLinksToObjectTypes,
        onLinkToObjectActivated,
        displayInformationOptions,
    } = props;

    debug(`CodeGraphInformationPane component - render`, props);
    
    captureLinksToObjectTypes ??= [ 'code', 'domain', 'kingdom' ];
   
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
                        captureLinksToObjectTypes,
                        code: currentCodeSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else if (currentDomainSelected != null) {
                    let html = renderHtmlDomain({
                        eczoodb,
                        displayInformationOptions,
                        captureLinksToObjectTypes,
                        domain: currentDomainSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else if (currentKingdomSelected != null) {
                    let html = renderHtmlKingdom({
                        eczoodb,
                        displayInformationOptions,
                        captureLinksToObjectTypes,
                        kingdom: currentKingdomSelected,
                    });
                    setCompiledHtmlContent({ html, what, });
                } else {
                    let html = renderHtmlEmpty({
                        eczoodb,
                        displayInformationOptions,
                        captureLinksToObjectTypes,
                    });
                    //debug('Gonna update panel html contents...');
                    setCompiledHtmlContent({ html, what, });
                }
            } else {
                let domNode = contentDomRef.current;
                if (domNode != null) {
                    // install MathJax formulas
                    if (window?.MathJax?.typesetPromise != null) {
                        await window.MathJax.typesetPromise([ domNode ]);
                    }
                    // install link callbacks
                    for (const aNode of domNode.querySelectorAll('a')) {
                        let href = aNode.getAttribute("href");
                        let m = /^jsCallbackRef:([^/]+)\/(.*)$/.exec(href);
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


