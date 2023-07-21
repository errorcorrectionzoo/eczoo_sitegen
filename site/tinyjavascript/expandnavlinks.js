window.addEventListener('load', function() {
    var navHamburgerElement = document.getElementById('nav-shortcut-to-navigation-links');
    var navContentsElement = document.getElementById('navigation');
    var bodyContentsElement = document.getElementById('bodycontents');
    if (!bodyContentsElement.classList.contains('app-full-width')) {
        // only install in full-width apps
        return null;
    }
    navContentsElement.classList.add('collapsed-into-js-menu');
    var onClick = function(event) {
        if (navContentsElement.classList.contains('collapsed-into-js-menu-shown')) {
            navContentsElement.classList.remove('collapsed-into-js-menu-shown');
        } else {
            navContentsElement.classList.add('collapsed-into-js-menu-shown');
        }
        if (typeof event != 'undefined') {
            console.log('swallowing event!');
            event.stopPropagation();
            event.stopImmediatePropagation();
            event.preventDefault();
        }
        return true;
    };
    navHamburgerElement.addEventListener('click', onClick);
    window.eczToggleNavLinks = onClick;
});
