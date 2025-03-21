/* eslint-disable react/prop-types */

import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.ui');

import { Action } from 'history';

import loMerge from 'lodash/merge.js';
import loIsEqual from 'lodash/isEqual.js';

import React, { useEffect, useState, useRef, useLayoutEffect, useId, useCallback } from 'react';

import cytoscape from 'cytoscape';
import cySvg from 'cytoscape-svg';
cytoscape.use( cySvg );

import { EczCodeGraphViewController } from './eczcodegraphviewcontroller.js';
import { CodeGraphInformationPane } from './CodeGraphInformationPane.jsx';

import './codegraph_style.scss';




function DownloadSnapshotControls(props)
{
    const { onDownloadSnapshot, bgColor } = props;

    let [isFull, setFull] = useState(true);
    let [isBgOn, setBgOn] = useState(false);

    const htmlIdFull = useId();
    const htmlIdBgOn = useId();

    const doDownload = (format) => {
        onDownloadSnapshot({ format, full: isFull, bg: isBgOn ? bgColor : null });
    };

    return (
        <fieldset className="controls-input-advanced-fieldset">
            <legend>Snapshot</legend>
            <span className="controls-input-group">
                <input type="checkbox" id={htmlIdFull} checked={isFull} onChange={(e) => setFull(e.target.checked)}></input>
                <label htmlFor={htmlIdFull}>full graph</label>
                <input type="checkbox" id={htmlIdBgOn} checked={isBgOn} onChange={(e) => setBgOn(e.target.checked)}></input>
                <label htmlFor={htmlIdBgOn}>background</label>
            </span>
            <span className="controls-input-sep"></span>
            <span className="controls-input-group">
                <button onClick={() => doDownload('svg')}>SVG</button>
                <button onClick={() => doDownload('png')}>PNG</button>
            </span>
        </fieldset>
    );
}


const zoomStep = 1.2;

export function EczCodeGraphControlsComponent(props)
{
    //
    // Props
    //
    const {
        eczCodeGraph,
        displayOptionsState,
        mergeSetDisplayOptionsState,
        history, uiHistoryControl,
    } = props;
    let cy = eczCodeGraph.cy;

    //
    // Hooks
    //

    let [zoomLevel, setZoomLevel] = useState( cy.zoom() );
    useEffect( () => {
        if (zoomLevel != cy.zoom()) {
            cy.zoom({ level: zoomLevel,
                      renderedPosition: { x: cy.width()/2, y: cy.height()/2 } });
        }
    }, [zoomLevel, cy] );

    const modeIsolateNodesDisplayRange =
        displayOptionsState.modeIsolateNodesOptions.range.parents.primary;
    const getModeIsolateNodesDisplayRangeOptions = (newRange) => {
        const rng = Math.round(newRange);
        const halfrng = Math.round(newRange/2);
        return {
            modeIsolateNodesOptions: {
                range: {
                    parents: {
                        primary: rng,
                        secondary: rng,
                    },
                    children: {
                        primary: halfrng,
                        secondary: halfrng,
                    },
                },
                reusePreviousLayoutPositions: true,
            }
        };
    };

    const modeIsolateNodesAddExtra =
        (displayOptionsState.modeIsolateNodesOptions.range.parents.extra !== 0);
    const getModeIsolateNodesAddExtraOptions = (addExtra) => {
        const extraRange = addExtra ? 1 : 0;
        return {
            modeIsolateNodesOptions: {
                range: {
                    parents: {
                        extra: extraRange,
                    },
                    children: {
                        extra: extraRange,
                    },
                },
                reusePreviousLayoutPositions: true,
            }
        };
    };

    // install events originating from cy itself (e.g. mouse scroll & zoom)
    const cyUserViewportEventNames = 'viewport'; //pinchzoom scrollzoom dragpan';
    useEffect( () => {
        const cyUserViewportEventHandler = (event_) => {
            if (cy.zoom() != zoomLevel) {
                setZoomLevel(cy.zoom());
            }
        };
        cy.on(cyUserViewportEventNames, cyUserViewportEventHandler);
        return () => {
            cy.removeListener(cyUserViewportEventNames, cyUserViewportEventHandler);
        }
    }, [ eczCodeGraph, cy, zoomLevel ]);

    const rootFieldsetRef = useRef(null);

    //
    // Callbacks
    //

    const doSetZoomLevel = (level) => {
        setZoomLevel( level );
    };
    const doZoomIn = () => {
        setZoomLevel( zoomLevel * zoomStep );
    };
    const doZoomOut = () => {
        setZoomLevel( zoomLevel / zoomStep );
    };
    const doZoomFit = () => {
        cy.animate({
            fit: true
        });
        setZoomLevel( cy.zoom() );
    }
    const doCenter = () => {
        let nodes = cy.nodes();
        if (displayOptionsState.displayMode === 'all') {
            // all ok
        } else if (displayOptionsState.displayMode === 'isolate-nodes') {
            nodes = cy.collection();
            for (const nodeId of displayOptionsState.modeIsolateNodesOptions.nodeIds) {
                nodes.merge( cy.getElementById(nodeId) );
            }
        } else {
            throw new Error(`can't center, don't know display mode = `,
                            displayOptionsState);
        }
        cy.animate({
            center: {
                eles: nodes,
            },
        }, {
            duration: 200
        });
    };
    const doModeIsolateExit = () => {
        mergeSetDisplayOptionsState({
            displayMode: 'all',
        }, { pushNewHistoryState: true });
    };
    const doModeIsolateRelayout = () => {
        mergeSetDisplayOptionsState({
            modeIsolateNodesOptions: {
                reusePreviousLayoutPositions: false,
            },
        });
    };
    const doModeIsolateZoomDomains = () => {
        const domainNodeIds = cy.nodes('[_isDomain=1]').map( (n) => n.id() );
        mergeSetDisplayOptionsState({
            displayMode: 'isolate-nodes',
            modeIsolateNodesOptions: {
                nodeIds: domainNodeIds,
            },
        }, { pushNewHistoryState: true });
    };

    const doClearSearchHighlightText = () => {
        mergeSetDisplayOptionsState({
            searchHighlightText: null
        })
    };

    const doDownloadSnapshot = async ({ format, full, scale, bg, pngOptions, svgOptions}) => {

        let fnameExt = '';

        let dataBlob = null;

        const commonOptions = {
            full: full ?? false,
            scale: scale ?? undefined,
            bg: bg ?? undefined,
        };

        if (format === 'svg') {

            const svgString = eczCodeGraph.cy.svg(loMerge({}, commonOptions, svgOptions));

            dataBlob = new Blob([svgString], { type: 'image/svg+xml' });
            fnameExt = '.svg';

        } else if (format === 'png') {

            fnameExt = '.png';
            dataBlob = eczCodeGraph.cy.png(loMerge({
                output: 'blob',
            }, commonOptions, pngOptions));

        } else {
            throw new Error(`Invalid graph snapshot format: ${format}`);
        }

        // create data URL and download. Argh this is ugly.
        // https://stackoverflow.com/a/71860718/1694896
        async function promiseBlobToDataUrl(blob) {
            const e = await new Promise( (resolve) => {
                let a = new FileReader();
                a.onload = resolve;
                a.readAsDataURL(blob);
            });
            return e.target.result;
        }
          
        let dataUrl = await promiseBlobToDataUrl(dataBlob);
        //debug(`Export data: `, {dataBlob, dataUrl});

        let aNode = window.document.createElement("a");
        aNode.setAttribute("href", dataUrl);

        aNode.setAttribute("download", `Error_Correction_Zoo_Code_Graph${fnameExt}`);
        aNode.click();
    };

    // ------------

    // history controls
    let historyControls = [];
    if (history != null) {
        const canGoBack = uiHistoryControl?.canGoBack ?? false;
        const canGoForward = uiHistoryControl?.canGoForward ?? false;
        historyControls = [
            (<button key="btnBack"
                disabled={!canGoBack}
                onClick={() => history.back()}>◀</button>),
            (<button key="btnForward"
                disabled={!canGoForward}
                onClick={() => history.forward()}>▶</button>),
            (<span key="btnHistSep" className="controls-input-sep"></span>),
        ];
    }

    // ------------

    const toggleControlsButtonLabel = {
        [false]: 'more…',
        [true]: 'show less',
    };
    const toggleControls = (event) => {
        const el = rootFieldsetRef.current;
        const isCurrentlyOn = ! el.classList.contains('state-hide-controls');
        el.classList.toggle('state-hide-controls', isCurrentlyOn);
        event.target.innerText = toggleControlsButtonLabel[!isCurrentlyOn];
    };

    return (
        <fieldset ref={rootFieldsetRef} className="EczCodeGraphControlsComponent state-hide-controls">
            <fieldset>
                <legend>View</legend>
                <input type="range"
                       min={-2.3}
                       max={2.3}
                       step={0.01}
                       value={Math.log(zoomLevel)}
                       onChange={ (ev) =>
                           doSetZoomLevel(Math.exp(parseFloat(ev.target.value))) }
                />
                <span className="controls-input-group">
                    <button onClick={doZoomIn}>+</button>
                    <button onClick={doZoomOut}>-</button>
                    <button onClick={doCenter}>center</button>
                    <button onClick={doZoomFit}>fit</button>
                </span>
                <span className="controls-input-sep"></span>
                <button onClick={toggleControls}>{
                    toggleControlsButtonLabel[false]
                }</button>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Isolation</legend>
                <button
                    disabled={displayOptionsState.displayMode === 'all'}
                    onClick={doModeIsolateExit}>🏠</button>
                <span className="controls-input-sep"></span>
                {historyControls}
                <button
                    onClick={doModeIsolateZoomDomains}>zoom domains</button>
                <span className="controls-input-sep"></span>
                <button
                    disabled={displayOptionsState.displayMode !== 'isolate-nodes'}
                    onClick={doModeIsolateRelayout}>relayout</button>
                <span className="controls-input-break"></span>
                <span className="controls-input-group">
                    <label htmlFor="input_modeIsolateNodesDisplayRange">tree:</label>
                    <input type="range"
                           id="input_modeIsolateNodesDisplayRange"
                           disabled={displayOptionsState.displayMode !== 'isolate-nodes'}
                           min={0}
                           max={16}
                           step={1}
                           value={modeIsolateNodesDisplayRange}
                           onChange={(ev) => mergeSetDisplayOptionsState(
                               getModeIsolateNodesDisplayRangeOptions(parseFloat(ev.target.value))
                           )}
                    />
                </span>
                <span className="controls-input-sep"></span>
                <span className="controls-input-group">
                    <input type="checkbox"
                           id="input_modeIsolateNodesAddExtra"
                           disabled={displayOptionsState.displayMode !== 'isolate-nodes'}
                           checked={modeIsolateNodesAddExtra}
                           onChange={ (ev) => mergeSetDisplayOptionsState(
                               getModeIsolateNodesAddExtraOptions( !! ev.target.checked )
                           ) }
                    />
                    <label htmlFor="input_modeIsolateNodesAddExtra">include neighbors</label>
                </span>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Search</legend>
                <input type="text"
                       id="input_searchGraphNodes"
                       placeholder="type to search"
                       value={ displayOptionsState.searchHighlightText || '' }
                       onChange={ (ev) => mergeSetDisplayOptionsState({
                           searchHighlightText: ev.target.value
                       }) }
                />
                <button onClick={() => doClearSearchHighlightText()}>clear</button>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Display</legend>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_domainColoring"
                        checked={displayOptionsState.domainColoring}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            domainColoring: !! ev.target.checked
                        }) }
                    />
                    <label htmlFor="input_domainColoring">domain colors</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_cousinEdgesShown"
                        checked={displayOptionsState.cousinEdgesShown}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            cousinEdgesShown: !! ev.target.checked
                        }) }
                    />
                    <label htmlFor="input_cousinEdgesShown">all cousins</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_secondaryParentEdgesShown"
                        checked={displayOptionsState.secondaryParentEdgesShown}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            secondaryParentEdgesShown: !! ev.target.checked
                        }) }
                    />
                    <label htmlFor="input_secondaryParentEdgesShown">all parents</label>
                </span>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Visual Aids</legend>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_highlightImportantNodes"
                        checked={displayOptionsState.highlightImportantNodes.highlightImportantNodes}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            highlightImportantNodes: { highlightImportantNodes: !! ev.target.checked }
                        }) }
                    />
                    <label htmlFor="input_highlightImportantNodes">highlight high-degree nodes</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_highlightPrimaryParents"
                        checked={displayOptionsState.highlightImportantNodes.highlightPrimaryParents}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            highlightImportantNodes: { highlightPrimaryParents: !! ev.target.checked }
                        }) }
                    />
                    <label htmlFor="input_highlightPrimaryParents">fade secondary parents</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_highlightRootConnectingEdges"
                        checked={displayOptionsState.highlightImportantNodes.highlightRootConnectingEdges}
                        onChange={ (ev) => mergeSetDisplayOptionsState({
                            highlightImportantNodes: {
                                highlightRootConnectingEdges: !! ev.target.checked
                            }
                        }) }
                    />
                    <label htmlFor="input_highlightRootConnectingEdges">selected code’s relations</label>
                </span>
            </fieldset>
            <DownloadSnapshotControls
                onDownloadSnapshot={doDownloadSnapshot}
                bgColor={eczCodeGraph.bgColor}
                />
        </fieldset>
    );
}




export function useCyDomMountedEczCodeGraph(mountSetting)
{
    const {
        eczCodeGraph,
        // cyDomNodeRef,
        // matchWebPageFonts,
        // window,
    } = mountSetting;

    const [ cyDomMountedForMountSetting, setCyDomMountedForMountSetting ] = useState({});

    const needMount = ! loIsEqual(mountSetting, cyDomMountedForMountSetting);
    
    debug(`useCyDomMountedEczCodeGraph(). eczCodeGraph.mountedDomNode = `,
          eczCodeGraph.mountedDomNode, `.  Debug: `,
          { mountSetting, cyDomMountedForMountSetting, needMount });

    // cytoscape initialization: make sure it's installed in the DOM correctly

    useLayoutEffect( () => {
        // debug(`Do we need to mount the code graph in the DOM? -> `, { needMount, mountSetting, cyDomMountedForMountSetting });
        if ( needMount ) {
            // access eczCodeGraph, cyDomNode via mountSetting. explicitly to facilitate
            // tracking the layout effect dependencies
            mountSetting.eczCodeGraph.mountInDom(mountSetting.cyDomNodeRef.current, {
                styleOptions: {
                    matchWebPageFonts: mountSetting.matchWebPageFonts,
                    window: mountSetting.window,
                },
            });
            setCyDomMountedForMountSetting( mountSetting );
        }
    }, [ mountSetting, cyDomMountedForMountSetting, needMount ] );

    return {
        cyDomIsMounted: !needMount,
    };
}


export function EczCodeGraphComponent(props)
{
    const {
        eczCodeGraph,
        eczCodeGraphViewController,
        matchWebPageFonts,
        onLayoutDone,
        history, // to manage app state history / browser back/forward buttons
    } = props;
    
    const eczoodb = eczCodeGraph.eczoodb;

    debug(`EczCodeGraphComponent render!`);

    //
    // React HOOKS
    //

    let cyDomNodeRef = useRef(null);
    let cyPanelDomNodeRef = useRef(null);

    const { cyDomIsMounted } = useCyDomMountedEczCodeGraph({
        eczCodeGraph,
        cyDomNodeRef,
        matchWebPageFonts,
        window
    });

    debug(`cyDomIsMounted = ${cyDomIsMounted}`);

    // UI state. Code selected/isolated, etc.

    let [ displayOptionsState, setDisplayOptionsState ] = useState(
        eczCodeGraphViewController?.displayOptions
    );
    const mergeSetDisplayOptionsState = useCallback(
        (displayOptions, { pushNewHistoryState }={}) => {
            setDisplayOptionsState(
                (oldDisplayOptions) => {
                    const newDisplayOptions = EczCodeGraphViewController.getMergedDisplayOptions(
                        oldDisplayOptions,
                        displayOptions
                    );
                    if (history != null && pushNewHistoryState) {
                        // mark the current state as being one where we can navigate forward
                        const currentReplaceHistoryState = loMerge(
                            {},
                            history.location.state,
                            {
                                uiHistoryControl: {
                                    canGoForward: true,
                                },
                            }
                        )
                        history.replace(history.location, currentReplaceHistoryState);
                        // now, push the new state.
                        const newHistoryState = {
                            displayOptionsState: newDisplayOptions,
                            uiHistoryControl: {
                                canGoBack: true,
                                canGoForward: false,
                            },
                        };
                        debug(`history.push(), newHistoryState =`, newHistoryState);
                        history.push(history.location, newHistoryState);
                        debug(`history.push() done`);
                    }
                    return newDisplayOptions;
                }
            );
        },
        [ setDisplayOptionsState, history ]
    );

    // DEBUG: enable user to set displayOptionsState directly in the JS console!
    window.eczCodeGraphUiMergeSetDisplayOptions = mergeSetDisplayOptionsState;

    useEffect( () => {
        if (!cyDomIsMounted) {
            return;
        }

        debug(`UI - setting displayOptions state, then will possibly recalculate layout`);

        eczCodeGraphViewController?.setDisplayOptions(displayOptionsState);

        let flagCancelledUpdateLayoutNotification = { didCancel: false };

        if (eczCodeGraph.isPendingUpdateLayout()) {
            (async () => {
                await eczCodeGraph.updateLayout({
                    //animate: false // DEBUG DEBUG
                });
                if (flagCancelledUpdateLayoutNotification.didCancel) {
                    return;
                }
                onLayoutDone?.();
            })();
        }

        return () => { flagCancelledUpdateLayoutNotification.didCancel = true; }

    }, [ eczCodeGraphViewController, eczCodeGraph, cyDomIsMounted, displayOptionsState, onLayoutDone ] );


    // -- set up app state history tracking (e.g. browser back/forward buttons) --

    useEffect( () => {
        // Make sure the current history state is up-to-date with the current displayOptionsState.
        if ( history != null &&
             ! loIsEqual(displayOptionsState, history.location?.state?.displayOptionsState) ) {
            const replaceCurrentHistoryState = Object.assign(
                {},
                history.location.state,
                {
                    displayOptionsState,
                }
            );
            debug(`Updating our history.state to our display state.`, { displayOptionsState });
            history.replace(history.location, replaceCurrentHistoryState);
            debug(`history.replace done.`);
        } else {
            debug(`No history.replace() update necessary at this point`);
        }
    }, [ history, displayOptionsState ] );

    useEffect( () => {
        if (history == null) {
            return;
        }
        const unlisten = history.listen( ({ location, action }) => {
            debug(`history navigation event: `, { location, action, test_history_Action_Pop: Action.Pop });
            if (action === Action.Pop) {
                debug(`Is a history pop event! `, { location, action });
                // the user navigated to this state - update the UI to the relevant state
                mergeSetDisplayOptionsState(
                    location.state?.displayOptionsState,
                );
                debug(`Is a history pop event, finished setting merged display options.`);
            } else {
                debug(`Not a navigation event, nothing to do `, { location, action });
            }
        } );
        return () => {
            debug(`Un-registering history listener ...`);
            unlisten();
        };
    }, [ history, mergeSetDisplayOptionsState ] );

    // --------------------------------

    const doUserSelection = ({ nodeId, edgeId, codeId, kingdomId, domainId, background, eventTarget }) =>
    {
        if (background) {
            mergeSetDisplayOptionsState({
                displayMode: 'all',
            }, { pushNewHistoryState: true });
            return;
        }

        if (edgeId != null) {
            // clicked on an edge - zoom to show it
            let cy = eczCodeGraph.cy;
            cy.animate({
                fit: {
                    eles: eventTarget,
                    padding: Math.min(cy.width(), cy.height()) / 6,
                },
            });
            return;
        }

        if (domainId) {
            nodeId = eczCodeGraph.getNodeIdDomain(domainId);
        }
        if (kingdomId) {
            nodeId = eczCodeGraph.getNodeIdKingdom(kingdomId);
        }
        if (codeId) {
            nodeId = eczCodeGraph.getNodeIdCode(codeId);
        }

        debug(`Graph selected`, { nodeId });

        mergeSetDisplayOptionsState({
                displayMode: 'isolate-nodes',
                modeIsolateNodesOptions: {
                    nodeIds: [ nodeId ],
                    reusePreviousLayoutPositions: true,
                    // will merge remaining options with preexisting ones
                },
            },
            { pushNewHistoryState: true }
        );
        
        const cy = eczCodeGraph.cy;
        const node = cy.getElementById(nodeId);
        let nodeRenderedPosition = node.renderedPosition();
        if (nodeRenderedPosition.x < 0 || nodeRenderedPosition.y < 0 ||
             nodeRenderedPosition.x > cy.width() || nodeRenderedPosition.y > cy.height()) {
            cy.animate({
                center: {
                    eles: node,
                },
            }, {
                duration: 400
            });
        }
    };

    eczCodeGraph.setUserTapCallback(doUserSelection);

    const onLinkToObjectActivated = (objectType, objectId) => {
        debug('Link to object clicked: ', { objectType, objectId, });
        if (objectType === 'code') {
            doUserSelection({codeId: objectId});
        } else if (objectType === 'kingdom') {
            doUserSelection({kingdomId: objectId});
        } else if (objectType === 'domain') {
            doUserSelection({domainId: objectId});
        } else {
            throw new Error(
                `I don't know what to do with click on ${objectType}`
            );
        }
    };

    //
    // Render components
    //

    debug(`Rendering components. displayOptionsState =`, displayOptionsState);

    let currentCodeSelected = null;
    let currentDomainSelected = null;
    let currentKingdomSelected = null;
    if (displayOptionsState.displayMode === 'isolate-nodes') {
        const { nodeIds } = displayOptionsState.modeIsolateNodesOptions;
        if ( nodeIds && nodeIds.length === 1) {
            const nodeId = nodeIds[0];
            const nodeElementCyQuery = eczCodeGraph.cy.getElementById(nodeId);
            // careful in case nodeId is invalid.
            if (nodeElementCyQuery && nodeElementCyQuery.length) {
                const nodeElementData = nodeElementCyQuery.data();
                const codeId = nodeElementData._codeId;
                const domainId = nodeElementData._domainId;
                const kingdomId = nodeElementData._kingdomId;

                if (codeId != null) {
                    currentCodeSelected = eczoodb.objects.code[codeId];
                }
                if (domainId != null) {
                    currentDomainSelected = eczoodb.objects.domain[domainId];
                }
                if (kingdomId != null) {
                    currentKingdomSelected = eczoodb.objects.kingdom[kingdomId];
                }
            }
        }
    }

    let rendered = (
        <div className="EczCodeGraphComponent">
            <div ref={cyPanelDomNodeRef} className="EczCodeGraphComponent_CyPanel">
                <div ref={cyDomNodeRef} className="EczCodeGraphComponent_Cy"></div>
            </div>
            <div className="EczCodeGraphComponent_SidePanel">
                <EczCodeGraphControlsComponent
                    eczCodeGraph={eczCodeGraph}
                    displayOptionsState={displayOptionsState}
                    mergeSetDisplayOptionsState={mergeSetDisplayOptionsState}
                    history={history}
                    uiHistoryControl={history?.location?.state?.uiHistoryControl}
                />
                <CodeGraphInformationPane
                    eczoodb={eczoodb}
                    currentCodeSelected={currentCodeSelected}
                    currentDomainSelected={currentDomainSelected}
                    currentKingdomSelected={currentKingdomSelected}
                    captureLinksToObjectTypes={['code', 'domain', 'kingdom']}
                    onLinkToObjectActivated={onLinkToObjectActivated}
                />
            </div>
        </div>
    );

    debug('Rendered graph component');

    return rendered;
}
