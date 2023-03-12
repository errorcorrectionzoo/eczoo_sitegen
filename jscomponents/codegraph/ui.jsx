import debug_module from 'debug';
const debug = debug_module('eczoo_jscomponents.codegraph.ui');

import _ from 'lodash';

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';

import cytoscape from 'cytoscape';
import cySvg from 'cytoscape-svg';
cytoscape.use( cySvg );


import { CodeGraphInformationPane } from './CodeGraphInformationPane.jsx';

import './codegraph_style.scss';




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
    }, [zoomLevel] );

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
    }, [ modeIsolateNodesDisplayRange ] ); //, displayModeWithOptions ] );

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
    }, [ modeIsolateNodesAddSecondary ] ); //, displayModeWithOptions ] );

    let [ searchGraphNodesText, setSearchGraphNodesText ] = useState('');
    useEffect( () => {
        cy.nodes().removeClass(['highlight', 'dimmed']);
        if (searchGraphNodesText !== '') {
            const eles = cy.nodes(`[label @*= ${JSON.stringify(searchGraphNodesText)}]`);
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
    }, [ searchGraphNodesText ] );

    // install events originating from cy itself (e.g. mouse scroll & zoom)
    const cyUserViewportEventNames = 'viewport'; //pinchzoom scrollzoom dragpan';
    const cyUserViewportEventHandler = (event) => {
        if (cy.zoom() != zoomLevel) {
            setZoomLevel(cy.zoom());
        }
    };
    useEffect( () => {
        cy.on(cyUserViewportEventNames, cyUserViewportEventHandler);
        return () => {
            cy.removeListener(cyUserViewportEventNames, cyUserViewportEventHandler);
        }
    }, [ eczCodeGraph ]); // run ONCE only for the given code graph!

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

    const doSearchGraphNodes = (searchText) => {
        setSearchGraphNodesText(searchText);
    };
    const doClearSearchGraphNodes = () => {
        setSearchGraphNodesText('');
    };

    const doDownloadSvg = (options) => {
        const svgData = eczCodeGraph.cy.svg(options);

        let aNode = window.document.createElement("a");
        aNode.setAttribute("href", "data:image/svg+xml;base64,"+btoa(svgData));
        aNode.setAttribute("download", "Error_Correction_Zoo_Code_Graph.svg");
        aNode.click();
    };

    return (
        <div className="EczCodeGraphControlsComponent">
            <div>
                <input type="range"
                       min={-2.3}
                       max={2.3}
                       step={0.01}
                       value={Math.log(zoomLevel)}
                       onChange={ (ev) =>
                           doSetZoomLevel(Math.exp(parseFloat(ev.target.value))) }
                />
                <button onClick={doZoomIn}>+</button>
                <button onClick={doZoomOut}>-</button>
                <button
                    onClick={doCenter}
                >center</button>
                <button onClick={doZoomFit}>fit</button>
            </div>
            <div>
                <input type="checkbox"
                       id="input_domainColoring"
                       checked={domainColoring}
                       onChange={ (ev) => onChangeDomainColoring(!! ev.target.checked) }
                />
                <label htmlFor="input_domainColoring">domain colors</label>
                <input type="checkbox"
                       id="input_cousinEdgesShown"
                       checked={cousinEdgesShown}
                       onChange={ (ev) => onChangeCousinEdgesShown(!! ev.target.checked) }
                />
                <label htmlFor="input_cousinEdgesShown">cousins</label>
                <input type="checkbox"
                       id="input_secondaryParentEdgesShown"
                       checked={secondaryParentEdgesShown}
                       onChange={ (ev) =>
                           onChangeSecondaryParentEdgesShown(!! ev.target.checked) }
                />
                <label htmlFor="input_secondaryParentEdgesShown">secondary parents</label>
            </div>
            <div>
                <div>
                    <button
                        disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                        onClick={doModeIsolateExit}>back</button>
                    <button
                        disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                        onClick={doModeIsolateRelayout}>relayout</button>
                    <span> </span>
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
                </div>
                <div>
                    <input type="checkbox"
                           id="input_modeIsolateNodesAddSecondary"
                           disabled={displayModeWithOptions.displayMode !== 'isolate-nodes'}
                           checked={modeIsolateNodesAddSecondary}
                           onChange={ (ev) =>
                               setModeIsolateNodesAddSecondary(!! ev.target.checked) }
                    />
                    <label htmlFor="input_modeIsolateNodesAddSecondary">expand with secondary step</label>
                </div>
            </div>
            <div>
                <input type="text"
                       id="input_searchGraphNodes"
                       placeholder="search"
                       value={ searchGraphNodesText }
                       onChange={ (ev) =>
                           doSearchGraphNodes(ev.target.value) }
                />
                <button onClick={() => doClearSearchGraphNodes()}>clear</button>
            </div>
            <button onClick={() => doDownloadSvg({full: true})}>SVG full</button>
            <button onClick={() => doDownloadSvg({full: false})}>SVG snapshot</button>
        </div>
    );
            /*
            <input type="checkbox"
                   id="showCousins"
                   checked={showCousins}
                   onChange={(ev) => doShowCousins(!!ev.target.checked)} />
            <label htmlFor="showCousins">show cousins</label>
            <div>
                <input type="checkbox"
                       id="dim"
                       checked={!!dimDegreeOptions.enabled}
                       onChange={(ev) => doDim(!!ev.target.checked)} />
                <label htmlFor="dim">dim by degree:</label>
                <input type="range"
                       disabled={!dimDegreeOptions.enabled}
                       id="dimDegree"
                       min={0}
                       max={20}
                       step={1}
                       value={dimDegreeOptions.degree}
                       onChange={(ev) => dimDegree(ev.target.value)} />
                <input type="checkbox"
                       id="keepdimLeaf"
                       disabled={!dimDegreeOptions.enabled}
                       checked={!dimDegreeOptions.dimLeaf}
                       onChange={(ev) => dimLeaf(!ev.target.checked)} />
                <label htmlFor="keepdimLeaf">keep leaf nodes</label>
            </div>
        </div>
    ); */
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
    let [cyInitialized, setCyInitialized] = useState(false);

    // UI state. Code selected/isolated, etc.

    let uiState = {};

    [ uiState.domainColoring, uiState.setDomainColoring ] = useState(
        eczCodeGraph.domainColoring()
    );
    useEffect( () => {
        eczCodeGraph.setDomainColoring(uiState.domainColoring);
    }, [ uiState.domainColoring ] );

    [ uiState.cousinEdgesShown, uiState.setCousinEdgesShown ] = useState(
        eczCodeGraph.cousinEdgesShown()
    );
    useEffect( () => {
        eczCodeGraph.setCousinEdgesShown(uiState.cousinEdgesShown);
    }, [ uiState.cousinEdgesShown ] );

    [ uiState.secondaryParentEdgesShown, uiState.setSecondaryParentEdgesShown ] = useState(
        eczCodeGraph.secondaryParentEdgesShown()
    );
    useEffect( () => {
        eczCodeGraph.setSecondaryParentEdgesShown(uiState.secondaryParentEdgesShown);
    }, [ uiState.secondaryParentEdgesShown ] );

    [ uiState.displayModeWithOptions, uiState.setDisplayModeWithOptions ] = useState({
        displayMode: eczCodeGraph.displayMode(),
        modeIsolateNodesOptions: eczCodeGraph.modeIsolateNodesOptions(),
    });
    useEffect( () => {
        const runSetDisplayModeAndLayout = async () => {
            debug(`Updating graph's displayMode&Options -> `, uiState.displayModeWithOptions);
            eczCodeGraph.setDisplayMode(
                uiState.displayModeWithOptions.displayMode,
                uiState.displayModeWithOptions,
            );
            await eczCodeGraph.layout({
                animate: true,
            });
            onLayoutDone?.();
        };
        runSetDisplayModeAndLayout();
    }, [ uiState.displayModeWithOptions ] );

    

    // const resizeEventHandler = (event) => {
    //     debug(`Resize event, resizing Cy's panel to parent DOM element`);
    //     eczCodeGraph.cy.resize( );
    // };

    // useEffect( () => {
    //     resizeEventHandler();
    //     window.addEventListener('resize', resizeEventHandler);
    //     return () => { window.removeEventListener('resize', resizeEventHandler);
    // }, [ ]); // do once -- install resize event & synchronize CY size.


    // --------------------------------


    const doUserSelection = ({ nodeId, codeId, kingdomId, domainId, background }) => {
        if (background) {
            uiState.setDisplayModeWithOptions(
                _.merge({}, uiState.displayModeWithOptions, {
                    displayMode: 'all',
                })
            );
            return;
        }
        if (domainId) {
            nodeId = eczCodeGraph.getNodeIdDomain(domainId);
        }
        if (kingdomId) {
            codeId = eczoodb.objects.kingdom[kingdomId].kingdom_code.code_id;
            // set codeId, will set nodeId in next if() block
        }
        if (codeId) {
            nodeId = eczCodeGraph.getNodeIdCode(codeId);
        }

        uiState.setDisplayModeWithOptions(
            _.merge({}, uiState.displayModeWithOptions, {
                displayMode: 'isolate-nodes',
                modeIsolateNodesOptions: {
                    nodeIds: [ nodeId ],
                    redoLayout: false,
                    // will merge remaining options with preexisting ones
                },
            })
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

    let doInitializeCy = () => {
        eczCodeGraph.mountInDom(cyDomNodeRef.current, { matchWebPageFonts, window });

        eczCodeGraph.cy.on('tap', (event) => {
            // target holds a reference to the originator
            // of the event (core or element)
            const eventTarget = event.target;
            debug('Tap! eventTarget = ', eventTarget);
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
        });

        // run the initial layout.
        let layoutPromise = eczCodeGraph.layout({ animate: true });
        layoutPromise.then( () => setCyInitialized(true) );
    };

    useLayoutEffect( () => {
        if (!cyInitialized) {
            doInitializeCy();
        }
    } );

    // set Cy UI settings
    useEffect( () => {
        if (cyInitialized) {
            const { displayMode } = uiState.displayModeWithOptions;
            debug(`effect hook for diplayModeWithOptions`, uiState.displayModeWithOptions);
            eczCodeGraph.setDisplayMode(uiState.displayMode, uiState.displayModeWithOptions);
            eczCodeGraph.layout();
        }
    }, [ uiState.diplayModeWithOptions ] );


    //
    // Render components
    //

    debug(`Rendering components. displayModeWithOptions=`, uiState.displayModeWithOptions);

    let currentCodeSelected = null;
    let currentDomainSelected = null;
    if (uiState.displayModeWithOptions.displayMode === 'isolate-nodes') {
        const { nodeIds } = uiState.displayModeWithOptions.modeIsolateNodesOptions;
        if ( nodeIds && nodeIds.length === 1) {
            const nodeId = nodeIds[0];
            const codeId = eczCodeGraph.cy.getElementById(nodeId).data()._codeId;
            const domainId = eczCodeGraph.cy.getElementById(nodeId).data()._domainId;

            if (codeId != null) {
                currentCodeSelected = eczoodb.objects.code[codeId];
            }
            if (domainId != null) {
                currentDomainSelected = eczoodb.objects.domain[domainId];
            }
        }
    }

    return (
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
                            uiState.setDisplayModeWithOptions(_.merge(
                                {}, uiState.displayModeWithOptions, newModeWithOptions,
                            ));
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
                                `I don't know what to do with click on ${object_type}`
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
