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

List the ancestors tree of the surface code (with CODE_ID "surface"):
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors  surface
```

Simple list of all ancestors of a given code, sorted such that parents
appear before children:
```
eczoo_sitegen> yarn node scripts/ancestorsTools list-ancestors --linear  surface
```

In either case you can use `--full-names` to show the full names of the codes,
not only the CODE_ID's.


## Query bibliographic references in the zoo

List bibliographic references that appear in the zoo.  Can select only a specific
reference type ("cite prefix") or inspect only codes that belong to a specific
domain.  Check `--help` info for more details.

Try, e.g.:
```
eczoo_sitegen> yarn node scripts/query_bib_references --cite-prefix=doi --include-source-path
```
