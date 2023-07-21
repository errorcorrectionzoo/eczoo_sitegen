window.eczColorSchemeHandler = (function(){
    var htmlElement = window.document.documentElement;
    if (!window.matchMedia) { return null; }
    var matcher = window.matchMedia('(prefers-color-scheme: dark)');
    var handler = {};
    handler.update = function() {
        handler.setDark( matcher.matches );
    };
    handler.setDark = function(darkOn) {
        if (darkOn) {
            htmlElement.classList.remove('light');
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
        }
    };
    handler.toggle = function() {
        var setIsDark = ! htmlElement.classList.contains('dark');
        if (setIsDark === matcher.matches) {
            window.localStorage.removeItem("eczColorSchemeHandlerColorScheme");
        } else {
            window.localStorage.setItem("eczColorSchemeHandlerColorScheme",
                                        setIsDark ? 'dark' : 'light');
        }
        handler.setDark( setIsDark );
    };
    handler.init = function() {
        var wantIsDark = window.localStorage.getItem("eczColorSchemeHandlerColorScheme");
        if (wantIsDark != null) {
            handler.setDark( (wantIsDark == 'dark') );
        } else {
            handler.update();
        }
    };
    matcher.addListener(handler.update);
    handler.init();
    return handler;
})();
