
import './cookies.scss';


export function animateObnoxiousCookieBar()
{
    let element = document.createElement('div');
    element.classList.add('obnoxious-cookie-bar')
    element.innerHTML = `<div class="cookie-title">Please make sure you accept our cookie policy.</div>
<div class="cookie-text"><p>This website doesn't use cookies. That's it! That's our policy.</p><p>Here's a consolation cookie for any cookie monster out there: 🍪.</p></div>
<div class="cookie-btns">
<div class="cookie-btn cookie-btn-1">Accept</div>
<div class="cookie-btn cookie-btn-2">Also accept</div>
</div>
`;

    element.addEventListener('click', () => {
        element.classList.remove('obnoxious-cookie-bar-shown');
        document.body.removeChild(element);
    });

    document.body.appendChild(element);
    element.classList.add('obnoxious-cookie-bar-shown')
}
