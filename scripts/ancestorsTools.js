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
// Common helpers
//
function common_args({argv, eczoodb})
{
    const lineWidth = argv.lineWidth;
    const minWrapWidth = 20;
    // display full parents tree
    let dispCodeLabel = (codeId) => {
        if (!argv.fullNames) {
            return codeId;
        }
        return `${eczoodb.objects.code[codeId].name} ⟨${codeId}⟩`;
    };
    
    return { lineWidth, minWrapWidth, dispCodeLabel };
}

const yargs_common = () => ({
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
        describe: 'Suppress logging messages',
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
    },
});


//
// Tool: detect degenerate paths
//

async function run_detect_degenerate_paths(argv)
{
    helperSetDefaultLogs({ verbosityLevel: argv.verbose, quietMode: argv.quiet });
    debug(`run_detect_degenerate_paths(): argv = `, argv);

    debuglog('runmain(): loading zoo... (might take a couple minutes)');
    const eczoodb = await loadEcZoo({
        dataDir: argv.dataDir,
        useFlmProcessor: false,
    });

    debuglog('runmain(): zoo is now loaded!');

    const { dispCodeLabel, lineWidth, minWrapWidth } = common_args({argv, eczoodb});

    //
    // Zoo is loaded (eczoodb). Query anything we need from it at this point.
    //

    const codeIdList = (argv.CODE_ID_LIST ?? "").split(',').map( (x) => x.trim() ).filter( (x) => x.length );

    debuglog(`Getting ancestors of ${JSON.stringify(codeIdList)}`);

    // run a depth-first search, like we did for list-by-ancestors, and alert the user
    // whenever we find multiple ways to reach a given ancestor.
    let byPairsOfAncestors = {};
    let ancestorParentsAlreadyVisited = {};

    let visitCode = ({ c, ancPath} ) => {
        let codeId = c.code_id;
        ancPath ??= [];
        debug(`Visiting ${codeId} from ${ancPath} ...`);
        let newAncPath  = [... ancPath, codeId];
        for (const [j, ancCodeId] of ancPath.entries()) {
            let key = `${ancCodeId}:${codeId}`;
            let pathList = byPairsOfAncestors[key];
            if (pathList == null) {
                pathList = byPairsOfAncestors[key] = [];
            }
            let thisPath = newAncPath.slice(j);
            pathList.push(thisPath);
        }
        if (ancestorParentsAlreadyVisited[codeId] != null) {
            return;
        }
        for (const prel of c.relations?.parents ?? []) {
            visitCode({ c: prel.code, ancPath: newAncPath });
        }
        ancestorParentsAlreadyVisited[codeId] = true;
    };

    // initiate the visit from the code ID's we were provided.  If none were provided, then initiate a search
    // for *all* codes in the zoo.  Don't worry, a code won't visit its parents if it was already visited.
    let visitCodeIdList = codeIdList.length ? codeIdList : Object.keys(eczoodb.objects.code);
    for (const codeId of visitCodeIdList) {
        visitCode({ c: eczoodb.objects.code[codeId] });
    }

    // now, go through each ancestor and check whether there are multiple paths
    // to that ancestor.

    // first of all, filter out all paths that involve codes we don't want to include.
    if (argv.onlyShowPathsWithout != null && argv.onlyShowPathsWithout.trim().length) {
        let excludeCodeIds = argv.onlyShowPathsWithout.split(',').map( (x) => x.trim() ).filter( (x) => x && x.length );
        for (const [key, paths] of Object.entries(byPairsOfAncestors)) {
            const newPaths = paths.filter( (path) =>
                path.every( (cId) => ! excludeCodeIds.includes(cId) )
            );
            byPairsOfAncestors[key] = newPaths;
        }
    }

    debug(`byPairsOfAncestors = `, byPairsOfAncestors);

    // Now, we detect degenerate paths.  We do this by going over all the pairs of codes,
    // inspecting all paths that connect them, and find any pairs of paths connecting
    // them that do not share an intermediate point.
    //
    // Furthermore, we want to find the "elementary" degenerate paths, replacing pieces
    // of paths in the above detected degenerate.  Eg. if
    //
    //     G
    //   / | \
    //  D  E  F
    //  |  | /
    //  B  C 
    //  \ /
    //   A
    //
    // Then we will have detected at this point
    // - C...G: [C->E->G, C->F->G],
    // - A...G: [A->B->D->G, A->C->E->G], [A->B->D->G, A->C->F->G]
    //
    // We'd like to further reduce this so that only a single "elementary" degenerate path is
    // reported for the A...G path (to make it "elementary").  We want:
    // - C...G: [C->E->G, C->F->G],
    // - A...G: [A->B->D->G, A->C->...->G]


    // Strategy:
    //
    // 1) identify all pairs of codes that have multiple distinct paths relating them.
    //
    let byPairsOfAncestorsWithDegeneratePaths = Object.fromEntries(
        Object.entries(byPairsOfAncestors).filter( ([key_,paths]) => (paths && paths.length>1) )
    );

    debug(`byPairsOfAncestorsWithDegeneratePaths =`, byPairsOfAncestorsWithDegeneratePaths);

    //
    // 2) go through all pairs of such codes, and inspect their paths.  Every time we
    //    find pair of codes in the path that itself is known to have degenerate paths,
    //    replace the sub-path by "...".  Make sure we don't keep duplicates after
    //    the simplification.
    //
    let detectedDegeneratePaths = {};

    for (const [key,paths] of Object.entries(byPairsOfAncestorsWithDegeneratePaths)) {
        // we'll edit the `paths` array in place.
        //debug(`Strategy step 2 for ${key}, paths = ${JSON.stringify(paths)}`)
        for (const path of paths) {
            for (;;) {
                try {
                    for (const [j1,cId1] of path.entries()) {
                        if (cId1 === '...') { continue; }
                        for (const [j2,cId2] of [...path.entries()].slice(j1+1)) {
                            if (j1 === 0 && j2 === path.length-1) {
                                continue; // well of course, not this one.
                            }
                            if (cId2 === '...') { continue; }
                            if (j2 === j1 + 2 && path[j1+1] === '...') {
                                // pair already replaced!
                                continue;
                            }
                            //debug(`Strategy step 2 for ${key}, testing ${cId1}:${cId2}`)
                            if (byPairsOfAncestorsWithDegeneratePaths[`${cId1}:${cId2}`] != null) {
                                //debug(`Simplifying ${path.slice(j1,j2+1).join(" ← ")} in path,`, {j1, j2, path});
                                // need to replace this pair! But keep both j1 and j2.
                                path.splice(j1+1, j2-j1-1, "...");
                                //debug(`Done! path is now = `, path);
                                // continue trying to see if we can replace paths by simplifying them.  But
                                // we need to restart the for loops because we'll have messed up the indices.
                                // So start the for loops again, using this try...catch hack.
                                throw { doContinueLoop: true };
                            }
                        }
                    }
                    break; // all ok, no further simplifications needed
                } catch (err) {
                    if (err.doContinueLoop === true) {
                        continue;
                    }
                    throw err; // another, unrelated error - propagate it further
                }
            }
            // now, make sure we remove duplicates.
            for (let j1 = 0; j1 < paths.length; ++j1) { // !!! make sure paths.length is reevaluated at each iteration !!!
                const path1 = paths[j1];
                for (const [j2,path2] of [...paths.entries()].slice(j1+1)) {
                    if (path1.every( (cId1, idx1) => (cId1 === path2[idx1]) )) {
                        // paths are equal, remove j2
                        paths.splice(j2,1);
                        break;
                    }
                }
            }
        }
        let [codeIdDesc,codeIdAnc] = key.split(':');
        if (paths.length === 1) {
            // there's no degeneracy here.  We have a path of the form  "A", "...", "B", "...", "C" ...
            paths.splice(0,1);
        }
        if (paths.length) {
            detectedDegeneratePaths[key] = {
                codeIds: [codeIdDesc,codeIdAnc],
                paths,
            }
        }
    }

    debug(`byPairsOfAncestorsWithDegeneratePaths =`, byPairsOfAncestorsWithDegeneratePaths);
    debug(`detectedDegeneratePaths =`, detectedDegeneratePaths);


    // // First, identify all endpoints where there are degenerate paths.  Then we'll worry
    // // about spelling out the elementary degenerate paths.

    // for (const [key, paths] of Object.entries(byPairsOfAncestorsWithDegeneratePaths)) {
    //     let [codeIdDesc,codeIdAnc] = key.split(':');
    //     let degeneratePaths = [];
    //     // take all distinct pairs of paths, and see if their difference is a nontrivial
    //     // "cycle" with no common edge
    //     for (const [j1,path1] of paths.entries()) {
    //         let p1inner = path1.slice(1,-1)
    //         let p1intermediate = new Set(p1inner);
    //         p1intermediate.delete('...'); // remove any '...', if present.
    //         for (const path2 of paths.slice(j1+1)) {
    //             let p2inner = path2.slice(1,-1);
    //             let hasNoCommonIntermediate = p2inner.every(
    //                 (cId) => ! p1intermediate.has(cId)
    //             );
    //             if (hasNoCommonIntermediate) {
    //                 // this is an elementary degenerate path, include it
    //                 degeneratePaths.push( [p1inner, p2inner] );
    //             }
    //         }
    //     }
    //     if (degeneratePaths.length > 1) {
    //         detectedDegeneratePaths[key] = {
    //             codeIds: [codeIdDesc, codeIdAnc],
    //             degeneratePaths
    //         };
    //     }
    // }



    debug(`detectedDegeneratePaths = `, detectedDegeneratePaths);


    let outputData = null;

    if (argv.outputFormat === 'json') {

        outputData = JSON.stringify(detectedDegeneratePaths);

    } else if (argv.outputFormat === 'txt') {

        // Display the elementary degenerate paths in a human-readable form.  Argh.

        outputData = '\n';

        for (const dpInfo of Object.values(detectedDegeneratePaths)) {
            const { codeIds, paths } = dpInfo;

            const codeLabel0 = dispCodeLabel(codeIds[0]);
            const codeLabel1 = dispCodeLabel(codeIds[1]);

            // Fix the paths: 1) remove endpoints from paths, and 2) prepare the display strings.
            let pathsWithDispCodeLabels = paths.map( (path) => path.slice(1, -1).map(
                (cId) => (cId === '...' ? '...' : dispCodeLabel(cId))
            ) );

            let lineBullet = '*   ';
            let lineIndent = '    ';

            outputData += wordWrapLines(
                `${codeLabel0} → ... → ${codeLabel1}`,
                lineWidth - lineIndent.length,
                {
                    firstIndent: lineBullet,
                    subsequentIndent: lineIndent,
                }
            ).map( x => x+'\n' ).join() + '\n';

            let nCols = pathsWithDispCodeLabels.length;
            let cellGap = 4;
            // don't make cells wider than necessary -- check width of all strings
            let cellWidth = parseInt(Math.floor((lineWidth - lineIndent.length) / nCols)) - 3 - cellGap;
            let maxLabelWidth = 0;
            for (let path of pathsWithDispCodeLabels) {
                for (const codeNameLabel of path) {
                    if (codeNameLabel.length > maxLabelWidth) {
                        maxLabelWidth = codeNameLabel.length;
                    }
                }
            }
            if (cellWidth > maxLabelWidth) {
                cellWidth = maxLabelWidth;
            }
            if (cellWidth < 10) { // sanity check
                cellWidth = 10;
            }

            let cellLWidth = parseInt(Math.floor(cellWidth/2))-1;
            let cellRWidth = cellWidth - cellLWidth - 1;
            let cellVBarJoiner = ' '.repeat(cellLWidth) + '|' + ' '.repeat(cellRWidth);

            let megaCellWidth = cellRWidth + ((cellGap+cellWidth)*(nCols-2)) + cellGap + cellLWidth;
            let megaCellLPadding = 2;
            if (megaCellWidth < cellWidth+megaCellLPadding) { // sanity check
                megaCellWidth = cellWidth+megaCellLPadding;
            }

            debug(`Cell sizes: `, {cellWidth, cellLWidth, cellRWidth, cellGap, megaCellWidth, nCols});

            outputData += `${lineIndent}${
                ' '.repeat(cellLWidth) + ' ' + '-'.repeat(megaCellWidth) + ' '
            }\n`;

            outputData += wordWrapLines(
                `${codeLabel0}`,
                megaCellWidth - megaCellLPadding,
                {
                    firstIndent: lineIndent + ' '.repeat(cellLWidth+1+megaCellLPadding),
                    subsequentIndent: lineIndent + ' '.repeat(cellLWidth+1+megaCellLPadding),
                }
            ).map( x => x+'\n' ).join();

            outputData += `${lineIndent}${
                ' '.repeat(cellLWidth) + '/' + '-'.repeat(megaCellWidth) + '\\'
            }\n`;

            let cellsLines = []; // cellsLines[rowNo][whichPath] = <array of lines for this cell>
            for (let [whichPath, path] of pathsWithDispCodeLabels.entries()) {
                while (cellsLines.length < path.length) {
                    cellsLines.push( [...pathsWithDispCodeLabels].map( () => [] ) ); // add another row of empty arrays
                }
                for (const [j, codeNameLabel] of path.entries()) {
                    let hbarsep = '-'.repeat(cellWidth);
                    if (codeNameLabel === '...') {
                        hbarsep = ' '.repeat(cellWidth);
                    }
                    cellsLines[j][whichPath] = [
                        hbarsep,
                        ... wordWrapLines(
                            codeNameLabel,
                            cellWidth,
                        ),
                        hbarsep,
                    ];
                }
            }
            // now, display the cells
            let cellVBarJoinerFullLine = (cellVBarJoiner + ' '.repeat(cellGap)).repeat(nCols-1) + cellVBarJoiner
            for (const rowData of cellsLines) {
                outputData += lineIndent + cellVBarJoinerFullLine + '\n';
                let numRowLines =
                    rowData.reduce( (num, cellLines) => (num < cellLines.length ? cellLines.length : num), 0 );
                for (let rowLineNo = 0; rowLineNo < numRowLines; ++rowLineNo) {
                    outputData += lineIndent;
                    for (const [colj, cellLines] of rowData.entries()) {
                        let cellLine = null;
                        if (rowLineNo < cellLines.length) {
                            cellLine = cellLines[rowLineNo];
                            // center in cell
                            let remainpad = cellWidth - cellLine.length;
                            let lpad = parseInt(Math.floor((remainpad)/2));
                            cellLine = ' '.repeat(lpad) + cellLine + ' '.repeat(remainpad - lpad); // pad to cell width
                        } else {
                            cellLine = cellVBarJoiner;
                        }
                        if (colj > 0) {
                            outputData += ' '.repeat(cellGap);
                        }
                        outputData += cellLine;
                    }
                    outputData += '\n';
                }
                outputData += lineIndent + cellVBarJoinerFullLine + '\n';
            }
            
            outputData += `${lineIndent}${
                ' '.repeat(cellLWidth) + '\\' + '-'.repeat(megaCellWidth) + '/'
            }\n`;

            outputData += wordWrapLines(
                `${codeLabel1}`,
                megaCellWidth - megaCellLPadding,
                {
                    firstIndent: lineIndent + ' '.repeat(cellLWidth+1+megaCellLPadding),
                    subsequentIndent: lineIndent + ' '.repeat(cellLWidth+1+megaCellLPadding),
                }
            ).map( x => x+'\n' ).join();

            outputData += `${lineIndent}${
                ' '.repeat(cellLWidth) + ' ' + '-'.repeat(megaCellWidth) + ' '
            }\n`;

            outputData += `\n\n`;
        }

    }

    process.stdout.write(outputData);
    return;
}

run_detect_degenerate_paths.yargs_builder = (yargs) => {
    return yargs
        .options({
            ...yargs_common(),
            'only-show-paths-without': {
                type: 'string',
                describe: 'Only report degenerate paths that do not contain the given codes (provide comma-separated list of CODE_ID\'s)',
            }
        })
        .positional('CODE_ID_LIST', {
            describe: 'A comma-separated list of code IDs from where to start scanning ancestors for degenerate paths.',
            type: 'string',
            default: null,
        })
        .strict()
    ;
}

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

    const { dispCodeLabel, lineWidth, minWrapWidth } = common_args({argv, eczoodb});

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
                Object.entries(ancestorsData).filter( ([cId, _]) => codeIds.includes(cId) )
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
            ...yargs_common(),
            'linear': {
                boolean: true,
                describe: 'List all ancestor codes as a simple list.  The list respects global parent/child order, i.e., parents appear before their children.',
                conflicts: ['list-by-ancestor', 'detect-degenerate-paths'],
            },
            'list-by-ancestor': {
                boolean: true,
                describe: 'For each ancestor, display the different paths through which this code appears as an ancestor',
                conflicts: ['linear', 'detect-degenerate-paths'],
            },
            'show-only-ancestors': {
                //default: null, // messes up "implies: "!
                describe: 'Refine the output of --list-by-ancestor to only show information about the given ancestors (provide comma-separated list of CODE_ID\'s)',
                implies: ['list-by-ancestor'],
            },
        })
        .positional('CODE_ID', {
            describe: 'The code ID for which to list all ancestors',
            type: 'string',
        })
        .strict()
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
        .command({
            command: 'detect-degenerate-paths [CODE_ID_LIST]',
            aliases: ['d'],
            desc: "Detect pairs of codes that can be reached through multiple distinct paths of parental relationships.  These are nontrivial \"cycles\" in the undirected code graph that can be written as a difference of two directed paths.  (Cycles in the directed code graph are anyways not allowed.)",
            builder: run_detect_degenerate_paths.yargs_builder,
            handler: run_detect_degenerate_paths,
        })
        .demandCommand()
        .help()
        .wrap(Y.terminalWidth())
        .strict()
        .parse();
    
    debug('main() done');
}

await main();


// helper

function wordWrapLines(x, width, { minWidth, firstIndent, subsequentIndent }={})
{
    debug(`Wrapping: `, {x, width, minWidth});
    minWidth ??= 15;
    if (width < minWidth) {
        throw new Error(`wordWrapLines() invalid width=${width} is less than minWidth=${minWidth}`);
    }
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