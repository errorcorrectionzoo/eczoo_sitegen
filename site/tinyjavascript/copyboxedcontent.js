window.addEventListener('load', function() {

    var copyCallbackFn = function (event, text) {
        var divNode = event?.target;
        var boxedContentNode = divNode?.parentNode;
        if (boxedContentNode) {
            console.log('Copying to clipboard:', text);
            navigator.clipboard.writeText(text).then( function () {
                boxedContentNode.classList.add('visual-highlight-copied');
                setTimeout( function () {
                    boxedContentNode.classList.remove('visual-highlight-copied');
                    boxedContentNode.classList.add('visual-highlight-copied-done');
                    setTimeout( function () {
                        boxedContentNode.classList.remove('visual-highlight-copied-done');
                    }, 1000 );
                }, 1000);
            } );
        }
    };

    var makeCopyLink = function (boxedContentNode) {
        var text = boxedContentNode.innerText;
        var divNode = document.createElement('DIV');
        divNode.innerText = 'copy';
        divNode.classList.add('boxedcontent-copy-link');
        divNode.addEventListener('click', function (event) {
            copyCallbackFn(event, text);
            event.stopPropagation();
            event.preventDefault();
        });
        boxedContentNode.appendChild(divNode);
    };

    var boxedContentNodes = document.querySelectorAll('.boxedcontent');

    // add "copy" link to all .boxedcontent elements
    for (const boxedContentNode of boxedContentNodes) {
        makeCopyLink(boxedContentNode);
    }
});
