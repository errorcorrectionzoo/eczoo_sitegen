# `site/` — Eleventy Site Generation

Eleventy 3 build that turns the eczoodb object graph into static HTML in
`site/_site/`. Parcel is integrated into the Eleventy build (via
`@kitschpatrol/eleventy-plugin-parcel`) to bundle JS components and SCSS.

## `eleventy.config.js` (the heart of the build)

- Input `src/`, output `_site/`, includes `templates/`, layouts `templates/layout/`, global data dir `site_data/`. Template formats: html, md, njk, 11ty.js (most pages are `.11ty.js`).
- Global data `eczoodb` (~line 88): loads the zoo via `sitelib/build_eczoo.js` → `load_or_reload_eczoodb()`; cached & reloaded on watch changes (5s throttle). Also runs `prepareEczooBibReferences()` (`sitelib/prepare_eczoo_bibreferences.js`).
- Global data `eczoo_config` (~line 76): base URL, data dir, citations cache dir, SVG export toggle.
- Headless code-graph SVG exporter (Puppeteer Chrome) initialized for production builds (~line 109; `sitelib/init_headless_graph_exporter.js`); skipped in dev mode (placeholder SVGs via `sitelib/generatePlaceholderSvg.js`).
- Parcel plugin config (~lines 165–221): bundles `jsc_profiles/*.js` entry points and stylesheets into `/vv/` with hashed names; Terser (not SWC) for JS; middleware rewrites extensionless URLs to `.html`.
- Custom filter `getEczooAbsoluteUrl` (~line 157).

### Environment variables

| Var | Effect |
|---|---|
| `ECZOO_USE_TEST_DATA=1` | use small fixture zoo `eczoodb/test_data/` instead of `../../eczoo_data` |
| `ECZOO_DEVELOPMENT_MODE=1` | skip SVG graph exports, dev shortcuts |
| `ECZOO_RUN_11TY_PARCEL=0` | skip Parcel bundling entirely (fastest) |
| `ECZOO_RUN_11TY_PARCEL_LAZY=1` | lazy Parcel builds |
| `ECZOO_CITATIONS_CACHE_DIR` | override citations cache location |

### Build scripts (`site/package.json`)

| Command | Use |
|---|---|
| `yarn build` | full production build (Parcel + SVG exports), output `_site/` |
| `yarn build-simple` | dev-mode build (no SVG exports) |
| `yarn build-simple-noparcel` | fast build, no JS bundling |
| `yarn build-test` / `build-test-simple` | builds using test data (fast iteration) |
| `yarn dev` / `yarn dev-test` | watch + serve on localhost:8080 |
| `yarn serve` | serve a pre-built `_site/` (sirv) |

All builds clear `_site/` and `../.parcel-cache/` first, set `NODE_OPTIONS=--max-old-space-size=8192`, and post-process `/vv/*.js` to prepend `"use strict"`.

## Page sources (`src/`)

Pagination-driven pages (one output per zoo object, via `eczoodb.objects.*`):

| File | Output |
|---|---|
| `src/c/c.11ty.js` | `/c/{code_id}` — code pages. Data fn (~line 126) sets permalink, title, `jscomponents_profile: 'code_page'`, meta citation info; render fn (~line 231) calls `render_code_page()` from eczoodb. |
| `src/domain/domain.11ty.js`, `src/kingdom/kingdom.11ty.js` | domain / kingdom pages |
| `src/list/list.11ty.js` | codelist pages |
| `src/domain/domaingraph.11ty.js`, `src/kingdom/kingdomgraph.11ty.js`, `src/list/listgraph.11ty.js` | per-object code-graph SVGs (headless exporter) |
| `src/schemas/schemas.11ty.js` | `/schemas/*.json` schema exports |

Single pages: `index.11ty.js` (home), `lists.11ty.js`, `concepts.11ty.js`
(glossary of FLM-defined terms), `team.11ty.js`, `references.11ty.js`
(all citations), `sitemap.xml.11ty.js`, and HTML pages `about.html`,
`search.html`, `code_graph.html`, `edit_code.html`, `gitpreview.html`, `404.html`.

Data exports under `src/dat/`: `eczoodata.11ty.js` (full DB dump JSON, used
client-side by codegraph/editors), `searchindex.11ty.js` (lunr index, built by
`jscomponents/search/generate_index.js`), `randomcodedata.11ty.js`,
`bibreferences_bib.11ty.js` (.bib), `bibreferences_csl.11ty.js` (CSL-JSON).

Directory defaults: `src/src.11tydata.js` — layout `base_page`, git
last-modified dates, tag `sitePage` (used by sitemap).

## Layout & assets

- `templates/layout/base_page.11ty.js` (~lines 86–238) — master HTML shell: meta tags, favicon, fonts, nav links, stylesheet link, footer; injects the page's JS profile via `<script type="module" src="~/site/jsc_profiles/${jscomponents_profile}.js">` (~line 219). Pages control this via the `page_layout_info` object (`jscomponents_profile`, `wide_layout`, `header_navigation_links`, extra head content).
- `jsc_profiles/*.js` — one Parcel entry per page type; imports + initializes jscomponents (see [jscomponents.md](jscomponents.md)).
- `stylesheets/` — modular SCSS (~29 files), `main.scss` is the master import; compiled by Parcel. Page-specific files: `ecc-code-page.scss`, `codelist-page.scss`, `home-page.scss`, `search-page.scss`, `flm-formatting.scss`, etc.
- `tinyjavascript/` — small standalone scripts injected directly: `darkmode.js`, `copyboxedcontent.js`, `expandnavlinks.js`.
- `static/` (icons → `/icons/*`), `static_copy/` (robots.txt → site root); copied by `parcel-reporter-static-files-copy`.
- `site_data/` — global data: `home_page_data.js` (popular codes list), `notable_codes_hierarchy.js` (~123 code IDs highlighted in hierarchy trees).
- `sitelib/` — build helpers: `build_eczoo.js` (`load_or_reload_eczoodb`, ~line 38), `prepare_eczoo_bibreferences.js`, `init_headless_graph_exporter.js`, `generatePlaceholderSvg.js`.
- `.parcelrc` — custom transformers (sass, raw, og:image), optimizers (`parcel-optimizer-nohtmlsuffix`, terser), namer (`@errorcorrectionzoo/parcel-namer-own-folder-hashes` → `/vv/` hashed names), resolver (`@phfaist/parcel-resolver-root`, `~` prefix → repo root, `/` → `site/_site`).

## Output structure (`_site/`)

`index.html`, `c/*.html`, `domain/*.html` + `kgraph_*.svg`, `kingdom/`,
`list/`, `vv/` (hashed JS/CSS bundles), `dat/` (JSON/bib exports), `schemas/`,
`sitemap.xml`, `icons/`, top-level pages.
