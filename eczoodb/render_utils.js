// import debug_module from 'debug';
// const debug = debug_module('eczoodbjs.render_utils');
//


export function render_meta_changelog(changelog, R, { details_open }={})
{
    const {ne,rdr,ref} = R;

    let html = '';

    html += `
<details ${details_open ? 'open' : ''} class="sectioncontent page-change-log">
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


export function render_stat_num_codes(value)
{
    return `<span class="stat-number">${value}</span> code${value > 1 ? 's' : ''}`;
}

// (The former `docrefs_placeholder_ref_resolver`, which showed a reference
// to a figure or an equation of another page as `[figure]`, is gone: labels
// are unique in the whole zoo, and such a reference resolves through the
// zoo's index, linking to the page that defines the label.)
