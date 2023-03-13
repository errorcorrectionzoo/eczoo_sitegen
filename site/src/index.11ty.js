const debug = require('debug')('eczoo_sitegen.src.index');

const data = {
    title: 'Home',
    tags: ['sitePage'],
    page_layout_info: {
        header_large_text: 'Welcome to the error correction zoo!',
        wide_layout: true,
        div_bodycontents_classes: ['page-index'],
        // jscomponents: {
        //     randomcode: true,
        // },
        jscomponents_profile: {
            dynamic: 'home',
        },
    },
    eleventyComputed: {
        // ---
        // injection hack to get correct page date property!
        // https://github.com/11ty/eleventy/issues/2199#issuecomment-1027362151
        date: (data) => {
            data.page.date = new Date(
                data.eczoodb.zoo_gitlastmodified_processor.get_latest_modification_date()
            );
            return data.page.date;
        }
        // ---
    },
};


function join_list_items(items, {joiner, and, wrap_item, final_dot}={})
{
    const lenm1 = items.length - 1;
    return items.map( (itemval, index) => {
        let value = itemval;
        if (index !== lenm1) {
            value = value + (joiner ?? ', ');
        } else {
            value = (and ?? '') + value + (final_dot ?? '.');
        }
        if (wrap_item != null) {
            return wrap_item(value);
        }
        return `<li>${value}</li>`;
    } ).join('');
}



async function render(data)
{
    const {eczoodb, home_page_data} = data;

    const zoollm = await import('@phfaist/zoodb/zoollm');
    const llm_html_renderer = new zoollm.ZooHtmlFragmentRenderer();

    const { zoo_generate_stats } = await import('@errorcorrectionzoo/eczoodb/stats.js');

    const llmrender = (fragment) => {
        if (zoollm.value_not_empty(fragment)) {
            return fragment.render_standalone(llm_html_renderer);
        }
        return '';
    };

    let s = '';

    // const popular_code_id_list = [ 'css' ];
    const popular_code_id_list = home_page_data.popular_code_id_list;

    const zoo_stats = zoo_generate_stats( {
        eczoodb,
        stats: home_page_data.stats_spec
    } );


    const heading_separator_html = '&nbsp;▸&nbsp;&nbsp;';


    //
    // BOX 1: "JUMP TO", DOMAINS
    //


    s += `
<nav class="page-index-box">`.trim();
    s += `
  <ul class="page-index-box-links">` .trim();

    // LIST SOME FAVORITES
    {
        s += `
    <li><span class="page-index-box-links-head">Jump to${heading_separator_html}</span></li>`
            .trim();
        let s_items = [];
        for (const popular_code_id of popular_code_id_list) {
            const code = eczoodb.objects.code[popular_code_id];
            if (code != null) {
                const code_href = eczoodb.zoo_object_permalink('code', popular_code_id);
                const code_name_rdr = llmrender(eczoodb.code_short_name(code));
                s_items.push(`<a href="${escape(code_href)}">${code_name_rdr}</a>`);
            };
        }
        s += join_list_items(s_items);
    }

    // SMALL VERTICAL SPACE
    s += `<li class="page-index-box-links-thin-separator"></li>`;
    s += `
  </ul>` .trim();

    // LIST DOMAINS/KINGDOMS
    for (const [domain_id,domain] of Object.entries(eczoodb.objects.domain)) {
        const domain_href = eczoodb.zoo_object_permalink('domain', domain_id)
        s += `
  <ul class="page-index-box-links">` .trim();
        s += `
    <li><a href="${domain_href}"
           class="page-index-box-links-head">
           ${llmrender(domain.name)}${heading_separator_html}
        </a></li>` .trim();
        let s_items = [];
        for (const {kingdom} of (domain.kingdoms ?? [])) {
            const kingdom_href = eczoodb.zoo_object_permalink('kingdom', kingdom.kingdom_id)
            s_items.push(`
    <a href="${kingdom_href}">${llmrender(kingdom.name)}</a>` .trim());
        }
        s += join_list_items(s_items);
        s += `
  </ul>` .trim();
    }
    s += `
</nav>` .trim();


    //
    // BOX 2: LISTS
    //

    const max_display_box_codelists = home_page_data.max_display_box_codelists;

    s += `
<nav class="page-index-box">
  <ul class="page-index-box-links">`;

    s += `
    <li><a href="/lists" class="page-index-box-links-head"
           >Code lists${heading_separator_html}</a>` .trim();

    let codelist_entries = Object.entries(eczoodb.objects.codelist);
    const cmp = (a,b) => ( a === b ? 0 : (a < b ? -1 : +1) );
    codelist_entries.sort(
        ([a_id, a], [b_id, b]) => cmp(a.title?.llm_text, b.title?.llm_text)
    );

    {
        let s_items = [];
        for (const [codelist_id, codelist] of
             codelist_entries.slice(0, max_display_box_codelists)) {
            //debug('rendering codelist box; codelist =', codelist);
            s_items.push(
                `<a href="${eczoodb.zoo_object_permalink('codelist', codelist_id)}" `
                + `>${llmrender(codelist.title.whitespace_stripped())}</a>`
            );
        }
        s += join_list_items(s_items);
        if (codelist_entries.length > max_display_box_codelists) {
            s += `
    <li>… (<a href="/lists">see all</a>)</li>` .trim() ;
        }
    }

    s += `
  </ul>
</nav>`;



    //
    // BOX 3: IMPORTANT PAGES
    //

    s += `
<nav class="page-index-box">
  <h1><a href="/">Home Page</a></h1>
  <ul class="navlinks">
    <li><a href="/code_graph">Code graph</a></li>
    <li><a href="/lists">Code lists</a></li>
    <li><a href="/all">All codes</a></li>
    <li><a href="/concepts">Glossary of concepts</a></li>
    <!--<li><a href="/search">Search</a></li>-->
    <li>
      <form action="/search" method="GET">
        <input type="text" class="navbar-search" name="q" placeholder="search"></input>
      </form>
    </li>
  </ul>

  <h1>More</h1>
  <ul class="navlinks">
    <li><a href="/edit_code">Add new code</a></li>
    <li><a href="/additional_resources">Additional resources</a></li>
    <li><a href="/team">Team</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>`;


    //
    // BOX 4: RANDOM CODE PAGE
    //

    s += `
<nav class="page-index-box page-index-box-span-2" id="random-code-box">
  <span style="font-style:italic">(Random code loading …)</span>
</nav>`;

    //
    // BOX 5: STATS
    //
    {
        s += `
<nav class="page-index-box" id="quick-stats-box">
  Stats at a glance: `;
        let s_items = [];
        for (const [zoo_stat_number, zoo_stat_label] of zoo_stats) {
            s_items.push(`
   <span class="stat-number">${ zoo_stat_number }</span>&nbsp;${zoo_stat_label}` .trim());
        }
        s += join_list_items(s_items, { and: 'and ', wrap_item: (v) => v });
    }

    s += `
</nav>`;


    //
    //
    //

    return s;
}


module.exports = {
    data,
    render
};
