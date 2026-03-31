
import './AiZoo20260401.css';
//import eczooMainLogoUrl from 'url:../../site/static/icons/eczoo-main-logo-contrast.svg';

//import markdownit from 'markdown-it'
//import aiUpdateTextArticleMd from 'bundle-text:./ai-update-text-article.md';

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

    // let aEl = bannerElement.querySelector('a.AiZoo20260401-Banner-LearnMoreLink');
    // aEl.addEventListener('click', (e) => {
    //     console.log('Showing full AI announcement message...');
    //     msgElement.classList.add('AiZoo20260401MsgArticleContainer-shown');
    //     e.preventDefault();
    //     return false;
    // });

    document.body.appendChild(bannerElement);
}

function animateAiZoo20260401_aipostpage()
{
    // const md = markdownit({
    //     html: true,
    //     linkify: true,
    //     typographer: true
    // });
    // console.log(md);
    // const aiUpdateTextArticleHtml = md.render(aiUpdateTextArticleMd);

//     let msgElement = document.createElement('div');
//     msgElement.classList.add('AiZoo20260401MsgArticleContainer');
//     msgElement.innerHTML = `
// <div class="AiZoo20260401-MsgArticleWrap">
// <button class="AiZoo20260401-CloseBtn AiZoo20260401-CloseClickable" aria-label="Close">&times;</button>
// <div class="AiZoo20260401-MsgArticleContent">
// <div class="AiZoo20260401-MsgArticleContent-Title-Logo">
// <div class="AiZoo20260401-MsgArticleContent-Title">
// The AI Error Correction Zoo<!--: A new start with AI <span class="AiZoo20260401-wow-ai">AI</span>-->
// </div>
// <!--<img src="${eczooMainLogoUrl}">-->
// </div>
// <div class="AiZoo20260401-MsgArticleContent-MainContent">
// ${aiUpdateTextArticleHtml}
// </div>
// <!--<a href="#" class="AiZoo20260401-CloseClickable">Close</a>-->
// </div>
// </div>
// `;

    // msgElement.querySelector('.AiZoo20260401-CloseClickable').addEventListener('click', (e) => {
    //     console.log('Close click!');
    //     msgElement.classList.remove('AiZoo20260401MsgArticleContainer-shown');
    //     e.preventDefault();
    //     return false;
    // });

    let titleEl = document.getElementById('id-AiZoo20260401-MsgArticleContent-Title');
    document.body.addEventListener('mousemove', (e) => {
        let rect = titleEl.getBoundingClientRect();
        let x = 100 - ((e.clientX - rect.left) / rect.width) * 100;
        let y = 100 - ((e.clientY - rect.top) / rect.height) * 100;
        titleEl.style.backgroundPosition = `${x}% ${y}%`;
    });

    // document.body.appendChild(msgElement);
}

function animateAiZoo20260401()
{
    if (window.location.pathname.endsWith("/__41ai")) {
        animateAiZoo20260401_aipostpage();
    } else {
        animateAiZoo20260401_banner();
    }
}

window.addEventListener('load', function() {
    setTimeout(animateAiZoo20260401, 500);
});