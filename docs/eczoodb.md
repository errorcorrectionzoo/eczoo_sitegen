# `eczoodb/` — Zoo Backend (ZooDb-based in-memory database)

Package `@errorcorrectionzoo/eczoodb`. Loads YAML data from the sibling
`../eczoo_data` repo into a typed object graph, and provides the HTML render
functions for each page type. Built on `@phfaist/zoodb`
(https://zoodb.readthedocs.io).

## Core files

| File | Purpose |
|---|---|
| `eczoodb.js` | Main module. `EcZooDb` class (~line 169, extends `ZooDb`) and `createEcZooDb(config)` factory (~line 1007). Default config: relation populators, FLM environment, citation sources (arxiv, doi, manual, preset, qecdborg), searchable text. |
| `load_yamldb.js` | `createEcZooYamlDbDataLoader(zoodb)` — standard ZooDb YAML loader configured by `objects_config.js`. |
| `objects_config.js` | Maps object types → data paths in eczoo_data: `code` ← `codes/`, `domain`/`kingdom` ← `codetree/*.yml`, `codelist` ← `codelists/`, `user` ← `users/users_db.yml`, `space` ← `code_extra/spaces.yml`. |
| `fullopts.js` | `get_eczoo_full_options()` — full processor configuration (stats processor priority 80, codelist populate processor priority 30, FLM, citations, searchable text). Used by site build and scripts. |
| `permalinks.js` | `zoo_object_permalink(object_type, object_id)` — URL scheme: code → `/c/{id}`, codelist → `/list/{id}`, user → `/team#u-{id}`, etc. |
| `dirs_defaults.js` | Default dirs: citations cache (`_zoodb_citations_cache/`, overridable via `ECZOO_CITATIONS_CACHE_DIR` env var), schema root (`schemas/`). `.browser.js` variant for browser builds. |
| `compile_codelist.js` | `EczPopulateCodeListsDbProcessor` + `run_predicate()` — predicate logic for code lists (`descendant_of`, `property`, `domain`, `manual_code_list`, `any_*`, `all_*`, `not_*`, `exclude`). See `CODELISTS_HOWTO.md`. |
| `stats.js` | `EczStatsDbProcessor`, `get_home_page_stats()`, code family tree statistics. |
| `citeextsources.js` | `CiteSourceExternalQecdbOrg` — custom citation source for qecdb.org references. |
| `eczoo-bib-style.{json,js,csl}` | CSL bibliography style (JSON imported via `eczoo-bib-style.js` to avoid import-attribute syntax issues in browsers). |

## Render functions (used by `site/src/*.11ty.js` pages)

| File | Key function |
|---|---|
| `render_code.js` | `render_code_page(code, {...})` (~line 175) — full code page HTML: name, description, features, relations, hierarchy. |
| `render_code_hierarchy.js` | `get_code_hierarchy_info()`, `render_code_hierarchy_content()` — ancestor/descendant tree on code pages. |
| `render_codelist.js` | `render_codelist_page()` (~line 188). |
| `render_domain.js` / `render_kingdom.js` | `render_domain()` / `render_kingdom()`. |
| `render_person.js` | `render_person()` — team page entries. |
| `render_utils.js` | `render_meta_changelog()`, `render_stat_num_codes()`, placeholder ref resolver. |

All rendering goes through FLM (zooflm) render contexts; output is HTML strings
consumed by Eleventy templates.

## Schemas (`schemas/`)

YAML files in JSON-Schema draft-06 format with ZooDb extensions (`_zoo_*`,
`_flm:` markers indicating FLM-processed fields: `standalone` = can be rendered
in any context (no figures, no references, no citations) and typically inline;
`full` = can use all FLM features, including cross-references, figures, etc.).

Main object types: `code.yml`, `domain.yml`, `kingdom.yml`, `codelist.yml`,
`user.yml`, `space.yml`. Supporting: `code_relation_list.yml`,
`code_features.yml`, `codelist_predicate.yml`, `meta.yml`.

Key `code` fields: `code_id` (pattern `^[a-z0-9_.-]+$`), `name`, `short_name`,
`description`, `physical`/`logical` (space refs), `protection`, `features.*`
(rate, encoders, decoders, threshold, fault_tolerance, ...),
`relations.parents`/`cousins` (each `{code_id, detail}`), `realizations`,
`notes`, `_meta.changelog` (`{user_id, date}` entries).

ZooDb auto-populates back-references: `relations.parents` ↔ `relations.parent_of`,
`cousins` ↔ `cousin_of`.

## EcZooDb useful methods

- `code_visit_relations(code, {relation_properties, callback, ...})` — BFS over relations
- `code_is_descendant_of(code, parent_code_id)`, `code_is_cousin_of(...)`
- `code_parent_domains(code, {...})`, `code_parent_kingdoms(code, {...})`
- `code_get_primary_parent(code)` → `{code|domain|kingdom, relation_object}`
- `codelist_compiled_code_id_list/list/set(codelist)`
- `zoo_object_permalink(type, id)`

Objects accessible as `eczoodb.objects.code[code_id]`, `eczoodb.objects.domain[...]`, etc.

## Loading the zoo (canonical pattern)

```js
const eczoodb = await createEcZooDb({ fs, fs_data_dir: '/path/to/eczoo_data', ...options });
const yaml_loader = await createEcZooYamlDbDataLoader(eczoodb);
eczoodb.install_zoo_loader_handler(new ZooDbDataLoaderHandler(yaml_loader));
await eczoodb.load();
```

See working examples: `eczoodb/scripts/try_load_zoo.js`,
`site/sitelib/build_eczoo.js`, `scripts/_helpers/helperEcZooLoader.js`
(exports `loadEcZoo()` — easiest entry point for ad-hoc scripts).

## Tests

Mocha tests in `eczoodb/test/` (run with `yarn test` inside `eczoodb/`):
`test_eczoodb.js`, `test_load_yamldb.js`, `test_render_code.js`,
`test_render_codelist.js`, `test_compile_codelists.js` (largest),
`test_stats.js`. Helper `test/_loadeczoodb.js` exports `load_eczoo()` which
loads the small fixture zoo in `eczoodb/test_data/` with citations cache
`_TEST_zoodb_citations_cache/`.
