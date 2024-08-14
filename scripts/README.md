# Helper scripts to manage stuff in the zoo

These scripts can be run using the syntax:
```
eczoo_sitegen> yarn node scripts/MYSCRIPT  [...arguments]
```

Try `--help` in the place of `[...arguments]` to get a list of arguments
the script accepts.

Try also `--no-warnings` immediately after `yarn node` if you're annoyed by
some warnings (`ExperimentalWarnings`) that `node` displays.


## List ancestors of a given code

### Simply listing ancestors and code hierarchy tree

List the ancestors tree of the surface code (with CODE_ID "surface"):
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors  surface
```

Simple list of all ancestors of a given code, sorted such that parents
appear before children:
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors --linear  surface
```

To show the information, for each individual ancestor, of through which parental
relationship paths the code is an acestor, use:
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors --list-by-ancestor  surface
```
If you're only interested in information about specific ancestors, try
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors --list-by-ancestor --show-only-ancestors=css,galois_css surface
```

In all cases you can use `--full-names` to show the full names of the codes,
not only the CODE_ID's.

### Detecting degenerate paths in graph

I call "degenerate paths" a set of distinct paths with same start and end points following
the parent relationships.  The `ancestorsTools` script provides a routine to find such
paths.

Try:
```
eczoo_sitegen> yarn node scripts/ancestorsTools detect-degenerate-paths --full-names
```

You can also use `--full-names` to get full code names, not just ID's.

You can also inspect the ancestry of one or more specific codes, instead of listing all
degenerate paths one can find in the zoo:
```
eczoo_sitegen> yarn node scripts/ancestorsTools detect-degenerate-paths galois_css,stabilizer
```

## Query bibliographic references in the zoo

List bibliographic references that appear in the zoo.  Can select only a specific
reference type ("cite prefix") or inspect only codes that belong to a specific
domain.  Check `--help` info for more details.

Try, e.g.:
```
eczoo_sitegen> yarn node scripts/query_bib_references --cite-prefix=doi --include-source-path
```
