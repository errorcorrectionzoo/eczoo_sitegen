import debugm from 'debug';
const debug = debugm('eczoo_pdfexport.try_load_zoo');

import fs from 'fs';
import path from 'path';

import _ from 'lodash';

import child_process from 'child_process';

import which from 'which';
import open_desktop from 'open';

import { EcZooDb } from '@errorcorrectionzoo/eczoodb/eczoodb.js';
import { EcZooDbYamlDataLoader } from '@errorcorrectionzoo/eczoodb/load_yamldb.js';

import { zoo_permalinks } from '@errorcorrectionzoo/eczoodb/permalinks.js';

import { get_eczoo_full_options } from '@errorcorrectionzoo/eczoodb/fullopts.js';


import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



import { generate_codes_latex_document } from './gen_latex.js';

// function generate_codes_latex_document(eczoodb, codeIdList)
// {
//     return `
// % TEST DUMMY DOCUMENT
// \\documentclass[11pt]{article}

// \\begin{document}
// Hello, world!

// Selected code IDs are: ${ ', '.join(codeIdList) }.

// \\end{document}
// `;
// }




async function runmain({
    dataDir,
    workDir,
    givenCodeIdList,
    recursiveDescendants,
    latexBin,
    magickExe,
    imageDpi,
    output,
} = {})
{
    debug(`runmain(), dataDir=${dataDir}`);

    dataDir ??= path.join(__dirname, '..', '..', 'eczoo_data');
    magickExe ??= which.sync('magick');
    imageDpi ??= 450;

    const latexExe = which.sync('latex', (latexBin != null) ? { path: latexBin } : {});
    const latexmkExe = which.sync('latexmk', (latexBin != null) ? { path: latexBin } : {});

    let codeIdList = []; // will be populated with all code ID's to include

    debug(`Using dataDir=‘${dataDir}’`);

    const eczoodbopts = _.merge(
        {
            fs,
            fs_data_dir: dataDir,
        },
        get_eczoo_full_options({
            citationsinfo_cache_dir: path.join(__dirname, '..'),
        }),
        {
            flm_options: {
                resources: {
                    rename_figure_template:
                        (f) =>  `fig-${f.b32hash(24)}.pdf`,
                },
            },
            zoo_permalinks: {
                object: (object_type, object_id) => {
                    if (object_type === 'code' && codeIdList.includes(object_id)) {
                        return `#code_${object_id}`;
                    }
                    return 'https://errorcorrectionzoo.org'
                        + zoo_permalinks.object(object_type, object_id);
                },
                graphics_resource: (graphics_resource) =>
                    `_figpdf/${graphics_resource.src_url}`
            },
        },
    );

    let eczoodb = new EcZooDb(eczoodbopts);

    eczoodb.install_zoo_loader(new EcZooDbYamlDataLoader({ }));
    
    await eczoodb.load();

    // find all the relevant codes

    if (recursiveDescendants) {
        for (const codeId of givenCodeIdList) {
            const code = eczoodb.objects.code[codeId];
            eczoodb.code_visit_relations(
                code,
                {
                    relation_properties: ['parent_of'],
                    callback: (visitedCode) => {
                        if ( ! codeIdList.includes(visitedCode.code_id) ) {
                            codeIdList.push(visitedCode.code_id);
                        }
                    }
                }
            );
        }
    } else {
        codeIdList = givenCodeIdList;
    }

    // generate the LaTeX document

    const latex_content = generate_codes_latex_document(eczoodb, codeIdList);

    debug(`Generated latex document.`); //content: `, latex_content);

    // write out the latex file & copy in the relevant style files

    const jobname = 'code';

    if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
    }

    fs.writeFileSync( path.join(workDir, `${jobname}.tex`), latex_content );

    fs.copyFileSync( path.join(__dirname, 'ecznote.dtx'),
                     path.join(workDir, 'ecznote.dtx') );
    fs.copyFileSync( path.join(__dirname, 'ecznote.ins'),
                     path.join(workDir, 'ecznote.ins') );

    fs.copyFileSync(
        path.join(__dirname, '..', 'site', 'static', 'icons', 'eczoo-main-logo.pdf'),
        path.join(workDir, 'eczoo-main-logo.pdf'),
    );
    fs.copyFileSync(
        path.join(__dirname, '..', 'site', 'static', 'icons', 'eczoo-main-logo-mobile.pdf'),
        path.join(workDir, 'eczoo-main-logo-mobile.pdf'),
    );
    
    // remove files from previous runs to make sure that everything is up-to-date
    for (const fileNameToRemove of [ `${jobname}.aux`, 'ecznote.cls' ]) {
        if (fs.existsSync( path.join(workDir, fileNameToRemove) )) {
            fs.rmSync( path.join(workDir, fileNameToRemove) );
        }
    }

    // compile class file

    debug(`Compiling class file ...`);

    const run_command = (cmd, args) => {
        const {output, stdout, stderr, error}
              = child_process.spawnSync(cmd, args, { cwd: workDir });
        //console.log({ output, stdout, stderr });
        if (stdout) {
            console.log(stdout.toString());
        }
        if (stderr) {
            console.log(stderr.toString());
        }
        if (error) {
            console.error(`Child process exited abnormally: `, error);
            console.error(output);
            throw error;
        }
    };

    //child_process.spawnSync(latexExe, [ 'ecznote.ins' ], { cwd: workDir });
    run_command(latexExe, [ 'ecznote.ins' ]);


    // convert & copy in the figure files

    if (!fs.existsSync(path.join(workDir, '_figpdf'))) {
        fs.mkdirSync(path.join(workDir, '_figpdf'), { recursive: true });
    }

    for (const graphics_resource_data of Object.values(
        eczoodb.zoo_flm_processor.resource_collector.collected_resources.graphics_path
    )) {
        const full_source_path = graphics_resource_data.resolved_info.full_source_path;
        const target_name = graphics_resource_data.target_info.target_name
        debug(`Figure: ${full_source_path} → ${target_name}`);
        run_command(
            magickExe,
            [ '-density', imageDpi,
              full_source_path,
              path.join( '_figpdf', target_name )
            ]
        );
    }


    // now compile our latex document to PDF

    debug(`Compiling document ...`);

    run_command(latexmkExe, [ '-lualatex', jobname ]);

    const temp_pdf_output = path.join(workDir, `${jobname}.pdf`)

    // copy out the PDF if requested
    if (output != null) {
        debug(`Saving document to ‘${output}’ ...`);
        fs.copyFileSync( temp_pdf_output, output );
    } else {
        debug(`Viewing document ...`);
        // or simply view it
        open_desktop(temp_pdf_output);
    }

};



import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main()
{
    const args = yargs(hideBin(process.argv))
          .scriptName('@errorcorrectionzoo/pdfexport')
          .usage('Usage: $0 [options] code_id [code_id ...]')
          .options({
              'data-dir': {
                  alias: 'd',
                  default: null,
                  describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
              },
              'recursive-descendants': {
                  describe: 'Also include all children codes',
                  default: false,
                  boolean: true,
              },
              'work-dir': {
                  alias: 'w',
                  default: '_tmppdf',
                  describe: "A folder for temporary files, in which we'll run LaTeX etc.",
              },
              'latex-bin': {
                  alias: 'x',
                  default: null,
                  describe: "Folder where we can find the latex and latexmk executables",
              },
              'magick-exe': {
                  alias: 'M',
                  default: null,
                  describe: "Path to magick executable to convert graphics",
              },
              // 'verbose': {
              //     default: false,
              //     boolean: true,
              //     describe: "Print out more information",
              // },
              'output': {
                  alias: 'o',
                  default: null,
                  describe: "File name for the output PDF file",
              },
          })
          .command('<code_id>', 'Code IDs')
          .demandCommand(1, 'Please specify at least one code_id')
          .strictOptions()
          .argv
    ;
    
    args.givenCodeIdList = args._;

    await runmain(args);
}

await main();
