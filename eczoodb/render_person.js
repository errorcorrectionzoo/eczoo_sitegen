
// Display a person
export function render_person(person)
{
    let s = '';

    let avatar_url = '';
    let avatar_add_class = '';
    if (person.avatarurl != null && person.avatarurl !== '') {
        avatar_url = person.avatarurl;
    } else if (person.githubusername != null && person.githubusername !== '') {
        avatar_url = `https://github.com/${person.githubusername}.png`;
    } else {
        avatar_add_class = ' person-avatar-unknown';
    }

    let styleBgImage = '';
    if (avatar_url) {
        styleBgImage = `style="background-image: url('${avatar_url}');"`;
    }

    s += `
<div class="tile tile-person${avatar_add_class}"
     id="u-${person.user_id}" ${styleBgImage}
     ><div class="tile-content"><div class="tile-person-line tile-persion-name-line">`;
    s += `<span class="person-name">${person.name}</span>`;
    if (person.zoorole != null && person.zoorole !== '') {
        s += `<span class="person-zoorole"> (${person.zoorole})</span>`;
    }
    s += `</div>`;
    s += `<div class="tile-person-line tile-person-links-line">`;
    if (person.pageurl != null && person.pageurl !== '') {
        s += `<span class="person-linkdetail person-pageurl"
  ><a href="${person.pageurl}" target="_blank">web</a></span>`;
    }
    if (person.gscholaruser != null && person.gscholaruser !== '') {
        s += `<span class="person-linkdetail person-gscholaruser"
  ><a href="https://scholar.google.com/citations?user=${person.gscholaruser}"
      target="_blank">google scholar</a></span>`;
    }
    if (person.githubusername != null && person.githusername !== '') {
        s += `<span class="person-linkdetail person-githubusername"
  ><a href="https://github.com/${person.githubusername}"
      target="_blank">github</a></span>`;
    }
    s += `&nbsp;`;
    s += `</div></div></div>`;

    return s;
}
