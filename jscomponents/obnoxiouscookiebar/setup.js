import { animateObnoxiousCookieBar } from './index.js';

export function load()
{
    const elements = document.querySelectorAll('.show-cookie-bar-on-click');
    for (const el of elements) {
        el.addEventListener('click', (event) => {
            console.log("Showing our cookie bar...");
            animateObnoxiousCookieBar();
            event.preventDefault();
        });
    }
}
