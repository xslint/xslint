# xslint

Catch the bugs in your XSLT stylesheets before they ship.

[![DevOps By Rultor.com](https://www.rultor.com/b/xslint/xslint)](https://www.rultor.com/p/xslint/xslint)

[![npm](https://img.shields.io/npm/v/@maxonfjvipon/xslint.svg?style=flat)](https://www.npmjs.com/package/@maxonfjvipon/xslint)
[![grunt](https://github.com/xslint/xslint/actions/workflows/grunt.yml/badge.svg)](https://github.com/xslint/xslint/actions/workflows/grunt.yml)
[![codecov](https://codecov.io/gh/xslint/xslint/branch/master/graph/badge.svg)](https://codecov.io/gh/xslint/xslint)
[![PDD status](http://www.0pdd.com/svg?name=xslint/xslint)](http://www.0pdd.com/p?name=xslint/xslint)
[![Maintainability](https://qlty.sh/gh/xslint/projects/xslint/maintainability.svg)](https://qlty.sh/gh/xslint/projects/xslint)
![Lines-of-Code](https://raw.githubusercontent.com/xslint/xslint/gh-pages/loc-badge.svg)
[![Hits-of-Code](https://hitsofcode.com/github/xslint/xslint)](https://hitsofcode.com/view/github/xslint/xslint)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/xslint/xslint/blob/master/LICENSE.txt)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fxslint%2Fxslint.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fxslint%2Fxslint)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=xslint_xslint&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=xslint_xslint)

Run it on your stylesheets, no install needed:

```bash
npx @maxonfjvipon/xslint@0.6.0 path/to/stylesheets
```

Given a stylesheet like this:

```xml
<?xml version="1.0"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my">
  <xsl:function name="my:slug">
    <xsl:param name="text"/>
    <xsl:sequence select="lower-case(translate($text, ' ', '-'))"/>
  </xsl:function>
  <xsl:template match="/">
    <xsl:apply-templates select="library/book"/>
  </xsl:template>
  <xsl:template match="book">
    <xsl:param name="title" select="title"/>
    <xsl:param name="title" select="@title"/>
    <h1><xsl:value-of select="$subtitle"/></h1>
  </xsl:template>
</xsl:stylesheet>
```

xslint reports what a processor refuses and what nothing ever runs, each at its
exact line and column:

```text
[WARNING] sheet.xsl(3:3) A stylesheet function is never called in any expression across the corpus. Remove it or call it. (unused-function)
[ERROR] sheet.xsl(12:5) Two xsl:param siblings share a @name. Each parameter of a template, function, or stylesheet must have a distinct name. (duplicate-param-name)
[ERROR] sheet.xsl(13:31) A variable is referenced where no binding in scope declares it. Declare it, or correct the name to one in scope. (undefined-variable)
```

That is the `recommended` preset, which a run reports unless told otherwise.
`--preset all` adds the style checks too, from literal text outside
`xsl:text` to single-letter names. The [check catalog][checks] teaches every
one of them.

## Principles

xslint holds itself to these principles:

- **One way to say one thing.** Where XSLT offers two spellings of the same
  meaning, a codebase that keeps to one reads faster and hides fewer faults.
  [gofmt](https://go-proverbs.github.io/),
  [PEP 20](https://peps.python.org/pep-0020/),
  [Prettier](https://prettier.io/docs/option-philosophy) and
  [Bugayenko](https://www.yegor256.com/2014/08/13/strict-code-quality-control.html)
  make the same case for uniform code.
- **The processor decides.** xslint reports an error only where a processor of
  the declared version would refuse the stylesheet, since that is what the
  [specification](https://www.w3.org/TR/xslt-30/#errors) calls an error. A
  linter that refuses more teaches its users to ignore it.
- **A safe fix never changes the output.** `--fix` runs where nobody reads the
  diff, so a fix that changes what a stylesheet produces ships as a suggestion
  instead. [ESLint](https://eslint.org/docs/latest/extend/custom-rules#applying-fixes)
  draws the same line.
- **Advice stays inside the declared version.** No check asks for a construct
  the stylesheet's `version` cannot run. That version names the oldest
  processor the stylesheet has to load on, and a
  [1.0 processor](https://www.w3.org/TR/xslt-10/#forwards) tolerates a newer
  construct only when the stylesheet declares a newer version.

Where XSLT has two spellings, xslint asks for the one most XSLT code already
uses. A team that mixes forms on purpose, writing `record[child::*]` for
emphasis, turns the check off in `.xslint.yml`.

## Proven on real code

[DocBook-XSL](https://github.com/docbook/xslt10-stylesheets) (1.0),
[TEI](https://github.com/TEIC/Stylesheets) (2.0) and
[DITA-OT](https://github.com/dita-ot/dita-ot) (1.0/2.0) are the three most
widely used XSLT projects. In their core stylesheets the `recommended`
preset a run reports by default draws **245 reports**, with no false positives
from its validators. Among them are 47 references to a variable no binding in
scope declares, which a processor refuses outright, and 16 stylesheet functions
nothing calls. Another 141 are imports and includes naming a file the
checkout does not hold. Most of those are modules a build generates first, so
they are worth a look but usually need no patch. Run with `--preset all`, the same
stylesheets draw **11,161 findings across 45 different checks in 867
stylesheets**, most of them style.

Every figure above comes from the reports committed under
`test/resources/corpora/`. A nightly job re-lints the three projects at their
pinned commits and diffs the output against those reports line for line, so
the nightly build fails once a figure here goes stale.

## Continuous integration

In CI, use the [GitHub Action](https://github.com/xslint/xslint-action) to
get inline annotations on your pull requests:

```yaml
- uses: actions/checkout@v6
- uses: xslint/xslint-action@0.0.14
```

Or run it on commit with [pre-commit](https://pre-commit.com) by adding this to your
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/xslint/xslint
    rev: 0.6.0
    hooks:
      - id: xslint
```

## Editors

xslint runs inside your editor through the
[xslint-lsp](https://github.com/xslint/xslint-lsp) language server, with the
same diagnostics and quick-fixes as the CLI:

- **VS Code, Cursor, VSCodium, Windsurf, Gitpod:** install the extension from
  [Open VSX](https://open-vsx.org/extension/maxonfjvipon/xslint-vscode), or the
  `.vsix` attached to each [release](https://github.com/xslint/xslint-lsp/releases).
- **IntelliJ IDEA, WebStorm, PyCharm, and other JetBrains IDEs:** install the
  [xslint-jetbrains](https://github.com/xslint/xslint-jetbrains) plugin.

## Installation

To install `xslint` globally, install [npm] first, then run:

```bash
npm install -g @maxonfjvipon/xslint@0.6.0
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

Run `xslint` with no arguments to check every `.xsl` and `.xslt` file under the
current directory, or name the files and directories to check. Pick the preset
with `--preset`, silence checks by substring with `--suppress`, and ask one
question of a whole tree with `--only`. Either flag takes a comma-separated
list as readily as a repeat, and a substring no check name holds fails the run:

```bash
xslint --preset all --suppress=short-names path/to/dir
xslint --only=short-names,unused path/to/dir
xslint --only=short-names --only=unused path/to/dir
```

The [usage guide][usage] covers how a directory is walked, what
`.gitignore` keeps out, and how the flags combine.

## Configuration

Project-wide settings live in a `.xslint.yml` file, found by walking up from
the current directory or passed with `--config <path>`. Flags override the
file, and the file overrides the defaults:

```yaml
preset: all
rules:
  short-names: off
  "unused-*": error
exclude:
  - "test/**"
```

The [configuration guide][configuration] explains every key.

## Inline suppression

Silence a check in one place with an XML comment. A directive that silences
nothing is reported as unused, wherever the run ran the checks it names:

```xml
<!-- xslint-disable-next-line unused-function -->
<xsl:function name="my:hook">
```

The [suppression guide][suppression] covers the line and file
forms and how a directive reaches a wrapped expression.

## Output

Defects go to stdout and logs to stderr. `--format` picks `text`, `json`,
`sarif` (a SARIF 2.1.0 log for GitHub code scanning) or `github` (inline
annotations in Actions). The [output guide][output] describes each
format and the order defects come out in.

## Fixing

`--fix` applies the corrections that leave a stylesheet meaning what it meant,
`--fix-suggestions` adds those that change behavior or are one of several
reasonable choices, and `--fix-dry-run` writes nothing. Only the flagged span is
rewritten. The [fixing guide][fixing] covers overlapping fixes and
expressions that do not parse.

## Exit code

`xslint` exits non-zero when any `error`-severity defect is found. Warnings do
not fail the run by default; to make them count, cap the allowed number with
`--max-warnings`:

```bash
xslint --max-warnings=0    # any warning fails the run
xslint --max-warnings=10   # more than ten warnings fails the run
```

## Baseline

To adopt xslint on a tree that already holds hundreds of defects, record them
once with `--baseline-write` and fail the build only on the new ones:

```bash
xslint --baseline-write xslint-baseline.json
xslint --baseline xslint-baseline.json --max-warnings=0
```

A fixed defect fails the run until `--baseline-prune` drops its entry. A prune
records nothing new, so the baseline only shrinks. The [baseline
guide][baseline] covers how defects are counted and where the file is read
from.

## Adopting

On a large tree, measure the reports by check, turn off only the checks the
team rejects, and gate CI on a baseline of the rest. Then fix one check per
pull request and prune what it left stale. The [adoption guide][adopting]
gives the commands for each step, and for moving to the `all` preset.

## Checks

Validators first make sure every stylesheet is well-formed and every XPath
expression parses, then linters run over what passed, one file at a time or
across every stylesheet you lint together. The [check catalog][checks] lists
every check with its motive and examples, and the
[guide to how xslint checks][stages] describes the stages.

## Programmatic use

`xslint` is embeddable: `lint` takes in-memory sources and returns the defects,
touching no files and never exiting.

```js
const {lint, fixed} = require('@maxonfjvipon/xslint')

const sources = [{file: 'sheet.xsl', content: '<xsl:stylesheet .../>'}]
const defects = lint(sources, {suppress: ['short-names']})
const {contents} = fixed(sources, defects)
```

The [API guide][api] documents `lint`, `fixed`, `settingsOf`,
`stylesheetsOf`, `sourceOf`, `ledgerOf` and `baselined`.

## How to contribute

Fork repository, make changes, then send us a [pull request][guidelines].
We will review your changes and apply them to the `master` branch shortly,
provided they don't violate our quality standards. To avoid frustration,
before sending us your pull request please make sure all your tests pass:

```bash
npm test
```

Most of the `npm test` run goes to the `*.deep.test.js` files, which run the
command-line tool in a child process. While you are still working, run the rest
of the suite on its own. It holds most of the tests and starts no process:

```bash
npm run fast
```

Name a new test `*.deep.test.js` when it runs `xslint` or `xcop` in a child
process (it does so by requiring `test/helpers.js`), and plain `*.test.js` when
it stays in this one. `test/conformance.test.js` checks the naming both ways, so
a misnamed file fails the build.

New linter rules live in `src/resources/checks/xpath` (per-file) or
`src/resources/checks/corpus` (cross-file), each with a matching test pack in
`test/resources`. The validators in `src/resources/checks/validation` and the
formatting checks in `src/resources/checks/format` are fixed in code; their
YAML only tunes severity and message. You write a check in YAML, but
a run reads `src/resources/checks.json`, so rebuild and commit it whenever you
touch one:

```bash
npx grunt checks
```

If you forget, the test suite re-renders the file from the YAML and fails on any
difference. Regenerate the documentation site with
`npx grunt docs`.

You will need [npm] and [node] installed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and
[CHANGELOG.md](CHANGELOG.md) for release notes.

[npm]: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
[node]: https://nodejs.org/en
[guidelines]: https://www.yegor256.com/2014/04/15/github-guidelines.html
[checks]: https://xslint.github.io/xslint/
[usage]: https://xslint.github.io/xslint/manual/usage.html
[configuration]: https://xslint.github.io/xslint/manual/configuration.html
[suppression]: https://xslint.github.io/xslint/manual/suppression.html
[output]: https://xslint.github.io/xslint/manual/output.html
[fixing]: https://xslint.github.io/xslint/manual/fixing.html
[baseline]: https://xslint.github.io/xslint/manual/baseline.html
[adopting]: https://xslint.github.io/xslint/manual/adopting.html
[stages]: https://xslint.github.io/xslint/manual/checks.html
[api]: https://xslint.github.io/xslint/manual/api.html
