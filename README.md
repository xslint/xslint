# xslint

Lint your XSL/XSLT stylesheets — catch malformed XML, invalid XPath, and
stylistic defects before they ship.

[![DevOps By Rultor.com](https://www.rultor.com/b/xslint/xslint)](https://www.rultor.com/p/xslint/xslint)

[![npm](https://img.shields.io/npm/v/@maxonfjvipon/xslint.svg?style=flat)](https://www.npmjs.com/package/@maxonfjvipon/xslint)
[![grunt](https://github.com/xslint/xslint/actions/workflows/grunt.yml/badge.svg)](https://github.com/xslint/xslint/actions/workflows/grunt.yml)
[![codecov](https://codecov.io/gh/xslint/xslint/branch/master/graph/badge.svg)](https://codecov.io/gh/xslint/xslint)
[![PDD status](http://www.0pdd.com/svg?name=xslint/xslint)](http://www.0pdd.com/p?name=xslint/xslint)
[![Hits-of-Code](https://hitsofcode.com/github/xslint/xslint)](https://hitsofcode.com/view/github/xslint/xslint)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/xslint/xslint/blob/master/LICENSE.txt)

`xslint` is a CLI linter for XSL stylesheets. It first checks that every
stylesheet is well-formed and every XPath expression compiles, then runs its
checks for stylistic, semantic, and logical problems — each reported with its
exact line and column, in your terminal or in CI.

## Quick start

Run it on your stylesheets — no install needed:

```bash
npx @maxonfjvipon/xslint@0.0.14 path/to/stylesheets
```

Given a stylesheet like this:

```xml
<?xml version="1.0"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="//book">
    <xsl:variable name="x" select="title"/>
    <xsl:value-of select="$x"/>
  </xsl:template>
</xsl:stylesheet>
```

xslint points at each problem with its exact position and how to fix it:

```text
[ERROR] sheet.xsl(2:1) The xsl:output instruction is missing. Declare it to specify the serialization format explicitly. (not-using-output)
[WARNING] sheet.xsl(3:24) A pattern alternative starts with //, which is redundant since every XSLT pattern already matches at any depth, and it lowers the rule's default priority from 0.5 to that of the step alone. Remove the leading // and give the rule an explicit priority if it must keep ranking as it does. (starts-with-double-slash)
[WARNING] sheet.xsl(4:5) A variable, function, or template has a single-character name. Use a descriptive name that reveals intent. (short-names)
```

In CI, use the [GitHub Action](https://github.com/xslint/xslint-action) to
get inline annotations on your pull requests:

```yaml
- uses: actions/checkout@v6
- uses: xslint/xslint-action@0.0.9
```

Or run it on commit with [pre-commit](https://pre-commit.com) — add to your
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/xslint/xslint
    rev: 0.0.11
    hooks:
      - id: xslint
```

Browse the full [check catalog](https://xslint.github.io/xslint/).

## Proven on real code

Pointed at core stylesheets from the three most widely-used XSLT projects —
[DocBook-XSL](https://github.com/docbook/xslt10-stylesheets) (1.0),
[TEI](https://github.com/TEIC/Stylesheets) (2.0), and
[DITA-OT](https://github.com/dita-ot/dita-ot) (1.0/2.0), 70 files in all —
xslint surfaced **1,974 findings across 22 different checks, with no false
positives from its validators**: 106 `xsl:choose` blocks with no
`xsl:otherwise`, 67 unused named templates, 40 stylesheet functions never
called, and more. Real stylistic and logical findings in code that has shipped
for decades.

## Installation

To install `xslint` globally, install [npm] first, then run:

```bash
npm install -g @maxonfjvipon/xslint@0.0.14
xslint --version
```

## Build

To build `xslint` from source, clone this repository:

```bash
git clone git@github.com:xslint/xslint.git
cd xslint
```

Next, run these commands to install `xslint` system-wide:

```bash
npm install
npm install -g .
```

Use Node 22, the release CI runs on. Babel 8, which the mutation tester pulls
in, declares itself for 22.18 and 24.11 upward only, so on any other release
`npm install` prints an `EBADENGINE` warning per Babel package and then
installs regardless.

Verify that `xslint` is installed correctly:

```bash
$ xslint --version
0.0.0
```

## Usage

You can check all files in current directory:

```bash
xslint
```

To check specified files - provide them as arguments:

```bash
xslint path/to/your/file1.xsl path/to/your/file2.xsl
```

You can suppress some [checks][checks] by using `--suppress` option:

```bash
xslint --suppress=confusing-variable-and-node
```

You can skip several checks at once if they contain a certain substring:

```bash
xslint --suppress=unused
```

If you want to suppress many checks, use `--suppress` as many times as you need:

```bash
xslint --suppress=oversized-template --suppress=short-names
```

## Configuration

Project-wide settings live in a `.xslint.yml` file, discovered by walking up
from the current directory (or passed with `--config <path>`). Command-line
flags override the file, and the file overrides the built-in defaults.

```yaml
# .xslint.yml
rules:
  short-names: off       # turn one check off
  "unused-*": error      # or a family, by glob
exclude:
  - "test/**"                           # globs to skip, relative to this file
max-warnings: 10                        # default for --max-warnings
log-level: info                         # default for --log-level
quiet: false                            # default for --quiet
```

- **`rules`** maps a check name — or a glob such as `unused-*` — to
  `off`, `warning`, or `error`. `off` disables the check (like `--suppress`);
  `warning` and `error` re-grade its severity.
- **`exclude`** lists globs, relative to the config file's own directory, whose
  matching files are not linted.
- **`max-warnings`**, **`log-level`**, and **`quiet`** set the defaults for the
  matching command-line flags.

Unknown top-level keys, rule names that match no check, and values of the wrong
type (a non-numeric `max-warnings`, a non-list `exclude`, a non-boolean
`quiet`, a non-string `log-level`) are reported and ignored, so typos do not
pass silently.

## Inline suppression

Silence a rule in one place with an XML-comment directive. Rule names are
optional and space-separated; with none, every rule at that location is
suppressed.

```xml
<!-- xslint-disable-next-line short-names -->
<xsl:variable name="x" select="1"/>

<!-- xslint-disable-file not-using-schema-types -->
```

- **`xslint-disable-next-line [rules]`** — the line after the comment.
- **`xslint-disable-line [rules]`** — the comment's own line.
- **`xslint-disable-file [rules]`** — the whole file (put it near the top).

A directive that suppresses nothing is reported as unused, so stale ones can be
found and removed.

An expression written across several lines is one value, and a directive that
reaches any line of it silences every defect in it. Nothing inside a start tag
can carry a comment of its own, so a directive above the element is the only
way to reach a wrapped `@test` or `@select` at all — the cost is that it cannot
pick out one defect in such a value and leave its neighbours reported.

## Output

Defects are written to stdout; progress and diagnostic logs go to stderr, so
`xslint path/to/dir > report.txt` captures only the findings. Pass `--quiet` to
drop the informational log lines:

```bash
xslint --quiet
```

Output is colored only when it goes to an interactive terminal, so a redirected
or piped run stays plain text; setting the conventional `NO_COLOR` environment
variable turns coloring off everywhere.

## Machine-readable output

`--format` selects the output. `text` (the default) is the human format above;
`json` and `sarif` print a single document to stdout — logs stay on stderr, so
the document is clean to pipe or redirect; `github` prints GitHub Actions
workflow commands:

```bash
xslint --format json path/to/dir     # a flat array of defects
xslint --format sarif path/to/dir    # a SARIF 2.1.0 log
xslint --format github path/to/dir   # ::warning/::error annotations for CI
```

Each entry of the `json` array names the check as `rule` and carries its
`severity`, its `message`, and the `file`, `line` and `column` the defect stands
at. A fixable one carries a `fix` beside them, holding that span's own `line`
and `column`, the `value` it replaces, the `replacement` it would write, and
whether it is a `suggestion`. Defects come out ordered by file, then line, then
column, then rule — so two runs over one tree emit the same document, and a
report committed today diffs against one taken tomorrow.

Inside a GitHub Action, `--format github` makes each defect an inline
annotation on the pull-request diff with no upload step — the lowest-friction
way to see findings on a review.

SARIF feeds GitHub code scanning, so xslint findings appear as annotations on
pull requests:

```yaml
- run: xslint --format sarif . > xslint.sarif || true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: xslint.sarif
```

The `|| true` keeps a findings exit code from failing the step before the
upload; the alerts still surface in code scanning. Run it from the repository
root so the reported paths stay repo-relative — a file outside the working
directory is named by its absolute path instead.

## Fixing

Some defects have a single unambiguous correction, and `--fix` applies it in
place:

```bash
xslint --fix path/to/dir
```

Today this covers nine checks:

- `redundant-whitespace` — a doubled space is collapsed to one, and a space
  leading or trailing an XPath expression is removed, in a pattern such as
  `match` and inside a `{...}` as much as in a `select`. A run holding a line
  ending is the indentation of a wrapped expression, so it is neither reported
  nor collapsed.
- `unabbreviated-axis` — a verbose axis specifier is shortened: `child::x`
  becomes `x`, `attribute::x` becomes `@x`, `parent::node()` becomes `..`, and
  `self::node()` becomes `.`. On a 1.0 stylesheet a predicated step keeps its
  longhand, since `.` and `..` took no predicate before XPath 2.0.
- `redundant-namespace-declarations` — a namespace prefix declared on the
  stylesheet but never used is deleted. A prefix named in an
  `exclude-result-prefixes` or `extension-element-prefixes` list counts as
  used, `#all` naming every one of them at once, since cutting a declaration
  one of those refers to leaves the reference unbound.
- `use-node-set-extension` — the redundant `node-set()` extension is unwrapped
  in XSLT 2.0 and later, under whichever prefix the stylesheet binds to EXSLT's
  common namespace or Microsoft's: `exsl:node-set($x)` becomes `$x`. An
  argument binding looser than a step keeps the brackets the call supplied
  where an expression stands around it, so `exsl:node-set($x | $y)/title`
  becomes `($x | $y)/title` and not `$x | $y/title`, which selects something
  else.
- `count-compared-to-zero` — an existence test spelled as a count is
  simplified version-appropriately: on XSLT 2.0+, `count($x) > 0` becomes
  `exists($x)` and `count($x) = 0` becomes `empty($x)`; on 1.0 (where those
  functions don't exist), `boolean($x)` — or a bare `$x` in a whole `@test` —
  and `not($x)`. The value comparisons XSLT 2.0 added say the same thing, so
  `count($x) eq 0` and `0 lt count($x)` are simplified too.
- `starts-with-double-slash`, outside an `xsl:template` — the redundant leading
  `//` of a pattern is dropped: `match="//keyed"` on an `xsl:key` becomes
  `match="keyed"`. Only a template's pattern is ranked by priority, so on
  `xsl:key`, `xsl:number`, `xsl:for-each-group` and `xsl:accumulator-rule` the
  same nodes match at the same rank. Each alternative of a union is a pattern of
  its own, so `match="alpha | //beta | //gamma"` loses both of them in one run.
- `redundant-double-negation` — `not(not(x))` becomes `boolean(x)`, the
  equivalent it spells out the long way; where nothing but a truth is taken it
  becomes plain `x`. Those places are a whole `@test` or `use-when`, an operand
  of `and` or `or`, the argument of another `not()`, the condition of an `if` and
  the body of a `satisfies`, so `@a and not(not(@b))` becomes `@a and @b`; an
  argument that binds loosely enough for the operator around it to regroup
  arrives in brackets.
- `redundant-boolean-call` — a `boolean()` standing in one of those same places
  drops the wrapper: `test="boolean(@x)"` becomes `test="@x"` and
  `not(boolean(@x))` becomes `not(@x)`. An operand of a comparison keeps its
  wrapper, comparing a value with a truth rather than two values, and so does a
  predicate, where XPath reads a number as a position rather than a truth.
- `predicate-position-literal` — a positional predicate written the long way is
  shortened: `item[position() = 1]` becomes `item[1]`, and
  `item[position() = last()]` becomes `item[last()]`. The value comparison
  `item[position() eq 1]` shortens the same way, both operands being integers,
  and the operand that survives keeps its own spelling, so a prefixed
  `fn:last()` stays prefixed.

Only the exact span that was flagged is rewritten — the rest of the file is
left byte-for-byte intact — and a fix is skipped rather than applied when the
source no longer matches what it expects.

Other defects have a correction that is clear but *opinionated* — it changes
behavior, removes code, or is one of several reasonable choices. Those are
offered as **suggestions**, applied only with `--fix-suggestions`, never
silently by `--fix`:

```bash
xslint --fix-suggestions path/to/dir
```

Today this covers:

- `string-length-compared-to-zero` — an emptiness test spelled as a length is
  simplified: `string-length(@x) > 0` becomes `@x != ''`, `= 0` becomes
  `@x = ''`, and the no-argument `string-length() = 0` becomes `. = ''`, the
  context item being what such a call measures. The value comparisons are read
  too, and the rewrite keeps the class it was given, so `string-length(@x) eq 0`
  becomes `@x eq ''` rather than being moved into the general comparison it was
  not written as — which is one more reason it is a suggestion, a value
  comparison against an absent node answering the empty sequence where the
  general one answers false. A suggestion because the two are
  not general equivalents: they differ for an absent attribute
  (`string-length(@x) = 0` is true, `@x = ''` is false) and, in XPath 1.0, for a
  multi-node set. An argument that binds at least as loosely as the comparison
  it moves into — `string-length(@a or @b) = 0` — is reported with no fix, since
  the rewrite would regroup the expression.
- `incorrect-use-of-boolean-constants` — the string test `'true'`/`'false'`
  becomes `true()`/`false()`, which changes the truth value of a `'false'` test
  (a non-empty string is always true). Either quote spells the same constant, so
  a `test="&quot;true&quot;"` is reported and rewritten too.
- `redundant-import` — a repeated `xsl:import`/`xsl:include` of one module is
  removed, and the reference cut is an earlier one, so the module keeps the
  precedence its last reference gives it. A suggestion because no choice of
  reference makes the deletion behaviour-preserving: importing a module twice
  puts it at two precedence levels, and `xsl:apply-imports` (like 2.0's
  `xsl:next-match`) walks that chain and meets it at both, so a module whose
  rules reach back down it runs once per reference. An `xsl:include` creates no
  level of its own but copies in the included module's own `xsl:import`
  elements, so a repeated include duplicates those the same way. A module
  reached *both* ways — imported and also included — is reported without a fix
  at all, since which of the two to drop is a decision about precedence rather
  than a deletion the tool can make.
- `select-starts-with-double-slash` — the leading `//` of a `@select` is
  anchored as `.//`: `select="//title"` becomes `select=".//title"`, scanning
  descendants of the context node instead of the whole document.
- `starts-with-double-slash`, on an `xsl:template` — the redundant leading `//`
  of `@match`, or of any alternative of it, is dropped: `match="//para"` becomes
  `match="para"`. The same nodes match, but the default priority of that
  alternative falls from 0.5 to 0, so a rule that used to win a conflict can
  start losing it.
- `confusing-variable-and-node` — a bare variable name used as a node selector
  gets its `$`: `<xsl:apply-templates select="items"/>` becomes
  `select="$items"`, assuming the variable was meant over a child element.
- `text-outside-xsl-text` — loose literal text inside an instruction is wrapped:
  `<xsl:if test="a">hello</xsl:if>` becomes
  `<xsl:if test="a"><xsl:text>hello</xsl:text></xsl:if>` (only when there is a
  single run of text to wrap).
- `using-disable-output-escaping` — the attribute is removed, which changes how
  the output is escaped.
- `output-method-xml` — `method="xml"` becomes `"html"` when the stylesheet
  emits HTML.
- `missing-version-in-stylesheet` — the version is declared as `1.0` (a guess you
  may want to change), spelled the way the root needs it: `version` on an
  `xsl:stylesheet`, and the namespaced `xsl:version` on a simplified stylesheet,
  under whichever prefix that document binds to XSLT.
- `mode-or-priority-without-match` — the orphan `mode` or `priority` attribute
  is removed.
- `name-compared-to-string` — `name() = 'x'` becomes `self::x` and
  `local-name() = 'x'` becomes `self::*:x`, shifting from lexical-QName to
  expanded-name matching. Either quote spells the string and either class of
  equality comparison asks the question, so `name() eq "x"` is the same
  construct; `name() != 'x'` becomes `not(self::x)`. An ordering comparison is
  left alone, and so is a comparison about another node, `name(@a) = 'x'`.
- `translate-for-case` — an alphabet `translate(x, 'A…Z', 'a…z')` becomes
  `lower-case(x)` (or `upper-case(x)`), which also folds non-ASCII characters.
  Either alphabet may be quoted either way, and the two need not agree.
- `leaking-result-namespace` — the leaking prefix is added to
  `exclude-result-prefixes`, which drops its declaration from the serialized
  output (offered only when a single prefix leaks).
- `variable-or-param-with-select-and-content` — the `@select` is deleted,
  leaving the body as the value, which binds a tree where the expression bound
  its own type; dropping the body instead is the other correction, and no
  single edit expresses it.

Checks whose correction needs real judgment (a fresh name, a more specific
path) stay report-only. A run without `--fix` reports how many defects each
option would fix.

An expression xslint cannot parse draws one defect, from the validator, and the
checks that read expressions say nothing further about it: a stylesheet whose
real fault is a missing bracket comes back with that fault and not with a page
of advice about text no processor accepts. A rule that matches the attribute
structurally rather than reading the expression can still report there, and is
never offered a correction. Fix the syntax and the rest of the feedback appears
on the next run.

Where the expression sits no longer decides whether you are told why. A bare
one — a `select`, a `test`, and the rest listed under
`invalid-xpath-expression` — a **pattern** such as `match`, and each expression
the braces of an attribute value template, a text value template or a shadow
attribute enclose are all parsed, and whichever of them is broken is reported as
malformed. The report points at the character the parser stopped on rather than
at the attribute holding it, so a fault buried in a long expression, or in the
second of two `{...}` on one line, names its own column.

Where two corrections cover the same piece of an expression — the redundant
whitespace in `d[position()  =  1]` sits inside the predicate that becomes
`d[1]` — only the wider one is applied, and the other is announced as skipped.
Run `--fix` again to take care of whatever the first run left.

Pass `--fix-dry-run` to see what would remain after fixing, without writing any
file:

```bash
xslint --fix-dry-run path/to/dir
```

## Exit code

`xslint` exits non-zero when any `error`-severity defect is found. Warnings do
not fail the run by default; to make them count, cap the allowed number with
`--max-warnings`:

```bash
xslint --max-warnings=0    # any warning fails the run
xslint --max-warnings=10   # more than ten warnings fails the run
```

## Checks

The full list of checks with descriptions and examples is available at
[xslint.github.io/xslint][checks].

xslint runs in two stages. **Validators** first establish that the input is
valid; **linters** then run over the stylesheets that pass, catching
stylistic, semantic, and logical problems. A stylesheet that does not parse is
reported once and skipped, so one broken file never hides the feedback on the
rest.

Validators:

- **XML well-formedness** — a stylesheet that is not well-formed XML is
  reported and excluded from linting.
- **XPath syntax** — every bare XPath expression (in `select`, `test`,
  `use`, `value`, `group-by`, `group-adjacent`, and the XSLT 3.0 `key`,
  `initial-value`, `xpath`, `context-item`, `with-params`,
  `namespace-context`, `for-each-item`, `for-each-source` and `use-when`) is
  parsed, on an XSLT element or — spelled `xsl:use-when`, the only spelling a
  simplified stylesheet has — on a literal result element; the ones the processor
  cannot parse are reported.

Linters:

- **Per-file** checks evaluate one stylesheet at a time (most checks).
- **Cross-file** checks reason across all the stylesheets you lint together.
  For example, a named template defined in one file but invoked from another
  (via `xsl:import`/`xsl:include`) is not reported as unused, an
  `xsl:import`/`xsl:include` cycle across files is flagged (`circular-import`),
  and the same module imported twice in one stylesheet is flagged
  (`redundant-import`).
  Lint the whole project at once so these checks can see every caller and every
  imported module.
- **Formatting** checks read each XPath expression as a stream of tokens and
  flag stylistic noise — currently redundant whitespace (a doubled space, or a
  space leading or trailing the expression).

Every check that reads an expression reads it from an XPath or pattern attribute
of an XSLT element (`select`, `test`, `match`, …) or from an attribute value
template — `<div class="{count(item) = 0}"/>` is checked, and fixed, inside the
braces. An attribute of your own output vocabulary that happens to share a name
with an XSLT one, as in `<widget test="count(item) = 0"/>`, holds text destined
for the result tree, so it is never read as XPath and never rewritten. And each
of them is handed the expressions the validator kept, so a malformed one is
reported once rather than nagged about its spacing, its axes and its
`count(...)` calls on top of that.

## Programmatic use

`xslint` is embeddable — editors, build tools, and the
[language server](https://github.com/xslint/xslint-lsp) import it instead of
shelling out. `lint` takes in-memory sources and returns the defects, touching
no files and never exiting:

```js
const {lint, fixed} = require('@maxonfjvipon/xslint')

const sources = [{file: 'sheet.xsl', content: '<xsl:stylesheet .../>'}]
const defects = lint(sources, {suppress: ['short-names']})
// each defect: {name, severity, message, file, line, pos, fix?}

// apply the fixable ones without writing to disk:
const {contents} = fixed(sources, defects)
```

`lint(sources, {suppress, overrides})` runs every validator and linter over the
`{file, content}` sources, honors inline `xslint-disable` directives, and hands
the defects back in the order the reports print them — file, line, column, rule;
`fixed(sources, defects, suggestions)` returns the rewritten content per file.

## Editors

xslint runs inside your editor through the
[xslint-lsp](https://github.com/xslint/xslint-lsp) language server, with the
same diagnostics and quick-fixes as the CLI:

- **VS Code, Cursor, VSCodium, Windsurf, Gitpod** — install the extension from
  [Open VSX](https://open-vsx.org/extension/maxonfjvipon/xslint-vscode), or the
  `.vsix` attached to each [release](https://github.com/xslint/xslint-lsp/releases).
- **IntelliJ IDEA, WebStorm, PyCharm, and other JetBrains IDEs** — install the
  [xslint-jetbrains](https://github.com/xslint/xslint-jetbrains) plugin.

## How to Contribute

Fork repository, make changes, then send us a [pull request][guidelines].
We will review your changes and apply them to the `master` branch shortly,
provided they don't violate our quality standards. To avoid frustration,
before sending us your pull request please make sure all your tests pass:

```bash
npm test
```

Most of those seconds go to the three `*.deep.test.js` files, which run the
command-line tool in a child process. While you are still working, run the rest
of the suite on its own — it finishes in about a second:

```bash
npm run fast
```

A test you add belongs on the side it costs: name it `*.deep.test.js` when it
runs `xslint` or `xcop` in a child process — which it does by requiring
`test/helpers.js` — and plain `*.test.js` when it stays in this one.
`test/conformance.test.js` checks that both ways round, so a misnamed file turns
the build red rather than quietly slowing the fast half down.

New linter rules live in `src/resources/checks/xpath` (per-file) or
`src/resources/checks/corpus` (cross-file), each with a matching test pack in
`test/resources`. The validators in `src/resources/checks/validation` and the
formatting checks in `src/resources/checks/format` are fixed in code; their
YAML only tunes severity and message. That YAML is where a check is written, but
a run reads `src/resources/checks.json`, so rebuild and commit it whenever you
touch one:

```bash
npx grunt checks
```

Forgetting is not a silent mistake — the test suite re-renders the file from the
YAML and fails on any difference. Regenerate the documentation site with
`npx grunt docs`.

You will need [npm] and [node] installed

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and
[CHANGELOG.md](CHANGELOG.md) for release notes.

[npm]: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
[node]: https://nodejs.org/en
[guidelines]: https://www.yegor256.com/2014/04/15/github-guidelines.html
[checks]: https://xslint.github.io/xslint/
