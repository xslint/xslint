# Architecture

How xslint is built. The rules an agent follows are in [`AGENTS.md`](AGENTS.md);
why a piece is built the way it is lives in the ticket its code cites.

## Staging

xslint lints XSL stylesheets in two stages. **Validators** establish that the
input is valid; **linters** run only over what passed. Each validator hands the
valid part on and reports the rest, so one broken file or malformed expression
never hides the feedback on everything else, and one fault draws one defect.

```text
src/index.mjs             CLI entry (commander.js, ESM)
  src/xslint.js           discovery, config, run order, output; exports lint()
    src/validators/ — partition the input, report the bad part:
      xsl-validator.js           well-formed XML  -> builds the corpus
      xpath-validator.js         XPath syntax     -> keeps the valid expressions
    src/linters/, document — (corpus, suppressions) => defects:
      xpath-linter.js            declarative checks/xpath/*.yaml (per file)
      corpus-linter.js           declarative checks/corpus/*.yaml (cross file)
      namespace, result-namespace, import, output, parameter,
      element, variable, root-template — the DOM, not one expression
    src/linters/, expression — (expressions, suppressions) => defects:
      *-linter.js                code-based checks/format/*.yaml (one construct each)
```

An expression linter is handed the `expressionsOf` records the XPath validator
kept, so a refused expression reaches no check at all.

`lint(sources, {suppress, overrides, only, preset}) => defects` in
`src/xslint.js` is the whole staging as a pure function: no file I/O, no
output, no exit, and the defects in one total order. The command-line
`xslint(paths, options)` wraps it: it resolves config, reads the files, calls
`lint`, applies `--fix`, reports, and sets `process.exitCode`. The editor
integrations (`xslint-lsp`, `xslint-jetbrains`) use what the package `main`
re-exports, listed in the index. `src/index.mjs` imports the pipeline inside
the command action, so `--version` and `--help` load none of it.

Each linter is one `{name, run, checks}` entry in `LINTERS` or
`EXPRESSION_LINTERS` in `src/xslint.js`. The `CHECKS` names that `--suppress`
and config globs match are derived from those entries.

## Expressions

`expressionsOf` in `src/attributes.js` yields one `found` record,
`{node, start, expression, pattern, version}`, for every expression a
stylesheet carries:

- an XPath or pattern attribute of an XSLT element, whole, and one of the same
  names in the XSLT namespace on any other element (`xsl:use-when`);
- each expression an attribute value template encloses in braces, offset to
  where it starts, and each a text value template encloses where the nearest
  `expand-text` is on;
- a shadow attribute (`_select` for `select`), which overrules the plain one.

The namespace decides, never the name, so the `select` of a literal result
element is text bound for the result tree and is left alone. `pattern` says
which language the text is in: a rewrite legal in an expression can be a syntax
error in a pattern. `version` is the version in force at the node, read from
the element itself or its innermost ancestor declaring one: `version` (or
`_version`) on an XSLT element other than `xsl:output`, `xsl:version` on any
other element.

`src/xpath.js` registers five selector functions: `xslint:normalize-space`
(XML's whitespace), `xslint:version`, `xslint:attribute` (a value in either
spelling), `xslint:name` (an expanded name), and `xslint:conditional`.

## Checks

A check is one entry of four kinds, each a YAML, a motive, and a test.

| Kind | YAML | Detection | Reported node |
| --- | --- | --- | --- |
| `xpath` | `xpath` + `severity` + `message` | the XPath selects violations | selected node |
| `corpus` | `declaration`/`usage` (+ `reference`/`scoped`/`reachable`) | cross-file, declarative | the declaration |
| `validation` | `severity` + `message` | code (well-formedness, XPath syntax) | in code |
| `format` | `severity` + `message` | code (a `src/linters/*-linter.js`) | in code |

Per-file rule, `src/resources/checks/xpath/<name>.yaml`:

```yaml
xpath: <XPath selecting the violation nodes>
severity: warning|error
message: <the fault. The remedy.>
fix: <optional safe|suggestion|[ safe, suggestion ]>
preset: recommended|all
```

Cross-file rule, `src/resources/checks/corpus/<name>.yaml`:

```yaml
declaration: <XPath selecting declared nodes that carry an @name>
usage: <XPath selecting the used names, across the whole corpus>
reference: <optional call|variable>
scoped: <optional true>
reachable: <optional true>
severity: warning|error
message: <the fault. The remedy.>
preset: recommended|all
```

Without `reference`, a declaration is a defect when its `@name` matches no
`usage` value reached from outside every declaration, or from one nothing
names. With `reference`, every usage value is lexed as XPath and the name is
looked for among what its tokens reference: a `call` is a name opening a
bracket or behind a `#`, matched by URI, local name and arity; a `variable` is
a name behind a `$`. `reachable: true` follows the call graph from outside
every declaration body, so a callee of an uncalled declaration is a defect;
`scoped: true` counts usage only within the declaration's subtree or an
importing file. Usage is followed across files, so a function a library
declares and another file calls is never flagged.

`fix:` names the tier every fix of the check lands in, and is the one place a
tier is spelled. `preset:` names the first preset holding the check;
`recommended` holds every error a processor refuses a stylesheet over and the
dead code whose reports held over the corpora, bar `unused-variable`.

`npx grunt checks` renders every YAML into `src/resources/checks.json`, which
is what a run reads; `test/conformance.test.js` re-renders it and fails on any
difference.

### Adding a check

- **xpath rule**: `checks/xpath/<name>.yaml` and
  `test/resources/xpath-packs/<name>.yaml`.
- **corpus rule**: `checks/corpus/<name>.yaml` and
  `test/resources/corpus-packs/<name>.yaml`.
- **format check**: a `src/linters/<name>-linter.js` wired into `LINTERS` or
  `EXPRESSION_LINTERS`, with a YAML tuning `severity` and `message`. It detects
  on the tree: `gathered(found, kinds)` for the nodes it is about, `textOf` and
  `offsetOf` for what one spans and where, `calls` for a standard function
  call, `operatorOf` for the operator between two operands, all in
  `src/syntax.js`. It takes kinds rather than a kind, since a general and a
  value comparison are two. Where the place a construct stands decides it,
  `src/booleans.js` answers whether only an effective boolean value is taken
  there. It builds defects with `metaOf`, `suppressed` and `defect` from
  `src/checks.js`, and narrows to one attribute through `whole(found, name)`.

Every check needs a motive at `src/resources/motives/<kind>/<name>.md` and a
test; `test/conformance.test.js` enforces the name, the motive and the pack.

### Rules for a check

- **Version-dependence.** Read the version off `found.version` and gate with
  `since` against a floor; a selector asks `xslint:version(.)`, which is `NaN`
  where nothing declares one, so the report goes unmade. A gate is a lower
  bound: what 2.0 introduced is present in 4.0. Emit the form the declared
  version runs (`exists(x)` on 2.0+, `boolean(x)` on 1.0), and check that a
  version exclusion still fires where its premise fails.
- **Roots.** Match `(/xsl:stylesheet | /xsl:transform | /xsl:package)`, and fork
  on the namespace rather than on root names: an XSLT root takes `version`, a
  simplified stylesheet `xsl:version` under whatever prefix the document binds,
  read with `lookupPrefix`. A root holding an embedded stylesheet is not a
  simplified one. A whole-rule guard stands at the root step, `/*[guard]//x`.
- **Selector hygiene.** No existence by counting (`count(x) > 0`). No element
  named by `name()`; write the node test, whose prefix XPath binds. Beside
  `count(*) = 1`, ask `not(text()[normalize-space()])`, and wherever `text()` is
  read, read the nearest `ancestor::*[@xml:space][1]`. Ask an attribute's
  presence in both spellings and its value through `xslint:attribute`.
- **Served selectors.** A selector opening `//name`, `//(a | b)`, a union of
  those, an anchor in front of `//`, an attribute axis or a prefixed wildcard is
  served from the shared walk (`src/selectors.js`, `src/predicates.js`), with
  only what the walk cannot answer sent to fontoxpath. A selector whose axis is
  the root itself, a bare wildcard, or a positional predicate cannot be served
  and goes on `UNINDEXED` in `test/conformance.test.js`, held from both sides;
  every cross-file selector must be served, with no table to exempt one.
- **Fix with detection.** A declarative check's fix is a `node => fix` builder
  in `src/fixers.js`; a code-based linter attaches its `fix` to the defect.
  Declare `suggestion` unless the edit is deterministic and keeps semantics.
  Cover it with a `test/resources/fix/<name>.xsl` and `.fixed.xsl` pair
  (generated with `--fix`) and rows in `test/fixer.deep.test.js`'s
  `APPLIED`/`UNCHANGED`/`DROPPED`. A fix that needs structural editing waits for
  the full-fidelity parser (#228).
- **Motive.** Lead with the concrete harm, then an `Incorrect:`/`Correct:` pair
  of valid XSLT, in a hundred words of prose outside code blocks. Never name a
  fix tier, `--fix`, or report-only, never describe internals, and keep the
  prose true to the selector: no "such as" for a closed list, no "root
  template" for any `/`-prefixed match.

## Test packs

Each linter owns a `test/resources/<name>-packs/` directory, read through the
one harness, `test/packs.js`. A pack is `pack` (the check name), `found`, and
`input`, or `inputs` for corpus and import packs, which reference each other as
`file<index>.xsl`; an import pack's `absent` lists missing hrefs. `found`
carries `amount` and `positions`: `[line, col]`, `[fileIndex, line, col]` for
cross-file packs, or `[line, col, other-check]` for a co-firing check. A format
check's pack carries `fixes` aligned with `positions`, the expected
replacement or `null` for report-only. `test/conformance.test.js` holds a pack
to one position per defect, and every pack directory to exactly one harness
call.

`test/xcop.deep.test.js` writes every pack's inline XSL into one temporary
directory and runs xcop over it once. A fixture deliberately non-canonical goes
on `UNFORMATTED`, which is asserted: an entry xcop accepts turns red. Without
xcop installed the fixtures are pending; CI passes `--forbid-pending`.

## Speed

`test/chains.js` times a cross-file check over two import chains on
`test/clock.js`, processor time capped at the wall. A short chain holds a
hundred files or more, since a quadratic whose constant is still small hides
under the parse at forty (#769, #1141). The `corpora` budgets read the wall
clock.

## User configuration

- `--suppress=<substring>` turns off every check whose name matches.
- `--only=<substring>` (or `only:`) reports only the checks it names; a
  suppression outranks it.
- `--preset` (or `preset:`) is `recommended` unless `all`. `--only` replaces it,
  a re-grade naming a check exactly adds to it, and `off` outranks both.
- `.xslint.yml`, found by walking up or named by `--config`, turns checks
  `off`, re-grades severity, excludes globs, and defaults `max-warnings`,
  `log-level` and `quiet`. Flags override the file, which overrides the
  defaults. Unknown keys and patterns matching nothing are reported. A
  `dir/**` exclusion is not walked at all, and neither is what the project's
  `.gitignore` files name, unless git's index holds the path.
- Comments `xslint-disable-next-line`, `xslint-disable-line` and
  `xslint-disable-file` take optional rule names; an unused one is reported.

A defect is fixable when it carries `fix: {line, col, value, replacement,
suggestion}`, `suggestion` stamped from the check's `fix:` tier.
`--fix` applies the safe tier, `--fix-suggestions` the suggestions too, and
`--fix-dry-run` writes nothing. No fix is offered on an element holding an
expression the grammar refuses. `src/fixer.js` locates each fix by decode-walking
the raw source, so entities shift nothing; of two overlapping fixes the
left-most, then the wider, wins, and the other waits for the next run.

## Key files

| File | Role |
| --- | --- |
| `src/index.mjs` | CLI entry (commander.js, ESM); imports the pipeline inside the command action |
| `src/xslint.js` | Discovery, config, staging, output; exports `lint`, `fixed`, `settingsOf`, `stylesheetsOf`, `sourceOf` |
| `src/config.js` | Resolves `.xslint.yml` (severities, `off`, excludes, `max-warnings`) |
| `src/gitignore.js` | `ignoring(start)`: what the project's `.gitignore` files refuse |
| `src/directives.js` | Parses inline `xslint-disable-*` comments |
| `src/reporters.js` | `reporterOf(format)`: `text`, `json`, `sarif`, or `github` |
| `src/validators/xsl-validator.js` | Builds the corpus; reports each non-well-formed stylesheet |
| `src/validators/xpath-validator.js` | Splits the expressions into kept and refused, and says whether a later version admits a refused one |
| `src/linters/xpath-linter.js` | Loads `checks/xpath/*.yaml`, the per-file declarative kind |
| `src/linters/corpus-linter.js` | Loads `checks/corpus/*.yaml`, the cross-file declarative kind |
| `src/linters/parameter-linter.js` | `unused-function-template-parameter` |
| `src/linters/element-linter.js` | `not-creating-element-correctly` |
| `src/linters/root-template-linter.js` | `template-writes-nothing` and `output-method-xml` |
| `src/linters/output-linter.js` | `not-using-output`, asked of the import tree and reported on the entry point |
| `src/linters/bare-name-linter.js` | `confusing-variable-and-node` |
| `src/linters/variable-linter.js` | `undefined-variable`, judged over an entry point's whole import tree |
| `src/linters/*-linter.js` | Code-based `checks/format/*.yaml`, one construct each |
| `src/checks.js` | `metaOf`, `suppressed`, `defect`, `rawly` for code-based linters |
| `src/source.js` | Raw-text walking: `parted`, `offsetAt`, `placeAt`, `character`, `skip` |
| `src/selectors.js` | `splitOf`: a selector parted into the names the shared walk serves and the tail the engine answers; `chosen` |
| `src/predicates.js` | `predicateOf`: a served predicate answered off the walk, or nothing |
| `src/attributes.js` | `expressionsOf`, `PATTERNS`, and `whole` |
| `src/xsl-version.js` | `versionOf`, `numbered` and `since` |
| `src/conditions.js` | `excluded` and `conditional`: whether a `use-when` drops an element surely, or may |
| `src/tree.js` | One walk per document: `walked`, `named`, `attributed`, `ranked`, `holding` |
| `src/roots.js` | `roots` and `entered`: the root templates, and whether a module can be entered |
| `src/comparisons.js` | `comparedToZero`: a call compared with `0` or `1` |
| `src/booleans.js` | `coerced` and `unwrapped`: where only an effective boolean value is taken |
| `src/expressions.js` | `enclosed`, `staticOf`, `saidOf`, `attributeOf`, `nameOf` |
| `src/tokens.js` | Positioned XPath lexer (`tokenized`, `TOKENS`); `GAP`, `TRIVIA`, `OPAQUE`, `NAMED`, `unquoted`, `normalized` |
| `src/grammar.js` | 1937 lines: `parsed` and `matched`, the XPath 3.1 and pattern grammars as recursive descent, at the version in force |
| `src/syntax.js` | The door between a record and its parse: `parseOf`, `isValid`, `gathered`, `textOf`, `calls`, `filters` |
| `src/import-graph.js` | Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf` |
| `src/fixers.js` | Maps a declarative check to a `node => fix` builder |
| `src/fixes.js` | Fix builders over the raw source: `deletion`, `substitution`, `excision`, `standsAt` |
| `src/fixer.js` | Applies fixes to source: decode-walk, verify, end to start |
| `src/xpath.js` | The fontoxpath environment: `PREFIXES`, the evaluator, `satisfies`, `compiles`, the `xslint:` functions |
| `src/helpers.js` | XML and YAML parsing, `slashed`, `absentOf`, file recursion skipping `.git` and `node_modules` |
| `src/resources/checks.json` | Every check as a run reads it; generated, never edited |
| `src/logger.js` | 4-level logger |
| `src/output.js` | `colorful(stream)` and the leveled `writer` |
| `src/version.js` | `what` and `when`, stamped by the `release` workflow |
| `scripts/generate-docs.js` | Builds `docs/` from checks, motives and the manual |
| `scripts/generate-checks.js` | Builds `src/resources/checks.json` |
| `scripts/audit.js` | Judges the nightly `npm audit` |
| `scripts/budget.js` | Judges a corpus run against its budget |
| `scripts/snapshot.js` | Diffs a corpus run against its committed report; `--write` rewrites it |
| `scripts/readme.js` | The figures `README.md` states of the tree |
| `test/conformance.test.js` | Naming, motives, selector hygiene, retired keys, the suite's shape, the stated length of an exempt file |
| `test/shadows.test.js` | Every selector comparing an attribute's value asks both spellings |
| `test/guides.js` | The guides as data |
| `test/guides.test.js` | Guide sizes, `CLAUDE.md` as an import, the index against the tree, the counts a guide states |
| `test/grammar-corpus.test.js` | Round trip and acceptance diff over every expression in the repository |
| `test/grammar-shapes.test.js` | The same diff over generated expressions |
| `test/strictness.js` | `insists`: whether fontoxpath refuses over its own strictness |
| `test/helpers.js` | The only door to a child process: `runXslint`, `xslintStatus`, `xslintStreams`, `xslintUnread`, `xcopped`, `walkedWith` |
| `test/predicates.test.js` | The predicate vocabulary from both sides |
| `test/tiers.test.js` | Declared tiers against what a run offers; README and manual naming none |
| `test/clock.js` | Processor time capped at the wall |
| `test/chains.js` | `grown`: a linter timed over two chains |
| `test/packs.js` | The one pack harness |
| `test/xcop.deep.test.js` | xcop over every pack's inline XSL |
| `test/workflows.test.js` | Workflow scopes, release stamping, and README version pins |
| `test/manifest.test.js` | `package.json` against what the tree runs and imports |
| `test/readme.test.js` | Every README figure held to the tree |
