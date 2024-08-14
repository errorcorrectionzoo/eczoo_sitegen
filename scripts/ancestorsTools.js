//
// Run as "yarn node --no-warnings scripts/ancestorsTools.js [...]".
// Try --help to get a list of options.
//

import debugm from 'debug';
const debug = debugm('eczoo_sitegen.scripts.ancestorsTools');
const debuglog = debugm('EczLog');

//import fs from 'fs';

import _ from 'lodash';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { helperSetDefaultLogs } from './helperLogs.js';
import { loadEcZoo } from './helperEcZooLoader.js';


//
// Tool: List Ancestors
//

async function run_list_ancestors(argv)
{
    helperSetDefaultLogs({ verbosityLevel: argv.verbose, quietMode: argv.quiet });
    debug(`run_list_ancestors(): argv = `, argv);

    debuglog('runmain(): loading zoo... (might take a couple minutes)');
    const eczoodb = await loadEcZoo({
        dataDir: argv.dataDir,
        useFlmProcessor: false,
    });

    debuglog('runmain(): zoo is now loaded!');

    //
    // Zoo is loaded (eczoodb). Query anything we need from it at this point.
    //

    const codeId = argv.CODE_ID;
    const code = eczoodb.objects.code[codeId];

    if (code == null) {
        throw new Error(`Invalid CODE_ID ‘${codeId}’, no such code in EC Zoo DB`);
    }

    debuglog(`Getting ancestors of ${codeId}`);

    let ancestorsData = null;
    if (argv.linear) {

        const ancestors = eczoodb.code_get_ancestors(code);
        ancestorsData = ancestors.map( (c) => c.code_id );

    } else if (argv.listByAncestor) {

        ancestorsData = {};
        
        let visitCode = ({ ancestorsData, c, ancPath} ) => {
            let codeId = c.code_id;
            ancPath ??= [];
            debug(`Visiting ${codeId} from ${ancPath} ...`);
            let pathList = ancestorsData[codeId];
            if (pathList == null) {
                pathList = ancestorsData[codeId] = [];
            }
            pathList.push( [...ancPath, codeId] );
            for (const prel of c.relations?.parents ?? []) {
                visitCode({ ancestorsData, c: prel.code, ancPath: [... ancPath, c.code_id] });
            }
        };

        visitCode({ ancestorsData, c: code });

        // possibly filter the final ancestorsData object to limit to only those ancestors
        // that we're interested in:
        if (argv.showOnlyAncestors != null && argv.showOnlyAncestors.trim().length) {
            const codeIds = argv.showOnlyAncestors.split(',').map( (x) => x.trim() );
            ancestorsData = Object.fromEntries(
                Object.entries(ancestorsData).filter( ([cId,aInfo]) => codeIds.includes(cId) )
            );
        }

    } else {

        // display full tree
        let seenCodeIds = {};
        
        let visitCode = ({ c, reachedFromCode} ) => {
            debug(`Visiting ${c.code_id} from ${reachedFromCode?.code_id} ...`);
            let codeId = c.code_id;
            let info = {
                codeId,
            };
            if (reachedFromCode != null) {
                info.reachedFromCodeId = reachedFromCode.code_id;
            }
            let seenInfo = seenCodeIds[codeId];
            if (seenInfo != null) {
                let alreadyAncestorViaChainInfos = [];
                let ancInfo = seenInfo;
                while (ancInfo != null) {
                    alreadyAncestorViaChainInfos.push(ancInfo);
                    if (ancInfo.reachedFromCodeId) {
                        ancInfo = seenCodeIds[ancInfo.reachedFromCodeId];
                    } else {
                        ancInfo = null;
                    }
                }
                info.alreadyAncestorViaChain =
                    alreadyAncestorViaChainInfos.map( (x) => x.codeId );
                return info;
            }
            info.parentsInfo = [];
            seenCodeIds[codeId] = info;
            for (const prel of c.relations?.parents ?? []) {
                info.parentsInfo.push( visitCode({ c: prel.code, reachedFromCode: c }) );
            }
            return info;
        };
        
        ancestorsData = visitCode({ c: code });
    }

    debug(`ancestorsData = `, ancestorsData);

    let outputData = null;

    if (argv.outputFormat === 'json') {
        outputData = JSON.stringify(ancestorsData);
    } else if (argv.outputFormat === 'txt') {

        const lineWidth = argv.lineWidth;
        const minWrapWidth = 20;
        // display full parents tree
        let dispCodeLabel = (codeId) => {
            if (!argv.fullNames) {
                return codeId;
            }
            return `${eczoodb.objects.code[codeId].name} ⟨${codeId}⟩`;
        };
        
        if (argv.linear) {
            outputData = (
                '\n'
                + `Ancestors of ${codeId}:\n`
                + ancestorsData.map( (c) => `  * ${c}\n` ).join('')
                + '\n'
            );
        } else if (argv.listByAncestor) {
            outputData = '\n';
            let wrapToWidth = lineWidth - 4;
            if (wrapToWidth < minWrapWidth) { wrapToWidth = minWrapWidth; }

            for (const [codeId, ancPathList] of Object.entries(ancestorsData)) {
                const dispCodeLines = wordWrapLines(
                    `${dispCodeLabel(codeId)}:`,
                    wrapToWidth,
                    {
                        firstIndent: '* ',
                        subsequentIndent: '  ',
                    }
                );
                outputData += dispCodeLines.join('\n') + '\n\n';
                for (const ancPath of ancPathList) {
                    const dispAncPathLines = wordWrapLines(
                        ancPath.map(dispCodeLabel).join(' ← '),
                        wrapToWidth,
                        {
                            firstIndent: '  - ',
                            subsequentIndent: '    ',
                        }
                    );
                    outputData += dispAncPathLines.join('\n') + '\n';
                }
                outputData += '\n';
            }
        } else {
            let dispAncInfo = ({ ancestorInfo, indents }) => {
                let lines = [];
                indents ??= [];
                let indent = (x) => {
                    return indents.join('') + x;
                }
                let { codeId, alreadyAncestorViaChain, parentsInfo } = ancestorInfo;
                let hasUpperLevels = (indents.length > 0);
                debug(`dispAncInfo`, {indents, codeId,alreadyAncestorViaChain,parentsInfo});
                const thisBullet = hasUpperLevels ? '-  *' : '*';
                const thisIndentMinusOneChar = ' '.repeat(thisBullet.length-1);
                const thisIndentBarJoiner = (
                    thisIndentMinusOneChar +
                    ((alreadyAncestorViaChain != null || parentsInfo.length) ? '|' : ' ')
                );
                let wrapToWidth = (
                    lineWidth - indents.reduce( (x,y) => (x + y.length), 0 )
                    - thisIndentBarJoiner.length
                );
                if (wrapToWidth < minWrapWidth) { wrapToWidth = minWrapWidth; }

                const codeLines = wordWrapLines(
                    `${dispCodeLabel(codeId)}`,
                    wrapToWidth - 1
                );
                for (const [j,thisLine] of codeLines.entries()) {
                    const joiner =
                        (j === 0) ? (thisBullet + '  ') : thisIndentBarJoiner+' ';
                    lines.push(indent(joiner + thisLine));
                }

                if (alreadyAncestorViaChain != null) {
                    const alreadyViaChainRev = [...alreadyAncestorViaChain].reverse();
                    const alreadyViaString =
                      `… already via:  ${ alreadyViaChainRev.map(dispCodeLabel).join(' ← ') }`;
                    const alreadyViaLines = wordWrapLines(alreadyViaString, wrapToWidth);
                    for (const alreadyViaLine of alreadyViaLines) {
                        lines.push(indent(`${thisIndentMinusOneChar}  ${alreadyViaLine}`));
                    }
                    lines.push(indent(''));
                } else if (parentsInfo.length) {
                    lines.push(indent(thisIndentBarJoiner));
                    for (const [j,pInfo] of parentsInfo.entries()) {
                        lines.push(... dispAncInfo({
                            ancestorInfo: pInfo,
                            indents: [
                                ...indents,
                                ((j < parentsInfo.length-1)
                                 ? thisIndentBarJoiner
                                 : thisIndentMinusOneChar + ' ')
                            ],
                        }))
                    }
                } else {
                    lines.push(indent(''));
                }
                return lines;
            };
            outputData = (
                '\n' + dispAncInfo({ ancestorInfo: ancestorsData }).join('\n') + '\n\n'
            );
        }
    } else {
        throw new Error(`Invalid output format: ‘${argv.outputFormat}’`);
    }

    process.stdout.write(outputData);

    return;
}

run_list_ancestors.yargs_builder = (yargs) => {
    return yargs
        .options({
            'data-dir': {
                alias: 'd',
                default: null,
                describe: "Data repository folder (defaults to sibling `eczoo_data` folder)",
            },
            'verbose': {
                alias: 'v',
                count: true,
                default: 0,
                describe: 'Enable verbose mode'
            },
            'quiet': {
                alias: 'q',
                boolean: true,
                default: false,
                describe: 'Suppress logging messages',
            },
            'linear': {
                boolean: true,
                describe: 'List all ancestor codes as a simple list.  The list respects global parent/child order, i.e., parents appear before their children.'
            },
            'list-by-ancestor': {
                boolean: true,
                describe: 'For each ancestor, display the different paths through which this code appears as an ancestor',
            },
            'show-only-ancestors': {
                default: null,
                describe: 'Refine the output of --list-by-ancestor to only show information about the given ancestors (provide comma-separated list of CODE_ID\'s)',
            },
            'full-names': {
                boolean: true,
                describe: 'Display the full name for each code, not only its code ID.'
            },
            'output-format': {
                default: 'txt',
                describe: 'Preferred output format. One of "txt" or "json".'
            },
            'line-width': {
                default: terminalWidth,
                describe: 'Wrap long lines to this line width',
            }
        })
        .positional('CODE_ID', {
            describe: 'The code ID for which to list all ancestors',
            type: 'string',
        })
        .strictOptions()
    ;
}


let terminalWidth = null;

//
// Main function. Parse command-line arguments and call runmain().
//
async function main()
{
    let Y = yargs(hideBin(process.argv));
    terminalWidth = Y.terminalWidth() ?? 80;
    await Y
        .scriptName('ancestorsTools')
        .command({
            command: 'list-ancestors <CODE_ID>',
            aliases: ['l'],
            desc: 'List all ancestors of the given CODE_ID',
            builder: run_list_ancestors.yargs_builder,
            handler: run_list_ancestors,
        })
        .demandCommand()
        .help()
        .wrap(Y.terminalWidth())
        .parse();
    
    debug('main() done');
}

await main();


// helper

function wordWrapLines(x, width, { minWidth, firstIndent, subsequentIndent }={})
{
    debug(`Wrapping: `, {x, width, minWidth});
    minWidth ??= 20;
    let lines = [];
    let remaining = x;
    while (remaining && remaining.length) {
        remaining = remaining.trim();
        if (remaining.length == 0) {
            break; // there was only whitespace left
        }
        if (remaining.length <= width) {
            // we're done
            lines.push(remaining);
            break;
        }
        let rpos = remaining.lastIndexOf(' ', width);
        if (rpos === -1 || rpos < minWidth) {
            let thisLine = remaining.slice(0,width-1);
            const newRemaining = remaining.slice(width-1).trim();
            debug(`Splitting remaining=‘${remaining}’ at width-1=${width-1}`, {thisLine,newRemaining});
            lines.push(
                thisLine + (newRemaining.length ? '↩' : '')
            );
            remaining = newRemaining;
        } else {
            let thisLine = remaining.slice(0,rpos).trim();
            const newRemaining = remaining.slice(rpos);
            debug(`Splitting remaining=‘${remaining}’ at rpos=${rpos}`, {thisLine, newRemaining});
            lines.push(thisLine);
            remaining = newRemaining;
        }
    }
    // add first/subsequent indents to the lines
    lines = lines.map( (line, index) => {
        if (index === 0 && firstIndent != null) {
            return firstIndent + line;
        }
        if (index > 0 && subsequentIndent != null) {
            return subsequentIndent + line;
        }
        return line;
    } );
    debug(`---> lines = `, lines);
    return lines;
}