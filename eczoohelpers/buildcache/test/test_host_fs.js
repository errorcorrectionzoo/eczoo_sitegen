// Tests of the host file system (js/host.js) against the contract of
// cachette's CacheFs and ManagerFs, and of its in-process lock table.

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
    hostRead, hostWrite, hostAppend, hostAtomicReplace, hostRename, hostList, hostStat,
    hostSetModified, hostRemove, hostRemoveFolder, hostLock, hostUnlock, heldGuardCount,
} from '../js/host.js';


describe('host file system (js/host.js)', function () {

    let dir;

    beforeEach(function () {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildcache-hostfs-'));
    });

    afterEach(function () {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const p = (...names) => [ dir, ...names ].join('/');

    it('reads an absent file as undefined, and fails on a folder', function () {
        assert.equal(hostRead(p('nothing')), undefined);
        fs.mkdirSync(p('folder'));
        assert.throws( () => hostRead(p('folder')), (e) => typeof e === 'string' && /^Failed to read/.test(e) );
    });

    it('write, append and atomic_replace create the missing folders', function () {
        hostWrite(p('a', 'b', 'w.txt'), Buffer.from('one'));
        assert.equal(fs.readFileSync(p('a', 'b', 'w.txt'), 'utf-8'), 'one');
        hostAppend(p('c', 'd', 'x.txt'), Buffer.from(''));
        assert.equal(fs.readFileSync(p('c', 'd', 'x.txt'), 'utf-8'), '');
        hostAppend(p('c', 'd', 'x.txt'), Buffer.from('ab'));
        hostAppend(p('c', 'd', 'x.txt'), Buffer.from('cd'));
        assert.equal(fs.readFileSync(p('c', 'd', 'x.txt'), 'utf-8'), 'abcd');
        hostAtomicReplace(p('e', 'f', 'r.json'), Buffer.from('{}'));
        assert.equal(fs.readFileSync(p('e', 'f', 'r.json'), 'utf-8'), '{}');
        assert.deepEqual(hostRead(p('a', 'b', 'w.txt')), Buffer.from('one'));
    });

    it('atomic_replace replaces the content, keeps the permissions, leaves no temporary file', function () {
        const target = p('r.txt');
        fs.writeFileSync(target, 'old');
        fs.chmodSync(target, 0o640);
        hostAtomicReplace(target, Buffer.from('new content'));
        assert.equal(fs.readFileSync(target, 'utf-8'), 'new content');
        if (process.platform !== 'win32') {
            assert.equal(fs.statSync(target).mode & 0o777, 0o640);
        }
        assert.deepEqual(fs.readdirSync(dir), [ 'r.txt' ]);
    });

    it('rename replaces the target, and fails for an absent source or a folder', function () {
        fs.writeFileSync(p('from'), 'A');
        fs.writeFileSync(p('to'), 'B');
        hostRename(p('from'), p('to'));
        assert.equal(fs.readFileSync(p('to'), 'utf-8'), 'A');
        assert.equal(fs.existsSync(p('from')), false);
        assert.throws( () => hostRename(p('from'), p('to')), /^Failed to rename/ );
        fs.mkdirSync(p('folder'));
        assert.throws( () => hostRename(p('folder'), p('elsewhere')), /is not a file/ );
        // a rename into a missing folder fails (no folder is created)
        fs.writeFileSync(p('from'), 'A');
        assert.throws( () => hostRename(p('from'), p('missing', 'to')), /^Failed to rename/ );
    });

    it('lists files, folders and symbolic links without following them', function () {
        assert.deepEqual(hostList(p('absent')), []);
        fs.writeFileSync(p('file'), 'x');
        fs.mkdirSync(p('folder'));
        fs.symlinkSync(p('file'), p('link-to-file'));
        fs.symlinkSync(p('folder'), p('link-to-folder'), 'dir');
        fs.symlinkSync(p('nowhere'), p('dangling'));
        assert.deepEqual(hostList(dir).sort(), [
            'Ldangling', 'Ffile', 'Dfolder', 'Llink-to-file', 'Llink-to-folder',
        ].sort());
        assert.throws( () => hostList(p('file')), /^Failed to list folder/ );
    });

    it('stat answers the size and the modification time, undefined when absent', function () {
        assert.equal(hostStat(p('absent')), undefined);
        fs.writeFileSync(p('f'), 'hello');
        const [ size, modified ] = hostStat(p('f'));
        assert.equal(size, 5);
        assert.ok(Math.abs(modified - Date.now()) < 60000);
        fs.mkdirSync(p('folder'));
        assert.throws( () => hostStat(p('folder')), /not a file/ );
    });

    it('set_modified sets the exact millisecond, and does nothing for an absent file', function () {
        fs.writeFileSync(p('f'), 'x');
        for (const ms of [ 0, 1, 999, 1000, 1700000000123, 1795000000999, Date.now() ]) {
            hostSetModified(p('f'), ms);
            assert.equal(hostStat(p('f'))[1], ms, `modification time ${ms}`);
        }
        hostSetModified(p('f'), -5000);
        assert.equal(hostStat(p('f'))[1], 0);
        hostSetModified(p('absent'), 1000);
        assert.equal(fs.existsSync(p('absent')), false);
    });

    it('remove removes a file or a link (not its target), and ignores an absent path', function () {
        fs.writeFileSync(p('file'), 'x');
        fs.mkdirSync(p('folder'));
        fs.symlinkSync(p('folder'), p('link'), 'dir');
        hostRemove(p('link'));
        assert.equal(fs.existsSync(p('folder')), true);
        assert.equal(fs.existsSync(p('link')), false);
        hostRemove(p('file'));
        assert.equal(fs.existsSync(p('file')), false);
        hostRemove(p('file'));
        assert.throws( () => hostRemove(p('folder')), /^Failed to remove/ );
    });

    it('remove_folder removes an empty folder only', function () {
        fs.mkdirSync(p('empty'));
        fs.mkdirSync(p('full'));
        fs.writeFileSync(p('full', 'f'), 'x');
        fs.writeFileSync(p('file'), 'x');
        hostRemoveFolder(p('empty'));
        assert.equal(fs.existsSync(p('empty')), false);
        hostRemoveFolder(p('empty'));
        assert.throws( () => hostRemoveFolder(p('full')), /^Failed to remove folder/ );
        assert.throws( () => hostRemoveFolder(p('file')), /^Failed to remove folder/ );
        assert.throws( () => hostRemoveFolder(''), /empty path/ );
    });

    describe('locks', function () {

        afterEach(function () {
            assert.equal(heldGuardCount(), 0, 'every guard is released');
        });

        it('creates the lock file when absent, and fails when its folder is missing', function () {
            const g = hostLock(p('l.lock'), true);
            assert.ok(g >= 1);
            assert.equal(fs.readFileSync(p('l.lock'), 'utf-8'), '');
            hostUnlock(g);
            assert.throws( () => hostLock(p('missing', 'l.lock'), true), /^Failed to open the lock file/ );
            assert.equal(fs.existsSync(p('missing')), false);
        });

        it('excludes as ManagerFs states: shared with shared, exclusive with nothing', function () {
            const lock = p('l.lock');
            const s1 = hostLock(lock, false);
            const s2 = hostLock(lock, false);
            assert.ok(s1 >= 1 && s2 >= 1 && s1 !== s2);
            assert.equal(hostLock(lock, true), 0, 'shared guards exclude an exclusive lock');
            hostUnlock(s1);
            assert.equal(hostLock(lock, true), 0, 'one shared guard still excludes it');
            hostUnlock(s2);
            const x = hostLock(lock, true);
            assert.ok(x >= 1);
            assert.equal(hostLock(lock, true), 0, 'an exclusive guard excludes an exclusive lock');
            assert.equal(hostLock(lock, false), 0, 'an exclusive guard excludes a shared lock');
            // another file is not concerned
            const other = hostLock(p('other.lock'), true);
            assert.ok(other >= 1);
            hostUnlock(other);
            hostUnlock(x);
            hostUnlock(x);  // releasing again does nothing
            const s3 = hostLock(lock, false);
            assert.ok(s3 >= 1);
            hostUnlock(s3);
        });

        it('locks a file, not a path: a file that replaces a removed lock file is free', function () {
            const lock = p('l.lock');
            const x = hostLock(lock, true);
            fs.rmSync(lock);
            const y = hostLock(lock, true);
            assert.ok(y >= 1, 'the new file at the path has locks of its own');
            assert.equal(hostLock(lock, false), 0);
            hostUnlock(x);
            hostUnlock(y);
        });

        it('locks one file under two paths as one file', function () {
            fs.mkdirSync(p('sub'));
            fs.symlinkSync(p('sub'), p('alias'), 'dir');
            const x = hostLock(p('sub', 'l.lock'), true);
            assert.equal(hostLock(p('alias', 'l.lock'), false), 0);
            hostUnlock(x);
        });
    });
});
