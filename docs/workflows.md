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
- Builds use the `debug` package; the site build scripts already set `DEBUG=...`. For your own scripts: `DEBUG='eczoodb,zoodb*' yarn node ...`. `DEBUG` does not reach the headless graph exporter's page: set `ECZOO_HEADLESS_PAGE_DEBUG='*'` (or narrower namespaces) to see its `debug()` messages.
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

## `eczoohelpers/buildcache`

Package `@errorcorrectionzoo/buildcache` (Node only): a small wasm-bindgen
binding of the Rust crate [cachette](https://crates.io/crates/cachette) (0.1)
to `node:fs`. Rust in `src/lib.rs`, host functions and an in-process lock
table in `js/host.js`, API in `index.js`: `openCacheManager()` →
`openValuesCache()` → `get()`/`put()`/`close()`, `maintain()`; see its
`README.md`. Used by `site/sitelib/init_headless_graph_exporter.js` for the
graph SVG cache.

- The build is committed in `dist/` (glue `buildcache.js`, `buildcache_bg.wasm`, `BUILD_INFO.json`), so no Rust toolchain is needed to use it.
- Rebuild only when `src/`, `Cargo.toml` or `Cargo.lock` change (e.g. a new cachette: `cargo update -p cachette`): needs `rustup target add wasm32-unknown-unknown` and `wasm-pack`; then `yarn build` there (`tools/build.mjs`: wasm-pack build, machine paths remapped and checked, output copied to `dist/`; cargo output stays in the ignored `target/`). Commit `dist/` with `Cargo.lock`.
- Tests: `cd eczoohelpers/buildcache && yarn test` (mocha). The GitHub CI (`.github/workflows/eczoodb-ci-test.yml`) runs them after the eczoodb tests.

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

## `_eczoo_graph_svg_cache/`

Cache of the code-graph SVGs that builds with SVG exports (not
`ECZOO_DEVELOPMENT_MODE=1`) render with the headless exporter; a cachette
cache through `eczoohelpers/buildcache`, gitignored. How the build uses it:
[site.md](site.md).

- Location: `_eczoo_graph_svg_cache/` at the repo root; `_TEST_eczoo_graph_svg_cache/` with `ECZOO_USE_TEST_DATA=1`. Override with `ECZOO_GRAPH_SVG_CACHE_DIR` (relative to the repo root, or absolute).
- Mode `ECZOO_GRAPH_SVG_CACHE`: `1` (default) uses it; `0` neither reads nor writes it; `refresh` renders every graph and overwrites its entry; `verify` renders every graph, compares it with the cached SVG, prints a `VERIFY MISMATCH` error for each difference and replaces that entry (the build does not fail), and stores missing entries.
- Each build prints `graph SVG cache [mode …]: N graphs: … hits, … misses, …`.
- A graph is rendered again only when its key changes: what it shows (visible subgraph, options). Every key changes with the exporter's code (bundle rebuilt with `yarn build` in jscomponents, `headlessGraphExporter.js`), a puppeteer/Chrome upgrade, or other label font metrics (e.g. Source Sans Pro installed). To start over, delete the folder or build once with `refresh`.
- Pruning: at the end of a build, maintenance (at most once a day) removes values not used for 60 days, and data beyond 1 GiB (down to 80%). One full set is ~37 MB.
- Only one process at a time may use a cache folder (no cross-process locks): two simultaneous builds need different `ECZOO_GRAPH_SVG_CACHE_DIR`.
- CI: the eczoo_data workflows `build-and-deploy-site.yml` and `devsite-build-and-deploy.yml` set `ECZOO_GRAPH_SVG_CACHE_DIR: "_eczoo_graph_svg_cache"` and restore/save `eczoo_sitegen/_eczoo_graph_svg_cache` with `actions/cache` (key `eczoo-graph-svg-cache-<run_id>-<run_attempt>`, restored by prefix; the devsite saves under `devsite-eczoo-graph-svg-cache-` and falls back to the main site's). `yarn buildall` rebuilds the exporter bundle there, so CI hits rely on that build being deterministic; GitHub drops entries unused for 7 days.

## `pdfexport/` (semi-maintained)

LaTeX/PDF export of code pages: `main.js` loads the zoo and emits LaTeX via
`gen_latex.js` / `gen_latex_code_page.js`; needs `latexmk` and ImageMagick.
