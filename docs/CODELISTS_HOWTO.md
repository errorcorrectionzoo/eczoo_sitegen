# Code Lists: How They Work

This document explains how code lists are defined, compiled, and rendered in the
Error Correction Zoo.

## Overview

A **codelist** is a YAML data object (schema: `schemas/codelist.yml`) that
specifies:

1. **Which codes** to include (via predicates),
2. **How to sort** those codes, and
3. **How to display** them.

The compilation logic lives in `compile_codelist.js` (function `get_list_data()`).
Rendering is handled by `render_codelist.js`.

Codelist YAML files live in the data repository under `codelists/` and are
organized into subdirectories such as `descendants/` and `features/`.

---

## Top-level YAML structure

```yaml
list_id: 'my_list'          # required, unique identifier (lowercase, digits, underscores, dots, hyphens)

title: |                     # required, FLM standalone text
  My list title

intro: |                     # optional, FLM block-level text shown before the list
  Some introductory text with \hyperref[code:foo]{links}.

codes:                       # required
  select:                    # required, array of predicate collections
    - <predicate_collection_1>
    - <predicate_collection_2>

sort:                        # optional
  by: 'name'                 # field name to sort by (default: 'name')
  reverse: false             # reverse sort order (default: false)
  case_sensitive: false       # case-sensitive sort (default: false)
  parents_before_children: false  # topological sort (default: false)

display:                     # required
  style: index               # 'index' or 'table'
  options: { ... }           # style-specific options (see Display section)

metainfo:                    # optional, free-form metadata
  some_property: true
```

---

## Code selection: `codes.select`

The `codes.select` field is an **array of predicate collections**. Each predicate
collection is an object whose keys are predicate names.

### Combining logic

- **Within** a single predicate collection: all predicates combine with **AND**.
  A code must satisfy every predicate in the collection to be selected by that
  collection.

- **Across** predicate collections in the array: collections combine with **OR**.
  A code is included if it matches *any one* of the predicate collections.

```yaml
codes:
  select:
    # Collection 1: codes that are descendants of 'stabilizer' AND have threshold set
    - descendant_of: stabilizer
      property_set: features.threshold

    # Collection 2: codes that are descendants of 'holographic'
    - descendant_of: holographic

    # Result: union of both sets
```

### Special case: select all codes

An empty predicate collection `{}` matches all codes:

```yaml
codes:
  select:
    - {}
```

---

## Available predicates

All predicates are defined in `schemas/codelist_predicate.yml` and implemented in
`compile_codelist.js` (function `run_predicate()`).

### `descendant_of` family

Tests whether a code is a descendant (via parent relations) of a given code.

| Predicate | Argument | Meaning |
|-----------|----------|---------|
| `descendant_of` | `string` (code_id) | Code is a descendant of the given code |
| `any_descendant_of` | `[code_id, ...]` | Code is a descendant of **at least one** of the given codes |
| `all_descendant_of` | `[code_id, ...]` | Code is a descendant of **all** the given codes |
| `not_descendant_of` | `string` | Code is **not** a descendant of the given code |
| `not_any_descendant_of` | `[code_id, ...]` | Code is **not** a descendant of any of the given codes |
| `not_all_descendant_of` | `[code_id, ...]` | Code is **not** a descendant of all the given codes |

**Example:**
```yaml
codes:
  select:
    - descendant_of: topological
```

### `cousin_of` family

Tests whether a code has a direct cousin relation with a given code. (Checks
both `cousins` and `cousin_of` relations.)

| Predicate | Argument | Meaning |
|-----------|----------|---------|
| `cousin_of` | `string` (code_id) | Code is a direct cousin of the given code |
| `any_cousin_of` | `[code_id, ...]` | Code is a cousin of **at least one** of the given codes |
| `all_cousin_of` | `[code_id, ...]` | Code is a cousin of **all** the given codes |
| `not_cousin_of` | `string` | Code is **not** a cousin of the given code |
| `not_any_cousin_of` | `[code_id, ...]` | Code is **not** a cousin of any of the given codes |
| `not_all_cousin_of` | `[code_id, ...]` | Code is **not** a cousin of all the given codes |

**Example:**
```yaml
codes:
  select:
    - cousin_of: gray
```

### `domain` family

Tests whether a code belongs to a specific domain (via primary parent relations).

| Predicate | Argument | Meaning |
|-----------|----------|---------|
| `domain` | `string` (domain_id) | Code belongs to the given domain |
| `any_domain` | `[domain_id, ...]` | Code belongs to **at least one** of the given domains |
| `all_domain` | `[domain_id, ...]` | Code belongs to **all** of the given domains |
| `not_domain` | `string` | Code does **not** belong to the given domain |
| `not_any_domain` | `[domain_id, ...]` | Code does **not** belong to any of the given domains |
| `not_all_domain` | `[domain_id, ...]` | Code does **not** belong to all of the given domains |

**Example:** Select codes in the classical domain but not in quantum or c-q domains:
```yaml
codes:
  select:
    - domain: classical_domain
      not_any_domain: ['quantum_domain', 'classical_into_quantum_domain']
```

### `property_set` family

Tests whether a property (accessed by dot-separated path) is set to a
non-null/non-undefined value on a code.

| Predicate | Argument | Meaning |
|-----------|----------|---------|
| `property_set` | `string` (property path) | The property is set (non-null) |
| `any_property_set` | `[prop, ...]` | **At least one** of the properties is set |
| `all_property_set` | `[prop, ...]` | **All** of the properties are set |
| `not_property_set` | `string` | The property is **not** set |
| `not_any_property_set` | `[prop, ...]` | **None** of the properties is set |
| `not_all_property_set` | `[prop, ...]` | **Not all** of the properties are set |

Property paths can use dot notation to access nested fields, e.g.
`features.threshold`, `features.decoders`, `features.rate`.

**Example:**
```yaml
codes:
  select:
    - property_set: features.threshold
      not_descendant_of: ecc
```

### `property`

Tests whether a specific property has a specific value (strict JS equality `===`).

```yaml
codes:
  select:
    - property:
        name: 'some_field'
        value: 'some_value'
```

### `manual_code_list`

Includes only codes whose `code_id` appears in the given list.

```yaml
codes:
  select:
    - manual_code_list: ['code_id_1', 'code_id_2', 'code_id_3']
```

### `exclude`

Excludes codes whose `code_id` appears in the given list. Typically combined
with another predicate in the same collection.

```yaml
codes:
  select:
    - descendant_of: stabilizer
      exclude: ['some_code_to_skip', 'another_code']
```

---

## Predicate modifier prefixes

Many predicate base names support systematic modifier prefixes:

- **`not_`** — negates the result
- **`any_`** — argument is a list; returns true if the predicate holds for at
  least one element
- **`all_`** — argument is a list; returns true if the predicate holds for every
  element
- **`not_any_`** — negation of `any_` (none match)
- **`not_all_`** — negation of `all_` (not all match)

These prefixes apply to: `descendant_of`, `cousin_of`, `domain`, `property_set`.

---

## Sorting: `sort`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `by` | string | `'name'` | Code property to sort by. Dot-separated paths supported. |
| `reverse` | boolean | `false` | Reverse the sort order. |
| `case_sensitive` | boolean | `false` | If false, sort is case-insensitive. |
| `parents_before_children` | boolean | `false` | After primary sort, reorder so parents appear before children. |

If the `by` field refers to an FLM fragment (e.g., `name`), it is rendered to
plain text for comparison purposes.

---

## Display styles: `display`

### `index` style

Renders an ordered list (`<ol>`) of code names with links.

```yaml
display:
  style: index
  options:
    show_introduced: true              # show the "introduced" reference
    show_alternative_names: true       # show a.k.a. names
    show_description: true             # show code description (initially hidden)
    description_first_paragraph: true  # truncate description to first paragraph
    description_truncate_to: 200      # truncate description to N characters
```

### `table` style

Renders an HTML table with configurable columns.

```yaml
display:
  style: table
  options:
    cssclass: 'xtra-xtra-stretch'      # CSS class for the table
    columns:
      - property: name                  # code property to display
        title: Code                     # column header
        link_to_code: true              # make value a link to the code page
        cssclass: 'top left'            # CSS class for cells

      - property: description           # another column
        title: Description
        first_paragraph_only: true      # truncate FLM to first paragraph
        truncate_to: 300                # truncate FLM to N characters
        cssclass: 'textit'

      - predefined: counter             # special: row counter
        cssclass: 'small textit center top'

      - relationship_property: 'gray'   # extract field from a relationship
        property: 'detail'              # which field of the relation object
        title: 'Relation'
```

The `relationship_property` column type looks up a code's relationship (parent
or cousin) to a specific reference code (given by code_id) and extracts a field
from that relationship object (typically `detail`).

Possible CSS classes for the table: `xtra-stretch`, `xtra-xtra-stretch`, `hlines`.

Possible CSS classes for the columns: `small` (font size), `left`, `center`, `right`
(horizontal align) `top`, `bottom` (vertical alignment).

---

## Common patterns in existing code lists

### Pattern 1: All descendants of a code

The most common pattern. Selects all codes in the subtree below a given code.

```yaml
codes:
  select:
    - descendant_of: topological
```

Used by the majority of lists in `codelists/descendants/`.

### Pattern 2: Descendants and/or cousins of a code

Selects descendants plus direct cousins. Two separate predicate collections
(OR logic).

```yaml
codes:
  select:
    - descendant_of: self_correct
    - cousin_of: self_correct
```

Used for codes "related to" a given code family (e.g., `list_gray.yml`,
`list_self_correct.yml`, `list_quantum_inspired.yml`).

### Pattern 3: Domain-based selection

Selects all codes in a domain, typically excluding overlapping domains.

```yaml
codes:
  select:
    - domain: classical_domain
      not_any_domain: ['quantum_domain', 'classical_into_quantum_domain']
```

Used by the top-level domain lists (`list_classical.yml`, `list_quantum.yml`,
`list_classical_into_quantum.yml`).

### Pattern 4: Feature/property-based selection

Selects codes that have a specific property set, optionally constrained by
domain or ancestry.

```yaml
codes:
  select:
    - property_set: features.threshold
      not_descendant_of: ecc
```

Used by lists in `codelists/features/` (e.g., `list_threshold.yml`,
`list_decoders.yml`, `list_transversal.yml`).

### Pattern 5: Feature selection within a domain

Combines `property_set` with `domain` to list codes in a specific domain that
have a particular feature.

```yaml
codes:
  select:
    - property_set: features.decoders
      domain: classical_domain
```

### Pattern 6: All codes (no filter)

Selects every code in the database.

```yaml
codes:
  select:
    - {}
```

Used by `list_all.yml`.

---

## Compilation pipeline

1. **Filter**: Every code in `eczoodb.objects.code` is tested against
   `codelist.codes.select`. The predicate collections are evaluated with OR
   logic; within each collection, predicates combine with AND logic.

2. **Sort**: The filtered list is sorted by the field specified in `sort.by`
   (default: `name`). FLM fragments are rendered to plain text for comparison.
   If `sort.parents_before_children` is set, a topological reordering is applied
   after the primary sort.

3. **Render**: The sorted list is passed to the display style renderer (`index`
   or `table`), which generates HTML.

The compiled code list is also stored as computed data on the codelist object
(property `compiled_codes_info`) with fields `code_list`, `code_id_list`, and
`code_id_set` for use by other parts of the system.
