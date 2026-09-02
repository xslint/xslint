# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. Keep it
accurate: a change to behavior that leaves this file describing the old one is
not done.

This file holds the rules and the map. The **derivation** behind any one module
— the ticket it answers, the measurement a number in it stands on, the arbiter
that settled a refusal — lives in the `CLAUDE.md` of the directory that module
sits in, and arrives with that directory rather than with every turn:
`src/CLAUDE.md`, `src/linters/CLAUDE.md`, `src/validators/CLAUDE.md`,
`test/CLAUDE.md`, `scripts/CLAUDE.md`. A turn loads this file and the guide of
every directory on the way down to whatever it touches, so a chain of them is
what a bar on their size answers to — standing under the breach since #844, so
a chain reddens with room still left to answer it — and a note
that outgrew even a chain stands at the top of the module it is about, the way
`src/grammar.js` and every `-linter.js` note under `src/linters/` do. So a
claim goes where the code it is about goes, and the `Key files` index below
names every file in one line. Both halves are machine-enforced —
`test/guides.test.js` for the size, the index, and the counts a guide states of
a list in the code, `test/conformance.test.js` for the length one states of a
file the line cap is lifted off (#821, #825).

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
green — run `npm run coverage` and the xcop suite too. Two more run on a
schedule rather than on a pull request: `daily`, which is `npm test` across
three platforms and two node versions, and `corpora`, which times a real run
(see **Speed**).

The suite comes in two halves, and the line between them is a child process. A
**deep** test starts one — it runs `xslint` or `xcop` the way a user does — and
is named `*.deep.test.js`; every other test stays in this process. Four files
are deep, and they still cost most of what the suite costs: 671 of the 2853
tests, 9 of the 14 seconds. The other 2182 finish inside one, which is why
`npm run fast` is the loop to work in and `npm test` the one to finish on. The
deep target runs under `mocha --parallel`, so those four files run at once and
the slowest of them sets the clock — `xslint.deep.test.js` alone, whose 52 tests
each try the CLI with different arguments and so cannot share a process the way
the other three now do. The fourth, `walk.deep.test.js`, is the one that starts
node rather than `xslint`: it walks a wide directory in a process given the
smallest JavaScript stack node will start with, because the crash of #758 needs
a spread wider than the stack carries and scaling the stack down is what puts
that within half a second of fixture-building instead of the 125,000 files it
takes at full size. How wide the directory is, it does not decide: the same run
measures the largest spread that stack carries and the tree is a fifth wider
than that, some eleven thousand files. A fixed 30,000 was the first spelling and
it read as cheap on the platform it was written on — a second there, over ten on
Windows, where the deep target's own timeout took it down. Writing those files is
the whole of what the test costs, and it costs differently: half a second on
macOS and thirty on Windows, which walks 380 files a second where macOS walks
25,000. So the slowest deep file is `xslint.deep.test.js` everywhere but there,
and this one asks for a timeout of its own rather than the target's ten seconds.
`npm run coverage` runs parallel too: c8 merges what each
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

Both halves run on one mocha, and did not until #841: `grunt-mocha-cli` pins
`mocha ^8.2.0`, so `npm install` nested a second mocha under it — 8.4.0,
from 2021 — and `grunt mochacli` ran the suite there while `npm run coverage`
ran it on 11. That nested tree is where two of the nine advisories `npm audit`
read on master stood and nowhere else, `nanoid` and `minimatch`. An
`overrides` entry in `package.json` holds it to the `mocha` the root declares,
and `manifest.test.js` asks it of every tool a grunt wrapper runs — of
`grunt-eslint`'s `eslint` too since #855, which had nested a 9 under the
declared 10 the same way, and had been supplying the config's own imports out
of that nest. The rest of
that entry lifts `diff` and `serialize-javascript` to the majors mocha 12 ships
with — every version mocha 11's own ranges admit is an advisory, and its one
call into each is unchanged in 12 — grunt's `js-yaml` to 4, whose `safeLoad`
grunt calls only in a `readYAML` nothing here calls, 3.x never having been
patched, and `typed-rest-client`'s exact `qs` up one patch. The two majors
are spelled at the top level rather than under `mocha`, because npm 11.12
honours a range scoped under `grunt` or `grunt-mocha-cli` and drops the
same range scoped under `mocha`. `daily.yml` runs `npm audit` in a job of its
own beside the six cells that run the suite, so the next advisory files an
issue by morning without taking a platform's test result down with it — an
advisory this project waits on upstream to patch would otherwise leave
Windows unmeasured for as long as the wait lasts, and six identical audits
say one thing.

## Speed

Speed is machine-enforced like every other convention here, and it was the one
that was not: the cross-file linter went quadratic and reached master with
eighteen jobs green, at 52% to 72% of the whole run over the three corpora the
README advertises (#755, #756). Two tiers hold it now, and the evidence under
every bar either of them stands on is in `test/CLAUDE.md`, beside
`test/scaling.test.js`, `test/import-linter.test.js` and `scripts/budget.js`.

`test/scaling.test.js` is the per-pull-request tier. It charges every stage its
own **processor time** — `process.cpuUsage`, never the wall clock, which charges
a stage for every slice the scheduler hands to something else — over a corpus it
builds at 40 stylesheets and again at 160, and asks two questions of each: what
percentage of the whole run it cost, and how it grew beside the middle stage's
growth. Both are quotients taken inside one process, which is what cancels the
machine. `SHARES` names the three stages that legitimately cost more of a run
than the rest — `xpath-linter` at 42%, `xpath-validator` at 24%,
`xsl-validator` at 16% — and every other stage answers to one bar, `SHARE` at
7%; growth is asked only of the stages with no entry, against `GROWTH` at 3.0,
since an entry pins what a stage costs outright and that is the stronger
statement. `corpora.yml` is the nightly tier, timing DocBook-XSL, TEI and
DITA-OT at pinned commits against a budget of 13, 13 and 6 seconds, and
asserting what it read rather than only how long it took. What a gate measured
at one size cannot see is a quadratic whose constant is still small there, so
`test/import-linter.test.js` is a third instrument, timing one check over a
chain of 200 stylesheets and again over 800 and failing past a growth of 8
(#769).

Every one of those tables is a **ratchet and not a licence**, red from both
sides: past the bar, or so far under it that `SLACK` (four) says the bar has
stopped being one and wants retightening. Three rules govern a bar, and they are
what to read before touching either table. Where there is a defect to catch, a
bar goes at the **geometric middle of the two measured distributions**, the
readings with the defect in place and the readings without — geometric because
the risk is multiplicative on either side. Where there is no second distribution
to leave room for, it stands between **half again and twice the dearest
reading**, taken over several runs of the gate rather than off one printed table,
since a range of extremes is not a statistic. And a share is a share **of the
whole run**, so a stage made cheaper lifts every other share without one of them
costing a millisecond more: **re-derive the table by the ratio of the dearest
readings, or say why an entry stays**. A bar raised on nobody's failure is a bar
loosened.

## Code style

ESLint (`eslint-config-google` + `@stylistic`, config in `eslint.config.mjs`,
run by the `lint` job) enforces: spaced operators, no single-letter names
(`id-length` >= 2), postfix `x++` only (prefix `++x` is banned), bare module
names in `require`/`import` (no `node:` prefix), no conditional operator
(`a ? b : c` is banned outright by `no-ternary`, nesting and flat chain alike),
no file longer than 1000 lines (`max-lines`),
no redundant return variable
(`const x = expr; return x` is banned — return the expression), no missing
argument (a call must fill every parameter the callee declares without a
default), one `return` per function (a second exit is banned), no orphaned
JSDoc block (a `/**` block standing in front of another one documents nothing,
which is what a deleted function leaves behind), and no sprawling one (a
description past five lines, or a single `@`-tag entry past three). The last
five are project-local rules in `eslint-local-rules.js`, unit-tested in
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

A file stops at 1000 lines, counting the blank ones and the comments, since a
reader scrolls past those as well. One file stands above it and is named in
`SPRAWLING` in the config — `src/grammar.js`, 2170 lines of one function per
production of XPath 3.1 — rather than carrying a disable comment of its own, so
what is exempted is one list a reviewer reads in the place the cap is set, not a
mark to be found by opening every file. Neither half can rot in silence.
`conformance.test.js` asks the rule itself whether each name on that list is
still reported, so a file that shrinks back under the cap, or is renamed, or is
deleted, turns its own exemption red instead of quietly un-capping whatever
takes the name next; and it fails when *nothing* in the config caps a file at
all, because a rule deleted takes its enforcement with it and leaves the
exemption list reading like a limit that is still in force. The length beside
the name answers to it too since #825, that being the half which did rot: 1828
was the reading #748 took when it cut the cap, and the file stood at 2386 by
the time anything asked — a drift of 30% behind a sentence promising that
neither half could. It is asked as the cap twice, quiet at the length the prose
states and reporting the file one line under it, so a stated length is read in
the unit the cap is written in rather than counted a second time beside it; and
a file the cap is lifted off that states no length at all fails as loudly, an
exemption from a bound being bounded by nothing but the number a reader is
given.

A docblock stops at five lines of description, and at three for any one tag
entry — the tag line and the two wraps behind it — with the delimiters and the
blank `*` separators counted in neither, both numbers set beside the rule in
`eslint.config.mjs`. An at-sign does not open an entry: one of the five tags a
block of ours gives a line to does, since this repository's prose names
`@select`, `@name` and `@xml:space` on nearly every page and a sentence
wrapping onto one of those closed the description and bought three fresh lines
— eight of prose under a cap of five, silently. A tag nobody writes is prose
and charged as prose. That list spells the five without their at-sign, a
literal puzzle marker in a file being a puzzle `pdd` then refuses for holding
neither the words nor the estimate one carries. Nothing weighed a comment
before: 268 descriptions in 65 files stood past that bar, the dearest of them
142 lines, so a derivation grew wherever one was written the way the cross-file
linter's cost grew before #755 (#832). The bar is not a licence to respell what
a block cannot hold as a `/* */` beside it either — such prose is cut and not
moved, the dearest chain of guides standing at 0.91 of `LOADED` and reddening
well under it, so a guide is no place to put it either and the ticket number
left standing in the surviving sentence is what keeps a derivation
recoverable.

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

An array grows by `concat`, a `flatMap` or an array literal, never by spreading
a list into a `push` — another `no-restricted-syntax` selector, over every file
in the repository. A spread hands each element over as a separate argument, and
V8 caps those at roughly 125 per kilobyte of stack, so the shape carries a limit
nothing about the code says out loud: `allFilesFrom` walked this repository's own
768,731 files straight into a `RangeError`, before a byte of XSL was read (#758).
Ten sites spelled it, of which one had a user in front of it and the other nine
were waiting for a large enough corpus. An array literal is exempt because it
spends no argument per element, so `[...one, ...two]` is the composition to
reach for.

Nothing that depends on the outer loop alone is computed in the inner one, and a
`no-restricted-syntax` selector holds the one place that mattered: a call to
`referencing` inside a `usages` scan in `src/linters/corpus-linter.js`. The
names a usage value holds depend on that value and the check's template, not on
the declaration being judged, so reading them per (declaration, usage) pair
reads them across the product of the two — 1207 names against 72,077 attributes
over DocBook-XSL, which is 98% of what that stage spent. Build the index once
with `indexed` and ask it for the declaration's name. The selector named
`needle` until #783, the reference string a scan built per pair and then
`replaceAll`ed, which was the hottest frame in the whole process ahead of every
fontoxpath one; the index took both the function and the scan, so what it bans
is the shape rather than the spelling (#755, #783).

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
      namespace, result-namespace, imports, output, parameter,
      element, root-template     — the DOM, not one expression
    src/linters/, expression — (expressions, suppressions) => defects:
      *-linter.js                code-based checks/format/*.yaml (one construct each)
```

What crosses that last edge is what the validator kept: the `expressionsOf`
records themselves, not the attributes they hang off, so the expression stage
reads the derivation rather than rebuilding one from a node (#589). A pattern and
a brace's expression reach it too, which is why `redundant-whitespace` now
collapses the leading gap of a `match=" //spaced"`.

Thirteen linters cross it, not one. Ten of them scanned the whole corpus and asked
`expressionsOf` themselves until #750, so each read the expressions the XPath
validator had already refused and reported a second defect on the same fault —
`select="child::"` drew an `invalid-xpath-expression` *and* an
`unabbreviated-axis`, and `test="count(alpha) = 0 ("` drew one and a
`count-compared-to-zero`. Withholding the fix, which is all #636 could do from
inside `defect`, left the advice standing on text no processor accepts. One
fault draws one defect now, and it is the staging that says so rather than a
gate every new check has to remember: what is refused reaches no check at all.
Four `close < 0` guards went with the gate, one per scanner — a bracket that
never closes cannot reach a scanner reading an expression that parsed.

The twelfth arrived from the other kind rather than from the corpus, which is the
same staging read from the outside: `starts-with-double-slash` and
`use-double-slash` were declarative until #586, so a `match="//child::"` drew the
refusal *and* the advice to drop a `//`, and only the fix was withheld. A
selector reads the document, and the document holds the text a processor cannot
run; the records the validator kept do not.

The thirteenth arrived the same way at #788, and what it shows is the other half
of what a selector reading the document costs. `select-starts-with-double-slash`
asked `//*[starts-with(normalize-space(@select), '//')]`, which is every element
there is, so the `select` of a *literal result element* — text on its way to the
result tree, that no processor evaluates — drew the warning and, under
`--fix-suggestions`, was rewritten: a check about XPath quietly changing what a
stylesheet emits. `expressionsOf` yields no record for such an attribute, so the
staging answers that one too, without a namespace test anybody has to remember.

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
reports, and sets the exit code. It sets it as `process.exitCode` and never
`process.exit`, which ends the process where it stands and abandons every write
the kernel has not taken: node's stdout is asynchronous to a pipe on POSIX —
synchronous to a file, to a terminal, and to a pipe on Windows — so whether the
report arrived whole depended on how fast the other end read it. Twenty
stylesheets draw 720 defects here, 165,500 bytes of report: a file or a terminal
takes all of it, a shell pipe whose reader stalls for two seconds takes 65,492
bytes, and the socket `spawn` hands a child takes none at all. The exit code was
right in each of those, so nothing announced the loss (#767). A
`no-restricted-syntax` selector bans the call across the repository, nothing
here having a use for it — the `catch` around the parse in `src/index.mjs` sets
the same field. What pins it is a pair of runs whose reader stays paused until
stderr says how many defects were found, counting the report's lines against
that number: one report wider than the pipe and one narrower, since how wide a
pipe the host gives is what decides which of the two shapes a run of this suite
meets. The wide one leaves the run writing into a pipe nobody is emptying, which
is the write `process.exit` abandons and the whole of what #767 is
about — put back, it reports 312 of the 760 lines it counted. The narrow one is
taken whole before the reader looks, so the run is over and the hazard is node's
own rather than this project's: one `process.nextTick` after a child exits,
`flushStdio` resumes every readable stdio stream of it, deliberately, so the
stream can reach eof, and an untouched one is read and thrown away. A stalled
reader must therefore own the data rather than leave it for that flush, which is
`test/helpers.js`'s business and what the narrow row pins. Twenty stylesheets
were the whole of the test until #822, so its verdict stood on the host's socket
buffer and not on the run: those twenty are 147,620 bytes of report now, which
fits whatever rultor's docker container gives, so the run finished first, node
discarded the report, and eleven merges in a row read `-0` on a commit six
GitHub runners passed. The package `main` re-exports `lint` and
`fixed` so an embedder (the planned LSP server, #336) can lint a buffer without
shelling out; the bin stays `src/index.mjs`.

`src/index.mjs` reaches `xslint.js` through a dynamic `import` inside the
command action, not a top-level one, and so runs `program.parseAsync`. Importing
it eagerly loaded fontoxpath, xmldom, `yaml`, and all 68 check YAMLs — 137 ms
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
`corpus-linter`) and the token/DOM linters all share `src/syntax.js` (the front
door onto `src/grammar.js`: one parse per distinct expression, and the tree,
verdict, node text and offsets a check reads off it), `src/xpath.js` (the
fontoxpath environment, which since #577 nothing but the two declarative loaders
requires — a verdict is the grammar's and an engine no longer stands on the path
to one), `src/tokens.js` (the
positioned XPath lexer), and `src/helpers.js` (XML/YAML parsing, file
recursion). The staging is wired only in `src/xslint.js`: each linter is one
`{name, run, checks}` entry in `LINTERS`/`EXPRESSION_LINTERS`, and both the
`CHECKS` name list that `--suppress` and config globs match and the `STAGES`
list `test/scaling.test.js` times are *derived* from those entries, so a linter
can drift apart from neither its suppression names nor what measures how it
grows.

Nothing selects the attributes holding an **expression** by name on its own — no
code-based linter, and no
validator either since #589, which is the one entry list Phase 3 of #644 asks
for. An attribute a check reads as *structure* is a different thing and outside
this rule: the `@name` of an `xsl:param` declares a parameter and holds no
XPath, so `parameter-linter` reads it off `walked` with the namespace tested
rather than looking for an entry list that would never have it.
`src/attributes.js` hands it every expression a stylesheet carries: an
XPath or pattern attribute *of
an XSLT element*, whole — or one of the same names *in the XSLT namespace*, which
in a stylesheet that loads is `xsl:use-when` and nothing else (#654) — plus each
expression an attribute value template encloses
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
attribute (#606). The namespace decides and never the name: an attribute a
literal result element happens to call `test` or
`select` holds text destined for the result tree, so it is left alone — reading it
as XPath let `--fix` rewrite the output — while the `xsl:use-when` beside it is
XSLT's own attribute, holding a static expression a processor evaluates before it
transforms anything, and that spelling reached neither the validator nor any
check until #654: the derivation asked for an unprefixed name on an XSLT element,
and a simplified stylesheet has neither half. The widening admits any name
`ATTRIBUTES` holds under that namespace rather than the one, since a prefix is the
document's to choose and a list of permitted spellings would be a second opinion
about XSLT to keep current; what the reach costs is a report on a file already
refused, an `xsl:select` or an `xsl:match` being an attribute no version allows
there, and never a defect invented against working code.

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
that is what the loaders `require`. Parsing 68 YAML files, and loading the parser
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
  `message`. A code-based format linter detects on the **tree**, through
  `src/syntax.js` — `gathered(found, kinds)` for the nodes it is about, `textOf`
  and `offsetOf` for what one spans and where, `calls` for whether one is a call
  to a standard function, `operatorOf` for the operator between two operands —
  never by matching the expression's text, which is what Phase 4 of #644 is
  moving the last of them off. Where what makes the construct wrong is the place
  it stands in rather than the construct alone, that question is
  `src/booleans.js`'s: whether nothing but an effective boolean value is taken
  there, and what may be written in its stead. It takes *kinds* rather than a kind because one
  construct is often more than one node kind: a general and a value comparison
  are two, and a check gathering the first alone is blind to every 2.0
  stylesheet written in the second (#763, #575). It builds its defects through
  `src/checks.js`
  (`metaOf`, `suppressed`, `defect`) and reads its expressions from
  `src/attributes.js`'s `expressionsOf` (every XPath/pattern attribute of an XSLT
  element, plus every expression an attribute value template, a 3.0 text value
  template, or a shadow attribute carries, each flagged `pattern` or not) unless
  it has a documented reason to
  narrow — then it narrows through `whole(found, name)`, never a hand-written
  `//@name`, which an ESLint `no-restricted-syntax` selector bans. That helper
  asks one question rather than two on purpose: a check taking the *name* alone
  would start reading the `test="{boolean(x)}"` of a literal result element,
  where stripping the wrapper prints the node instead of `true`. The linter is
  handed the records the validator kept, so there is no corpus to scan and no
  node to pair with its own text.

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
  Nor may it name an element by its **prefix**: `name()` answers the lexical
  QName, so `name() = 'xsl:variable'` is a question about how one document spells
  the XSLT namespace and not about XSLT at all. Write the node test —
  `//(xsl:variable | xsl:template)`, whose prefix XPath binds for us — never
  `//*[name() = ...]`. Both directions were live in the tree: TEI's
  `rdf/make-acdc.xsl` writes its XSLT as `XSL:` and binds lowercase `xsl:` to
  something else, so eight checks read none of it, and a literal result element
  whose `xsl:` is bound elsewhere drew all eight. This is
  machine-enforced by `test/conformance.test.js` over every selector of every
  kind. Nor may it count the elements a node holds and ask nothing about its
  text: `count(*) = 1` is how a check spells *nothing but this one
  instruction*, and text beside the instruction answers that as much as a
  second element does, so `not(text()[normalize-space()])` stands beside the
  count — whitespace being what a processor strips from an indented stylesheet
  rather than content. What the advice writes decides it, though, so a check
  whose target form carries the text along is exempt on `COUNTING`, an
  attribute value template being the one such form in the tree today. Reading
  `text()` at all obliges it to read `xml:space` beside it, that attribute
  deciding whether a whitespace-only node is there at all: XSLT strips one
  before a processor looks at it, so indentation is not content — unless the
  nearest ancestor declaring `xml:space` says `preserve`, a nearer `default`
  cancelling a `preserve` above it, which is why the clause reads
  `ancestor::*[@xml:space][1]` rather than any ancestor at all. A check asking
  what a processor *emits* rather than what a node holds is exempt on
  `EMITTED`. `local-name()` is not banned with it — it asks nothing about a prefix,
  and `text-outside-xsl-text` needs a negated set no union of node tests can
  spell — but a union is the shorter reading wherever the list is closed (#784).
  Nor may it ask whether an attribute is *there* in one of the two spellings
  XSLT gives it: any attribute of an XSLT element is written `_x` as readily
  as `x`, so a presence clause reads `not(@_x)` beside `not(@x)`. Ten
  selectors read one spelling, all ten reported a stylesheet Saxon loads, and
  two of them rewrote it; `conformance.test.js` holds that from both sides,
  exempting `xsl:version` alone (#849).
  And a selector that opens `//name` or `//(name | name)` is served from the
  shared walk rather than by a descendant step of its own, so how a selector
  opens decides what it costs: the axis comes off `named` in `src/tree.js` and
  only the predicates reach fontoxpath — and since #811 not all of those, a
  predicate `src/predicates.js` recognises being answered off the walk while
  one it does not is refused rather than guessed at, over-acceptance there
  being a wrong report where under-acceptance is only the engine call it was.
  A **union** of such paths is served the
  same way since #811, each branch carrying an axis and a tail of its own and
  the survivors merged by rank, since XPath answers a union in document order
  over both sides at once — so `//xsl:when[…] | //xsl:otherwise[…]` is two
  buckets the walk holds rather than two descendant sweeps the engine pays for.
  A union spelled **inside** one sweep is parted arm by arm since that ticket's
  fourth phase, `P//(a | b)[Q]` being `P//a[Q] | P//b[Q]`, so an arm the walk
  cannot reach is asked of the engine alone instead of answering for every arm
  it can — which is one arm in `modern-construct-in-xslt-1`, whose other nine
  cost 9 ms over DocBook-XSL against 646 for the ten together.
  What a selector spells in **front** of its `//` is served too since #811's
  third phase: `P//X` is every `X` standing below a node `P` chose, so the
  anchor is one question the engine answers for the document and the walk keeps
  the candidates that have one of its answers above them — where the sweep
  behind it used to cost a traversal for every check spelling one. A wildcard
  or a predicate that could answer a number — picking one node out of
  the sequence rather than filtering it — cannot be served, and a selector
  spelling one of those goes on `UNINDEXED` in `test/conformance.test.js`
  beside the shape that keeps it out — which is enforced from both sides, so
  neither a selector that could be served and is listed nor one that is served
  and unlisted survives (#784). An attribute axis is served since #811, both
  `//@*` and one named attribute of named elements, so it is no longer a reason
  to be on that list, and neither is an anchor, nor a union of any spelling; a
  cross-file check answers to a
  gate with no list at all, every one of its selectors being served and a fifth
  belonging in that shape too. What keeps the seven that are left out is a
  descending **predicate** for five of them — the axis is the root itself, one
  node, and everything the selector costs is inside the brackets — a wildcard
  for one, and for one a union of attribute paths spelled inside brackets a
  predicate stands outside of, which is neither a sweep to part nor an axis the
  merge can order.
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
  namespace-bound node test works) — half of which is machine-enforced, a
  `conformance.test.js` gate refusing `name()` in any selector of any kind
  (#784), `local-name()` staying allowed because it is prefix-independent and one
  check needs a negated set no union can spell;
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
with `positions` (the expected `fix.replacement`, `null` for report-only). A
`null` is as much of an assertion as a string: it pins a check as report-only,
so an accidentally attached fix turns red. It was opt-in until #607, and 33 of
98 packs had opted out, among them every `redundant-whitespace` replacement.

**There is one harness**, `test/packs.js`, and each linter's test file is the
five lines that name a directory, a noun and a lint call (#660). It was
twenty-two files of the same loop with those three things swapped, and
duplication of a test is not free the way duplication of a fixture is: an
assertion the packs are supposed to carry had to be written twenty-two times,
and one written twenty-one times failed nowhere. Every count below is of
twenty-two — seven asserted that a check goes quiet when the run suppresses it,
five that a defect answers to the check the pack names, one that it carries that
check's severity and message, and two that a fix reads the `value` the pack
gives. `import-packs` is the one that was found: it asserted no fix at all while
`redundant-import` attached a real deletion, from #519 to #607, because the
block #519 wrote into the other harnesses simply never reached it. Each of those
assertions is written once now and every directory gets all of them, which is
`corpus-linter` learning about suppression (breaking it fails four tests where
master stays green) and twenty-one directories learning that a defect is graded
the way `checks.json` grades it (hard-coding one severity in `src/checks.js`
fails ten tests in two directories).

Four `conformance.test.js` gates hold the shape. Two are about the packs: one
whose `pack:` names a `checks/format/` check must carry `fixes` standing one per
position, and every pack of every kind must give one position per defect its
`amount` claims, since the harness walks the positions rather than the count and
an `amount` standing above their number is a place asserted nowhere (#565). That
first one is what lets the harness ask only what a pack spells, `fixes` and
`values` being read where they are declared: the data gate says which packs must
declare a fix, so no directory can quietly opt out of asserting one.

The other two are about the harness, and they answer the two ways one function
can fail where twenty-two files could not. A second copy is not expressible: no
`.test.js` but that gate's own file may read `found.amount`, `found.positions`,
`found.fixes` or `found.values`. And **every pack directory is handed to the
harness exactly once**, matched one-to-one against the directories holding
packs. That second one is the load-bearing half, and it was missing from the
first spelling of this change. Folding the harnesses makes one call the whole of
what runs a directory, so deleting it deletes every assertion over that
directory's packs at once, and nothing in the tree objected: eleven of the
twenty-two could be dropped with `npm run coverage` still reading 100%, among
them `xpath-packs` and all thirty-eight declarative checks. The other eleven
were caught by the coverage gate rather than by anything asking the question,
and `xpath-packs` had been caught that way too, through `evaluateXpath` — a
wrapper this change deletes, since a function kept alive so that its coverage
notices a missing test is the accident the ticket is about. The retired gate is
the same lesson: it asked whether the harness reading a directory mentioned
`found.fixes` at all, a text check standing in for structure that reached 19 of
the 22 and could only ever ask whether the string appeared.

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
  [xcop](https://github.com/yegor256/xcop) over that directory, then reads each
  fixture's own verdict out of the report — `helpers.js`'s `xcopped`, which
  takes the report off the failure when xcop exits non-zero rather than losing
  it with the throw. The CI `xcop` job runs it too. A fixture is written under a
  directory named for the one its pack sits in, and `UNFORMATTED` names a pack
  by the path it stands at, because a *basename* names two packs as readily as
  one: it keyed both, so a new pack taking a name either unchecked the pack that
  had it or overwrote that pack's fixture, leaving two assertions reading one
  file and the other written nowhere. Neither said anything, and the overwrite
  half is the one that hides a defect — a deliberately non-canonical fixture
  armed in a directory sorting first is silently replaced by the sound one, and
  master reports 357 passing and nothing failing (#693). The
  `redundant-namespace-declarations` pack is on that list because its fixture
  must carry the unused namespace the check flags, which xcop would canonicalize
  away, and its two prefix-list packs for the same reason one step in: xcop
  counts a namespace used only by a QName, so a declaration named only by an
  `exclude-result-prefixes` is canonicalized away exactly as a dead one is
  (#553), and two of #817's `cancelled-preserve` packs one attribute over
  again: the whitespace a nearer `xml:space="default"` throws away is the whole
  of what they assert, and xcop compacts everything under a `preserve` ancestor
  without honouring that nearer declaration — so only the two spellings it
  refuses are listed and the other two are written canonically. Every entry is
  **asserted** rather than merely skipped — the fixture
  is written and asked about like any other, and an entry whose pack xcop
  accepts turns red, which is the ratchet every other exemption list here
  answers to. Four did: two prefix-list packs, a spaced declaration, and
  `a-wrap-written-as-a-reference`, that last one exempted on a reason #694 has
  since removed. Nothing could have shown it before, either — asking which
  entries are still needed means letting them all be judged, and one refusal
  took the whole run down. The repo-wide sweep in
  the workflow excludes `test/resources/directives/wrapped*.xsl` for the same
  reason: they must keep the wrapped attribute value #611 is about, which xcop
  joins onto one line. And `test/resources/scaling/**` for the first reason
  again: the one stylesheet the speed gate copies must declare namespaces
  nothing uses, or `namespace-linter` has no defect to build and the stage is
  measured on a path it never takes. Every other line of it conforms — the root
  element is the whole of what xcop objects to.
  One refusal used to cost every other fixture its verdict. xcop stops at the
  first file it rejects, so nothing behind that one is mentioned at all: every
  assertion over those failed, with one message between them and none naming the
  file that broke — 204 at once when the ticket was written, and 357 of 357
  here, since where the run stops depends on where the bad file sorts. The
  complaint xcop did print was read by nobody. `xcopped` now asks again from
  where it stopped, recording the refusal against the file it names and renaming
  that file out of the five extensions xcop globs, so a sound directory costs
  one process, a directory holding two bad files costs three, and nothing but a
  bad file ever fails (#694). A file the run never mentioned at all takes the
  whole of what xcop printed as its verdict, rather than asserting against
  nothing. Where the tool does not run, every fixture is registered and
  **pending**, never absent: a suite that asserts nothing must not read like one that passed, which
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
  `fix: {line, col, value, replacement, suggestion?}`. A code-based linter never
  sees an expression the XPath validator refused, since #750 stages every one of
  them over what the validator *kept*, so there is nothing there to fix and
  nothing to report either. `defect` held a gate of its own from #636 to then —
  it took the whole corpus, reported what it found in refused text and withheld
  only the fix, because rewriting text no processor parses is how
  `select="child::"` became `select=""` — and the exclusion made that condition
  one no call could fail. A declarative fix never passes
  through `defect` — `src/linters/xpath-linter.js` attaches it from
  `src/fixers.js` — so
  it is gated there instead, against the same `expressionsOf` derivation: no fix
  is offered on an attribute whose expression the grammar refuses, nor on the
  element carrying it, since a fixer names the attribute it wants inside itself
  where no gate can see it (#651). That gate stays, because a declarative
  selector reads the document rather than the expressions the validator kept, and
  so can still match an attribute holding text nobody parses. Withholding every
  fix on such an element is
  deliberate over-reach: an element holding an expression no processor parses is
  not worth tidying. What "refuses" means moved underneath every gate at
  #732 without any of them changing: `isValid` — in `src/syntax.js` since #577,
  where the parse it reads is kept — asks `src/grammar.js` at the
  version in force rather than fontoxpath at 3.1, so a `cast as` in a
  `version="1.0"` sheet now withholds the fix it used to be offered. A *safe* fix
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

One line each, and the note behind it in the `CLAUDE.md` of that file's own
directory, or of the nearest one above it. A path here answers to the tree from
both sides: every one of them exists, and every module under `src/` is named by
one of them.

| File | Role |
| --- | --- |
| `src/index.mjs` | CLI entry (commander.js, ESM); imports the pipeline inside the command action, so `--help` loads none of it |
| `src/xslint.js` | Discovery, config, staging, output; exports the pure `lint` (package `main`), `fixed`, and the `STAGES` the speed gate times |
| `src/config.js` | Resolves `.xslint.yml` (severities/`off`, excludes, `max-warnings`) |
| `src/directives.js` | Parses inline `xslint-disable-*` comment directives |
| `src/reporters.js` | `reporterOf(format)` — `text`, `json`, `sarif`, or `github` output |
| `src/validators/xsl-validator.js` | Builds the corpus; reports each non-well-formed stylesheet |
| `src/validators/xpath-validator.js` | Splits the corpus's expressions into valid (kept, and the whole of what the expression linters are staged over) and malformed (reported) |
| `src/linters/xpath-linter.js` | Loads `checks/xpath/*.yaml`, the per-file declarative kind; the dearest stage there is |
| `src/linters/parameter-linter.js` | `unused-function-template-parameter`, over the walk rather than a substring |
| `src/linters/element-linter.js` | `not-creating-element-correctly` |
| `src/linters/root-template-linter.js` | `template-writes-nothing`, over every template, and `output-method-xml`, which still asks which one is the root |
| `src/linters/output-linter.js` | `not-using-output`, asked of the import tree rather than the file, an `xsl:output` merging into whatever imports it |
| `src/linters/corpus-linter.js` | Loads `checks/corpus/*.yaml`, the cross-file declarative kind |
| `src/linters/bare-name-linter.js` | `confusing-variable-and-node` |
| `src/linters/*-linter.js` | Code-based `checks/format/*.yaml`, one construct each (axis, namespace, count, name, ...); see the flow diagram |
| `src/checks.js` | Shared for code-based linters: `metaOf`, `suppressed`, `defect`, `rawly` |
| `src/source.js` | Raw-text walking shared by `checks` and `fixer`: `offsetAt`, `placeAt`, `character`, `skip` |
| `src/selectors.js` | `splitOf` — a declarative selector parted into the names a shared walk can serve as its axis and the tail the engine must answer; `chosen`, `valued` |
| `src/predicates.js` | `predicateOf` — what one predicate of a served selector answers of a candidate, off the walk rather than the engine, or nothing where the engine must answer it |
| `src/attributes.js` | `expressionsOf` — every expression a stylesheet carries; `PATTERNS`, and `whole` for a linter that narrows to one attribute |
| `src/xsl-version.js` | `versionOf` and `since` — the version in force at a node, and a lower-bound gate over it |
| `src/tree.js` | One pass over a document, remembered against it: `walked`, `named`, `attributed`, `holding` |
| `src/comparisons.js` | `comparedToZero` — the shared scan for a call compared with `0`/`1` (count, string-length) |
| `src/booleans.js` | `coerced` and `unwrapped` — where nothing but an effective boolean value is taken, and what may stand there instead |
| `src/expressions.js` | `enclosed` — the expressions an attribute value template holds in its braces |
| `src/tokens.js` | Positioned XPath lexer (`tokenized`, `TOKENS`), preserving whitespace; owns `GAP`, `TRIVIA`, `OPAQUE`, `NAMED` |
| `src/grammar.js` | `parsed` and `matched` — the XPath 3.1 expression grammar and the pattern grammar, as recursive descent, at the version in force |
| `src/syntax.js` | The one door between a record and its parse: `parseOf`, `isValid`, `gathered`, `textOf`, `calls`, `filters` |
| `src/import-graph.js` | Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf` |
| `src/fixers.js` | Maps a declarative check name to a `node => fix` builder |
| `src/fixes.js` | Shared fix builders reading the raw source: `deletion`, `substitution`, `excision`, `standsAt` |
| `src/fixer.js` | Applies a defect's `fix` to source (decode-walk, verify-before-apply, end-to-start) |
| `src/xpath.js` | The fontoxpath environment, and only that: `PREFIXES`, the two evaluators, `satisfies`, `compiles` |
| `src/helpers.js` | XML parsing (expands internal-subset entities), YAML parsing, file recursion |
| `src/resources/checks.json` | Every check as a run reads it, built from the YAML; never edited by hand |
| `src/logger.js` | 4-level logger |
| `src/output.js` | `colorful(stream)`, the one gate on coloring, and the leveled prefixed `writer` both streams are written through |
| `src/version.js` | `what` and `when`, rewritten by the `.rultor.yml` release pipeline |
| `scripts/generate-docs.js` | Builds the `docs/` site from checks + motives |
| `scripts/generate-checks.js` | Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`) |
| `scripts/budget.js` | Judges what a corpus cost the nightly tier against its budget, from both sides |
| `test/conformance.test.js` | Enforces naming, motives, selector hygiene, the `mature` freeze, the suite's own shape, and the length a guide states of the file the line cap is lifted off |
| `test/guides.js` | The guides as data: the chain a turn loads on its way to one file, what that chain may cost, and how a claim standing in one is read |
| `test/guides.test.js` | The guides themselves: a bar on what a chain of them costs a turn, the index held to the tree from both sides, and the counts a guide states of a list in the code |
| `test/grammar-corpus.test.js` | Round trip and acceptance diff over every expression the repository carries |
| `test/grammar-shapes.test.js` | The same acceptance diff over 14112 expressions nobody wrote |
| `test/strictness.js` | `insists` — whether fontoxpath refuses an expression over its own strictness rather than over anything malformed in it |
| `test/helpers.js` | The only door to a child process in the suite: `runXslint`, `xslintStatus`, `xslintStreams`, `xslintUnread`, `xcopped`, `walkedWith` |
| `test/predicates.test.js` | The vocabulary held from both sides: every spelling it answers, and every one it refuses beside what puts that out of reach |
| `test/packs.js` | The one harness every pack directory is read through |
| `test/scaling.test.js` | The speed gate: every stage's own processor time as a share of the run, at two corpus sizes |
| `test/xcop.deep.test.js` | Writes every pack's inline XSL to one directory and runs xcop over it |
| `test/workflows.test.js` | Every job granted the scope its own steps write with, and left the scope they read with |
| `test/manifest.test.js` | What `package.json` declares, held to what a grunt wrapper runs and what this repository's own JavaScript imports |
