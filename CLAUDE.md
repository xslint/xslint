# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. Keep it
accurate: a change to behavior that leaves this file describing the old one is
not done.

## Git workflow

Always start from a clean master:

```bash
git checkout master
git pull origin master
```

## Commands

```bash
npm run fast                                         # ESLint then the fast half
npm test                                             # ESLint then every test (Grunt)
npx mocha test/xslint.deep.test.js --timeout 10000   # one test file
npx mocha test/xslint.deep.test.js --grep sentence   # tests matching a pattern
npx grunt docs                                       # regenerate the docs/ site
npx grunt checks                                     # rebuild src/resources/checks.json
npm run coverage                                     # 100% branch gate (CI)
```

CI also runs, as separate jobs beyond `npm test`: `coverage`, `xcop`,
`copyrights` (SPDX header on every source file), `markdown-lint`, `yamllint`,
`typos`, `pdd`, and `fixtures`. A green local `npm test` does not mean CI is
green — run `npm run coverage` and the xcop suite too.

The suite comes in two halves, and the line between them is a child process. A
**deep** test starts one — it runs `xslint` or `xcop` the way a user does — and
is named `*.deep.test.js`; every other test stays in this process. Three files
are deep, and they still cost most of what the suite costs: 437 of the 1082
tests, 8 of the 12 seconds. The other 645 finish inside a second, which is why
`npm run fast` is the loop to work in and `npm test` the one to finish on. The
deep target runs under `mocha --parallel`, so those three files run at once and
the slowest of them sets the clock — `xslint.deep.test.js` alone, whose 50 tests
each try the CLI with different arguments and so cannot share a process the way
the other two now do. `npm run coverage` runs parallel too: c8 merges what each
worker writes to `NODE_V8_COVERAGE`, so the 100% gate is unaffected while the
run went from 48 seconds to 13. `grunt mochacli` runs both targets, so
nothing in CI narrows. The naming is not a convention anybody has to remember
either: `test/conformance.test.js` reads every `.test.js` for the
`require('./helpers')` that is the only door to a child process, and fails when
a file holding it is not named `.deep.test.js` — or when one that spawns nothing
is.

What a deep test must not do is spend a process per assertion. The xcop suite
did, 257 of them, and 25 of the suite's 26 seconds were ruby interpreters
booting; it asks once over a directory now and reads each fixture's line out of
the one report (#687). `fixer.deep.test.js` did the same with 79 — a node per
row — and now seeds one `mkdtempSync` directory per *flag* and fixes it in one
run, 15 seconds down to 1 (#689). A yard shared that way is one corpus, so a
cross-file check reads every fixture in it at once; that can only ever hide a
defect a neighbour supplies the usage for, never invent one, and a row pinning
file content would turn red if a fix went missing. What would not turn red is a
row asserting a check is *gone*, so the suite's first test holds every such row
to a check that reads one file. Nor may a deep test write into the working
tree: its scratch files
go under `mkdtempSync`, because `should test default directory` lints the
repository and a file appearing and vanishing under `test/` takes that walk's
count with it — a race parallel mode turns from theory into one failure in four.
`conformance.test.js` fails any test file that writes without asking for a
temporary directory.

## Code style

ESLint (`eslint-config-google` + `@stylistic`, config in `eslint.config.mjs`,
run by the `lint` job) enforces: spaced operators, no single-letter names
(`id-length` >= 2), postfix `x++` only (prefix `++x` is banned), bare module
names in `require`/`import` (no `node:` prefix), no conditional operator
(`a ? b : c` is banned outright by `no-ternary`, nesting and flat chain alike),
no redundant return variable
(`const x = expr; return x` is banned — return the expression), no missing
argument (a call must fill every parameter the callee declares without a
default), one `return` per function (a second exit is banned), and no orphaned
JSDoc block (a `/**` block standing in front of another one documents nothing,
which is what a deleted function leaves behind). The last four are project-local
rules in `eslint-local-rules.js`, unit-tested in
`test/eslint-local-rules.test.js`; the arity of the callee is read from its
declaration in the same file, or by loading the module a relative `require`
names. The orphan rule has to be one of them rather than a
`no-restricted-syntax` selector, because a comment is not a node a selector can
reach, and `jsdoc/require-param` cannot see it either: a block binds to the
declaration that follows, so the second block wins and the first is judged
against nothing. Removing `settled` in #709 left its block behind, describing a
`tokens` parameter and a token return directly above `operates`, which takes
neither. That plugin file sat in ESLint's `ignores` and so was held to none of
the rules it implements — nine ternaries lived there. It is linted now, with the
formatting rules its own style predates (`semi`, `quotes`, `comma-dangle`,
`quote-props`, `object-curly-spacing`, `space-before-function-paren`) and
`local/no-multiple-returns` switched off for that one file, so a ban that
matters reaches the plugin too. Shortening that off-list is its own job; only
`eslint.config.mjs` is still unlinted.

A parameter a caller may leave out therefore says so in the signature, with a
default — `fix = undefined` on `defect` in `src/checks.js`. A JSDoc `[fix]`
alone does not count: the rule weighs `Function.length`, so an optional
parameter that the runtime signature calls required is a lint error at every
call that omits it.

A function likewise leaves through exactly one `return`, and the branching — not
the exit — decides what it carries: a lookup keyed on the deciding values
(`collapses` in `src/linters/count-linter.js`), a binding an `if`/`else if`
chain settles before the exit (`defectsOf` in `src/linters/corpus-linter.js`,
which picks the strategy rather than the answer), or a sentinel a scan assigns
before its loop ends
(`closes` in `src/expressions.js`). A `return` counts against the nearest
enclosing function, so a `map`/`every` callback carrying its own single `return`
is fine, and an arrow with an expression body has none at all.

The conditional operator is not one of those shapes: it is banned outright, so a
value that branches is a `let` initialised to the fallback and narrowed by an
`if`, never `a ? b : c`. Two operators stay, because neither asks a question
about a condition — `??` and `?.`, for the case that is only about absence:
`entities.get(name) ?? whole` in `src/helpers.js` says what
`has(name) ? get(name) : whole` said, in one reading rather than three. Where the
branch really is a condition, initialise to the *default* arm and let the `if`
carry the exception, so the fallback is stated once and the reader never holds an
open branch to reach it. An arrow that has to branch grows a block body — the
expression form has nowhere to put the `if`.

One word names one thing. **`expression` is the text of an expression, never the
node carrying it** — a node is an `attribute`, and the record pairing the two is
`found` (`{node, start, expression, pattern}`, what `expressionsOf` yields).
`no-restricted-syntax` selectors enforce both halves: reading a node's property
off an `expression` is an error, and so is handing `defect` a node and its text as
two arguments. The word named the node in `src/validators/xpath-validator.js`
and the text in
`src/attributes.js` until #648, which is how one call came to spell both from one
identifier and how a JSDoc drifted to a key (`file`) the validator never pushed.
Pass the record, not its pieces: a mismatched pair reported at the wrong place and
lost its fix silently, because a node read as text parses for nobody.

A gap is spelled one way: `GAP` (or `WHITESPACE`) from `src/tokens.js`, the four
characters of XML's `S`. JavaScript's `\s` is banned by a `no-restricted-syntax`
selector in every regex literal and template, because it also matches a no-break
space and the Unicode spaces, so a scan spelling its gap that way reads a call in
`boolean&#xA0;(a)` that no processor parses (#643).

**Every style or consistency convention must be machine-enforced.** When you fix
one, do not just fix the instances — in the same change add a check that fails on
the next violation (prefer a new `no-restricted-syntax` selector so no dependency
is added, else a CI job).

## Architecture

**xslint** is a CLI linter for XSL stylesheets. It runs in two stages.
**Validators** first establish that the input is valid; **linters** then run only
over what passed. Each validator *partitions* its input — it hands the valid part
to the next stage and reports the rest — so one broken file, or one malformed
expression, never hides the feedback on everything else.

```text
src/index.mjs             CLI entry (commander.js, ESM)
  src/xslint.js           discovery, config, run order, output; exports lint()
    src/validators/ — partition the input, report the bad part:
      xsl-validator.js           well-formed XML  -> builds the corpus
      xpath-validator.js         XPath syntax     -> keeps the valid expressions
    src/linters/, document — (corpus, suppressions) => defects:
      xpath-linter.js            declarative checks/xpath/*.yaml (per file)
      corpus-linter.js           declarative checks/corpus/*.yaml (cross file)
      *-linter.js                code-based checks/format/*.yaml (one construct each)
    src/linters/, expression — (expressions, suppressions) => defects:
      xpath-format-linter.js     checks/format/redundant-whitespace.yaml
```

The two stages have a directory each, and everything else in `src/` is the core
they consume. That is not filing: it is what makes the rule below expressible,
which it was not while a stage and a shared module were the same kind of string
written from the same place (#715). The `-linter` suffix stays inside
`src/linters/` for one reason — dropping it would put `linters/xpath.js` one word
from `src/xpath.js`, the fontoxpath environment.

`src/xslint.js` exposes the whole staging as a pure function,
`lint(sources, {suppress, overrides}) => defects`: no file I/O, prints nothing,
never exits. The command-line `xslint(paths, options)` in the same module wraps
it — resolves config, reads the `.xsl` files, calls `lint`, applies `--fix`,
reports, and sets the exit code. The package `main` re-exports `lint` and
`fixed` so an embedder (the planned LSP server, #336) can lint a buffer without
shelling out; the bin stays `src/index.mjs`.

`src/index.mjs` reaches `xslint.js` through a dynamic `import` inside the
command action, not a top-level one, and so runs `program.parseAsync`. Importing
it eagerly loaded fontoxpath, xmldom, `yaml`, and all 67 check YAMLs — 137 ms
before a byte of XSL was read, charged to `--version` and `--help` and every
rejected argument as much as to a real run. Behind the action that work happens
only where it is used, and the invocations that never lint answer in 72 ms
(#687). Whatever the action throws still reaches the one `try` around the parse,
which is what `parseAsync` buys over letting an async action reject unheard.

A check is one entry with **four kinds**, each a YAML file plus a motive plus a
test pack:

| Kind | YAML | Detection | Reported node |
| --- | --- | --- | --- |
| `xpath` | `xpath` + `severity` + `message` | the XPath selects violations | selected node |
| `corpus` | `declaration`/`usage` (+ `reference`/`scoped`/`reachable`) | cross-file, declarative | the declaration |
| `validation` | `severity` + `message` | code (well-formedness, XPath syntax) | in code |
| `format` | `severity` + `message` | code (a `src/linters/*-linter.js`) | in code |

No linter imports another, no validator imports another, and only
`src/xslint.js` reaches into either directory. That is one rule rather than
three: a `no-restricted-syntax` selector over all of `src/`, with that one file
ignored, refuses a `require` or `import` of any path ending in `-linter` or
`-validator`. It asks what is being required, never where the requiring file
sits, which is what makes it hold — the first draft anchored on the requirer's
directory and three spellings walked past it, an extension (`./name-linter.js`),
a longer way to the same file (`../src/linters/name-linter`, which resolves), and
any new `src/` subdirectory at all, since `src/*.js` does not recurse (#715). A
barrel cannot get around it either: an `src/linters/index.js` would have to
require the linters it re-exports, and that is the same violation. The
declarative loaders (`xpath-linter`,
`corpus-linter`) and the token/DOM linters all share `src/xpath.js` (the
fontoxpath environment: prefixes, evaluators, `isValid`), `src/tokens.js` (the
positioned XPath lexer), and `src/helpers.js` (XML/YAML parsing, file
recursion). The staging is wired only in `src/xslint.js`: each linter is one
`{run, checks}` entry in `LINTERS`/`EXPRESSION_LINTERS`, and the `CHECKS` name
list that `--suppress` and config globs match is *derived* from those entries, so
a linter and its suppression names cannot drift apart.

No code-based linter selects attributes by name on its own. `src/attributes.js`
hands it every expression a stylesheet carries: an XPath or pattern attribute *of
an XSLT element*, whole, plus each expression an attribute value template encloses
in braces, offset by where it starts inside the value (#579). Each one says
whether it is a `pattern`, because the two are different languages and a rewrite
legal in one can be a syntax error in the other — `.` stands alone in an
expression but is a whole pattern rather than a step inside one, so `y|.` does
not parse and a bare `match="."` outranks the `self::node()` it replaced. A
fixer touching a step withholds inside a pattern; where the shorter form does
not exist there at all, the check does not report it either, the way it stays
quiet on a `parent::n` (#583). In an XSLT 3.0
stylesheet it also reads a **text value template** — the braces of a text node
whose nearest `expand-text`/`xsl:expand-text` is on — and a **shadow attribute**
(`_select` for `select`), the same expressions the modern idiom hides outside an
attribute (#606). An attribute a literal result element happens to call `test` or
`select` holds text destined for the result tree, so it is left alone — reading it
as XPath let `--fix` rewrite the output.

XPath binds prefix `xsl:` to the XSLT namespace; `xslint:` is reserved in
`src/xpath.js` for custom functions (none are registered now).

## Check formats

Per-file rule — `src/resources/checks/xpath/<name>.yaml`:

```yaml
xpath: <XPath selecting the violation nodes>
severity: warning|error
message: <one sentence, no trailing period>
```

Cross-file rule — `src/resources/checks/corpus/<name>.yaml`:

```yaml
declaration: <XPath selecting declared nodes that carry an @name>
usage: <XPath selecting the used names, across the whole corpus>
reference: "<optional substring template; {name} stands for the @name>"
scoped: <optional true>
reachable: <optional true>
severity: warning|error
message: <one sentence>
```

Without `reference`, a `declaration` is a defect when its `@name` matches no
`usage` value by exact identity. With `reference`, the match is by substring:
plain (defect when the string occurs nowhere, counting the declaration's own
body), `reachable: true` (follows the call graph — a defect when referenced yet
never reached from outside every declaration body), or `scoped: true` (counts
usage only within the declaration's subtree, or an importing file). Because usage
is followed across files, a symbol defined in a `_funcs.xsl` library and used
elsewhere is never flagged.

Validator and format checks — `checks/{validation,format}/<name>.yaml` — carry
only `severity` and `message`; their logic lives in code and the YAML just tunes
those two.

## Adding a rule

Names are kebab-case with no `template-match-` (or other noise) prefix. Every
rule needs a motive (`src/resources/motives/<kind>/<name>.md`) and at least one
test. `test/conformance.test.js` enforces the naming, the motive, and the
pack/test coverage for all four kinds — a rule that misnames itself, drops its
motive, or ships untested fails the build.

The YAML is where a check is authored and reviewed, but not what a run reads:
`npx grunt checks` renders all four kinds into `src/resources/checks.json`, and
that is what the loaders `require`. Parsing 67 YAML files, and loading the parser
to do it, cost 31 of the 71 ms every process spent before it looked at a byte of
XSL (#689). So **touching a check means running `npx grunt checks` and committing
the result** — `conformance.test.js` re-renders the JSON from the YAML and fails
on any difference, because a check that has drifted is not the check that fires.

- **xpath rule**: add `checks/xpath/<name>.yaml` and
  `test/resources/xpath-packs/<name>.yaml`.
- **corpus rule**: add `checks/corpus/<name>.yaml` and
  `test/resources/corpus-packs/<name>.yaml`.
- **validation/format check**: the logic is code (a validator, or a
  `src/linters/*-linter.js` wired into `LINTERS`); the YAML only tunes
  `severity` and
  `message`. A code-based format linter builds its defects through `src/checks.js`
  (`metaOf`, `suppressed`, `defect`) and reads its expressions from
  `src/attributes.js`'s `expressionsOf` (every XPath/pattern attribute of an XSLT
  element, plus every expression an attribute value template, a 3.0 text value
  template, or a shadow attribute carries, each flagged `pattern` or not) unless
  it has a documented reason to
  narrow — then it narrows through `selectorOf`, never a hand-written `//@name`,
  which an ESLint `no-restricted-syntax` selector bans, and wraps what it narrowed
  to in `wholeOf` so `defect` still receives one expression rather than a node and
  a string paired up by hand.

Then run `npx grunt checks`, `npm test`, `npm run coverage`, and
`npx grunt docs`.

### Mandatory rules

- **Version-dependence.** If a check's detection or fix is valid only for certain
  XSLT versions, the version test is part of the check. Read the version with
  `versionOf(node)` from `src/xsl-version.js` and test it with `since` against a
  floor such as its `MODERN` (code) — a version gate is a lower bound, not a list
  of spellings, so a construct 2.0 introduced is present in 4.0 too, and a hazard
  that begins where backwards compatible behaviour stops only deepens after
  (#619) — never
  `documentElement.getAttribute('version')`, which an ESLint rule bans because it
  misses a simplified stylesheet's `xsl:version`. Pass the **node under
  judgement**, not the document: `version` may sit on any XSLT element and
  `xsl:version` on any literal result element, each setting the version of its
  own subtree, so a document-wide answer misjudges a template raised or lowered
  against its root (#618). A code-based linter already holds that node from
  `expressionsOf`, so the gate belongs inside its per-expression loop, not above
  it. `versionOf` canonicalises the value too — `version` is an `xs:decimal`, so
  `2`, `2.0` and `2.00` are one version and answer `2.0` — and hands back
  anything it cannot place, which `malformed-version-in-stylesheet` reports rather
  than let a gate guess (#614). A declarative rule reads it
  structurally — `(/xsl:stylesheet | /xsl:transform)/@version` on an XSLT root,
  `@xsl:version` on any other root (a literal result element standing in as the
  stylesheet) — never a bare `/*/@version` (blind to a simplified root) or a
  presence fallback `(@version | @xsl:version)` (an SVG root's own `version`
  defeats it); `test/conformance.test.js` fails a selector naming `@version`
  without `@xsl:version`. That gate read only a *comparison* until #608 — its
  pattern was `@version` followed by `=` — so `missing-version-in-stylesheet`,
  which asks `not(@version)`, slipped past the very rule written to catch it and
  never asked a simplified root for the `xsl:version` XSLT requires of it. It
  matches any mention of `@version` now, presence test included. Fork on the
  *namespace*, not on the two root names: `xsl:package` is a third XSLT root and
  takes the plain `version` as much as `xsl:stylesheet` does, so a rule reading
  `self::xsl:stylesheet or self::xsl:transform` demands `xsl:version` of a
  package that already declares its version correctly. A fix follows the same
  fork: `missing-version-in-stylesheet` writes a plain `version` on any XSLT
  root and the namespaced one on a simplified root, under whichever prefix that
  document binds — read with `lookupPrefix`, never assumed to be `xsl`. Where
  check and fixer fork differently the pair is worse than either alone: this one
  reported a package and then wrote a second `version` beside its first, turning
  a valid module into a file no parser loads. A non-XSLT root is not a simplified
  stylesheet on the strength of holding an `xsl:*` either — an *embedded*
  stylesheet (XSLT 1.0 §2.7) is data around a real module root, which declares
  its own version, so the else branch excludes a root holding one:
  `not(.//(xsl:stylesheet | xsl:transform | xsl:package))`, one union step rather
  than a descendant scan per name. Never emit a fix the declared
  version cannot run; emit
  the version-appropriate form instead (`count(x) > 0` -> `exists(x)` on 2.0+,
  `boolean(x)`/`x` on 1.0). A version-sensitive check with no version guard is a
  bug. Verify a version-based *exclusion* fires on the versions where its premise
  does not hold — an inert 2.0 attribute in a 1.0 sheet is still a defect.
- **Root-robustness.** A declarative rule that anchors on the stylesheet root must
  match both spellings: `(/xsl:stylesheet | /xsl:transform)[...]`, never
  `/xsl:stylesheet[...]` — they are exact synonyms in every version. Broaden a
  descendant root test too (`//(xsl:stylesheet | xsl:transform)`). A whole-rule
  root/version guard belongs at the root step (`/*[guard]//x`), not nested in a
  per-node predicate; nest it only when it gates a sub-clause. This is
  machine-enforced by `test/conformance.test.js`.
- **Selector hygiene.** A declarative selector must not test existence by
  counting — write `x` and `not(x)`, never `count(x) > 0` or `count(x) = 0`,
  the same anti-pattern `count-compared-to-zero` flags in a user's sheet.
  A comparison that asks a real cardinality (`count(x) >= 2`) is fine. This is
  machine-enforced by `test/conformance.test.js`, and the gap XPath allows before
  the `(` is part of the call, so `count (x) > 0` is caught too — it was not until
  #621, which let one selector spend the space the user-facing check reports.
- **Fix in the same change.** If a check is fixable, land the fix with the
  detection — never defer it. A declarative rule gets a `node => fix` builder in
  `src/fixers.js`; a code-based linter attaches the `fix` to its defect. Mark it
  `suggestion: true` unless the edit is deterministic and semantics-preserving.
  Cover it with a committed `test/resources/fix/<name>.{xsl,fixed.xsl}` pair
  (generate the `.fixed` by running `--fix`) plus rows in
  `test/fixer.deep.test.js`'s `APPLIED`/`UNCHANGED`/`DROPPED` tables. A check
  whose only correct fix is structural stays report-only until the full-fidelity
  parser (#228); the missing fixer records that, and the motive stays silent
  about it (see **Motive quality**).
- **Motive quality.** A motive teaches the *construct*, not the tool. Lead with
  the concrete harm — why the flagged construct is wrong (correctness,
  portability, performance, or readability), not just that it is — then show an
  `Incorrect:`/`Correct:` pair of *valid* XSLT that resolves it, and where it
  helps, how to migrate by hand. It must not name a fix tier, mention
  `--fix`/`--fix-suggestions`/report-only, or describe scanner or parser
  internals: whether a check is fixable is data (the `src/fixers.js` wiring and
  the `suggestion` flag) that `README.md` lists and the docs site renders, never
  motive prose (#604). Keep the prose true to the selector: do not write "such as"
  for a closed list, call any `/`-prefixed match the "root template", or claim a
  hand-fix is loss-less when it shifts template priority or a value's type. Only
  motive existence is machine-checked today; turning the example pair into a
  `conformance.test.js` gate is pending the motive cleanup (#552).
- **Motive sync.** When you touch what a check flags — its severity, its version
  scope, the constructs it leaves alone — re-read its motive and update it. The
  motive is where the end user learns the construct's harm and hand-fix; a
  behavior change with an untouched motive is presumed a bug. A change to only the
  fix tier touches the wiring, `README.md`, and docs — not the motive.
- **Docs sync.** A behavior change must also update `README.md` (user-facing:
  usage, the `--fix`/suggestion lists), this file (architecture), and the docs
  site (`npx grunt docs`).

### Maturity (`mature: true`)

A check that has passed a full maturity audit carries `mature: true` in its
YAML. It is *frozen*: do not re-audit or churn it, and change its behavior only
by first removing the flag — a "perfect" check that changes must re-earn the
mark. A check is mature only when it meets every bar below; the last three are a
human attestation the flag records, the rest are visible in the tree:

- no false positive and no false negative (non-`xsl` prefixes, both roots, every
  version, the construct buried / 3+ times / beside a lookalike negative);
- the motive fully teaches it (see **Motive quality**);
- if fixable, the fix is implemented, correctly tiered, and tested — otherwise it
  is report-only *by nature* (no safe deterministic fix can exist); a fix merely
  deferred to a future capability (#228, #486, #461, #460) does not qualify. The
  report-only status shows in the wiring (no fixer), not the motive;
- the pack exercises the hard cases (see **Test packs**);
- version-dependence handled wherever the construct or fix needs it;
- the selector is optimal (no needless `//`, no `name()=`/`local-name()` where a
  namespace-bound node test works);
- it does not overlap another check.

`test/conformance.test.js` enforces the machine-checkable floor for a `mature`
check: its motive carries an `Incorrect:`/`Correct:` pair, and if it is fixable
(a `src/fixers.js` entry or a `test/resources/fix/<name>.xsl` fixture) that
fixture pair exists and `fixer.deep.test.js` runs it. The opinionated checks
tracked in #499 are not marked mature until that issue is settled.

**No check carries the flag today** (#637). The last two, both axis checks, were
frozen around open bugs — `using-namespace-axis` around advice its own message
cannot give inside a pattern (#632), `unabbreviated-axis` around a safe-tier fix
that wrote a pattern no processor loads, re-flagged in `ad6bf7f` before it was
true and then changed by six commits with the freeze still on. Nothing enforced
the freeze either (#638), so the mark asserted what the tree could not back.
Before adding it back, read the amendment in #644: nine checks have carried it
and all nine were unfrozen, so the bar itself — not the discipline around it — is
what is under review.

## Test packs

Each linter owns a `test/resources/<name>-packs/` directory, auto-discovered by
its harness — no registration. A pack is `pack` (the check name), `found`, and
`input` (or `inputs` for corpus/import packs, which reference each other as
`file<index>.xsl`). `found` carries `amount` and `positions` — `[line, col]`, or
`[fileIndex, line, col]` for cross-file packs, or `[line, col, other-check]` for
a co-firing check. A code-based linter's pack also carries `found.fixes` aligned
with `positions` (the expected `fix.replacement`, `null` for report-only), which
the harness asserts too. Both halves are machine-enforced by
`conformance.test.js`: a pack whose `pack:` names a `checks/format/` check must
carry `fixes` standing one per position, **and** the harness reading that pack's
directory must mention `found.fixes` at all — the pack declaring a fix and
nobody reading it is how `import-packs` asserted none while `redundant-import`
emitted one. No harness falls back to an empty array for `fixes` any more
(`found.values` is a separate, still opt-in key), so a dropped key throws rather
than quietly asserting nothing. It was opt-in until #607, and 33 of 98 packs had
opted out, among them every `redundant-whitespace` replacement. A `null` is as
much of an assertion as a string: it pins a check as report-only, so an
accidentally attached fix turns red.

- **Test the hard cases.** A pack must exercise more than one clean, top-level
  occurrence: the construct **buried** in a larger expression (a predicate, an
  `and`/`or` operand, a nested call), **three or more** occurrences in one
  expression (to catch a first-match bug), and the **negative neighbours** that
  look similar but must not fire. Positions pin every occurrence. A scan over a
  node *set* must exercise every node *kind* the selector yields — a `//text()`
  scan needs a CDATA section beside a plain text node, a `//*/@*` scan the
  literal-result versus XSLT-element split — because 100% branch coverage counts
  a branch one kind reaches as covered for all: a `nodeType`-blind crash sits
  green until a pack feeds it the other kind (#606).
- **Fixtures live in files.** Every test stylesheet is a committed `.xsl` under
  `test/resources/` (never inline in a `.test.js` — the `fixtures` CI job bans
  inline `<?xml`/`<xsl:`); YAML is only for the multi-field packs. Malformed
  fixtures go in `test/resources/malformed/` (excluded from the xcop workflow,
  since malformed XML cannot pass a formatting check).
- **xcop.** `test/xcop.deep.test.js` re-serializes the inline XSL of every
  `*-packs` directory into one `mkdtempSync` directory and runs
  [xcop](https://github.com/yegor256/xcop) over that directory once, then reads
  each fixture's own line out of the single report — `helpers.js`'s `xcopped`,
  which takes the report off the failure when xcop exits non-zero rather than
  losing it with the throw. The CI `xcop` job runs it too. The
  `redundant-namespace-declarations` pack is listed in `UNFORMATTED` because its
  fixture must carry the unused namespace the check flags, which xcop would
  canonicalize away, and its four prefix-list packs for the same reason one step
  in: xcop counts a namespace used only by a QName, so a declaration named only
  by an `exclude-result-prefixes` is canonicalized away exactly as a dead one is
  (#553). A pack's *basename* is what that list matches and what names its
  fixture file, so two packs sharing one across directories exclude and overwrite
  each other silently — name a new pack so it collides with none. The repo-wide
  sweep in
  the workflow excludes `test/resources/directives/wrapped*.xsl` for the same
  reason: they must keep the wrapped attribute value #611 is about, which xcop
  joins onto one line.
  Where the tool does not run, every fixture is registered and **pending**, never
  absent: a suite that asserts nothing must not read like one that passed, which
  is how 250 assertions went missing on a developer machine for months (#645).
  Whether it runs is settled by running it, not by looking it up in `PATH`. The
  CI job passes `--forbid-pending`, so in the one place the tool must be there,
  pending is a failure. A test registered behind a condition is banned by a
  `no-restricted-syntax` selector — skip it in its body with `this.skip()`.
- **Table-driven.** Where several `it` blocks differ only in data, express them as
  a data array plus one generator, not repeated blocks. When adding a test, add a
  row to the matching table (`test/fixer.deep.test.js`, the pack harnesses,
  `test/config.test.js`, ...) before writing a new block.

## User configuration

- **Suppress**: `xslint --suppress=<rule-substring>` matches names across every
  validator and linter.
- **Config**: `.xslint.yml` (found by walking up, or `--config <path>`) can turn
  rules `off`, re-grade severity, `exclude:` file globs, and default
  `max-warnings`/`log-level`/`quiet`. Flags override the file overrides the
  defaults (`src/config.js`). Unknown keys and no-match patterns are reported.
- **Inline directives**: XML comments `xslint-disable-next-line`,
  `xslint-disable-line`, `xslint-disable-file`, each with optional space-separated
  rule names (`src/directives.js`); an unused directive is reported.
- **Fix tiers**: a defect is fixable when it carries
  `fix: {line, col, value, replacement, suggestion?}`. A code-based linter still
  reads an expression the XPath validator refused — it takes the whole corpus,
  not the validated part — so it still reports what it finds there, but `defect`
  withholds the fix, because rewriting text no processor parses is how
  `select="child::"` became `select=""` (#636). A declarative fix never passes
  through `defect` — `src/linters/xpath-linter.js` attaches it from
  `src/fixers.js` — so
  it is gated there instead, against the same `expressionsOf` derivation: no fix
  is offered on an attribute whose expression the engine refuses, nor on the
  element carrying it, since a fixer names the attribute it wants inside itself
  where no gate can see it (#651). Withholding every fix on such an element is
  deliberate over-reach: an element holding an expression no processor parses is
  not worth tidying. A *safe* fix
  (deterministic, semantics-preserving) is applied by `--fix`; a
  `suggestion: true` fix (changes behavior, or is one of several corrections) is
  applied only by `--fix-suggestions`. `--fix-dry-run` writes nothing.
  `src/fixer.js` locates each fix by decode-walking the raw source, so a `>`
  written `&gt;` (#518) or a span shifted by an earlier entity (#525) still fixes,
  and an already-edited span is skipped rather than corrupted. Two fixes whose
  spans overlap cannot both be applied in one run (#571): the left-most wins,
  the wider of two that start together wins, and the loser is announced and left
  in the report for a later run — so a `.fixed.xsl` fixture may still hold a
  defect, and every one of them is parsed back by `test/fixer.deep.test.js` to
  prove no run left broken XML behind.

## Key files

| File | Role |
| --- | --- |
| `src/xslint.js` | Orchestrates discovery, config, staging, output; exports the pure `lint` (package `main`) and `fixed` |
| `src/config.js` | Resolves `.xslint.yml` (severities/`off`, excludes, `max-warnings`) |
| `src/directives.js` | Parses inline `xslint-disable-*` comment directives |
| `src/reporters.js` | `reporterOf(format)` — `text`, `json`, `sarif`, or `github` output |
| `src/validators/xsl-validator.js` | Builds the corpus; reports each non-well-formed stylesheet |
| `src/validators/xpath-validator.js` | Splits corpus expressions into valid (kept) and malformed (reported) via `isValid` |
| `src/linters/xpath-linter.js` | Loads `checks/xpath/*.yaml`; attaches any `src/fixers.js` fix, unless the node — or the element carrying it — holds an expression the engine refuses (#651) |
| `src/linters/corpus-linter.js` | Loads `checks/corpus/*.yaml`; cross-file rules |
| `src/linters/*-linter.js` | Code-based `checks/format/*.yaml`, one construct each (axis, namespace, count, name, ...); see the flow diagram |
| `src/checks.js` | Shared for code-based linters: `metaOf`, `suppressed`, `defect(check, meta, source, found, offset, fix)` — takes the expression whole, as `expressionsOf` yields it, and adds its `start` to the offset itself (#648); walks the raw text so a wrapped or entity-shifted value reports where it truly stands (#611), and drops the `fix` when the expression does not parse (#636). That walk is `rawly(source, found, offset)`, exported beside it, because a linter needs the raw offset as much as a defect does: an attribute value arrives with its line endings normalised to spaces, so a check reasoning about whitespace cannot see a wrap in the value it holds and has to ask the source (#628) |
| `src/source.js` | Raw-text walking shared by `checks` and `fixer`: `offsetAt`, `placeAt`, `character`, `skip` |
| `src/attributes.js` | `expressionsOf(xsl)` — every expression a stylesheet carries: a bare/AVT attribute, a 3.0 text value template, or a shadow attribute, each saying whether it is a `pattern`; `PATTERNS` names the five attributes that hold one; `selectorOf(name)` for a linter that narrows, and `wholeOf(attribute)` to build the same record for the one it narrowed to |
| `src/xsl-version.js` | `versionOf(node)` — the version in force at a node, from the nearest ancestor's `@version` (XSLT element) or `@xsl:version` (literal result element), canonicalised as a decimal; `since(version, floor)` for a lower-bound gate; shared `MODERN`/`KNOWN`/`DECIMAL` |
| `src/comparisons.js` | `comparedToZero` — shared scan for a call compared with `0`/`1` (count, string-length) |
| `src/expressions.js` | `masked`/`closes` lexer helpers (node-set, double-negation, boolean-call); `enclosed` — the expressions an AVT holds in its braces. `masked` blanks every kind `OPAQUE` names, so a construct standing inside a string, a comment, or a literal that never closes is invisible to the six linters scanning above it |
| `src/tokens.js` | Positioned XPath lexer (`tokenized`, `TOKENS`), preserving whitespace. A name is lexed whole and greedily as `TOKENS.NAME`, so the operator letters inside one stay part of it — `border` is one token, not `b`/`or`/`der` (#617, #249) — and a word is an operator only where the grammar lets one stand, which `operates` decides from the last token rather than from the spelling: the `or` of `a/or` is a node test, the `or` of `a or b` is not. `WORDS` and `SYMBOLS` are derived as complements of each other from the same operator maps. Every piece of punctuation carries a kind of its own too — `/`, `//`, `@`, `$`, `,`, `.`, `..`, a `::` no axis name claimed, and the operators XPath 3.1 added (`=>`, `:=`, `!`, `#`, `?`, and the braces and `:` of a map constructor) — so `TOKENS.OTHER` holds only what XPath has no token for at all, rather than the undivided run that lexed `a/@b` as one `other` and left nothing a recursive-descent grammar could be written against (#676, #685). The arrow was the sharper of the two, and the distinction is worth keeping: a *missing* kind lands in `OTHER`, where a reader knows it has met something it cannot name, but `=>` was absent from `DOUBLE` where `>=` already sat and so lexed as `=` then `>` — a stream read wrongly rather than not at all, `a => f()` arriving spelled exactly like `a = (> f())`. The node comparisons were that same absence one more time: `<<` and `>>` were missing from `DOUBLE` where `<=` and `>=` already sat, so `$a << $b` arrived as two `<` in a row, and `is` was missing from the word half beside `eq` and `or` (#724). One entry each is the whole of the lexer's share, since `WORDS` and `SYMBOLS` are derived from that map — `is` is an operator only where `operates` admits one, so the `is` of `foo/is` stays the node test it is, and `island` stays one name. A braced URI literal is one token too, for a different reason than an operator is: `Q{uri}local` is how XPath 3.0 writes a name's namespace inline, and `BracedURILiteral` is a *terminal* of the grammar, so the whole of `Q{…}` is lexed here rather than assembled above out of a name and two braces — which is what it arrived as, six tokens of which one was the `{` a map constructor opens with, so a production written against either had to reach inside the other's. A malformed one is not a kind of literal: the content is every character up to the closing brace with a brace itself excluded, so `Q{a{b}c` and one that never closes lex on as the `Q` and the brace they always were, and the grammar refuses what those tokens make rather than a new kind having to say so (#708). A literal that never closes is `TOKENS.UNCLOSED` and not a `STRING`, for that same reason: `'unclosed` came back as a finished literal, so the lexer supplied the quote its author never wrote and the grammar accepted an expression no processor parses (#708). Which kinds a scan must read *over* rather than into is `OPAQUE` — string, unclosed and comment together — and it is one list because the two readers of that question, `masked` in `src/expressions.js` and `inside` in `src/linters/xpath-format-linter.js`, each spelled it out and so a kind added to one was a kind missing from the other: it was, and `redundant-double-negation` and `count-compared-to-zero` reported inside `select="'not(not(x))"`, on text nobody evaluates. A `no-restricted-syntax` selector refuses a second copy anywhere in `src/` but `src/tokens.js` itself, which is exempted by filename rather than by naming every kind: an array or a `&&`/`\|\|` chain mentioning `TOKENS.STRING` beside `TOKENS.COMMENT` is the list spelled out again, whether or not it happens to be complete today. Both readers spelled it as a chain, not an array, so a selector reading `ArrayExpression` alone would have matched a shape this repository has never held and passed the two it did. Which of them ends a value is `ENDS`, so `operates` reads kinds alone: `.`, `..` and a constructor's `}` end one, and the `or` of `. or x` is therefore an operator. A name ends at a `::` though not at a `:`, since a QName carries one colon and an NCName none, so two together are never a name still being spelled: reading them as name characters is how `a::b` arrived as the single token `a::b` while `a ::b` arrived as three, one grammar read two ways by a gap, with the separator nowhere in the first for a parser to object to — six invalid expressions parsed as a plain step until it was fixed (#703). A separator ends a name and settles what may follow it: the grammar admits a NodeTest there and nothing else, so a name behind one is the element it names however it is spelled, and `child::child::b` and `child:: child::b` arrive as one stream rather than two told apart by a space (#709). That question is about what precedes rather than about characters, so it is `operates`'s question and answered beside it: both are handed the last *solid* token, which `tokenized` carries forward as it pushes, since whitespace is insignificant between tokens and a question a gap could change is one the grammar does not ask. Handed the token and not the list, because this one is asked of *every* token where `operates` is asked only of a word — deriving the last solid token by filtering the whole list each time turned the lexer quadratic in allocations, 3.4x on a 200-step expression, which is the shape #687 and #689 were each a ticket about. The character walk in `opensAxis` had been answering it by accident, asking `spelling` whether a name was in progress, which counts a `:` as a name character: the tight form walked back over the separator and got the right stream for the wrong reason, and the spaced form stopped at the gap and opened an axis. No verdict rode on it, since nothing accepts either spelling; the message did, and a parser handed two axis tokens said `expected a name, found "child::"` — naming a token the author never wrote as one. Also owns the one definition of a gap — `WHITESPACE`, the XML `S` a gap is spelled with, and `GAP`, the same four characters as a regular-expression class — plus `spelling`, which answers whether a name runs up to an offset, and `qualified`, which answers whether XML can spell one at all. Those two are different questions and the second was nobody's: a name is taken whole and greedily, so `my:25l`, `my:-x` and `my:a:b` each arrive as one `NAME` and read as an ordinary step, the grammar asking the lexer for a name and never how it is spelled — the one place we were the lenient side of the engine (#708). A QName is an NCName or two joined by one colon, and each part is weighed with `NAMED` less the colon that split it and `STARTS` for what it may open with, so the answer borrows the classes the lexer spells a name with rather than holding a second opinion about what a letter is. Both parts must hold something: a prefix names nothing on its own, and `$my:` and `my:(1)` are refused by every engine. This answer let them through, permitting a trailing colon because the `my:` of `my:*` arrives spelled that way — the `*` being the wildcard's own token — so a permission a wildcard needed reached a variable and a call as well (#731). A wildcard is `tested`'s business and it takes both tokens of the prefixed spelling itself now, which leaves this answer nothing to make an exception for. Every reader of a gap borrows one of them, and a `no-restricted-syntax` selector bans `\s` outright, because JavaScript's class also takes a no-break space and so reads a call in `boolean&#xA0;(a)` where no processor sees one (#643) |
| `src/grammar.js` | `parsed(xpath, version)` — the XPath 3.1 expression grammar as recursive descent over `tokenized`, one function per production. A node's span is a range of *token indexes*, never a pair of character offsets, so a position is carried from the lexer rather than computed from text, and the text of a node is the tokens of its span joined back together. The whole stream comes back with the tree, trivia and all, so joining it reproduces the expression as written — which is what keeps a fix a span replacement over raw source. The version in force is a parameter rather than a lookup, because the same text is a different language under a different one: `a to b` is a range in 2.0 and two steps around a name in 1.0, so modern syntax in a 1.0 stylesheet is a parse failure rather than an entry on a list somebody has to keep current (#652). The node comparisons are gated that way too: `is`, `<<` and `>>` stand beside the value and general comparisons and are refused below 2.0, the version that added them, so one selector of this project's own — the `$var << .` of `confusing-variable-and-node` — stopped being valid XPath our own parser refuses (#724). Beside them, and not below them: the three classes are one level of the ladder rather than three, because `ComparisonExpr` takes an operand from either side of one operator and admits no run of them (#726). Two levels of the ladder are spelled out rather than folded for that reason — the range between the sums and the comparisons, and the comparison between the concatenations and the `and` — since a `folded` run is left-associative and takes as many operands as it is offered. Three rungs let a comparison chain onto another, so `a = b eq c` and `a < b < c` parsed; over the 225 pairs fifteen comparison operators spell, the engine accepts none and the grammar accepted 144. The node comparisons would have taken that to 225, which is how the defect surfaced: the 81 pairs holding one were refused because the lexer did not know the operator, not because the grammar was right, and fixing the lexer took the accidental cover off. No committed expression chains comparisons, so the corpus gate cannot see any of it and four `REFUSES` rows pin it instead, one per class and one crossing two. A name with a bracket behind it is read off two version-keyed lists rather than one flat one, because what a name *may* be depends on the version: `TESTS` names the ten kind tests, `ITEMS` the five item types that are no kind test, and `RESERVED` maps each name XPath reserves to the version that reserved it, 1.0 taking the four node types alone, 2.0 adding its kind tests with `empty-sequence`, `if`, `item` and `typeswitch`, and 3.0 adding `array`, `function`, `map`, `namespace-node` and `switch`. One flat list held all fifteen, so `item()` and `map(*)` read as kind tests and parsed as steps, and `switch(1)` and `typeswitch(1)` — neither a kind test nor an item type, so no shortening of that list would have reached them — parsed as calls (#708). Below its floor the same characters are an ordinary call to an unregistered function, which is #576's question and not the parser's, and is exactly what xsltproc answers about every one of them at 1.0: it parses the expression and then goes looking for the function. That makes a `RESERVES` row the mirror of a `GATED` one — a construct that stops parsing from a version up rather than starting — and the reservation reaches only where a call could stand, in front of a bracket, so `//item` is the path it always was. A refusal is an answer rather than an exception — a corpus asks about thousands of expressions and most callers want a verdict — and it names the offset it stood at, so a report can point at the fault instead of at the attribute holding it. An inline namespace is gated at 3.0 along with everything else that version added, and it reaches four productions rather than one, a name being spelled in more places than a step: `named` composes the braced URI literal with the name behind it, so a variable and a call get it for free; `tested` reads one standing in front of a `*` as the fourth spelling of a wildcard, `Q{uri}*` naming every element of a namespace with no prefix bound to it; `called` asks `pastName` where `reaches` cannot, since a name is one token spelled as a QName and two with its namespace inline, so the bracket that tells a call from a step stands one token away or two; and `steps` counts it among the kinds a step may open with, since a step opening `Q{uri}a` opens with a name like any other. It asks that of `NAMES` rather than of one kind at a time, the lexer kinding a name three ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one has a bracket behind it, a `URI` where it spells its namespace inline. Asking about one kind is a defect that repeated itself before the shape was seen: the first draft of #708 accepted `a/Q{urn:my}b` and refused `//Q{urn:my}a`, the shape the inline form exists for, and with that fixed `a/my:fn(1)` was still accepted while `//my:fn(1)` was refused (#731). Every production that *reads* a name knew all three kinds; the one deciding where a name may stand knew them one at a time, and a path is the only place that distinction shows. Under-acceptance is the direction that invents a defect against working code. A reserved name is never either of those spellings, XPath reserving an unprefixed one alone (#708). Beside it stands `matched(pattern, version)`, because a pattern is a different language and not a second reading of this one: it is a union of paths and nothing else, so `1 + 1`, `@a = "b"` and `a, b` are fine expressions and no pattern at all, and reading a `match` with the expression grammar admits every one of them (#589, #649). The version decides which language it is, by more than a detail: 3.0 rebuilt the pattern grammar on top of the expression one, so `a intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`, `(self::node())`, `.` and the word `union` are all patterns there and none of them is one in 1.0 or 2.0, whose whole grammar is `IdKeyPattern` and a union of relative paths — each is gated on `REWRITE` rather than admitted everywhere, since a pattern accepted under a version with no production for it is a stylesheet called valid that no processor loads. A `/` may stand alone and a `//` may not, the step being what the descent descends to. A bracketed branch is where a pattern parts from an expression rather than borrowing it: 3.0's `StepExprP` admits one at *any* position in a path, so `a/(b \| c)` is a pattern as much as `(b \| c)/a` is, while the expression grammar's own parenthesized step may only open a path (#711) — reading the two alike refused a pattern XSLT admits. Its steps are narrower than an expression's at every version, because a pattern is matched by walking *up* from a node rather than evaluated forwards, so an axis such a walk cannot answer is a static error and not an empty match: `treads` names the two of 1.0 and 2.0's `ChildOrAttributeAxisSpecifier` and the six of 3.0's `ForwardAxisP`, which adds `self`, `descendant`, `descendant-or-self` and `namespace`, and no version admits the four reverse axes, `following`, `following-sibling` or `preceding-sibling`. A `..` never spells a step and a `.` spells one from 3.0. Settling that took two processors and neither would have done alone: SaxonJ-HE says what 3.0 refuses, with XTSE0340, but applies its own 3.0 pattern syntax whatever the stylesheet declares — it admits `self::a` and `.` at `version="1.0"` — so only xsltproc, being 1.0 only, can say what an older version refuses. A processor shows that a construct is admitted somewhere; only a version-aware one shows that a version refuses it, which is the trap #717's arbitration fell into as well. Two more borrowings from the expression grammar are paid back. A bracket is `bracketed` rather than the expression grammar's parenthesized primary, so it holds a `Pattern` — optionally, since `()` matches nothing and is a pattern all the same — `(a \| b)/c`, `(a)`, `(a[1])/b` and `(a \| b)[1]` are patterns and `(1 + 1)/a`, `(a = b)/c`, `("s")/a` and `(a, b)/c` are not, though each of those is a fine expression. And `.` is the whole of `PredicatePattern`, read by `whole` before any union, so it stands alone or not at all: `a \| .`, `. \| a` and `.[@x] \| a` are refused. It is still a *step* once a separator stands in front of it, which is the distinction `entered` draws — `b/.`, `/.` and `//.` are patterns while `(.)`, `(.)/a` and `a/(.)` open a path with one and are not. The last borrowing goes with them: `FunctionCallP` took its arguments from the expression grammar, where XSLT admits a literal or a variable reference and nothing else, so `key("k", a/b)`, `id("x" \| "y")` and `doc(concat("a", "b"))/x` parsed as patterns; `anchored` narrows them, and `root` takes no argument at all. A numeric literal is a literal, so `key("k", 1)` is a pattern and `id(1)` is one too — a processor refuses that second one for `XPTY0004`, which is `id`'s signature rather than the pattern grammar, and reading the arbiter's *code* rather than its exit status is what tells the two apart. Eight of a first sweep's apparent over-acceptances were static-type, undeclared-prefix, arity and classpath errors. Nothing reads either of them yet: they are wired in at Phase 3 of #644, behind the two gates of #680, which `test/grammar-corpus.test.js` now holds `parsed` to |
| `src/import-graph.js` | Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf`. A reference with no `@href` names no module and yields no import, rather than joining a null onto the directory and taking the whole run's report down (#597); no check reports that malformed reference yet (#668) |
| `src/fixers.js` | Maps a declarative check name to a `node => fix` builder, each built from `src/fixes.js` rather than by hand: `deletion` for one that cuts an attribute, `substitution` for one that rewrites its value |
| `src/fixes.js` | Shared fix builders: `deletion(attribute, content)`, which reads the span to cut from the raw source — xmldom reports an attribute at its opening delimiter, so the quote is whichever stands there and the walk back over the `=` and the name crosses a gap of any width. Rebuilding the text as `name="value"` behind a space made the fixer decline every other spelling of it (#594). Beside it, `standsAt(attribute, content)` answers where an attribute *stands*, in the line and column a defect is reported in, off the same walk: a reporter that instead subtracted the name's length from `columnNumber` was right only where the source spelled the attribute `name="value"` exactly, so `xmlns:dead = "urn:dead"` was reported two columns right of itself and one standing on its own line six (#681). The two answers differ by one gap on purpose — a deletion takes the gap in front of the name with it, or it would close two attributes up against each other. `substitution(attribute, replacement)` is the third, for a fix that rewrites a value rather than cutting it: it anchors one character past the delimiter and replaces the value alone, so the name, the gaps around the `=` and the quote stay as the source spells them and none of the three has to be found. Five builders rebuilt the whole attribute as `name="value"` instead, which assumed all three at once and failed on each — on `select = "//para"` the fix named a column two to the right and a text standing nowhere in the file, so it was announced and then declined as no longer matching (#718). The arithmetic behind it is banned outright now by a `no-restricted-syntax` selector, since nothing in `src/` needs to guess where an attribute begins. It does read the delimiter, though, because what a fix carries is the *decoded* value: an expression the source spelled `//a[@x &lt; 1]` arrives holding a bare `<`, and writing it back as it stands closes the element early. So `escaped` re-encodes the `&`, the `<` and whichever quote the value stands in — the delimiter being the one position the parser reports exactly, which is why `deletion` reads it too. A `>` is left bare, legal in an attribute value: re-encoding cannot recover which characters the author chose to write as references, so the line is drawn at what XML forbids. Rewriting the whole value swept every entity in it before that, which master does today on the plain spelling and this change would otherwise have carried to the spaced one |
| `src/fixer.js` | Applies a defect's `fix` to source (decode-walk, verify-before-apply, end-to-start). A line ending in the source answers to a space in the fix's `value`, the last normalisation between the two texts, without which no fix could reach an expression a line wrap crossed — announced as fixable and then refused with "the source no longer matches", naming an edit that never happened (#629) |
| `src/xpath.js` | fontoxpath environment: prefixes, evaluators, `isValid` — which retries the expression respelled when the engine refuses a spelling the grammar allows: the `namespace::` axis, ExprWhitespace around an axis's `::`, in front of a node test's bracket (#615), and in front of the bracket it closes with (#639). The axis and opening-bracket squeezes run between a step's own parts, and ask `src/tokens.js`'s `spelling` where a name begins, so the axis of `1-namespace::x` is respelled and the name of `a-namespace::x` is not; the closing one runs wherever a gap stands in front of a `)`, refusing only the `:` in front of it, since `:)` is the one XPath token a bracket ends — a list of what a test may hold instead is what refused `element( * )`. Those guards read characters rather than a parse, so what they hold is swept rather than argued: over every sequence of up to four of the pieces a fabrication is spelled from, no respelling changes the kinds the expression is made of, so the engine reads the tokens it was always going to read (#641). Fabricating a comment delimiter is the sharp end of that and what #641 reported, but not the whole of it — a squeeze that merged two names across a gap would move no delimiter and still change what compiles, so the sweep watches every kind rather than those two. `squeezed` is exported for it, and `compiles` beside it, since a diff that asks `isValid` what the engine thinks is asking the engine and this workaround together — the forty expressions #639 is about vanish from it (#680). The sweep stops at four atoms, which was #703's doing and is now a cost: a fifth broke on eight sequences, every one a pair of axes like `child:: child::`, until #709 stopped a name behind a separator opening an axis — all eight sweep clean now, and what keeps the depth at four is the ten-fold price of the fifth rather than a defect it would expose, and it says nothing about whether an expression the guards decline to respell deserved refusing, which only a grammar of our own (#677) can answer. Every verdict is kept, because fontoxpath remembers nothing between calls and a corpus asks about `.` and `@name` and `text()` over and over — a second pass over 4000 expressions cost what the first did, and now costs nothing (#689) |
| `src/helpers.js` | XML parsing (expands internal-subset entities), YAML parsing, file recursion. It refuses what `@xmldom/xmldom` would repair rather than reject: the level of a diagnostic is not consulted, since an attribute written without quotes arrives a mere `warning` and is then invented into a value (#574), and `forbidden` walks the text nodes for the two sequences character data may not hold — an `&` that opens no reference, which the parser rewrites to `&amp;`, and a `]]>` that closes no section, which it keeps as it stands (#691). Both are accepted in silence, at no level. Text nodes come from `src/tree.js`'s `walked`, not from a scan of the source, because both are legal in a comment and a processing instruction, and inside a CDATA section an `&` is text while a `]]>` is the close — a text node cannot be any of the three, so those are excluded by construction rather than by finding them, and an attribute value, where `]]>` is legal because it is not content, is outside the walk for the same reason. The YAML parser is required inside the function, not at the top: nothing on the linting path reads YAML any more, so a run that has no `.xslint.yml` never loads it |
| `src/resources/checks.json` | Every check as a run reads it, built from the YAML by `scripts/generate-checks.js`. Never edited by hand — `test/conformance.test.js` re-renders it and fails on any difference |
| `src/logger.js` | 4-level logger |
| `scripts/generate-docs.js` | Builds the `docs/` site from checks + motives |
| `scripts/generate-checks.js` | Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`) |
| `test/conformance.test.js` | Enforces naming, motives, selector hygiene, pack/test coverage, the `mature` freeze across all kinds, the fast/deep split of the suite itself, and that no test writes a scratch file outside a temporary directory |
| `test/grammar-corpus.test.js` | The two gates #680 stands in front of the parser, asked of every expression the repository carries — 607 of them, from the committed stylesheets, from the ones the packs hold inline, and from the selectors the declarative checks are themselves written in. **Round trip**: a parse's tokens join back into the expression byte for byte, every node's span slices to its own text, and every child nests inside its parent in order — the last of those is what slicing cannot see, since shifting a node and its children together still slices. **Acceptance diff**: the verdict is diffed against the engine's, and the engine is asked as `compiles` rather than as `isValid` — `isValid` is `compiles(xpath) \|\| compiles(squeezed(xpath))`, so the respelling retry sits on the engine's side of that comparison and an expression fontoxpath refuses and the squeeze rescues cannot surface as a disagreement at all. Forty do, and they are #639's family exactly, a spaced axis or a `namespace::`; diffing against `isValid` cancels every one and reports the evidence for retiring the retry as absent from the tree, when what is absent is a comparison that can see it. Those forty are gated as a set — the grammar accepts every spelling the retry rescues, which is what makes retiring it at Phase 3 cost nothing — and what is left over is annotated one line each in `GAPS`, naming the side that accepts and the gap it stands for, so a new one and a stale one both turn red. Eleven stood when #680 wrote that list and **none** does now, which is the measure working rather than the measure going quiet: nine were a parenthesized step (#711), one a node comparison (#724) and the last a name no NCName can spell (#708). An empty list is an assertion, not the absence of one — every expression the repository carries takes the same verdict from both sides, so a disagreement of either kind turns it red — and it does not claim the two agree everywhere, the corpus reaching only what the corpus holds, which is why the classes #708 closed that no fixture spells are pinned in `test/grammar.test.js` instead. The corpus is gated as well, because a sweep can pass by finding nothing: each of the three sources must still yield what it did when the gates were written, and the retry must still have something to rescue. The selectors are one expression in twelve and held ten of the original eleven gaps — the checks are written in an idiom the stylesheets never use, which is why a corpus of stylesheets alone (#708) agreed completely and proved little |
| `test/helpers.js` | The only door to a child process in the suite: `runXslint`/`xslintStatus`/`xslintStreams` run the CLI, `xcopped` runs xcop once over a directory, `cmdAvailable` answers whether a tool is there by running it |
| `test/xcop.deep.test.js` | Writes every pack's inline XSL to one `mkdtempSync` directory and runs xcop over it once; pending, never absent, where the tool does not run |
