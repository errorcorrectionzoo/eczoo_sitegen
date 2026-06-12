# eczoo_sitegen — Error Correction Zoo site generator

Generates the static website https://errorcorrectionzoo.org. Zoo *content*
(YAML code descriptions) lives in the sibling repo `../eczoo_data`; this repo
only contains the generator code.

## Read these first

- `docs/architecture.md` — repo map, data flow, object model (code/domain/kingdom/codelist/user/space)
- `docs/eczoodb.md` — backend: `EcZooDb` class, schemas, render functions, loading pattern, tests
- `docs/site.md` — Eleventy build, page sources, templates, SCSS, env vars, build scripts
- `docs/jscomponents.md` — browser components and how `site/jsc_profiles/` integrates them
- `docs/workflows.md` — commands, CLI scripts, preview tool, citations cache, Parcel helpers
- `flm_howto.md` (repo root) — FLM markup language used for all zoo content

## Pipeline in one line

`../eczoo_data` YAML → `eczoodb/` (in-memory ZooDb, FLM, citations) → `site/`
(Eleventy + Parcel) → `site/_site/` static output; client JS from
`jscomponents/` via `site/jsc_profiles/`.

## Essential commands

```bash
yarn install                            # repo root (Yarn 3 workspaces, node_modules linker)
cd site && yarn build                   # full production build → site/_site/
cd site && yarn build-test-simple       # fast build with test data, no SVG exports
cd site && yarn dev                     # watch + serve on localhost:8080
cd site && yarn preview                 # live preview of eczoo_data edits (port 8087)
cd eczoodb && yarn test                 # mocha backend tests
```

Fast iteration env vars: `ECZOO_USE_TEST_DATA=1` (small fixture zoo),
`ECZOO_DEVELOPMENT_MODE=1` (skip SVG graph exports),
`ECZOO_RUN_11TY_PARCEL=0` (skip JS bundling).

## Conventions & gotchas

- Yarn 3 workspaces.  Use `yarn node` to run scripts (repo convention, ensures workspace resolution).
- ES modules everywhere (`"type": "module"`).   We use `node_modules` as configured in `.yarnrc.yml`, not Plug'n'Play, to avoid some issues with package resolution and with parcel.
- Files ending in `~` are editor backups — ignore, never edit.
- Ignore legacy folders: `pyeczoo/`, `site/old_edit_code_app_pkg/`, `site/_site.bkp/`, `jscomponents/editcode/` and `editcodelegacy/`; `pdfexport/` is semi-maintained.
- `_zoodb_citations_cache/cache_downloaded_info.json` is modified by normal builds; that git churn is expected.
- Content fields are FLM markup (LaTeX-like), not plain HTML/Markdown.
- To load the zoo in an ad-hoc script, use `scripts/_helpers/helperEcZooLoader.js` (`loadEcZoo()`).
- `jscomponents/paywall20250401/` and `aizoo20260401/` are date-gated April Fools jokes — leave alone.

## Additional docs

- `CODELISTS_HOWTO.md` - specification and howto for code lists.
