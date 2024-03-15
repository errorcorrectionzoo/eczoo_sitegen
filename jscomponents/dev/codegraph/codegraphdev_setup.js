import debugm from 'debug';
const debug = debugm('codegraph_page_main');

function isStrict() { return !this; };
if (!isStrict()) {
  throw new Error(`Not strict mode!`);
}

debug('Running code graph dev setup ...');
console.log("Running code graph dev setup. If you don't see debug messages run localStorage.debug='*'");

import eczoodbData from './eczoodata.json';
window.eczData = { eczoodbData };

import * as codegraphsetup from '../../codegraph/setup.js';
window.addEventListener('load', function () { codegraphsetup.load(); });
