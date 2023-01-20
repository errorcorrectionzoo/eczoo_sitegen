
function encXml(x)
{
    return x.replace(/[&<>"']/g, (match) => `&#x${ match.charCodeAt(0).toString(16) };` );
}


export function generatePlaceholderSvg({
    widthPx, heightPx, text, fontStyle, useLineHeight
} = {})
{
    widthPx ??= 400;
    heightPx ??= 400;
    text ??= "(placeholder image)";
    fontStyle ??= "italic 15px sans-serif";
    useLineHeight ??= 23;

    const textLines = text.split('\n');

    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="${widthPx}px" height="${heightPx}px" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect fill="#eee" stroke="#ccc" stroke-width="5" x="0" y="0" width="${widthPx}" height="${heightPx}"/>`;

    for (const [lineNo, textLine] of textLines.entries()) {
        svg += `
<text x="25" y="${40 + lineNo*useLineHeight}" fill="#888"
      style="font: ${fontStyle}">${textLine}</text>`
    }
    svg += `</svg>`;

    return svg;
}


export const placeholdersSvg = {
    notBuiltInDevelMode: generatePlaceholderSvg({
        text: `
(image not generated in devel
mode for faster builds; use
"yarn build" to do full build)
`.trim()
    }),
};
