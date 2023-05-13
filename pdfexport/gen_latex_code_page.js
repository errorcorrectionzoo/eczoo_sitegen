//
import debugm from 'debug';
const debug = debugm('eczoo_pdfexport.gen_latex_code_page');


const _render_features_list = [
    ['rate', 'Rate'],
    ['magic_scaling_exponent', 'Magic'],
    ['encoders', 'Encoding'],
    ['transversal_gates', 'Transversal Gates'],
    ['general_gates', 'Gates'],
    ['decoders', 'Decoding'],
    ['fault_tolerance', 'Fault Tolerance'],
    ['code_capacity_threshold', 'Code Capacity Threshold'],
    ['threshold', 'Threshold'],
];


export class EczLatexCodePageLatexRenderer
{
    constructor({ eczoodb, codeId })
    {
        this.eczoodb = eczoodb;
        this.codeId = codeId;

        this.code = this.eczoodb.objects.code[this.codeId];
    }

    flm_render_fn(render_context, R)
    {
        const code = this.code;
        const { ne, rdr, rdrblock, ref } = R;

        debug(`flm_render_fn(): ${this.code?.code_id}`);

        let latex_output = [];

        let title_line = `\\eczcode{${this.codeId}}{`;
        title_line += rdr(code.name);
        if (code.introduced) {
            title_line += '~' + rdr(code.introduced);
        }
        title_line += '}';

        latex_output.push(title_line);

        const render_code_field = (fieldname, fieldtitle) => {
            const fieldvalue = code[fieldname];
            if (fieldvalue) {
                latex_output.push(`\\section{${fieldtitle}}`);
                latex_output.push( rdr(fieldvalue) );
            }
        };

        // debug(`x`);

        render_code_field('alternative_names', 'Alternative Name(s)');

        render_code_field('description', 'Description');

        render_code_field('protection', 'Protection');

        // debug(`y`);

        if (code.features != null && code.features.length > 0) {
            for (const [feature_field, feature_name] of _render_features_list) {

                const value = code.features[feature_field];
                if (value == null) {
                    continue;
                }

                latex_output.push( '\\section{' + feature_name + '}' );
                latex_output.push( rdr(value) );
            }
        }

        render_code_field('realizations', 'Realizations');

        render_code_field('notes', 'Notes');

        // debug(`z`);

        let render_code_relations_list = (rel_types, reltitlesingplur) => {

            let relation_list = [];
            for (const rel_type of rel_types) {
                if (code.relations[rel_type] && code.relations[rel_type].length) {
                    relation_list.extend(code.relations[rel_type]);
                }
            }
            if (relation_list.length == 0) {
                return;
            }

            let reltitle = null;
            const [reltitlesing, reltitleplur] = reltitlesingplur;
            if (relation_list.length > 1) {
                reltitle = reltitleplur;
            } else {
                reltitle = reltitlesing;
            }

            latex_output.push('\\section{' + reltitle + '}')

            let render_relation = (relobj) => {
                let cn = rdr(relobj.code.name);
                cn = '\\href{https://errorcorrectionzoo.org/c/'+relobj.code.code_id+'}{'+cn+'}';
                if (relobj.detail) {
                    return cn + ' --- ' + rdr(relobj.detail);
                }
                return cn;
            }

            latex_output.push(
                "\\begin{itemize}"
                + relation_list.map( (relobj) => 
                    "\\item\\relax " + render_relation(relobj) + '\n\n'
                ).join('\n')
                + "\\end{itemize}"
            )
        }
        
        render_code_relations_list(['parents'], ['Parent', 'Parents']);
        render_code_relations_list(['parent_of'], ['Child', 'Children']);
        render_code_relations_list(['cousins','cousin_of'], ['Cousin', 'Cousins']);

        // debug(`w`);

        return latex_output.join( "\n\n" );
    }
}
   

