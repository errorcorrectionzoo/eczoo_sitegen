// import debug_module from 'debug';
// const debug = debug_module('eczoodbjs.render_utils');
//
// import * as zoollm from '@phfaist/zoodb/zoollm';


export function render_meta_changelog(changelog, {ne,rdr,ref})
{
    let html = '';

    html += `
<details class="sectioncontent page-change-log">
<summary><span>Page edit log</span></summary>
<ul>`;
    let most_recent = true;
    for (const chg of changelog) {
        html += `
  <li>${ ref('user', chg.user_id) } (${ chg.date })`;
        if (most_recent) {
            html += ` — most recent`;
            most_recent = false;
        }
        html += `</li>`;
    }
    html += `
</ul>
</details>
`;
    return html;
}
