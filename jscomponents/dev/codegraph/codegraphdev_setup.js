import debugm from 'debug';
const debug = debugm('codegraph_page_main');

function isStrict() { return !this; }
if (!isStrict()) {
    throw new Error(`Not strict mode!`);
}


const initialDisplayOptions = {
  // cousinEdgesShown: true,
  // secondaryParentEdgesShown: true,

  // displayMode: 'isolate-nodes',
  // modeIsolateNodesOptions: {
  //   nodeIds: [ 'c_css' ],
  //   reusePreviousLayoutPositions: false,
  //   range: {
  //     parents: {
  //         primary: 2,
  //         secondary: 1,
  //         extra: 0,
  //     },
  //     children: {
  //         primary: 2,
  //         secondary: 1,
  //         extra: 0,
  //     },
  //   },
  // },
};


debug('Running code graph dev setup ...');
console.log("Running code graph dev setup. If you don't see debug messages run localStorage.debug='*'");

import eczoodbData from './eczoodata.json';
window.eczData = { eczoodbData };

import * as codegraphsetup from '../../codegraph/setup.js';
import * as mathjax from '../../mathjax/setup.js';

window.addEventListener('load', async function () {
    await mathjax.load();
    await codegraphsetup.load({ displayOptions: initialDisplayOptions });
    debug(`window load handler - code graph setup done!`);
    window.eczcodegraphdebug = () => {
        window.eczCodeGraph.cy.elements().toggleClass('DEBUG');
        window.eczCodeGraph.graphGlobalOptions.alwaysSkipCoseLayout =
            ! window.eczCodeGraph.graphGlobalOptions.alwaysSkipCoseLayout;
    };
    console.info('Type eczcodegraphdebug() to enable visual DEBUG mode!');
});
