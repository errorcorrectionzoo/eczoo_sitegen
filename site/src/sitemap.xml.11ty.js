import debugm from 'debug';
const debug = debugm('eczoo_sitegen.src.sitemap_xml');


const data = {
    permalink: '/sitemap.xml',
    layout: false,
    eleventyExcludeFromCollections: true,
};

const render = async function (data)
{

    const { sqzhtml } = await import("@phfaist/zoodb/util/sqzhtml");

    let xml = sqzhtml`
<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    let pages = [...data.collections.sitePage];
    pages.sort( (a,b) => (a.url < b.url ? -1 : (a.url > b.url ? 1 : 0)) );

    for (const page of pages) {
        const absoluteUrl = this.getEczooAbsoluteUrl(page.url);
        debug(`sitemap.xml: adding ‘${absoluteUrl}’`, {date: page.date});
        xml += sqzhtml`
    <url>
      <loc>${ absoluteUrl }</loc>
      <lastmod>${ page.date.toISOString().slice(0,10) }</lastmod>
      <changefreq>weekly</changefreq>
    </url>`;
    }

    xml += `
</urlset>`;

    return xml;
};

export default { data, render, };
