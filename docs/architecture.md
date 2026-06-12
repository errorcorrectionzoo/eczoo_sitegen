# Repository Architecture Overview

This repo (`eczoo_sitegen`) contains all code to generate the [Error Correction Zoo](https://errorcorrectionzoo.org) website. The zoo *content* (YAML files describing codes) lives in a **sibling repository** `../eczoo_data` (https://github.com/errorcorrectionzoo/eczoo_data).

## Big picture data flow

```
../eczoo_data/ (YAML: codes/, codetree/, codelists/, users/, code_extra/)
        │
        ▼
eczoodb/  ──  in-memory zoo database (EcZooDb class, built on @phfaist/zoodb)
        │     loads YAML, validates against schemas/, resolves relations,
        │     processes FLM markup, citations, code lists, stats
        ▼
site/  ──  Eleventy (11ty) static site generator
        │     paginates over eczoodb objects → one HTML page per code/domain/
        │     kingdom/list; integrates Parcel for JS/CSS bundling
        ▼
site/_site/  ──  final static website output (deployed to errorcorrectionzoo.org)
```

Client-side interactivity (code graph, search, popups, MathJax, ...) comes from
`jscomponents/`, bundled by Parcel via entry-point "profiles" in `site/jsc_profiles/`.

## Repo map (active folders)

| Folder | Purpose | Doc |
|---|---|---|
| `eczoodb/` | Backend: zoo in-memory representation (ZooDb), schemas, page render functions | [eczoodb.md](eczoodb.md) |
| `site/` | Eleventy HTML site generation, templates, stylesheets | [site.md](site.md) |
| `jscomponents/` | Browser JS components (codegraph, search, mathjax, ...) | [jscomponents.md](jscomponents.md) |
| `helpers/` | Parcel plugins (bundle namer, og:image URL transformer) | [workflows.md](workflows.md) |
| `eczoohelpers/eczcollectbib/` | Bibliography collection (`EczBibReferencesCollector`) | [workflows.md](workflows.md) |
| `scripts/` | CLI utility scripts (stats, ancestors, bib queries, graph gen, LLM inputs) | [workflows.md](workflows.md) |
| `previewtool/` | Live preview server (port 8087) for editing eczoo_data YAML | [workflows.md](workflows.md) |
| `_zoodb_citations_cache/` | Cached citation metadata downloaded from arXiv/DOI APIs | [workflows.md](workflows.md) |

### Mostly inactive / legacy folders (usually ignore)

- `pdfexport/` — LaTeX/PDF exporter for code pages (semi-maintained, requires latexmk + ImageMagick)
- `pyeczoo/` — old Python code
- `site/old_edit_code_app_pkg/`, `site/_site.bkp/`, `jscomponents/editcode/`, and `editcodelegacy/`
- `artwork/` — graphic assets sources
- Files ending in `~` are editor backups; ignore them.

## Key technologies

- **ZooDb** (`@phfaist/zoodb`, https://zoodb.readthedocs.io) — schema-driven YAML database with relations, processors, citations. `EcZooDb` extends `ZooDb`.
- **FLM** ("Flexible LaTeX-like Markup", `@phfaist/zoodb/zooflm`) — markup language used for all zoo content (descriptions, names). See `flm_howto.md` at repo root.  Uses a JS transpiled version of `https://github.com/phfaist/flm`, integrated into the zoodb package.
- **Eleventy 3** — static site generator; pages are mostly `.11ty.js` JavaScript templates.
- **Parcel 2** — bundles JS components and SCSS; integrated into the Eleventy build via `@kitschpatrol/eleventy-plugin-parcel`.
- **Yarn 3 workspaces** (`yarn@3.3.0`, `nodeLinker: node-modules` in `.yarnrc.yml` — not PnP) — monorepo; workspaces declared in root `package.json`.
- **React 18** (some components), **Cytoscape** (code graph), **Lunr** (search), **MathJax 3** (math), **citation-js / CSL** (bibliography).

## Workspaces (root package.json)

`_zoodb_citations_cache`, `eczoodb`, `eczoohelpers/eczcollectbib`, `jscomponents`,
`site`, `scripts`, `previewtool`, `helpers/parcel-namer-own-folder-hashes`,
`helpers/parcel-transformer-ogimage-phf`.

Internal packages are named `@errorcorrectionzoo/eczoodb`, `@errorcorrectionzoo/jscomponents`, etc.

## Zoo object model (quick reference)

- **code** — an error-correcting code; the central object type. ID: `code_id`. URL: `/c/{code_id}`.
- **domain** — top-level category (e.g. classical, quantum). URL: `/domain/{id}`.
- **kingdom** — subcategory within a domain. URL: `/kingdom/{id}`.
- **codelist** — predicate-defined list of codes. URL: `/list/{id}`.
- **user** — contributor. URL: `/team#u-{user_id}`.
- **space** — physical/logical space a code lives in.

Codes form a directed acyclic graph via `relations.parents` (with auto-populated back-references
`parent_of`) plus non-hierarchical `relations.cousins`. Domains/kingdoms anchor
the hierarchy through codes' `relations.root_for_domain` / `root_for_kingdom`.
