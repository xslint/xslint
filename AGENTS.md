# AGENTS.md

The rules for an agent working in this repository. The map of the code, and why
each rule here is the rule it is, are in [`ARCHITECTURE.md`](ARCHITECTURE.md):
read the section a change touches before making it. The derivation behind one
module is in the `CLAUDE.md` of its own directory — `src/`, `src/linters/`,
`src/validators/`, `test/`, `scripts/` — which Claude Code loads as it opens a
file there; any other agent reads it the same way. A change to behavior that
leaves any of these describing the old one is not done.

## Workflow

- Start from a clean master: `git checkout master`, then
  `git pull origin master`.
- **Every style or consistency convention is machine-enforced.** When you fix
  one, do not just fix the instances: in the same change add a check that fails
  on the next violation — a `no-restricted-syntax` selector first, so no
  dependency is added, else a rule in `eslint-local-rules.js` (unit-tested in
  `test/eslint-local-rules.test.js`), else a CI job.
- A bar is never widened to fit what has grown past it, and a red gate is fixed
  at its cause: never skip, disable or loosen a test to get green.

## Commands

```bash
npm run fast                                         # ESLint then the fast half
npm test                                             # ESLint then every test (Grunt)
npx mocha test/xslint.deep.test.js --timeout 10000   # one test file
npx mocha test/xslint.deep.test.js --grep sentence   # tests matching a pattern
npx grunt docs                                       # regenerate the docs/ site
npx grunt checks                                     # rebuild src/resources/checks.json
npx grunt readme                                     # restate the figures README.md reads off the tree
npm run coverage                                     # 100% branch gate (CI)
```

Work in `npm run fast`, finish on `npm test`. CI also runs, as separate jobs
beyond `npm test`: `coverage`, `xcop`, `copyrights` (SPDX header on every
source file), `markdown-lint`, `yamllint`, `typos`, `pdd`, and `fixtures`. A
green local `npm test` does not mean CI is green — run `npm run coverage` and
the xcop suite too. `daily` and `corpora` run on a schedule.

## Code style

ESLint (`eslint.config.mjs`, with the project rules of `eslint-local-rules.js`)
refuses each of these; the reasons are under **Code style** in
`ARCHITECTURE.md`.

- No conditional operator: a value that branches is a `let` set to the default
  arm and narrowed by an `if`. `??` and `?.` stay, for absence alone.
- One `return` per function: branch into a lookup, a binding settled before the
  exit, or a sentinel set before a loop ends.
- Postfix `x++` only, names of two characters or more, bare module names in a
  `require` (no `node:`), spaced operators.
- A parameter a caller may leave out has a default in the signature
  (`fix = undefined`); a JSDoc `[fix]` alone fails at every call omitting it.
- A source file outside `test/` stops at 1000 lines. The one file the cap is
  lifted off is named in `SPRAWLING` in the config, and `ARCHITECTURE.md`
  states its length.
- A docblock description stops at five lines, one tag entry at three, the note a
  module opens with at ten, and no docblock stands orphaned. A derivation that
  does not fit is cut to the ticket that derived it, never moved elsewhere.
- No string wrapped across lines with `+`: join an array.
- An array grows by `concat`, a `flatMap` or an array literal, never by
  spreading a list into a `push`.
- A gap is `GAP` (or `WHITESPACE`) from `src/tokens.js`, never `\s`.
- A stylesheet is named by `SUFFIXES` and asked through `suffixed` in
  `src/xslint.js`, never by a suffix spelled into an `endsWith` or a comparison.
- `expression` names the text of an expression, never the node carrying it;
  pass the `found` record, never a node and its text as two arguments.
- Nothing depending on the outer loop alone is computed in the inner one.
- Set `process.exitCode`; never call `process.exit`.
- No linter imports another, no validator another, and only `src/xslint.js`
  reaches into either directory.
- A linter narrowing to one attribute calls `whole(found, name)`, never a
  hand-written `//@name`.

## Checks

A check is a YAML under `src/resources/checks/<kind>/`, a motive under
`src/resources/motives/<kind>/<name>.md`, and a test pack; its name is
kebab-case with no noise prefix. The kinds and their formats are under
**Check formats** in `ARCHITECTURE.md`.

- After touching any check YAML, run `npx grunt checks` and commit
  `src/resources/checks.json`: a run reads the JSON, never the YAML.
- A message is two sentences, fault then remedy, in thirty words, names bare,
  no dash. Every check carries `preset:`, `recommended` or `all`.
- A code-based linter detects on the tree through `src/syntax.js`, never by
  matching an expression's text, reads its expressions from `expressionsOf`,
  and builds its defects through `src/checks.js`.
- Then run `npx grunt checks`, `npm test`, `npm run coverage`, and
  `npx grunt docs`.

The mandatory rules, each derived under **Mandatory rules** in
`ARCHITECTURE.md`:

- **Version-dependence.** If a detection or a fix holds only for some XSLT
  versions, the version test is part of the check: `found.version` tested with
  `since` against a floor, or `xslint:version(.)` in a selector, never
  `getAttribute('version')`. Never emit a fix the declared version cannot run.
  Fork on the namespace, not the root names, and write a fix's prefix as the
  document binds it.
- **Root-robustness.** A selector anchored on the root matches all three,
  `(/xsl:stylesheet | /xsl:transform | /xsl:package)`, and a whole-rule guard
  stands at the root step (`/*[guard]//x`).
- **Selector hygiene.** Test existence as `x` and `not(x)`, never by counting;
  name an element by its node test, never by `name()`; ask an attribute in both
  spellings (`@x or @_x`) and its value through `xslint:attribute(., 'x')`;
  beside `count(*) = 1` ask `not(text()[normalize-space()])`, and wherever
  `text()` is read, read `xml:space` beside it. Open a selector with `//name`
  where it can, so the shared walk serves it; one the walk cannot serve goes on
  `UNINDEXED` in `test/conformance.test.js`.
- **Fix in the same change.** Land a fixable check's fix with its detection,
  declare its tier in `fix:` (`suggestion` unless the edit is deterministic and
  keeps semantics), and cover it with a `test/resources/fix/<name>.xsl` and
  `.fixed.xsl` pair and rows in `test/fixer.deep.test.js`.
- **Motive quality.** A motive teaches the construct: the concrete harm first,
  then an `Incorrect:`/`Correct:` pair of valid XSLT. It never names a fix tier,
  `--fix`, report-only, or the scanner, and it stays true to the selector.
- **Motive sync.** A change to what a check flags re-reads and updates its
  motive; a change to the fix tier alone does not touch it.
- **Docs sync.** A behavior change updates `README.md` and the
  `src/resources/manual/` page it links to (the flags, never the checks a flag
  covers), `ARCHITECTURE.md` (and this file, where a rule moves), and the docs
  site (`npx grunt docs`); the figures the README states of the tree are
  `npx grunt readme`'s to write.
- **No maturity flag.** A check carries no `mature:` and no `nursery:`; do not
  freeze, re-audit, or grade one by anything but a test that turns red.

## Tests

- A test starting a child process reaches it through `require('./helpers')` and
  is named `*.deep.test.js`; a test that starts none is not.
- A deep test never spends a process per assertion: seed one directory and run
  once over it.
- No test writes into the working tree: scratch files go under `mkdtempSync`.
- A fixture is a committed `.xsl` under `test/resources/`, never inline in a
  `.test.js`; a malformed one goes in `test/resources/malformed/`.
- A pack exercises the hard cases: the construct buried in a larger expression,
  three or more occurrences in one, the negative neighbours that must not fire,
  and every node kind its scan yields. Positions pin every occurrence, and a
  format check's pack carries `fixes`, `null` where it is report-only.
- Every pack is read through `test/packs.js`, the one harness, and its inline
  XSL must pass xcop or be named on `UNFORMATTED`.
- Where `it` blocks differ only in data, add a row to the table that drives
  them; never register a test behind a condition — skip it with `this.skip()`.

## Speed

`test/scaling.test.js` charges every stage its own processor time as a share of
the whole run, and holds it to a bar: `xpath-linter` at 39%, `xpath-validator`
at 26%, `xsl-validator` at 18%, and every other stage to `SHARE` at 7%, its
growth beside the middle stage's to `GROWTH` at 3.0. One level down, each check
of a stage answers to `COST` at 3%, bar `name-starts-with-numeric` at 7% and
`too-many-templates` at 4%. The nightly `corpora` job times three real corpora
against a budget. Every bar is a ratchet, red from both sides: past it, or so
far under it that `SLACK` asks for it to be retightened. To place one:

- Where there is a defect to catch, put the bar at the **geometric middle** of
  the readings with the defect in place and the readings without.
- Where there is none, put it between **half again and twice the dearest
  reading**, taken over several runs of the gate.
- A share is of the whole run, so when a stage gets cheaper, **re-derive the
  table by the ratio of the dearest readings**, or say why an entry stays.

## Guides

- This file and `CLAUDE.md` each stay within 200 lines: a rule goes here, the
  map and the derivation behind a rule go to `ARCHITECTURE.md`, and the
  derivation behind one module to its directory's `CLAUDE.md`.
- A new module under `src/` gets its one line in the `Key files` index of
  `ARCHITECTURE.md` in the same change.
- A count or a length a document states of the code is held to the code by
  `test/guides.test.js` and `test/conformance.test.js`: change both together.
