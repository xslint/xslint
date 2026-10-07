# Usage

You can check all files in current directory:

```bash
xslint
```

To check specified files - provide them as arguments:

```bash
xslint path/to/your/file1.xsl path/to/your/file2.xslt
```

Either spelling of the name is read, `.xsl` and `.xslt`. A directory is walked
for both and everything else in it is stepped over, while a file named on the
command line under any other suffix earns a warning rather than being counted
as clean. A `.git` or a `node_modules` is never opened, wherever in the tree it
stands, and neither is a directory the project's own `.gitignore` files name —
a tree the project does not track is not its source. A file git tracks is read
whatever a line says of it, the way git itself reads one, and a path given on the
command line is read whatever those files say about it.

A run reports the checks of one preset. `recommended`, the default, holds what
a processor refuses and the dead code whose report is almost never wrong;
`all` holds every check in the catalog, style checks and unused variables
included. The [check catalog](../index.html) marks the preset each check belongs to:

```bash
xslint --preset all
```

You can suppress some [checks](../index.html) by using `--suppress` option:

```bash
xslint --suppress=confusing-variable-and-node
```

You can skip several checks at once if they contain a certain substring:

```bash
xslint --suppress=unused
```

If you want to suppress many checks, list them with commas, or use `--suppress`
as many times as you need:

```bash
xslint --suppress=oversized-template,short-names
xslint --suppress=oversized-template --suppress=short-names
```

To ask one question of a whole tree, run only the checks you name with
`--only`. It matches by substring the way `--suppress` does, it takes a
comma-separated list or may be given as many times as you need, and it reaches
any check in the catalog whatever the preset:

```bash
xslint --only=short-names,unused
xslint --only=short-names --only=unused
```

The two combine, and a suppression always wins: a check both of them name stays
quiet, so this runs every `unused-*` check but `unused-variable`:

```bash
xslint --only=unused --suppress=unused-variable
```

A substring in either flag that no check name holds stops the run before it
checks anything, names that substring, and exits with `1`, so a typo cannot
pass for a clean report.
