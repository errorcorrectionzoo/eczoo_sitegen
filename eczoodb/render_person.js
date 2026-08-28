//import debug_module from 'debug';
//const debug = debug_module('eczoodbjs.render_person');


function resolve_img(s, { builtin_class_prefix, builtin_prefix }) {
    if (s != null && s !== '') {
        const m = (new RegExp(`^${builtin_prefix}:(.*)$`)).exec(s);
        if (m) {
            const builtin = m[1];
            return {
                builtin,
                cssclasses: [`${builtin_class_prefix}${builtin}`],
            };
        }
        return {
            url: s,
            cssclasses: [],
        }
    }
    return null;
}
function styleBgImageMaybe(resolvedimg) {
    if (resolvedimg.url == null) {
        return '';
    }
    return `style="background-image: url('${resolvedimg.url}');"`;
}


// Display a person
export function render_person(person)
{
    let s = '';

    let avatar_info = resolve_img(person.avatarurl, {
        builtin_class_prefix: 'person-avatar-builtin-',
        builtin_prefix: 'builtinavatar',
    });

    if (avatar_info == null) {
        if (person.githubusername != null && person.githubusername !== '') {
            avatar_info = { url: `https://github.com/${person.githubusername}.png`, cssclasses: [] };
        } else {
            avatar_info = { cssclasses: ['person-avatar-unknown'] };
        }
    }

    let clslist = ['tile', 'tile-person', ...avatar_info.cssclasses];

    s += `
<div class="${ clslist.join(' ') }" ${styleBgImageMaybe(avatar_info)}
     id="u-${person.user_id}"
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
    s += `</div>`

    // core members & veterinarians get their affil
    if ((person.zooteam === 'core' || person.zooteam === 'veterinarians') && person.affiliations) {
        //debug(`Affiliations: `, person.affiliations);
        for (const affil of person.affiliations) {

            let affillogo_info = resolve_img(affil.logo, {
                builtin_class_prefix: 'person-affillogo-builtin-',
                builtin_prefix: 'builtinaffillogo',
            });

            s += `<div class="tile-person-line tile-person-affil-line">${ affil.short }</div>`;
            if (affillogo_info != null) {
                let tag = 'div';
                let attribs = {};
                if (affil.logohref) {
                    tag = 'a';
                    attribs = {href: affil.logohref, target: '_blank'};
                }
                s += `<${htmlTagWithAttribs(tag, attribs)}
                       class="tile-person-line tile-person-affillogo-line ${affillogo_info.cssclasses.join(' ')}"
                       ${styleBgImageMaybe(affillogo_info)}></${tag}>`;
            }
        }
    }

    s += `</div></div>`;

    return s;
}


function htmlTagWithAttribs(tag, attrs = {})
{
    const NAME_RE = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/;
    if (!NAME_RE.test(tag)) {
        throw new Error(`invalid tag name: ${tag}`);
    }
    let out = tag;
    for (const [name, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (!NAME_RE.test(name)) {
            throw new Error(`invalid attribute name: ${name}`);
        }
        if (value === true) {
            out += ` ${name}`;
        } else {
            out += ` ${name}="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
        }
    }
    return out;
}
