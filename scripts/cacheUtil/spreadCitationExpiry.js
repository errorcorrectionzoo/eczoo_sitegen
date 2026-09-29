//
// Run as "yarn node scripts/cacheUtil/spreadCitationExpiry.js [...]".
// Try --help to get a list of options.
//
// Spread the expiry dates of a cluster of citation cache entries (those of a
// given prefix whose expiry falls in a given range) evenly, in random order,
// over a window of a given number of days starting at the cluster's earliest
// expiry.  Each entry keeps its (expires - stale_after) gap.  Other lines of
// the cache file are written back unchanged.
//
// Run this only when no build is running.
//

import process from 'node:process';
import fs from 'fs';
import path from 'path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


const DAY = 86400000;

const fmt_date = (t) => new Date(t).toISOString().slice(0, 10);


function spreadCitationExpiry(argv)
{
    const { cacheFile, prefix, expiringFrom, expiringBefore, windowDays, dryRun } = argv;

    const cache_dir = path.dirname(cacheFile);
    const leftover = fs.readdirSync(cache_dir).filter( (f) => f.startsWith('._citations') );
    if (leftover.length) {
        throw new Error(
            `Found ${leftover.join(', ')} in ‘${cache_dir}’; is a build running?  Refusing to run.`
        );
    }

    const from_t = (expiringFrom != null) ? Date.parse(expiringFrom) : -Infinity;
    const before_t = (expiringBefore != null) ? Date.parse(expiringBefore) : Infinity;

    const lines = fs.readFileSync(cacheFile, 'utf8').split('\n');

    const line_start = '{"id":"' + prefix + ':';
    const targets = [];
    lines.forEach( (line, i) => {
        if ( ! line.startsWith(line_start) ) {
            return;
        }
        const o = JSON.parse(line);
        if (o.rec.expires >= from_t && o.rec.expires < before_t) {
            targets.push({ i, o });
        }
    });

    if ( ! targets.length ) {
        console.log(`No ‘${prefix}:’ entries expire in the given range.`);
        return;
    }

    const exps_before = targets.map( (t) => t.o.rec.expires ).sort( (a, b) => a - b );
    console.log(`${targets.length} ‘${prefix}:’ entries; before: expires `
                + `${fmt_date(exps_before[0])} .. ${fmt_date(exps_before.at(-1))}`);

    // Fisher-Yates shuffle, then assign evenly spaced expiry times
    for (let k = targets.length - 1; k > 0; --k) {
        const j = Math.floor(Math.random() * (k + 1));
        [targets[k], targets[j]] = [targets[j], targets[k]];
    }
    const start = exps_before[0];
    const step = (windowDays * DAY) / targets.length;

    targets.forEach( ({ i, o }, k) => {
        const gap = o.rec.expires - o.rec.stale_after;
        o.rec.expires = Math.round(start + k * step);
        o.rec.stale_after = o.rec.expires - gap;
        lines[i] = JSON.stringify(o);
    });

    const exps = targets.map( (t) => t.o.rec.expires ).sort( (a, b) => a - b );
    const stales = targets.map( (t) => t.o.rec.stale_after ).sort( (a, b) => a - b );
    console.log(`after: expires ${fmt_date(exps[0])} .. ${fmt_date(exps.at(-1))}, `
                + `stale_after ${fmt_date(stales[0])} .. ${fmt_date(stales.at(-1))}`);

    if (dryRun) {
        console.log(`Dry run, not writing ‘${cacheFile}’.`);
        return;
    }
    fs.writeFileSync(cacheFile + '.tmp', lines.join('\n'));
    fs.renameSync(cacheFile + '.tmp', cacheFile);
    console.log(`Wrote ‘${cacheFile}’.`);
}


function main()
{
    let Y = yargs(hideBin(process.argv));
    const argv = Y
        .scriptName('spreadCitationExpiry')
        .options({
            'cache-file': {
                default: '_zoodb_citations_cache/citations.jsonl',
                describe: 'The citation cache file to modify',
            },
            'prefix': {
                demandOption: true,
                string: true,
                describe: 'Citation prefix of the entries to spread (e.g. arxiv, doi)',
            },
            'expiring-from': {
                string: true,
                describe: 'Only entries expiring on or after this date (YYYY-MM-DD)',
            },
            'expiring-before': {
                string: true,
                describe: 'Only entries expiring before this date (YYYY-MM-DD)',
            },
            'window-days': {
                number: true,
                default: 30,
                describe: 'Spread the expiry dates over this many days',
            },
            'dry-run': {
                boolean: true,
                default: false,
                describe: 'Report what would change without writing the file',
            },
        })
        .help()
        .wrap(Y.terminalWidth())
        .strict()
        .argv;

    spreadCitationExpiry(argv);
}

main();
