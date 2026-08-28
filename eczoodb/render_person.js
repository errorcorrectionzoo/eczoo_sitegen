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
        // all the affiliations are wrapped in a single element, so that
        // hovering any one of them can reveal all their links at once (see
        // tiles-persons.scss)
        s += `<div class="tile-person-affils">`;
        for (const affil of person.affiliations) {

            let affillogo_info = resolve_img(affil.logo, {
                builtin_class_prefix: 'person-affillogo-builtin-',
                builtin_prefix: 'builtinaffillogo',
            });

            let affilHrefHtml = '';
            if (affil.href) {
                // link to the affiliation's web page; it is only revealed
                // when hovering an affiliation (see tiles-persons.scss).  No
                // whitespace before the tag, so that the link cannot end up
                // alone on a line; its spacing is set in the stylesheet.
                const affilhref_attribs = {
                    class: 'person-affil-link',
                    href: affil.href,
                    target: '_blank',
                };
                affilHrefHtml = `<${htmlTagWithAttribs('a', affilhref_attribs)}>\u{1F517}</a>`;
            }

            s += `<div class="tile-person-line tile-person-affil-line">${ affil.short }${ affilHrefHtml }</div>`;
            if (affillogo_info != null) {
                let tag = 'div';
                let attribs = {
                    class: ['tile-person-line', 'tile-person-affillogo-line',
                            ...affillogo_info.cssclasses].join(' '),
                    // the logo image is set as replaced content (see
                    // tiles-persons.scss), so that the box is exactly as wide
                    // as the logo; builtin logos set it in the stylesheet.
                    style: (affillogo_info.url == null) ? null
                        : `--affillogo-image: url('${affillogo_info.url}');`,
                };
                if (affil.href) {
                    tag = 'a';
                    attribs.href = affil.href;
                    attribs.target = '_blank';
                }
                s += `<${htmlTagWithAttribs(tag, attribs)}></${tag}>`;
            }
        }
        s += `</div>`;
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
