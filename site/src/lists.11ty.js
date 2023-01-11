
const data = {
    title: 'List of code lists',
};


const render = async (data) => {

    const eczoodb = data.eczoodb;

    const zoollm = await import('@phfaist/zoodb/zoollm');

    const html_fragment_renderer = new zoollm.ZooHtmlFragmentRenderer();

    let html = '';
    
    html += `
<h1>List of code lists</h1>
`;

    html += `
<ul>` .trim();

    let codelists_kv = Object.entries( eczoodb.objects.codelist );

    const sort_compare_fn = ([codelist_a_id, codelist_a], [codelist_b_id, codelist_b]) => {
        // special list 'all' gets sorted at the end
        if (codelist_a_id === 'all') {
            return +1;
        }
        if (codelist_b_id === 'all') {
            return -1;
        }
        // otherwise, sort lists alphabetically by their title
        if (codelist_a.title.llm_text === codelist_b.title.llm_text) {
            return 0;
        }
        return (codelist_a.title.llm_text < codelist_b.title.llm_text) ? -1 : +1;
    };

    codelists_kv.sort( sort_compare_fn );

    for (const [list_id, codelist] of codelists_kv) {
        html += `
  <li><p><a href="${eczoodb.zoo_object_permalink('codelist', list_id)}">`;
        html += codelist.title.render_standalone(html_fragment_renderer);
        html += `
  </a></p></li>`.trim();
    }

    html += `
</ul>` .trim();

    return html;
}


module.exports = { data, render, };
