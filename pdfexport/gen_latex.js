import debugm from 'debug';
const debug = debugm('eczoo_pdfexport.gen_latex');

import * as flm_fragmentrenderer_latex from '@phfaist/zoodb/flm-js/flm.fragmentrenderer.latex';
import {
    //$$kw, repr,
    make_render_shorthands, make_and_render_document,
} from '@phfaist/zoodb/zooflm';


import { EczLatexCodePageLatexRenderer } from './gen_latex_code_page.js';

export function generate_codes_latex_document(eczoodb, codeIdList)
{
    debug(`generate_codes_latex_document(): codeIdList = ${JSON.stringify(codeIdList)}`);

    const fr = flm_fragmentrenderer_latex.LatexFragmentRenderer();

    fr.text_format_cmds['defterm-term'] = 'ecztermdef';
    fr.latex_wrap_verbatim_macro = 'eczshowverbatim';
    fr.latex_semantic_block_environments['figure_caption'] = 'eczfigcaption';

    let code_renderers = codeIdList.map(
        (codeId) => new EczLatexCodePageLatexRenderer({eczoodb, codeId})
    );


    let render_doc_fn = (render_context) => {
        let result = [];
        const R = make_render_shorthands({
            render_context,
            render_value_options: {
                list_joiner: '\n',
                list_item_wrapper: (x) => `\\item ${x}\n`,
                list_full_wrapper: (x) => `\\begin{eczparagraphslist}
${x}
\\end{eczparagraphslist}`,
            }
        });
        for (const r of code_renderers) {
            result.push( r.flm_render_fn(render_context, R) )
        }

        return result.join("\n\n\\clearpage\n\n")
    };


    const { zoo_flm_environment } = eczoodb;

    const full_rendered_output = make_and_render_document({
        zoo_flm_environment,
        render_doc_fn,
        fragment_renderer: fr,
        render_endnotes: {
            endnotes_heading_title: 'Endnotes', //'References',
            endnotes_heading_level: 2,
        },
        render_endnotes_integrate_string: (content, endnotes) => {
            let ltx = content + "\n\n";
            if (codeIdList.length > 1) {
                ltx += "\\clearpage" + "\n";
            }
            ltx += endnotes;
            return ltx;
        }
    })

    // debug(`Rendered document content -> `, full_rendered_output);

    // put together the full document

    let ltx = '\\documentclass{ecznote}' + '\n\n';
    ltx += '\\begin{document}' + '\n';

    ltx += full_rendered_output;

    ltx += "\n\n";
    ltx += '\\end{document}';
    ltx += "\n";

    return ltx;
}
