//
// Use anystyle.io to parse a custom citation!
// https://anystyle.io/
//

import debug_module from 'debug';
const debug = debug_module('eczoohelpers_eczcollectbib.parse_anystyle');

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { tmpdir } from 'node:os';
import { writeFileAtomic } from '@phfaist/zoodb/util/atomicfilewrite';

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

    let anystyleExe;
    try {

        anystyleExe = which.sync('anystyle', {
            path: `${gemPathBin}:${process.env.PATH}`,
        });

    } catch (err) {
        console.error(err);
        console.error(
            `Unable to find the ‘anystyle’ command-line tool.  `
            + `Please install anystyle, see instructions at https://anystyle.io/ (try `
            + `‘gem install anystyle-cli’).`
        );
        throw new Error(`Unable to find ‘anystyle’ command-line tool.`);
    }

    debug({ anystyleExe });

    return anystyleExe;
}


export class Anystyle
{
    constructor()
    {
        debug(`Anystyle constructor!`);
        this.anystyleExe = null;
        this.tempPath = null;
        this.cacheFile = null;
        this.cacheDic = null;
    }

    initialize({ anystyleExe, cacheFile }={})
    {
        if (anystyleExe == null) {
            anystyleExe = getAnystyleCommand();
        }
        this.anystyleExe = anystyleExe;
        this.tempPath = fs.mkdtempSync(path.join(tmpdir(), 'eczsitegen-bibhelper-anystyle-'));
        this.cacheFile = cacheFile;
        this.cacheDic = Object.create(null);
        debug(`Initialized Anystyle interface class;`,
              { anystyleExe: this.anystyleExe, cacheFile: this.cacheFile });
    }

    async loadCache()
    {
        if (this.cacheFile == null) {
            debug(`Anystyle interface: No cache to load.`);
            return;
        }
        let jsonData = null;
        try {
            jsonData = await fsPromises.readFile(this.cacheFile);
        } catch (err) {
            debug(`Failed to read citations cache file ‘${this.cacheFile}’ - maybe it does not exist`, err);
            return;
        }
        if (jsonData == null) {
            return;
        }
        try {
            let jsonObject = JSON.parse(jsonData);
            Object.assign(this.cacheDic, jsonObject);
            debug(`Loaded AnyStyle-parsed manual citations cache from ‘${this.cacheFile}’ `
                  + `(${Object.keys(this.cacheDic).length} items)`);
        } catch (err) {
            debug(`Failed to import citations cache from ‘${this.cacheFile}’:`, err);
        }
    }
    async saveCache()
    {
        if (this.cacheFile != null) {
            debug(`Saving AnyStyle-parsed manual citation results to cache file ‘${this.cacheFile}’`);
            await writeFileAtomic({
                fsp: fsPromises,
                fileName: this.cacheFile,
                data: JSON.stringify(this.cacheDic),
                processPid: (process != null) ? process.pid : 'XX',
            });
        }
    }

    async cleanup()
    {
        debug(`Anystyle: cleaning up...`);
        await this.saveCache();
        if (this.tempPath != null) {
            fs.rmSync(this.tempPath, { recursive: true, force: true });
        }
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

        let cachedJson = this.cacheDic[`json:${formattedBibRef}`];
        let cachedBibtex = this.cacheDic[`bibtex:${formattedBibRef}`];

        let needsTempFile = (
            (wantJson && (cachedJson === undefined))
            || (wantBibtex && (cachedBibtex === undefined))
        );

        let cittmpfile = null;
        // citation data in temp file
        if (needsTempFile) {
            cittmpfile = path.join(this.tempPath, 'cit.txt')
            fs.writeFileSync(cittmpfile, formattedBibRef + '\n');
        }

        if (wantJson) {
            let rawDataJson = null;
            if (cachedJson !== undefined) {
                rawDataJson = JSON.parse(cachedJson);
            } else {
                let anystyleResult = run_command_get_output(
                    this.anystyleExe, [
                        '-f', 'csl', '--stdout', 'parse', cittmpfile,
                        // '/dev/stdin', /dev/stdin doesn't work on gh action
                    ], {
                        //stdinData: formattedBibRef,
                        binary: false,
                    }
                );
                debug(`... got CSL-JSON output: “${anystyleResult}”`);
                if (anystyleResult == null || !anystyleResult.trim().length) {
                    debug(`Empty output from ‘anystyle’!`);
                    let e = new Error(`No output from anystyle for bib ref`);
                    e._anystyle_error = 'no-output-for-bib-ref';
                    throw e;
                }
                let citjson = JSON.parse(anystyleResult);
                if (citjson.length !== 1) {
                    debug(`Could not parse formatted Bib ref!`, citjson);
                    let e = new Error(
                        `Could not parse formatted Bib ref? citjson.length=${citjson.length}`
                    );
                    e._anystyle_error = 'failed-to-parse-bib-ref';
                    throw e;
                }
                rawDataJson = citjson[0];
                // better store JSON-encoded string in cache, to avoid any wild mutations of shared objects
                this.cacheDic[`json:${formattedBibRef}`] = JSON.stringify(rawDataJson);
            }
            // apply fixes here, do NOT cache fixes because we might want to tweak the fixes
            // without having to rebuild the entire cache.
            data.json = this._fixjson(rawDataJson);
        }
        if (wantBibtex) {
            if (cachedBibtex !== undefined) {
                data.bibtex = cachedBibtex;
            } else {
                const anystyleResult = run_command_get_output(
                    this.anystyleExe, [
                        '-f', 'bib', '--stdout', 'parse', cittmpfile
                        // '/dev/stdin', /dev/stdin doesn't work on gh action
                    ], {
                        stdinData: formattedBibRef,
                        binary: false,
                    }
                );
                debug(`... got Bibtex output: “${anystyleResult}”`);
                data.bibtex = anystyleResult;
                this.cacheDic[`bibtex:${formattedBibRef}`] = data.bibtex;
            }
        }

        return data;
    }

    _fixjson(jsondata)
    {
        //debug(`Fixing anystyle-produced jsondata:`, jsondata);

        // fix the JSON in case we have some common pitfalls
        if (jsondata.type == null) {
            jsondata.type = 'document';
        }
            
        if (jsondata.DOI) {
            const found_urls = [... jsondata.DOI.matchAll(/\\url\{([^}]+)\}/g)].map(m => m[1]);
            if (found_urls.length) {
                // there's a problem.
                const old_doi = jsondata.DOI;
                delete jsondata.DOI;
                let existing_urls = jsondata.URL ? jsondata.URL.split(' ') : [];
                jsondata.URL = [...found_urls, ...existing_urls].join(' ');
                jsondata.note = `Available at ${old_doi}`;
            }
        }

        // bug -- anystyle sometimes includes a closing double-quote but suppresses the corresponding
        // opening double-quote.  Detect a single double-quote and remove it if present.
        if (jsondata.title && [...jsondata.title.matchAll(/["”]/ug)].length === 1
             && [...jsondata.title.matchAll(/“/ug)].length === 0) {
            //debug(`Detected lone closing double-quote in AnyStyle output, removing it:`, jsondata.title);
            jsondata.title = jsondata.title.replace(/["”]/u, '');
        }

        if (/^article(-journal)?$/.test(jsondata.type) && !jsondata['container-title']) {
            // make @article -> @unpublished if there is no journal
            jsondata.type = "manuscript";
        }

        return jsondata;
    }
};

