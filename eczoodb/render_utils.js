// import debug_module from 'debug';
// const debug = debug_module('eczoodbjs.render_utils');
//
import { RefInstance, $$kw } from '@phfaist/zoodb/zooflm';


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



export const docrefs_placeholder_ref_resolver = {
    get_ref(ref_type, ref_label, resource_info) {
        if (ref_type === 'code'
            || ref_type === 'domain' || ref_type === 'kingdom'
            || ref_type === 'codelist' || ref_type === 'user' || ref_type === 'space'
            || ref_type === 'topic' || ref_type === 'defterm') {
            // we'll let the default resolver find it
            return null;
        }
        // e.g. [figure]
        return  new RefInstance( $$kw({
            ref_type, ref_label,
            formatted_ref_flm_text: `[${ref_type}]`,
            target_href: null,
            counter_value: null,
            counter_formatter_id: null
        }) );
    }
};
