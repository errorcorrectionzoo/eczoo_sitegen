
import loIsEmpty from 'lodash/isEmpty.js';

export const cyStyleNumDomainColors = 3;

export const cyBaseStyleJson = [
    
    // style nodes:
    {
        selector: 'node',
        style: {
            'color': 'rgb(127, 48, 0)',
            'background-color': 'rgb(127, 48, 0)',
            label: 'data(label)',
            width: 15,
            height: 15,

            'min-zoomed-font-size': 14,
        }
    },
    {
        selector: 'node[_isDomain=1]',
        style: {
            'shape': 'round-rectangle',
            //'background-color': '#00007f',
            //'color': '#00007f',
            width: 25,
            height: 25,
        },
    },
    {
        selector: 'node[_isKingdom=1]',
        style: {
            'shape': 'diamond',
            width: 25,
            height: 25,
            // 'background-color': '#5e3834',
            // 'color': '#5e3834',
        }
    },
    {
        selector: 'node[_isKingdomRootCode=1]',
        style: {
            'shape': 'diamond',
            //width: 25,
            //height: 25,
            // 'background-color': '#5e3834',
            // 'color': '#5e3834',
        }
    },
    {
        selector: 'node[_hasParentKingdom=0]',
        style: {
            'shape': 'round-diamond',
            color: 'rgb(136, 91, 7)',
            'background-color': 'rgb(136, 91, 7)',
            width: 20,
            height: 20,
        }
    },

    // domain coloring
    {
        // I think that '.useDomainColors' might be necessary to override other color rules.
        selector: 'node.useDomainColors[_domainColorIndex=0]',
        style: {
            color: 'rgb(95,69,130)',
            'background-color': 'rgb(95,69,130)',
        },
    },
    {
        selector: 'node.useDomainColors[_domainColorIndex=1]',
        style: {
            color: 'rgb(50,108,110)',
            'background-color': 'rgb(50,108,110)',
        },
    },
    {
        selector: 'node.useDomainColors[_domainColorIndex=2]',
        style: {
            color: 'rgb(111,50,72)',
            'background-color': 'rgb(111,50,72)',
        },
    },

    // style edges:
    {
        selector: 'edge',
        style: {
            'width': 2,
            'opacity': 0.667,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            //'label': 'data(label)',
            'font-size': '12px'
        }
    },
    {
        selector: 'edge[_relType="parent"]',
        style: {
            'width': 2,
            'line-color': '#00307f',
            'target-arrow-color': '#00307f',
            'color': '#00307f'
        }
    },
    {
        selector: 'edge[_primaryParent=0]',
        style: {
            width: 2,
            //opacity: 0.25,// not good.
        }
    },
    {
        selector: 'edge[_relType="cousin"]',
        style: {
            'width': 1,
            'target-arrow-shape': 'none',
            'line-style': 'dashed',
            'line-color': '#00883f',
            'target-arrow-color': '#00883f',
            'color': '#00883f'
        }
    },


    //
    // special styling & style classes - e.g., hidden, dimmed.
    //

    // nodes marked at root --- heads of families / nodes selected for
    // isolated display
    {
        selector: '.isolationRoot',
        style: {
            color: 'rgb(230,50,50)',
            'font-weight': 'bold',
            'background-color': 'rgb(230,50,50)',
        }
    },
    {
        selector: '.isolationRootConnectingEdge',
        style: {
            width: 4,
        }
    },
    

    // isolation style
    {
        selector: '.isolationExtra',
        style: {
            opacity: 0.3,
        }
    },
    {
        selector: 'node.isolationExtra',
        style: {
            width: 10,
            height: 10,
        }
    },

    // hide anything with the 'hidden' class
    {
        selector: '.hidden, .isolationHidden, .hiddenSecondaryEdge',
        style: {
            display: 'none',
        }
    },

    //
    // style certain important nodes in the graph more prominently
    //
    {
        selector: '.importantNode',
        style: {
            'font-size': 32,
            'font-weight': 'bold',
        }
    },
    // {
    //     selector: '.notImportantNode',
    //     style: {
    //     }
    // },
    {
        selector: '.enableHighlightPrimaryParents[_primaryParent=0]',
        style: {
            'line-style': 'dotted',
        }
    },


    // custom highlight & dimmed class
    {
        selector: '.highlight, .searchMatchHighlight',
        style: {
            opacity: 1,
            color: 'rgb(220,80,0)',
            'background-color': 'rgb(220,80,0)',
            width: 40,
            height: 40,
            'font-size': 32,
        }
    },
    {
        selector: '.dimmed, .searchNoMatchDimmed',
        style: {
            opacity: 0.3,
        }
    },


    // DEBUG- layout parent relations
    {
        selector: 'edge.DEBUG.layoutParent[_relType="parent"], edge.DEBUG.layoutParent[_relType="cousin"]',
        style: {
            'width': 3,
            'line-color': 'rgb(120,0,50)',
            'color': 'rgb(120,0,50)',
        }
    },
    // DEBUG- items that are positioned by the prelayout.
    // {
    //     selector: '.DEBUG.prelayoutPositioned',
    //     style: {
    //         color: 'rgb(0,120,50)',
    //         'background-color': 'rgb(0,120,50)',
    //         //opacity: 1,
    //     }
    // },
    // DEBUG- items that our prelayout couldn't handle -- mark visually because the
    // existence of such visible nodes is a bug
    {
        selector: '.DEBUG.prelayoutOutOfLayoutTree',
        style: {
            color: 'rgb(120,0,50)',
            'background-color': 'rgb(120,0,50)',
            //opacity: 1,
        }
    },

];


export function getCyStyleJson(options)
{
    let customFontStyle = {};

    options ??= {};

    if (options.matchWebPageFonts) {
        let windowObject = (options.window ?? window);
        let computedStyle = windowObject.getComputedStyle(windowObject.document.body);
        customFontStyle['font-family'] = computedStyle.getPropertyValue('font-family');
        customFontStyle['font-size'] = computedStyle.getPropertyValue('font-size');
        customFontStyle['font-weight'] = computedStyle.getPropertyValue('font-weight');
        customFontStyle['font-style'] = computedStyle.getPropertyValue('font-style');
    }

    // individual options.fontFamily, options.fontSize, options.fontWeight
    // override web page defaults
    if (options.fontFamily != null) {
        customFontStyle['font-family'] = options.fontFamily;
    }
    if (options.fontSize != null) {
        customFontStyle['font-size'] = options.fontSize;
    }
    if (options.fontWeight != null) {
        customFontStyle['font-weight'] = options.fontWeight;
    }
    if (options.fontStyle != null) {
        customFontStyle['font-style'] = options.fontStyle;
    }

    if (loIsEmpty(customFontStyle)) {
        return cyBaseStyleJson;
    }

    return [].concat(
        [
            {
                selector: '*',
                style: customFontStyle
            }
        ],
        cyBaseStyleJson,
    );
}
