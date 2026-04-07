
import './aizoo20260401.css';

function animateAiZoo20260401_banner()
{
    let today = new Date();
    if (today.getDate() != 1 || today.getMonth() != 3) { // April is 3 since Jan is 0
        return; // not 4/1
    }

    let bannerElement = document.createElement('div');
    bannerElement.classList.add('AiZoo20260401Banner');
    bannerElement.innerHTML = `
<div class="AiZoo20260401-BannerContent">
<b>Important Error Correction Zoo Update: A new start with AI!</b>
<a href="/__41ai" class="AiZoo20260401-Banner-LearnMoreLink">Learn more...</a>
</div>
`;

    document.body.appendChild(bannerElement);
}

function animateAiZoo20260401_aipostpage()
{
    let titleEl = document.getElementById('id-AiZoo20260401-MsgArticleContent-Title');
    document.body.addEventListener('mousemove', (e) => {
        let rect = titleEl.getBoundingClientRect();
        let x = 100 - ((e.clientX - rect.left) / rect.width) * 100;
        let y = 100 - ((e.clientY - rect.top) / rect.height) * 100;
        titleEl.style.backgroundPosition = `${x}% ${y}%`;
    });

}

function animateAiZoo20260401()
{
    if (window.location.pathname.endsWith("/__41ai")) {
        animateAiZoo20260401_aipostpage();
    } else {
        animateAiZoo20260401_banner();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let today = new Date();
    if (today.getDate() != 1 || today.getMonth() != 3) { // April is 3 since Jan is 0
        return; // not 4/1
    }
    document.getElementById('logo').classList.add('ecz-41ai-logo');
    
});
window.addEventListener('load', function() {
    setTimeout(animateAiZoo20260401, 500);
});