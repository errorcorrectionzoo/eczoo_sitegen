/* eslint-disable react/prop-types */

import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.ui');

import loMerge from 'lodash/merge.js';

import React, { useEffect, useState, useRef, useLayoutEffect, useId } from 'react';

import cytoscape from 'cytoscape';
import cySvg from 'cytoscape-svg';
cytoscape.use( cySvg );


import { CodeGraphInformationPane } from './CodeGraphInformationPane.jsx';

import './codegraph_style.scss';



export function ui_getMergedDisplayOptions(modeWithOptionsA, modeWithOptionsB)
{
    let preventMergeArrays = {};
    if (modeWithOptionsB?.modeIsolateNodesOptions?.nodeIds) {
        // prevent merging the arrays by setting the nodeIds to null first
        preventMergeArrays = { modeIsolateNodesOptions: { nodeIds: null } };
    }
    return loMerge(
        {},
        modeWithOptionsA,
        preventMergeArrays,
        modeWithOptionsB,
    );
}



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
        domainColoring, onChangeDomainColoring,
        cousinEdgesShown, onChangeCousinEdgesShown,
        secondaryParentEdgesShown, onChangeSecondaryParentEdgesShown,
        displayModeWithOptions, onChangeDisplayModeWithOptions,
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

    let [ modeIsolateNodesDisplayRange, setModeIsolateNodesDisplayRange ] = useState(
        displayModeWithOptions.modeIsolateNodesOptions.range.parents.primary
    );
    useEffect( () => {
        // Here we assume that the range isn't modified outside of this
        // component.  If that assumption is no longer true, then we need to
        // make sure we keep the present state up to date.
        onChangeDisplayModeWithOptions({
            modeIsolateNodesOptions: {
                range: {
                    parents: {
                        primary: Math.round(modeIsolateNodesDisplayRange),
                    },
                    children: {
                        primary: Math.round(modeIsolateNodesDisplayRange/2),
                    },
                },
            }
        });
    }, [ modeIsolateNodesDisplayRange, onChangeDisplayModeWithOptions ] );

    let [ modeIsolateNodesAddSecondary, setModeIsolateNodesAddSecondary ] = useState(
        displayModeWithOptions.modeIsolateNodesOptions.range.parents.secondary !== 0
    );
    useEffect( () => {
        // Here we assume that the range isn't modified outside of this
        // component.  If that assumption is no longer true, then we need to
        // make sure we keep the present state up to date.
        const secondaryRange = modeIsolateNodesAddSecondary ? 1 : 0;
        onChangeDisplayModeWithOptions({
            modeIsolateNodesOptions: {
                range: {
                    parents: {
                        secondary: secondaryRange,
                    },
                    children: {
                        secondary: secondaryRange,
                    },
                },
            }
        });
    }, [ modeIsolateNodesAddSecondary, onChangeDisplayModeWithOptions ] );

    let [ searchGraphNodesText, setSearchGraphNodesText ] = useState('');
    useEffect( () => {
        cy.nodes().removeClass(['highlight', 'dimmed']);
        if (searchGraphNodesText !== '') {
            //const eles = cy.nodes(`[label @*= ${JSON.stringify(searchGraphNodesText)}]`);
            const eles = eczCodeGraph.search({text: searchGraphNodesText});
            eles.addClass('highlight');
            cy.stop();
            cy.animate({
                fit: {
                    eles,
                },
                duration: 80,
            })
            cy.elements().not('.highlight').addClass('dimmed');
            
        }
    }, [ searchGraphNodesText, cy, eczCodeGraph ] );

    // install events originating from cy itself (e.g. mouse scroll & zoom)
    const cyUserViewportEventNames = 'viewport'; //pinchzoom scrollzoom dragpan';
    useEffect( () => {
        const cyUserViewportEventHandler = (/*event*/) => {
            if (cy.zoom() != zoomLevel) {
                setZoomLevel(cy.zoom());
            }
        };
        cy.on(cyUserViewportEventNames, cyUserViewportEventHandler);
        return () => {
            cy.removeListener(cyUserViewportEventNames, cyUserViewportEventHandler);
        }
    }, [ eczCodeGraph, cy, zoomLevel ]); // run ONCE only for the given code graph!

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
        if (displayModeWithOptions.displayMode === 'all') {
            // all ok
        } else if (displayModeWithOptions.displayMode === 'isolate-nodes') {
            nodes = cy.collection();
            for (const nodeId of displayModeWithOptions.modeIsolateNodesOptions.nodeIds) {
                nodes.merge( cy.getElementById(nodeId) );
            }
        } else {
            throw new Error(`can't center, don't know display mode = `,
                            displayModeWithOptions);
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
        onChangeDisplayModeWithOptions({
            displayMode: 'all',
        });
    };
    const doModeIsolateRelayout = () => {
        onChangeDisplayModeWithOptions({
            modeIsolateNodesOptions: {
                redoLayout: true,
            },
        });
    };
    const doModeIsolateZoomDomains = () => {
        const domainNodeIds = cy.nodes('[_isDomain=1]').map( (n) => n.id() );
        onChangeDisplayModeWithOptions({
            displayMode: 'isolate-nodes',
            modeIsolateNodesOptions: {
                nodeIds: domainNodeIds,
            },
        });
    };

    const doSearchGraphNodes = (searchText) => {
        setSearchGraphNodesText(searchText);
    };
    const doClearSearchGraphNodes = () => {
        setSearchGraphNodesText('');
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
        function promiseBlobToDataUrl(blob) {
            return new Promise(r => {let a = new FileReader(); a.onload=r; a.readAsDataURL(blob)}).then(e => e.target.result);
        }
          
        let dataUrl = await promiseBlobToDataUrl(dataBlob);
        //debug(`Export data: `, {dataBlob, dataUrl});

        let aNode = window.document.createElement("a");
        aNode.setAttribute("href", dataUrl);

        aNode.setAttribute("download", `Error_Correction_Zoo_Code_Graph${fnameExt}`);
        aNode.click();
    };

    const toggleControls = (/*event*/) => {
        const el = rootFieldsetRef.current;
        el.classList.toggle('state-hide-controls');
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
                <button onClick={toggleControls}>more…</button>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Display</legend>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_domainColoring"
                        checked={domainColoring}
                        onChange={ (ev) => onChangeDomainColoring(!! ev.target.checked) }
                    />
                    <label htmlFor="input_domainColoring">domain colors</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_cousinEdgesShown"
                        checked={cousinEdgesShown}
                        onChange={ (ev) => onChangeCousinEdgesShown(!! ev.target.checked) }
                    />
                    <label htmlFor="input_cousinEdgesShown">cousins</label>
                </span>
                <span className="controls-input-group">
                    <input type="checkbox"
                        id="input_secondaryParentEdgesShown"
                        checked={secondaryParentEdgesShown}
                        onChange={ (ev) =>
                            onChangeSecondaryParentEdgesShown(!! ev.target.checked) }
                    />
                    <label htmlFor="input_secondaryParentEdgesShown">secondary parents</label>
                </span>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Isolation</legend>
                <button
                    disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                    onClick={doModeIsolateExit}>home</button>
                <span className="controls-input-sep"></span>
                <button
                    onClick={doModeIsolateZoomDomains}>zoom domains</button>
                <span className="controls-input-sep"></span>
                <button
                    disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                    onClick={doModeIsolateRelayout}>relayout</button>
                <span className="controls-input-break"></span>
                <span className="controls-input-group">
                    <label htmlFor="input_modeIsolateNodesDisplayRange">tree:</label>
                    <input type="range"
                           id="input_modeIsolateNodesDisplayRange"
                           disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                           min={0}
                           max={16}
                           step={1}
                           value={modeIsolateNodesDisplayRange}
                           onChange={(ev) =>
                               setModeIsolateNodesDisplayRange(parseFloat(ev.target.value))
                           }
                    />
                </span>
                <span className="controls-input-sep"></span>
                <span className="controls-input-group">
                    <input type="checkbox"
                           id="input_modeIsolateNodesAddSecondary"
                           disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                           checked={modeIsolateNodesAddSecondary}
                           onChange={ (ev) =>
                               setModeIsolateNodesAddSecondary(!! ev.target.checked) }
                    />
                    <label htmlFor="input_modeIsolateNodesAddSecondary">expand with secondary step</label>
                </span>
            </fieldset>
            <fieldset className="controls-input-advanced-fieldset">
                <legend>Search</legend>
                <input type="text"
                       id="input_searchGraphNodes"
                       placeholder="type to search"
                       value={ searchGraphNodesText }
                       onChange={ (ev) =>
                           doSearchGraphNodes(ev.target.value) }
                />
                <button onClick={() => doClearSearchGraphNodes()}>clear</button>
            </fieldset>
            <DownloadSnapshotControls
                onDownloadSnapshot={doDownloadSnapshot}
                bgColor={eczCodeGraph.bgColor}
                />
        </fieldset>
    );
}



export function EczCodeGraphComponent(props)
{
    const {
        eczCodeGraph,
        matchWebPageFonts,
        onLayoutDone,
    } = props;
    
    const eczoodb = eczCodeGraph.eczoodb;

    //
    // React HOOKS
    //

    let cyDomNodeRef = useRef(null);
    let cyPanelDomNodeRef = useRef(null);

    // This flag stores whether we have performed initial initialization on the cytoscape graph to
    // integrate the object into the DOM & set up callbacks.  Only after we did this initialization
    // will we start setting the graph state etc. to avoid running layouts twice, etc.
    let [cyUiInitialized, setCyUiInitialized] = useState(false);

    // UI state. Code selected/isolated, etc.

    let uiState = {};

    [ uiState.domainColoring, uiState.setDomainColoring ] = useState(
        false //eczCodeGraph.domainColoring()
    );
    useEffect( () => {
        if (!cyUiInitialized) {
            return;
        }
        //eczCodeGraph.setDomainColoring(uiState.domainColoring);
    }, [ cyUiInitialized, uiState.domainColoring ] );

    [ uiState.cousinEdgesShown, uiState.setCousinEdgesShown ] = useState(
        false // eczCodeGraph.cousinEdgesShown()
    );
    useEffect( () => {
        if (!cyUiInitialized) {
            return;
        }
        //eczCodeGraph.setCousinEdgesShown(uiState.cousinEdgesShown);
    }, [ cyUiInitialized, uiState.cousinEdgesShown ] );

    [ uiState.secondaryParentEdgesShown, uiState.setSecondaryParentEdgesShown ] = useState(
        false // eczCodeGraph.secondaryParentEdgesShown()
    );
    useEffect( () => {
        if (!cyUiInitialized) {
            return;
        }
        //eczCodeGraph.setSecondaryParentEdgesShown(uiState.secondaryParentEdgesShown);
    }, [ cyUiInitialized, uiState.secondaryParentEdgesShown ] );

    [ uiState.displayModeWithOptions, uiState.setDisplayModeWithOptions ] = useState({
        displayMode: null, // eczCodeGraph.displayMode(),
        modeIsolateNodesOptions: {
            range: {
                parents: { primary: 5, secondary: 5},
                children: { primary: 5, secondary: 5 }
            }
        } //eczCodeGraph.modeIsolateNodesOptions(),
    });
    useEffect( () => {
        if (!cyUiInitialized) {
            return;
        }
        const runSetDisplayModeAndLayout = async () => {
            debug(`Updating graph's displayMode&Options -> `, uiState.displayModeWithOptions);
            // const displaySettingChanged = eczCodeGraph.setDisplayMode(
            //     uiState.displayModeWithOptions.displayMode,
            //     uiState.displayModeWithOptions,
            // );
            if (true) { //displaySettingChanged) {
                await eczCodeGraph.updateLayout({
                    animate: true,
                });
                onLayoutDone?.();
            }
        };
        //runSetDisplayModeAndLayout();
    }, [ cyUiInitialized, uiState.displayModeWithOptions ] );


    // --------------------------------


    const doUserSelection = ({ nodeId, codeId, kingdomId, domainId, background }) => {
        if (background) {
            uiState.setDisplayModeWithOptions(
                ui_getMergedDisplayOptions(
                    uiState.displayModeWithOptions,
                    {
                        displayMode: 'all',
                    }
                )
            );
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

        uiState.setDisplayModeWithOptions(
            ui_getMergedDisplayOptions(
                uiState.displayModeWithOptions,
                {
                    displayMode: 'isolate-nodes',
                    modeIsolateNodesOptions: {
                        nodeIds: [ nodeId ],
                        redoLayout: false,
                        // will merge remaining options with preexisting ones
                    },
                }
            )
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

    // cytoscape initialization & graph event callbacks (e.g. "tap")

    let doInitializeCy = async () => {

        debug('ui: doInitializeCy()');

        eczCodeGraph.mountInDom(cyDomNodeRef.current, {
            styleOptions: { matchWebPageFonts, window, },
        });

        const tapEventHandlerFn = (eventTarget) => {

            if ( ! eventTarget || ! eventTarget.isNode ) {
                // tap on an edge or on the background -- hide info pane
                debug('Unknown or non-node tap target.');
                doUserSelection({ background: true });
                return;
            }

            if ( eventTarget.isEdge() ) {
                // handle edge click
                let cy = eczCodeGraph.cy;
                cy.animate({
                    fit: {
                        eles: eventTarget,
                        padding: Math.min(cy.width(), cy.height()) / 6,
                    },
                });
                return;
            }

            if ( eventTarget.isNode() ) {
                const node = eventTarget;
                debug(`Tapped node ${node.id()}`);
                doUserSelection({ nodeId: node.id() });
                return;
            }

            debug('Unknown click target ??!');
            return;
        };

        eczCodeGraph.cy.on('tap', (event) => {

            // target holds a reference to the originator
            // of the event (core or element)

            const eventTarget = event.target;
            debug('Tap! eventTarget = ', eventTarget);

            try {

                tapEventHandlerFn(eventTarget);

            } catch (err) {
                console.error(`Error (will ignore) while handling cytoscape canvas tap: `, err);
                return;
            }
        });

        // perform initial layout
        await eczCodeGraph.updateLayout({
            animate: true,
        });

        onLayoutDone?.();

        setCyUiInitialized(true);
    };

    useLayoutEffect( () => {
        if (!cyUiInitialized) {
            doInitializeCy();
        }
    }, [ cyUiInitialized ] );

    //
    // Render components
    //

    debug(`Rendering components. displayModeWithOptions=`, uiState.displayModeWithOptions);

    let currentCodeSelected = null;
    let currentDomainSelected = null;
    let currentKingdomSelected = null;
    if (uiState.displayModeWithOptions.displayMode === 'isolate-nodes') {
        const { nodeIds } = uiState.displayModeWithOptions.modeIsolateNodesOptions;
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
                    displayModeWithOptions={uiState.displayModeWithOptions}
                    onChangeDisplayModeWithOptions={
                        (newModeWithOptions) => {
                            debug(`request to set display options -> `, newModeWithOptions);
                            // uiState.setDisplayModeWithOptions(
                            //     ui_getMergedDisplayOptions(
                            //         uiState.displayModeWithOptions,
                            //         newModeWithOptions,
                            //     )
                            // );
                        }
                    }
                    domainColoring={ uiState.domainColoring }
                    onChangeDomainColoring={ uiState.setDomainColoring }
                    cousinEdgesShown={ uiState.cousinEdgesShown }
                    onChangeCousinEdgesShown={ uiState.setCousinEdgesShown }
                    secondaryParentEdgesShown={ uiState.secondaryParentEdgesShown }
                    onChangeSecondaryParentEdgesShown={ uiState.setSecondaryParentEdgesShown }
                />
                <CodeGraphInformationPane
                    eczoodb={eczoodb}
                    currentCodeSelected={currentCodeSelected}
                    currentDomainSelected={currentDomainSelected}
                    currentKingdomSelected={currentKingdomSelected}
                    captureLinksToObjectTypes={['code', 'domain', 'kingdom']}
                    onLinkToObjectActivated={ (objectType, objectId) => {
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
                    } }
                />
            </div>
        </div>
    );

    debug('Rendered graph component');

    return rendered;
}
