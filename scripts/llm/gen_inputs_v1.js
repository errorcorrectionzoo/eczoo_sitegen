import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.llm.gen_inputs_v1');

import fs from 'fs';
import path from 'path';

import _ from 'lodash';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { iter_object_fields_recursive } from '@phfaist/zoodb/util/objectinspector';
//import { get_field_schema, getfield, setfield } from '@phfaist/zoodb/util/getfield';
import { parse_schema_flm_options } from '@phfaist/zoodb/dbprocessor/flmsimplecontent';

import { loadEcZoo } from '../helperEcZooLoader.js';


function date_from_csl(csld)
{
    let parts = csld?.issued?.['date-parts']?.[0];
    if (parts) {
        if (parts.length === 1) {
            parts = [parts[0], 1, 1];
        } else if (parts.length === 2) {
            parts = [parts[0], parts[1], 1];
        }
        let d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}Z`);
        //debug(`date from parts: ${parts} -> ${d.toDateString()}`);
        if (isNaN(d.valueOf())) {
            throw new Error(`Invalid date caused by parts: ${JSON.stringify(parts)}`);
        }
        return d;
    }
    const raw = csld?.issued?.raw;
    if (raw) {
        let d = new Date(raw);
        //debug(`date from raw: ${JSON.stringify(raw)} -> ${d.toDateString()}`);
        if (isNaN(d.valueOf())) {
            throw new Error(`Invalid date caused by raw: ${JSON.stringify(raw)}`);
        }
        return d;
    }
    return null;
}

// const keep_code_fields = `
// name
// physical
// logical
// introduced
// alternative_names
// description
// protection
// features.rate
// features.encoders
// features.magic_scaling_exponent
// features.transversal_gates
// features.general_gates
// features.code_capacity_threshold
// features.threshold
// features.fault_tolerance
// relations.parents.[].detail
// relations.cousins.[].detail
// _meta
// `.trim().split(/\s+/);

//
// Core script function. Loads the zoo and performs the desired analysis.
//
async function runmain(args)
{
    if (!args.output) {
        throw new Error(`Need to specify output with --output=path/to/output/directory !`);
    }
    if (fs.existsSync(args.output)) {
        throw new Error(`Output ‘${args.output}’ exists, please remove first`);
    }

    process.stderr.write('runmain(): loading zoo... (might take a couple minutes)\n');
    const eczoodb = await loadEcZoo({ dataDir: args.dataDir });

    process.stderr.write('runmain(): zoo is now loaded!\n');

    //
    // Zoo is loaded (eczoodb). Query anything we need from it at this point.
    //

    let code_schema = eczoodb.schemas.code;

    let citation_manager = eczoodb.zoo_flm_processor.citation_manager;

    let curated_llm_inputs = [];

    // iterate over all codes
    for (const [code_id, code] of Object.entries(eczoodb.objects.code)) {
        debug(`Trying ${code_id} ...`, code.introduced?.flm_text);

        if (! code.introduced?.flm_text ) {
            // no introduced field, skip
            continue;
        }
        // identify codes that are introduced in a single arXiv paper
        const m = /^\s*\\cite\s*\{[aA][rR][xX][iI][vV]:([0-9a-zA-Z._/-]+)\}\s*$/.exec(
            code.introduced.flm_text
        );
        if (m == null) {
            // no match.
            continue;
        }
        // match!

        const introduced_arxiv_id = m[1];

        const introduced_arxiv_json_csl =
            citation_manager.get_citation_by_id(`arxiv:${introduced_arxiv_id}`);
        
        //debug({ introduced_arxiv_id, introduced_arxiv_json_csl });

        const introduced_arxiv_date = date_from_csl(introduced_arxiv_json_csl);
        if (introduced_arxiv_date == null) {
            throw new Error(`Something wrong, no date for '${code_id}' / ${introduced_arxiv_id}`);
        }

        debug(`Matched ${code_id} - introduced in ${introduced_arxiv_id} which appeared on ${introduced_arxiv_date.toDateString()}`);

        // inspect fields and remove anything that has citations that are too recent.
        //
        // we'll prepare an object 'obj' in which the field values are copied.
        //

        let obj = _.cloneDeep(eczoodb.raw_data_db.objects.code[code_id]);

        // for (const {fieldname, fieldvalue, fieldschema, parent, parent_index}
        //     of iter_object_fields_recursive(obj, code_schema, {provide_parent: true})) {
        //
        //     const flm_options = parse_schema_flm_options(fieldschema);
        //
        //     if ( ! flm_options.enabled ) {
        //         // no FLM here, no processing required
        //         continue;
        //     }
        //
        //     // otherwise, we'll check if it has a citation to works that are more recent
        //     // than the "introduced" paper date.
        //     let remove_this_item = false;
        //     const citation_matches = fieldvalue.matchAll(/(arxiv|doi):([^},]+)/ig);
        //     for (const [citation_full_match, cite_prefix, cite_key] of citation_matches) {
        //         const citation_date = date_from_csl(
        //             citation_manager.get_citation_by_id(`${cite_prefix.toLowerCase()}:${cite_key}`)
        //         );
        //         debug(`Found citation in ${code_id}:${fieldname} -> ${citation_full_match}`
        //               + `  pub on ${citation_date.toDateString()}`);
        //         if (citation_date && citation_date > introduced_arxiv_date) {
        //             debug(`Removing item with citation to ${citation_full_match} which appeared `
        //                   + `on ${citation_date.toDateString()}`);
        //             remove_this_item = true;
        //             break;
        //         } else {
        //             // all ok
        //         }
        //     }
        //     if (remove_this_item) {
        //         parent[parent_index] = undefined;
        //     }
        // }

        curated_llm_inputs.push({
            code_id,
            introduced_arxiv_id,
            code_obj: obj,
        });

    }

    // omit undefined or null items in arrays
    const json_replacer = (key, val) => {
        if (key === '_zoodb') {
            // internal field
            return undefined;
        }
        if (!Array.isArray(val)) {
            return val
        }
        return val.filter( (x) => x != null );
    };



    // now, output!

    fs.mkdirSync(args.output, { recursive: true });

    for (const { code_id, introduced_arxiv_id, code_obj } of curated_llm_inputs) {
    
        debug(`*** ${code_id}  - ${introduced_arxiv_id} -`);
        //debug(`JSON = `, JSON.stringify(code_obj, json_replacer));

        fs.mkdirSync(path.join(args.output, code_id));
        fs.writeFileSync(
            path.join(args.output, code_id, 'arxiv_id.json'),
            JSON.stringify({ arxiv_id: introduced_arxiv_id })
        );
        fs.writeFileSync(
            path.join(args.output, code_id, 'code_data.json'),
            JSON.stringify(code_obj, json_replacer)
        );

    }

    return;
}


//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    const args = yargs(hideBin(process.argv))
        .scriptName('gen_inputs_v1')
        .usage('Usage: $0 [options]')
        .options({
            'data-dir': {
                alias: 'd',
                default: null,
                describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
            },
            'output': {
                alias: 'o',
                default: '_curated_llm_inputs',
                describe: "Output folder to write to, must not exist",
            },
        })
        .strictOptions()
        .argv
    ;

    await runmain(args);
}

await main();
