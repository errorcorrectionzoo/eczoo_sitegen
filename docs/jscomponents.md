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
| `codegraph/` | Interactive code-hierarchy graph (Cytoscape + cose-bilkent/fcose layouts). Classes `EczCodeGraph`, `EczCodeGraphViewController` in `index.js`; React UI in `ui.jsx`. Also `_headless_exporter_browser_code.js`: headless (Puppeteer) build used server-side to export SVG graphs during the site build (`yarn build` in jscomponents compiles it to `codegraph/_headless_exporter_browser_code_dist/`). | `setup.js` |
| `search/` | Lunr-based full-text search widget (`@phfaist/zoodbtools_search`); index config in `configuresearchindex.js`; build-time index generator `generate_index.js` (used by `site/src/dat/searchindex.11ty.js`); loads `/dat/searchindex.json`. | `setup.js` |
| `mathjax/` | MathJax 3 loader/config for `.display-math` / `.inline-math`. | `setup.js` exports async `load()` |
| `popuptippy/` | Tippy.js popups for code info buttons (`.info-popup-button-zone`). | `setup.js` |
| `randomcode/` | Homepage "random code" widget, class `RandomCodeShower`. | `index.js` |
| `linkanchorvisualhighlight/` | Highlight animation for in-page anchor links. | `setup.js` |
| `editcodelegacy/` | Legacy code-editing interface (React + CodeMirror YAML editor with schema awareness), referenced by `/edit_code.html`; considered legacy/inactive. | `setup.js` → `EczEditCodeApp.jsx` |
| `editcode/` | Older/minimal editor — also legacy/unused. | `EditCodeApp.jsx` |
| `gitzoopreview/` | Git-based zoo preview app (`@phfaist/zoodbtools_gitpreview`), used by `/gitpreview.html`. | `setup.js` → `appSetup.jsx` |
| `obnoxiouscookiebar/` | Joke "this site doesn't use cookies" banner. | `setup.js` |
| `paywall20250401/` | April Fools 2025 fake paywall (date-gated to April 1). | `setup.js` |
| `aizoo20260401/` | April Fools 2026 "AI Zoo" banner (date-gated to April 1). | `setup.js` |
| `dev/`, `dev-dist/` | Dev scaffolding for codegraph (`dev/codegraph/codegraphdev.html`, Parcel target `dev-codegraph`). | — |

## Build notes

- `jscomponents/package.json` `build` script only compiles the codegraph headless exporter (needed before a full site build); everything else is bundled on-demand by the site's Parcel run. Root `yarn buildall` = jscomponents build + site build.
- `.parcelrc`: Terser optimizer (SWC breaks codegraph/FLM code), `@phfaist/parcel-resolver-root` for `~/` paths.
- Key deps: React 18, Cytoscape 3, @uiw/react-codemirror, Tippy.js, MathJax (CDN), @phfaist/zoodbtools_* packages.
