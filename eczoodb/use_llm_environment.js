import debug_mod from 'debug';
const debug = debug_mod("eczoodbjs.use_llm_environment");

import {
    $$kw, ZooTextFragmentRenderer, ZooLLMEnvironment, repr, CitationsProvider,
    RefInstance,
    //fn_unique_object_id,
} from '@phfaist/zoodb/zoollm';

import { split_prefix_label } from '@phfaist/zoodb/util';




export function default_target_href_resolver(ref_instance, render_context,
                                             { zoo_object_permalink })
{
    const { target_href, ref_type, ref_label } = ref_instance ?? {};

    if (target_href != null) {
        // maybe fix target_href?
        const url = new URL(target_href);
        if (url.protocol == 'zoodbobjectref:') {
            // this is a reference set by zoodb/zoollm/zooprocessor.js

            // [Note, we seem to get all the slashes as part of the pathname in
            // "protocol:///code/ref" when running in the browser]
            const objectref = url.pathname.replace(/^\/+/, '');

            const [object_type, object_id] = split_prefix_label(objectref);
            let object_url = zoo_object_permalink(object_type, object_id)
                + url.hash;
            return object_url;
        }
        return target_href;
    }
    throw new Error(`Cannot resolve link reference to ‘${ref_type}:${ref_label}’`);
}



export function use_llm_environment(_this)
{
    const zoo_llm_environment =
          new ZooLLMEnvironment(_this.config.zoo_llm_environment_options ?? {});

    //
    // target_href resolver for refs within LLM.  We depend on an external
    // callable in config that tells us how to build URLs corresponding to
    // object targets
    //
    zoo_llm_environment.ref_resolver.target_href_resolver =
        (ref_instance, render_context) => {
            return default_target_href_resolver(ref_instance, render_context, {
                zoo_object_permalink: _this.zoo_object_permalink,
            });
        }
    ;
    //
    // Maybe allow unresolved references, for an incomplete zoo?
    //
    if (_this.config.llm_allow_unresolved_references) {
        zoo_llm_environment.feature_refs.add_external_ref_resolver(
            {
                get_ref(ref_type, ref_label, resource_info, render_context) {
                    debug(`Default ref_resolver called for invalid reference `
                          + `‘${ref_type}:${ref_label}’`);
                    return RefInstance(
                        // ref_type, ref_label, formatted_ref_llm_text, target_href
                        ref_type, ref_label,
                        '<??>', null
                    );
                }
            }
        );
    }
    //
    // Maybe allow unresolved citations?
    //
    if (_this.config.llm_allow_unresolved_citations) {
        zoo_llm_environment.feature_citations.add_external_citations_provider(
            {
                get_citation_full_text_llm(cite_prefix, cite_key, resource_info)
                {
                    debug(`Note: unresolved citation ‘${cite_prefix}:${cite_key}’`);
                    return `\\begin{verbatimtext}${cite_prefix}:${cite_key}\\end{verbatimtext}`;
                }
            }
        );
    }
    //
    // Set the graphics resource URL resolver.  We depend on an external
    // callable in config that tells us how to build URLs corresponding to a
    // given graphics resource.
    //
    zoo_llm_environment.graphics_collection.src_url_resolver =
        (graphics_resource, render_context) => {

            const src_url =
                  _this.config.zoo_graphics_resource_permalink(graphics_resource);

            // possibly prepare alternative versions of the image (via Parcel)
            // through an srcset= attribute

            let srcset = undefined;

            // ### BUILDING AN SRCSET THIS WAY ONLY WORKS IF WE POSTPROCESS THE
            // ### RESULTING HTML PAGES WITH PARCEL, WHICH WE DON'T DO ATM

            // const max_factor = _this.config.zoo_graphics_resource_image_max_zoom_factor;

            // if (graphics_resource.graphics_type == 'raster') {

            //     const [imgw, imgh] = graphics_resource.pixel_dimensions;

            //     let srcset_items = [];
            //     for (let factor = 1; factor <= max_factor; ++factor) {
            //         const dpi = 96*factor;
            //         if (dpi >= graphics_resource.dpi) {
            //             break;
            //         }
            //         srcset_items.push({
            //             factor,
            //             width: Math.round(imgw * dpi / graphics_resource.dpi),
            //             height: Math.round(imgh * dpi / graphics_resource.dpi),
            //         });
            //     }
            //     srcset = srcset_items.map( ({factor, width, height}) => (
            //         `${src_url}?`
            //             + (new URLSearchParams({as:'webp',width,height})).toString()
            //             + ` ${factor}x`
            //     ) ).join(', ');

            //     debug(`built srcset for ${src_url} → ‘${srcset}’  `
            //           + `for ${repr(graphics_resource)}`);
            // }

            return {src_url, srcset};
        }
    ;

    // provide helper $$kw{} for superclass, if necessary
    _this.$$kw = $$kw;

    return zoo_llm_environment;
}


