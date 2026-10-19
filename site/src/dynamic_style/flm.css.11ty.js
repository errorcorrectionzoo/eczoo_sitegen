//
// The stylesheet of FLM content, as the zoo's FLM engine provides it
// (html_stylesheet(): every rule in the cascade layer `flm`, so that the
// site's own stylesheets, outside that layer, override any of them; the EC
// zoo's look of FLM content is stylesheets/flm-formatting.scss).  The page
// layout links it; Parcel bundles it.
//

const data = {
    layout: null,
    permalink: '/dynamic_style/flm.css',
};

const render = async (data) => {

    const flm_style = data.eczoodb.zoo_flm_engine.html_stylesheet();

    return `/* The stylesheet of FLM content (the FLM engine's html_stylesheet()) */
${ flm_style }`;

};

export default { data, render, };
