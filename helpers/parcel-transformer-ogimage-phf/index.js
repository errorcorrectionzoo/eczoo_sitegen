
//const url = require('url');

const { Transformer } = require('@parcel/plugin');

const getMetaPropertyTag = (html, property) => {
    const regex = new RegExp(`<meta[^>]*property=["|']${property}["|'][^>]*>`, 'i');
    const results = regex.exec(html);

    if (!results) {
        throw new Error(`Missing ${property}`);
    }

    return results[0];
};

const getMetaNameTag = (html, name) => {
    const regex = new RegExp(`<meta[^>]*name=["|']${name}["|'][^>]*>`, 'i');
    const results = regex.exec(html);

    if (!results) {
        throw new Error(`Missing ${name}`);
    }

    return results[0];
};


const getMetaTagContent = (metaTagHtml) => {
    const contentRegex = /content="([^"]*)"/i;
    const results = contentRegex.exec(metaTagHtml);

    if (!results) {
        throw new Error(`Missing content attribute in ‘${metaTagHtml}’`);
    }

    return results[1];
};

const getAbsoluteOgImageUrl = (baseHtml) => {
    try {
        const ogUrlTag = getMetaPropertyTag(baseHtml, 'og:url');
        return getMetaTagContent(ogUrlTag);
    } catch (error) {
        console.log(error.message);
    }
};

module.exports = new Transformer({
    async transform({ asset }) {
        const baseHtml = await asset.getCode();
        let patchedHtml = baseHtml;

        // console.log(`\n\nTRANSFORMING !\nbaseHtml = `, baseHtml);

        // get content of meta og:url ->
        const ogUrlContent = getAbsoluteOgImageUrl(baseHtml);

        if(!ogUrlContent) return [asset];

        // assume that the relative URLs will be relative to the site root!!
        const urlBaseRef = (new URL('/', ogUrlContent)).href;

        // const fixUrl = (givenUrl) => (new URL(givenUrl, urlBaseRef)).href;
        const urlBaseRefNoSlash = urlBaseRef.replace(/\/+$/g, '');
        const fixUrl = (givenUrl) => `${urlBaseRefNoSlash}${givenUrl}`;

        // for og:image
        try {
            const ogImageTag = getMetaPropertyTag(baseHtml, 'og:image');
            const ogImageContent = getMetaTagContent(ogImageTag);
            const absoluteOgImageUrl = fixUrl(ogImageContent);
            const ogImageTagAbsoluteUrl =
                  ogImageTag.replaceAll(ogImageContent, absoluteOgImageUrl);
            patchedHtml = baseHtml.replaceAll(ogImageTag, ogImageTagAbsoluteUrl);
            //console.log(`DEBUG: patching ‘${ogImageContent}’ -> ‘${absoluteOgImageUrl}’  [ref URL is ‘${ogUrlContent}’]`);
            asset.setCode(patchedHtml);
        } catch (error) {
            console.log(error.message);
        }

        // for twitter:image
        try {
            const twitterImageTag = getMetaNameTag(baseHtml, 'twitter:image');
            const twitterImageContent = getMetaTagContent(twitterImageTag);
            const absoluteTwitterImageUrl = fixUrl(twitterImageContent);
            const twitterImageTagAbsoluteUrl =
                  twitterImageTag.replaceAll(twitterImageContent, absoluteTwitterImageUrl);
            patchedHtml = patchedHtml.replaceAll(twitterImageTag, twitterImageTagAbsoluteUrl);
            asset.setCode(patchedHtml);
        } catch (error) {
            console.log(error.message);
        }

        return [asset];
    }
});
