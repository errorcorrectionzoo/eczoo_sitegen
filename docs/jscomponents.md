# `jscomponents/` — Browser JS Components

Package `@errorcorrectionzoo/jscomponents`. Client-side components bundled by
Parcel. They are consumed by the site through per-page entry points in
`site/jsc_profiles/*.js` (each profile imports the components a page type
needs and initializes them on `window` `load`).

## Consumption pattern

```js
// site/jsc_profiles/code_graph.js (example)
window.addEventListener('load', async function() {
    linkanchorvisualhighlight.load();
    await mathjax.load();
    await codegraph.load();
});
```

- `templates/layout/base_page.11ty.js` injects `<script type="module" src="~/site/jsc_profiles/${profile}.js">` based on each page's `page_layout_info.jscomponents_profile`.
- Parcel (run inside the Eleventy build) bundles each profile to `_site/vv/*-{hash}.js` with shared chunks deduplicated.
- Components fetch runtime data from `/dat/*.json` (built by `site/src/dat/*.11ty.js`) or from inline globals (e.g. `window.eczoo_random_code_data`).

## Components

| Folder | What it does | Entry |
|---|---|---|
| `codegraph/` | Interactive code-hierarchy graph (Cytoscape + cose-bilkent/fcose layouts). Classes `EczCodeGraph`, `EczCodeGraphViewController` in `index.js`; React UI in `ui.jsx`. The zoo comes from the data dump `/dat/eczoodata.json` (`setup_eczoodb.js`): the FLM engine of the zoo's own configuration installs the dump's FLM data (`zooflm`: index, citations, images, snippets) and renders the information pane (`CodeGraphInformationPane.jsx`) in an output context of its own, whose links to codes, domains and kingdoms are `#jsCallbackRef:TYPE/ID` callbacks; the graph's labels are the names' text snippets. The engine's WebAssembly module (about 5 MB) is a file beside the bundles, which the browser fetches. Also `_headless_exporter_browser_code.js`: headless (Puppeteer) build used server-side to export SVG graphs during the site build (`yarn build` in jscomponents compiles it to `codegraph/_headless_exporter_browser_code_dist/`, the `.wasm` file included). | `setup.js` |
| `search/` | Lunr-based full-text search widget (`@phfaist/zoodbtools_search`); index config in `configuresearchindex.js`; build-time index generator `generate_index.js` (used by `site/src/dat/searchindex.11ty.js`); loads `/dat/searchindex.json`. | `setup.js` |
| `mathjax/` | Waits for MathJax 4, which the page layout configures and loads with the FLM engine's scripts (`html_scripts()`). | `setup.js` exports async `load()` |
| `popuptippy/` | Tippy.js popups for code info buttons (`.info-popup-button-zone`). | `setup.js` |
| `randomcode/` | Homepage "random code" widget, class `RandomCodeShower`; it dispatches the FLM engine's event `flm:region-updated` on its box, on which the page's MathJax configuration typesets the new formulas. | `index.js` |
| `linkanchorvisualhighlight/` | Highlight animation for in-page anchor links. | `setup.js` |
| `editcodelegacy/` | Legacy code-editing interface (React + CodeMirror YAML editor with schema awareness), referenced by `/edit_code.html`; considered legacy/inactive. | `setup.js` → `EczEditCodeApp.jsx` |
| `editcode/` | Older/minimal editor — also legacy/unused. | `EditCodeApp.jsx` |
| `gitzoopreview/` | Git-based zoo preview app (`@phfaist/zoodbtools_gitpreview` 0.2, over `@phfaist/zoodbtools_preview` 0.2), used by `/gitpreview.html`: clones `errorcorrectionzoo/eczoo_data` (a branch or pull request) into an in-browser file system and loads the full zoo there with the FLM error policy `'continue'`. The compiled citations come from the data dump (`/dat/eczoodata.json`, `zooflm.citations`) for the arXiv and DOI placeholders; the objects' addresses are the preview's own (`previewObjectHref()`, followed by the preview component; none for an object without a page, as on the site), the images `data:` URLs (`previewGraphicsDataUrl()`). `renderObject.js` renders the site's pages through the zoo's engine and lists the FLM diagnostics of the object above them; for a code it adds the recommendations on its first paragraph (references to the page's own figures or equations, errors on its own: `truncate()`, `scan()`, `render_text()`) and on its change log. | `setup.js` → `appSetup.jsx` |
| `obnoxiouscookiebar/` | Joke "this site doesn't use cookies" banner. | `setup.js` |
| `paywall20250401/` | April Fools 2025 fake paywall (date-gated to April 1). | `setup.js` |
| `aizoo20260401/` | April Fools 2026 "AI Zoo" banner (date-gated to April 1). | `setup.js` |
| `dev/`, `dev-dist/` | Dev scaffolding for codegraph (`dev/codegraph/codegraphdev.html`, Parcel target `dev-codegraph`). Not ported to zoodb 0.3: its `eczoodata.json` is a zoodb 0.2 dump, which the code graph refuses (no `zooflm`), its page carries no MathJax configuration, and its `try_mk_*.js` scripts import modules that do not exist. | — |

## Build notes

- `jscomponents/package.json` `build` script only compiles the codegraph headless exporter (needed before a full site build); everything else is bundled on-demand by the site's Parcel run. Root `yarn buildall` = jscomponents build + site build. The script removes `jscomponents/.parcel-cache`, but Parcel keeps its cache at the repository's root (`.parcel-cache`, beside `yarn.lock`): after a change of a dependency (such as a new `@phfaist/zoodb`), remove that one too, or the build may reuse stale results.
- `.parcelrc`: Terser optimizer (SWC breaks codegraph/FLM code), `@phfaist/parcel-resolver-root` for `~/` paths.
- `yaml` aliases: Parcel (2.13) cannot bundle the `yaml` package's browser entry (`yaml/browser/index.js`: `import * as YAML` and `export *` of the same module, `export default YAML`): the bundle throws `ReferenceError: $…$import$… is not defined` as it loads. So `yaml` is aliased to its `browser/dist/index.js`. The alias of the root `package.json` applies to every import of `yaml` in the site's bundles, those of `@phfaist/zoodb` (its YAML loader and arXiv citation source, which `/gitpreview` bundles) and those of the legacy code editor alike (it takes precedence over the older alias of `jscomponents/package.json`), and points to the copy of `@phfaist/zoodb` (`node_modules/@phfaist/zoodb/node_modules/yaml`, 2.9; the root's `yaml` is 2.6). If an install moves that copy, update the root alias.
- Key deps: React 18, Cytoscape 3, @uiw/react-codemirror, Tippy.js, MathJax (CDN), @phfaist/zoodbtools_* packages.
