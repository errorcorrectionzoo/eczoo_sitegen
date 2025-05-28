//
// Use anystyle.io to parse a custom citation!
// https://anystyle.io/
//

import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.parse_anystyle');

import process from 'node:process';
import child_process from 'child_process';

import which from 'which';


function run_command_get_output(cmd, args, { stdinData, binary, workDir }={})
{
    binary ??= false;
    workDir ??= undefined;

    let spawnOptions = {};
    if (stdinData != null) {
        spawnOptions.input = stdinData;
    }
    const {output, stdout, stderr, error} = child_process.spawnSync(cmd, args, {
        cwd: workDir,
        ... spawnOptions
    });
    //debug('run_command', { cmd, args, spawnOptions, stdinData, output, stdout, stderr });
    if (stderr) {
        console.log(stderr.toString());
    }
    if (error) {
        console.error(`Child process exited abnormally: `, error);
        console.error(output);
        throw error;
    }
    if (binary) {
        return stdout;
    }
    return stdout.toString();
};



function getAnystyleCommand()
{
    debug(`Gonna query 'which' to find 'gem'...`);
    const gemExe = which.sync('gem');
    debug({ gemExe });
    const gemPath = run_command_get_output(gemExe, ['environment', 'gempath']);
    debug({ gemPath });
    const gemPathBin = gemPath.trim().split(':').map( (p) => `${p}/bin` ).join(':');
    debug({ gemPathBin });

    debug({ systemPath: process.env.PATH });

    const anystyleExe = which.sync('anystyle', {
        path: `${gemPathBin}:${process.env.PATH}`,
    });

    debug({ anystyleExe });

    return anystyleExe;
}


export class Anystyle
{
    constructor()
    {
        debug(`Anystyle constructor!`);
        this.anystyleExe = null;
    }

    initialize({ anystyleExe }={})
    {
        if (anystyleExe == null) {
            anystyleExe = getAnystyleCommand();
        }
        this.anystyleExe = anystyleExe;
        debug(`Initialized Anystyle interface class;`, { anystyleExe: this.anystyleExe });
    }

    anystyle(formattedBibRef, { wantJson, wantBibtex }={})
    {
        wantJson ??= false;
        wantBibtex ??= false;

        if (this.anystyleExe == null) {
            debug({ anystyleExe: this.anystyleExe });
            throw new Error(`Looks like you forgot to call Anystyle.initialize()`);
        }

        debug(`Running anystyle for “${formattedBibRef}”`);

        let data = {};

        if (wantJson) {
            const anystyleResult = run_command_get_output(
                this.anystyleExe, [
                    '-f', 'csl', '--stdout', 'parse', '/dev/stdin',
                ], {
                    stdinData: formattedBibRef,
                    binary: false,
                }
            );
            debug(`... got CSL-JSON output: “${anystyleResult}”`);
            let citjson = JSON.parse(anystyleResult);
            if (citjson.length !== 1) {
                debug(`Could not parse formatted Bib ref!`, citjson);
                let e = new Error(`Could not parse formatted Bib ref? citjson.length=${citjson.length}`);
                e._anystyle_error = 'failed-to-parse-bib-ref';
                throw e;
            }
            data.json = this._fixjson(citjson[0]);
        }
        if (wantBibtex) {
            const anystyleResult = run_command_get_output(
                this.anystyleExe, [
                    '-f', 'bib', '--stdout', 'parse', '/dev/stdin',
                ], {
                    stdinData: formattedBibRef,
                    binary: false,
                }
            );
            debug(`... got Bibtex output: “${anystyleResult}”`);
            data.bibtex = anystyleResult;
        }

        return data;
    }

    _fixjson(d)
    {
        // fix the JSON in case we have some common pitfalls
        if (d.type == null) {
            d.type = 'document';
        }
        return d;
    }
};

