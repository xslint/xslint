# AGENTS.md

Rules for an agent working in this repository. The map of the code, the check
formats, and the rules for authoring a check in full are in
[`ARCHITECTURE.md`](ARCHITECTURE.md): read the section a change touches before
making it. Why a rule is the rule it is lives in the ticket its gate cites, and
in git history; neither file retells it.

## Workflow

- Start from a clean, pulled `master`.
- Every style or consistency convention is machine-enforced. Fixing one means
  adding the check that fails on the next violation in the same change: a
  `no-restricted-syntax` selector first, else a rule in `eslint-local-rules.js`
  (tested in `test/eslint-local-rules.test.js`), else a CI job.
- A red gate is fixed at its cause. Never skip, disable, or loosen a test, and
  never widen a bar to fit what has grown past it.
- A behavior change updates `README.md` and the `src/resources/manual/` page it
  links to (the flags, never the checks a flag covers), `ARCHITECTURE.md`, and
  the docs site (`npx grunt docs`). The figures `README.md` states of the tree
  are written by `npx grunt readme`.

## Commands

```bash
npm run fast                                         # ESLint then the fast half
npm test                                             # ESLint then every test (Grunt)
npx mocha test/xslint.deep.test.js --timeout 10000   # one test file
npx mocha test/xslint.deep.test.js --grep sentence   # tests matching a pattern
npx grunt checks                                     # rebuild src/resources/checks.json
npx grunt docs                                       # regenerate the docs/ site
npx grunt readme                                     # restate the README figures
npm run coverage                                     # 100% branch gate
```

Work in `npm run fast`, finish on `npm test`. CI runs more than `npm test`:
`coverage`, `xcop`, `copyrights` (an SPDX header on every source file),
`reuse`, `actionlint`, `markdown-lint`, `yamllint`, `typos`, `pdd`, and
`fixtures`. A green local
`npm test` is not a green CI, so run `npm run coverage` and the xcop suite too.

## Code style

ESLint (`eslint.config.mjs` and `eslint-local-rules.js`) refuses each of these.

- No conditional operator. A value that branches is a `let` set to the default
  arm and narrowed by an `if`. `??` and `?.` stay, for absence alone.
- One `return` per function: branch into a lookup, a binding settled before the
  exit, or a sentinel set before a loop ends.
- Postfix `x++` only, names of two characters or more, bare module names in a
  `require` (no `node:`), spaced operators.
- A call fills every parameter its callee declares without a default, so an
  optional parameter carries one in the signature (`fix = undefined`).
- A source file outside `test/` stops at 1000 lines. The one exemption is named
  in `SPRAWLING` in `eslint.config.mjs`, and `ARCHITECTURE.md` states its length.
- A docblock description stops at five lines, a tag entry at three, the note a
  module opens with at ten, and no docblock stands orphaned. What does not fit
  is cut to the ticket that derived it, never moved elsewhere.
- No string wrapped across lines with `+`: join an array.
- An array grows by `concat`, `flatMap`, or an array literal, never by spreading
  a list into `push`.
- A gap is `GAP` (or `WHITESPACE`) from `src/tokens.js`, never `\s`.
- A stylesheet is recognised through `suffixed` and `SUFFIXES` in
  `src/xslint.js`, never by `.xsl` or `.xslt` spelled into a comparison.
- `expression` names the text of an expression, never the node carrying it.
  Pass the `found` record, never a node and its text as two arguments.
- `referencing` is never called inside a `usages` scan in
  `src/linters/corpus-linter.js`; build the index once with `indexed`.
- Set `process.exitCode`; never call `process.exit`.
- No linter imports another, no validator another, and only `src/xslint.js`
  requires either directory.
- A linter narrowing to one attribute calls `whole(found, name)`, never a
  hand-written `//@name`.
- A linter reads the version off `found.version` and gates it with `since`.
  One holding a node and no record joins the `VERSIONED` exemption group in
  `eslint.config.mjs` to call `versionOf`; `getAttribute('version')` never.

## Checks

A check is a YAML under `src/resources/checks/<kind>/`, a motive under
`src/resources/motives/<kind>/<name>.md`, and a test. Its name is kebab-case
with no noise prefix. Formats and the full authoring rules are under **Checks**
in `ARCHITECTURE.md`.

- A run reads `src/resources/checks.json`, never the YAML. After touching any
  check, run `npx grunt checks` and commit the JSON.
- A message is two sentences, fault then remedy, in thirty words, names bare,
  no dash. Every check carries `preset:`, `recommended` or `all`, and a fixable
  one carries `fix:`, `safe` or `suggestion`.
- A code-based linter detects on the parse tree through `src/syntax.js`, never
  by matching text, reads its records from `expressionsOf`, and builds its
  defects through `src/checks.js`.
- If a detection or a fix holds only for some XSLT versions, the version test
  is part of the check, and no fix emits what the declared version cannot run.
- A selector anchored on the root matches all three roots,
  `(/xsl:stylesheet | /xsl:transform | /xsl:package)`.
- A selector tests existence as `x` and `not(x)`, never by counting; names an
  element by its node test, never by `name()`; asks an attribute in both
  spellings (`@x or @_x`) and its value through `xslint:attribute(., 'x')`.
- A fixable check lands its fix in the same change, covered by a
  `test/resources/fix/<name>.xsl` and `.fixed.xsl` pair and rows in
  `test/fixer.deep.test.js`.
- A motive teaches the construct: the concrete harm first, then an
  `Incorrect:`/`Correct:` pair of valid XSLT, in a hundred words of prose
  outside its code blocks. It never mentions a fix tier, `--fix`, or how the
  scanner works. A change to what a check flags updates its motive.
- A check carries no `mature:` and no `nursery:`. Defects come from a corpus
  run or a user, never from an audit.
- Then run `npx grunt checks`, `npm test`, `npm run coverage`, and
  `npx grunt docs`.

## Tests

- A test that starts a child process reaches it through `require('./helpers')`
  and is named `*.deep.test.js`; a test that starts none is not.
- A deep test never spends a process per assertion: seed one directory and run
  once over it.
- No test writes into the working tree. Scratch files go under `mkdtempSync`.
- A fixture is a committed file under `test/resources/`, never inline in a
  `.test.js`. A malformed one goes in `test/resources/malformed/`.
- Every pack is read through `test/packs.js`. A pack covers the construct
  buried in a larger expression, three or more occurrences in one expression,
  the neighbours that must not fire, and every node kind its scan yields.
  Positions pin every occurrence, and a format check's pack carries `fixes`,
  `null` where it is report-only.
- A pack's inline XSL passes xcop or is named on `UNFORMATTED` in
  `test/xcop.deep.test.js`.
- Where `it` blocks differ only in data, add a row to the table driving them.
  Never register a test behind a condition; skip it with `this.skip()`.

## Speed

No test times anything. The nightly `corpora` job alone judges speed, a
quadratic in any stage and what a run costs outright alike. It times three
real corpora against the budgets in `.github/workflows/corpora.yml`, judged by
`scripts/budget.js`, and diffs what they draw against `test/resources/corpora/`.
A budget is a ratchet, red past it and red so far under it that `SLACK` asks
for it to be retightened.

- With a defect to catch, a bar stands at the geometric middle of the readings
  with the defect and without it.
- With none, it stands between half again and twice the dearest reading, taken
  over several runs.
- No bar is a share, a growth, or a reading taken inside a test (#1186, #1160).

## Guides

- This file holds rules; `ARCHITECTURE.md` holds the map. No other guide
  exists: what is true of one module is the note that module opens with.
- `CLAUDE.md` holds nothing but `@AGENTS.md`.
- Both files are present tense. History belongs to tickets and git.
- `test/guides.test.js` holds this file to 200 lines, `ARCHITECTURE.md` to 300,
  every `src/` module to a row of its index, and every count either states of a
  list in the code to that list.
