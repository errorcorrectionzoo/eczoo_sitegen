
import './paywall20250401.css';
import eczooMainLogoUrl from 'url:../../site/static/icons/eczoo-main-logo.svg';

const appPages = ['One', 'Two', 'Login', 'Subscribe', 'Final'];



function animatePaywall20250401()
{
    let today = new Date();
    if (today.getDate() != 1 || today.getMonth() != 3) { // April is 3 since Jan is 0
        return; // not 4/1
    }

    let ecz20250401PaywallAlreadyShown = null;
    if (localStorage.getItem("ecz20250401PaywallAlreadyShown")) {
        ecz20250401PaywallAlreadyShown = true;
    } else {
        ecz20250401PaywallAlreadyShown = false;
        localStorage.setItem("ecz20250401PaywallAlreadyShown", 1);
    }

    let element = document.createElement('div');
    element.classList.add('Paywall20250401Root');
    element.innerHTML = `
<div class="Paywall20250401-Banner">
<article class="Paywall20250401-One">
 <h1>You've reached your limit of free articles for this month.</h1>
 <p>Thank you for being a valued reader of the Error Correction Zoo!  While we’ve generously provided this service for free in the past, we need to face the current harsh realities of life.  To continue offering the content you rely on, we must now ask for your financial support.  Consider it an investment in the future of the information you depend on for your academic survival.</p>
 <p class="Paywall20250401-Menacing">Please register or select one of our multiple tailor-made plans to access content.</p>
 <p><div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Login">Register</div><div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Subscribe">Subscribe now!</div></p>
</article>
<article class="Paywall20250401-Two">
 <p>We are excited to introduce multiple plans.</p>
 <div class="Paywall20250401-Button Paywall20250401-Do-Exit">Click me to make everything disappear.</div>
</article>
<article class="Paywall20250401-Login">
 <p>Registration options might be temporarily restricted in the light of current world circumstances.  We apologize for any inconvenience this might cause.</p>
 <p><div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Register with my Quantum Company</div></p>
 <p><div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Register with quantum interactive proof</div></p>
 <p><div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Send me a pigeon</div></p>
</article>
<article class="Paywall20250401-Subscribe">
 <p>Our services cater to everyone—from the elite quantum investors swimming in wealth to the struggling academics counting every penny. No matter where you stand, we have a plan tailored just for you. Explore our options and find the perfect fit for you!</p>
 <div class="Paywall20250401-Plans">
  <div>
    <span class="T">Ultra quantum elite platinum</span>
    <div class="P">only <span class="Price">$50M</span><span>/mo</span></div>
    <ul>
    <li>Everything in Premium, plus:</li>
    <li>Quantum computer delivered along with website access</li>
    <li>We write your papers for you</li>
    <li>Shareholder satisfaction guarantee in case of quantum winter</li>
    </ul>
    <div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Get now!</div>
  </div>
  <div>
    <span class="T">Premium</span>
    <div class="P">only <span class="Price">$200</span><span>/mo</span></div>
    <ul>
    <li>Everything in Free, plus:</li>
    <li>No Ads</li>
    <li>You get to pay for Premium</li>
    <li>50% off all premium error correcting codes website visits</li>
    <li>Unlimited AI team members</li>
    </ul>
    <div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Get now!</div>
  </div>
  <div>
    <span class="T">Free</span>
    <div class="P">starting at <span class="Price">$0</span><span>/mo</span></div>
    <ul>
    <li>Ads-supported</li>
    <li>Unreliable Discord/email support</li>
    <li>Premium error-correcting code pages available at $50/visit</li>
    </ul>
    <div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Get now!</div>
  </div>
  <div>
    <span class="T">I'm a poor academic</span>
    <div class="P">only <span class="Price">1 proposal</span><span>/mo</span></div>
    <ul>
    <li>Everything in free, except:</li>
    <li>Worse discord support</li>
    <li>Extra-slow email replies</li>
    <li>See more ads for predatory journals and conferences</li>
    </ul>
    <div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="Final">Get now!</div>
  </div>
 </div>
 <div class="Paywall20250401-Button Paywall20250401-Do-Goto" data-goto="One">Back</div>
</article>
<article class="Paywall20250401-Final">
 <h1 class="Paywall20250401-ThankYou">Thank you for registering!</h1>
 <h1 class="Paywall20250401-ThankYou">💸💸💸💸</h1>
 <h1 class="Paywall20250401-ThankYou">🤑🤑🤑🤑</h1>
 <p>We'll guarantee most efficient use of your money when we buy our additional vacation houses.</p>
 <div class="Paywall20250401-Button Paywall20250401-Do-Exit">Access Error Correction Zoo</div>
</article>
<img src="${eczooMainLogoUrl}" style="max-width: 200px;">
</div>
`;

    const gotoPage = (p) => {
        element.classList.remove(...appPages.map(p => `Paywall20250401-${p}`));
        if (p) {
            element.classList.add('Paywall20250401-'+p);
        }
    }

    for (const e of element.querySelectorAll('.Paywall20250401-Do-Goto')) {
        e.addEventListener('click', (ev) => {
            ev.stopImmediatePropagation();
            gotoPage(e.dataset.goto);
        });
    }
    for (const e of element.querySelectorAll('.Paywall20250401-Do-Exit')) {
        e.addEventListener('click', (ev) => {
            ev.stopImmediatePropagation();
            gotoPage(null);
            element.style.display = 'none';
        });
    }

    // if this is not the first time the paywall is displayed, then a click anywhere
    // will make the thing disappear.  People still have to be able to work!
    if (ecz20250401PaywallAlreadyShown) {
        element.addEventListener('click', (ev) => {
            ev.stopImmediatePropagation();
            element.style.display = 'none';
        });
    }

    document.body.appendChild(element);
    element.classList.add('Paywall20250401-One');
}

window.addEventListener('load', function() {
    setTimeout(animatePaywall20250401, 800);
});