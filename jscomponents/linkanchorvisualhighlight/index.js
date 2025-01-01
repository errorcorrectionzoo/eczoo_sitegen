// import debug_mod from 'debug';
// const debug = debug_mod('eczoo_sitegen.jscomponents.linkanchorvisualhighlight');



// Utility; cf. https://stackoverflow.com/a/4642894/1694896
function getAncestor(node, tagName)
{
    tagName = tagName.toUpperCase();
    while (node) {
        if (node.nodeType == 1 && node.nodeName == tagName) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}


// It's apparently a good idea to minimize the number of event listeners, so
// we can set the listener on the #main content element.  The event can be
// caught there, too.

function possible_link_activated_callback(event)
{
    const a = getAncestor(event.target, "a");
    if (a === null) {
        return;
    }
    const link_target_href = a.getAttribute("href");
    if (link_target_href) {
        if (!link_target_href.startsWith("#")) {
            return;
        }
        const link_target_id = decodeURIComponent(
            link_target_href.substring(1)
        );
        const link_target = window.document.getElementById(link_target_id);
        console.log(link_target);

        // Normally, we let the browser handle the scrolling to the element to
        // keep behavior as native as possible and to also have the relevant
        // fragment in the URL address bar (e.g., for link sharing).
        //
        // But sometimes, for purely functional elements like navigation, we
        // should directly scroll to the target element.  This is indicated by a
        // special css class placed on the target element.
        //
        if (link_target.classList.contains('linkanchorvisualhighlight_direct_scroll')) {
            link_target.scrollIntoView(true);
            event.preventDefault();
        }

        // trigger the visual highlight flash on the target element.
        visualHighlight(link_target);
    }
}

export function visualHighlight(element)
{
    element.classList.add("visual-highlight");
    setTimeout(
        () => element.classList.remove("visual-highlight"),
        1000 // milliseconds
    );
}



//
// Flash corresponding anchor (citation or footnote) when a link is clicked to
// that point
//
export function setupVisualHighlightLinkEventListener(main_element_id)
{
    const element = window.document.getElementById(main_element_id);
    if (element) {
        element.addEventListener("click", possible_link_activated_callback);
    }
}

