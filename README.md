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
npx @maxonfjvipon/xslint@0.1.0 path/to/stylesheets
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
[WARNING] sheet.xsl(2:1) The '@id' attribute is missing in the 'xsl:stylesheet' element. Declare it to specify the unique identifier explicitly. (missing-id-in-stylesheet)
[WARNING] sheet.xsl(2:1) The xsl:output instruction is missing. Declare it to specify the serialization format explicitly. (not-using-output)
[WARNING] sheet.xsl(3:24) A pattern alternative starts with //, which is redundant since every XSLT pattern already matches at any depth, and it lowers the rule's default priority from 0.5 to that of the step alone. Remove the leading // and give the rule an explicit priority if it must keep ranking as it does. (starts-with-double-slash)
[WARNING] sheet.xsl(4:5) A variable, function, or template has a single-character name. Use a descriptive name that reveals intent. (short-names)
```

In CI, use the [GitHub Action](https://github.com/xslint/xslint-action) to
get inline annotations on your pull requests:

```yaml
- uses: actions/checkout@v6
- uses: xslint/xslint-action@0.0.10
```

Or run it on commit with [pre-commit](https://pre-commit.com) — add to your
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/xslint/xslint
    rev: 0.1.0
    hooks:
      - id: xslint
```

Browse the full [check catalog](https://xslint.github.io/xslint/).

## Proven on real code

Pointed at core stylesheets from the three most widely-used XSLT projects —
[DocBook-XSL](https://github.com/docbook/xslt10-stylesheets) (1.0),
[TEI](https://github.com/TEIC/Stylesheets) (2.0), and
[DITA-OT](https://github.com/dita-ot/dita-ot) (1.0/2.0) — xslint surfaced
**10,389 findings across 43 different checks in 867 stylesheets, with no false
positives from its validators**: 3,300 pieces of literal text outside
`xsl:text`, 639 `xsl:choose` blocks with no `xsl:otherwise`, and 586 template
and function parameters nothing reads. Real stylistic and logical findings in
code that has shipped for decades.

Every figure above is read off the reports committed under
`test/resources/corpora/`, which a nightly job re-lints at the pinned commits
and diffs line for line — so a number here is one the tree still draws, and
the build fails while it is not.

## Installation

To install `xslint` globally, install [npm] first, then run:

```bash
npm install -g @maxonfjvipon/xslint@0.1.0
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
xslint path/to/your/file1.xsl path/to/your/file2.xslt
```

Either spelling of the name is read, `.xsl` and `.xslt`. A directory is walked
for both and everything else in it is stepped over, while a file named on the
command line under any other suffix earns a warning rather than being counted
as clean. A `.git` or a `node_modules` is never opened, wherever in the tree it
stands.

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

Use `--stable` when every defect in the report has to be worth acting on:

```bash
xslint --stable
```

It leaves out the *nursery* — the checks an open issue reports wrong about code
a processor accepts. A check joins the nursery the day such an issue is filed
and leaves the day it closes, and while it sits there its own [check
page][checks] names the issue keeping it there.

That is the part `--suppress` cannot do for you. The nursery is read off the
checks themselves, so it follows the bug reports, where the same names written
into your own `.xslint.yml` go stale in both directions: they keep withholding
a check that has since been fixed, and never withhold one newly reported
wrong.

The nursery holds no checks today, so `--stable` reports all sixty-nine
checks.

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
stable: false                           # default for --stable
```

- **`rules`** maps a check name — or a glob such as `unused-*` — to
  `off`, `warning`, or `error`. `off` disables the check (like `--suppress`);
  `warning` and `error` re-grade its severity.
- **`exclude`** lists globs, relative to the config file's own directory, whose
  matching files are not linted. A pattern covering everything under a
  directory — `dir/**` — also stops the walk descending it, so an exclusion
  costs nothing rather than the walk it then throws away. A wildcard here reads
  a name opening with a dot like any other, so `dir/**` covers a
  `dir/.hidden/sheet.xsl` as much as the rest of what stands under `dir`.
- **`max-warnings`**, **`log-level`**, **`quiet`**, and **`stable`** set the
  defaults for the matching command-line flags. A check named **verbatim** under
  `rules` outranks `stable`, so grading a nursery check `warning` or `error`
  puts it back in the report. A glob does not: `'*': warning` grades every check
  it reaches and vouches for none, so the nursery stays withheld and each
  withheld check is named on standard error.

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

`--fix` applies the corrections that are deterministic and leave the stylesheet
meaning what it meant. `--fix-suggestions` applies those and the ones that
change behavior, remove code, or are one of several reasonable corrections,
which a plain `--fix` never touches. A correction needing real judgment — a
fresh name, a more specific path — stays report-only, and a run without either
flag reports how many defects each option would fix.

```bash
xslint --fix path/to/dir
xslint --fix-suggestions path/to/dir
```

Only the exact span that was flagged is rewritten — the rest of the file is
left byte-for-byte intact — and a fix is skipped rather than applied when the
source no longer matches what it expects. Where two corrections cover the same
piece of an expression — the redundant whitespace in `d[position()  =  1]` sits
inside the predicate that becomes `d[1]` — only the wider one is applied, and
the other is announced as skipped. Run `--fix` again to take care of whatever
the first run left.

Which corrections a check offers, in which of those two tiers, and why the
construct is worth correcting at all, is on that check's own page in the
[check catalog](https://xslint.github.io/xslint/).

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
- **Formatting** checks are written in code rather than as a declarative
  selector — their YAML tunes only `severity` and `message`. Most read the
  parse tree of one expression; the rest read the document or the import
  graph. The kind holds 24 checks today, and the [check catalog][checks]
  teaches every one of them.

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

Most of those seconds go to the `*.deep.test.js` files, which run the
command-line tool in a child process. While you are still working, run the rest
of the suite on its own — it holds most of the tests and starts no process:

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
