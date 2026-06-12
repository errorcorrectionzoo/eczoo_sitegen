# Workflows, Scripts & Helper Packages

## Common developer workflows

All commands assume Yarn 3 (`corepack enable`, `yarn install` at repo root)
and the data repo cloned as a sibling: `../eczoo_data`.

| Task | Command |
|---|---|
| Full production build | `cd site && yarn build` → output in `site/_site/` (root: `yarn buildall` also rebuilds jscomponents' headless exporter first) |
| Fast dev build (test data, no SVG exports) | `cd site && yarn build-test-simple` |
| Dev server with watch | `cd site && yarn dev` (localhost:8080); `yarn dev-test` for test data |
| Serve a built site | `cd site && yarn serve` (or root `yarn serve`) |
| Live preview while editing eczoo_data | `cd site && yarn preview` or root `yarn preview` (localhost:8087) |
| Backend tests | `cd eczoodb && yarn test` (mocha) |
| Lint | root `yarn lint` (eslint) |
| Quick zoo-load sanity check | `yarn node eczoodb/scripts/try_load_zoo.js --data-dir ../eczoo_data` |

Debugging tips:
- Builds use the `debug` package; the site build scripts already set `DEBUG=...`. For your own scripts: `DEBUG='eczoodb,zoodb*' yarn node ...`.
- For fast iteration on site templates: `ECZOO_USE_TEST_DATA=1` + `ECZOO_RUN_11TY_PARCEL=0` (or use `build-test-simple` / `build-simple-noparcel`).
- The full build is memory-hungry (`--max-old-space-size=8192` already set in scripts).

## `previewtool/` — live preview server

- `runPreview.js` starts a `PreviewAppServer` (`@phfaist/zoodbtools_previewremote`), Parcel-compiles `previewApp.html`/`previewApp.jsx` and serves it on **port 8087** (default in `startRemotePreviewApp.js`).
- The browser app loads the zoo from `../eczoo_data` through a remote-fs client; the user clicks "RELOAD" to pick up YAML edits.
- Citations are resolved from the precompiled cache (`_zoodb_citations_cache/cache_compiled_citations.json`) because DOI/arXiv APIs are blocked by CORS in the browser.

## `scripts/` — CLI utilities

Run with `yarn node scripts/<script>.js` (see `scripts/README.md`).

| Script | Purpose |
|---|---|
| `ancestorsTools.js` | Analyze code hierarchy: list ancestors/descendants, detect degenerate parent paths. |
| `zooStats.js` | Zoo statistics; CSV output of code properties/domains/metadata. |
| `bibrefs/collectBibRefs.js` | Collect bibliography references from the zoo (uses `EczBibReferencesCollector`); regex cite-pattern + domain filters; CSV/BibTeX output. |
| `query_bib_references.js` | DEPRECATED — use `bibrefs/collectBibRefs.js`. |
| `genCodeGraph/genCodeGraph.js` | Generate code-graph SVGs interactively (headless exporter); options in `genCodeGraph/my_graph_options.js`. |
| `llm/gen_inputs_v1.js` | Curate zoo data as LLM inputs. |
| `_helpers/helperEcZooLoader.js` | `loadEcZoo()` — the easiest way to load the full zoo in an ad-hoc script (configures cache dir, FLM, permalinks). Also `_helpers/helperLogs.js`. |

## `eczoohelpers/eczcollectbib`

`collectbib.js` defines `EczBibReferencesCollector`: collects citations
encountered by the FLM processor, parses author/year, generates BibTeX
(`generatebibtex.js`) and CSL-formatted bibliography entries. Used by the site
build (`site/sitelib/prepare_eczoo_bibreferences.js` → `/dat/bibreferences.*`
exports and `/references.html`) and by `scripts/bibrefs/`.

## `helpers/` — Parcel plugins

- `parcel-namer-own-folder-hashes/namerPlugin.js` — names bundles `vv/{abbreviated-stem}-{hash}.{ext}` (e.g. "eczoo"→"ecz"); leaves favicons at default names.
- `parcel-transformer-ogimage-phf/index.js` — rewrites relative `og:image` / `twitter:image` meta URLs to absolute URLs (base taken from `og:url`).

## `_zoodb_citations_cache/`

Cache of citation metadata fetched from arXiv/DOI APIs (a yarn workspace so it
can be referenced as a package).

- `cache_downloaded_info.json` (~12 MB) — raw fetched metadata per citation key. Frequently modified by builds; commit churn here is normal.
- `cache_compiled_citations.json` — precompiled CSL-rendered citation text (used by previewtool to avoid CORS).
- `_anystyle_manual_citations_cache.json` — anystyle-parsed manual citations.

Override location with `ECZOO_CITATIONS_CACHE_DIR`. Tests use the separate
`_TEST_zoodb_citations_cache/`.

## `pdfexport/` (semi-maintained)

LaTeX/PDF export of code pages: `main.js` loads the zoo and emits LaTeX via
`gen_latex.js` / `gen_latex_code_page.js`; needs `latexmk` and ImageMagick.
