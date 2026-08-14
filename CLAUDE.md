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
green — run `npm run coverage` and the xcop suite too. Two more run on a
schedule rather than on a pull request: `daily`, which is `npm test` across
three platforms and two node versions, and `corpora`, which times a real run
(see **Speed**).

The suite comes in two halves, and the line between them is a child process. A
**deep** test starts one — it runs `xslint` or `xcop` the way a user does — and
is named `*.deep.test.js`; every other test stays in this process. Four files
are deep, and they still cost most of what the suite costs: 534 of the 2177
tests, 9 of the 14 seconds. The other 1643 finish inside one, which is why
`npm run fast` is the loop to work in and `npm test` the one to finish on. The
deep target runs under `mocha --parallel`, so those four files run at once and
the slowest of them sets the clock — `xslint.deep.test.js` alone, whose 50 tests
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

## Speed

Speed is machine-enforced like every other convention here, and it was the one
that was not: the cross-file linter went quadratic and reached master with
eighteen jobs green, at 52% to 72% of the whole run over the three corpora the
README advertises (#755, #756). Two tiers hold it now.

`test/scaling.test.js` is the per-pull-request one. It builds a corpus in
memory, hands it to every stage at 40 stylesheets and again at 160, and asks two
questions of each: what it **costs** beside the middle stage of the same run,
and how it **grew** beside that stage's growth. Both are quotients taken inside
one process, which is what cancels the machine — an absolute threshold on a
shared runner either flakes or is set so loose it catches nothing. Each stage is
timed **directly** rather than by subtracting one run from another, since the
error of two timings compounds: a stage whose own reading holds to three percent
reads twenty measured that way. It spawns nothing and writes nothing, so it
belongs in the fast half, where it costs 3.3 seconds — and costs it every run
rather than on average, one measurement being discarded and none retried.

The cost is the assertion the gate stands on, and growth is the looser check
beside it, which is the opposite of how it was first written. The reason is
that #755, the regression this tier exists for, was a **constant and not a
shape**: it left the cross-file linter's exponent where it was — 1.46 against
1.57 over this corpus — and doubled what it spent at every size. So the two
growth distributions overlap, the fix reading 1.85 to 2.04 and the quadratic
1.66 to 2.43 — and since the lowest reading is the one judged, growth does not
merely fail to separate them, at 1.66 against 1.85 it ranks them backwards —
while the costs have nothing between them, 9.6 to 10.4 against 16.7 to 17.1.
Reverting `src/linters/corpus-linter.js` to its pre-#755 state fails the gate
three times out of three at 16.2 to 17.4, against the 13 that `SHARES` allows
it, and master passes ten times of ten idle and six of six under load. A bar
enough to have caught that would have to separate 2.31 from 1.93, which is
inside the noise of any machine.

What is timed is **processor time and not the wall clock**, `process.cpuUsage`
rather than `process.hrtime`. The wall charges a stage for every slice the
scheduler hands to something else, so the gate it produced was unusable on a
busy machine: under sixteen processes competing for ten cores it failed seven
runs of eight, naming stages nothing had touched at 2.36 and 2.97 times the
middle — indistinguishable, to whoever reads the build, from the one true
failure — and reading `corpus-linter` itself at 0.78, which is its bar's *other*
side and would have announced #755 as settled. Retrying does not help, because
contention lasts longer than a run and inflates the same stage in every attempt.
Processor time is what the stage itself spent, so the same sixteen processes
move it by a tenth, every entry staying within that of its idle reading, and the
gate passes every run under the load that broke the wall clock.

What processor time costs is resolution, and one platform pays it. Windows
charges in ticks far coarser than a cheap stage costs over the *small* corpus,
so eight of the fourteen measure `0` there and their growth arrives `Infinity`
or `NaN`. A growth that is not a finite number is therefore no reading and is
dropped rather than judged — verified by quantising the clock to 6 ms here,
which turns 2 to 4 growths of 18 non-finite and leaves the gate passing. The
share is unaffected, being taken over the corpus four times larger: that runner
reads `corpus-linter` at 9.30 where this machine reads 9.28 to 10.13. So a
coarse clock costs the looser of the two questions on one platform, not the
gate.

It stands down in one process and says so: `npm run coverage` runs mocha under
c8, and V8's branch bookkeeping does not fall evenly across the stages — it
charges `xpath-linter`, the one putting every declarative check through
fontoxpath, 53 to 56 times the middle stage where an uninstrumented run charges
it 30. A ceiling wide enough for both would say nothing true about either, so
the measurement skips itself when `NODE_V8_COVERAGE` is set (in the body, with
`this.skip()`, never by registering behind a condition) and the coverage run
reports it pending. Nothing is lost either way: every branch it reaches is
reached by the suite around it, so the 100% gate still holds without it — a
count is deliberately not quoted here, since one goes stale on the next commit
that adds a branch — and the gate itself still runs in `npm test`,
`npm run fast`, and the `build` job across six runners.

Three things more make it a gate rather than a source of red builds. It takes a
whole measurement first and throws it away, on the one principle a warm-up has:
warm the code with the work about to be timed. A warm-up over ten stylesheets is
not that, and it showed — the two validators stayed cold enough that the first
attempt read them nearly twice what they cost, `xsl-validator` 3.96 to 4.38
against a ceiling of 4 where the second attempt read 2.02 to 2.25, and
`xpath-validator` 6.36 to 6.92 against 3.25 to 3.52. A bias is not noise, so the
retry could not answer it and was nevertheless answering it on nearly every
standalone `npx mocha test/scaling.test.js`: a gate leaning on the mechanism
meant for something else, and one failing about a third of those runs. Forty
stylesheets only shrink it, to 3.2 and 5.1. A discarded measurement removes it —
every stage within five percent over six processes, no attempt ever retried —
and costs nothing, being the retry no longer spent. A disagreeing measurement is
still taken again, up to three times, over a corpus of its own, and the *lowest*
reading answers: noise inflates, so the floor of three attempts is the honest
one. And the stages are read from `STAGES`, derived in `src/xslint.js`
from the two linter lists, so a linter cannot be wired into the pipeline and
left outside what measures it — one test asserts exactly that over the
`src/linters/` directory, and another that no name in `SHARES` has stopped being
a stage.

`SHARES` names the four stages that legitimately cost more than the rest:
`xpath-linter` at 55, `corpus-linter` at 13, `xpath-validator` at 9,
`xsl-validator` at 4. Every other stage answers to one bar, `SHARE` at 2.5,
which the fourteen of them sit far below at 0.13 to 1.27 — so a cheap stage that
becomes an expensive one turns red, and earns either a fix or an entry. Two
things set a ceiling. Where there is a defect to catch it goes **between the two
measured distributions**: `corpus-linter` at 13 is a quarter above what the fix
costs and a quarter below what the quadratic costs, which is what fails it three
times of three at 16.2 to 17.4. Everywhere else it stands about **twice** the
local reading, on CI evidence rather than caution — a share cancels a machine's
speed but not its character, and a first spelling four tenths above the local
readings was refused by a macOS runner charging `xsl-validator` 1.21 of the
middle where this machine charges 2.2 and `xpath-validator` 6.13 where it charges
3.8. Those two came off a run since found to have a biased warm-up, so what they
prove is that headroom is needed, not how much. The table is a
ratchet rather than a licence, the `SPRAWLING` pattern one property over, and it
turns red from both sides: past the ceiling, or so far under it that `SLACK`
(four, for the same runner's sake) says the ceiling has stopped being a bar and
wants retightening. Growth is asked only
of the stages with no entry, since an entry pins what a stage costs outright,
which is the stronger statement; those fourteen read 0.29 to 1.58 idle and
loaded together, against a `GROWTH` bar of 3.0 and the 4.0 a stage that had gone
quadratic would read.

Two earlier spellings are recorded so nobody spends the week again. Absolute
growth bars were tuned until nothing flaked here, then failed on all six CI
runners at once, `corpus-linter` reading 8.7 on macOS where it read 7.1 here.
Growth as a multiple of the median passed all six — and could neither separate
the defect it was written for nor survive a loaded runner, which is both halves
of this design's reason for being.

What a gate measured at one size cannot see is a quadratic whose constant is
still small there. `circular-import` walks the whole import graph once per edge
and so costs the square of a chain of imports, confirmed at 2.48, 3.39, 3.53 and
3.99 per doubling from 100 stylesheets to 1600 — and reads a flat 1.0 to 1.6 at
forty, where the per-edge cost dominates (#769). That is what the second tier is
for. `corpora.yml` runs nightly, cloning DocBook-XSL, TEI and DITA-OT **at
pinned commits** — a branch tip would drift under the numbers — restoring them
through `actions/cache`, writing what it found to the job summary, and failing
past a per-corpus budget so `jayqi/failed-build-issue-action` opens an issue the
way `daily.yml` does. Vendoring those corpora instead is a trap: each carries
its own licence, and `reuse`, `copyrights` and `xcop` would all have to be told
to look away.

That tier asserts **what it read** and not only how long it took, because a
budget alone is blind to the failure it most wants to catch. It timed
`xslint … --quiet || true` at first, so a run that linted nothing passed: point
it at a path that does not exist and the exit code is *zero*, no code
distinguishing "found defects" from "died", and the whole of #758 — a walk that
crashes before a byte of XSL is read — would have stayed green under it. So the
step drops `--quiet`, keeps stderr, and compares the stylesheets `find` sees on
disk against the count the run reports having processed, which are the same
number or the run did not do its job. Past that it fails on an exit code above
1, since neither a clean run nor defects found can produce one, and then on the
budget.

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

A file stops at 1000 lines, counting the blank ones and the comments, since a
reader scrolls past those as well. One file stands above it and is named in
`SPRAWLING` in the config — `src/grammar.js`, 1828 lines of one function per
production of XPath 3.1 — rather than carrying a disable comment of its own, so
what is exempted is one list a reviewer reads in the place the cap is set, not a
mark to be found by opening every file. Neither half can rot in silence.
`conformance.test.js` asks the rule itself whether each name on that list is
still reported, so a file that shrinks back under the cap, or is renamed, or is
deleted, turns its own exemption red instead of quietly un-capping whatever
takes the name next; and it fails when *nothing* in the config caps a file at
all, because a rule deleted takes its enforcement with it and leaves the
exemption list reading like a limit that is still in force.

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
`needle` inside a `usages` scan in `src/linters/corpus-linter.js`. A
declaration's reference string is the declaration's, so building it per
(declaration, usage) pair built it 247 million times over DocBook-XSL and made
that `replaceAll` the hottest frame in the whole process, ahead of every
fontoxpath one. The ordering rule beside it is the same thought and is
structural rather than linted, because `mentioning` is the only way to reach the
usages at all: ask the *selective* question first. `within` climbs to the
document root for every pair it rejects and one `includes` rejects almost every
pair, so a tree walk placed in front of a substring test pays a full walk to
learn what the substring says (#755).

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
      namespace, result-namespace, imports, parameter — the DOM, not one
                                 expression
    src/linters/, expression — (expressions, suppressions) => defects:
      *-linter.js                code-based checks/format/*.yaml (one construct each)
```

What crosses that last edge is what the validator kept: the `expressionsOf`
records themselves, not the attributes they hang off, so the expression stage
reads the derivation rather than rebuilding one from a node (#589). A pattern and
a brace's expression reach it too, which is why `redundant-whitespace` now
collapses the leading gap of a `match=" //spaced"`.

Eleven linters cross it, not one. Ten of them scanned the whole corpus and asked
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
  joins onto one line. And `test/resources/scaling/**` for the first reason
  again: the one stylesheet the speed gate copies must declare namespaces
  nothing uses, or `namespace-linter` has no defect to build and the stage is
  measured on a path it never takes. Every other line of it conforms — the root
  element is the whole of what xcop objects to.
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

| File | Role |
| --- | --- |
| `src/xslint.js` | Orchestrates discovery, config, staging, output; exports the pure `lint` (package `main`), `fixed`, and `STAGES` — every linter the pipeline runs, named by its module and paired with what it is handed, derived from `LINTERS`/`EXPRESSION_LINTERS` rather than written out beside them so the speed gate cannot be measuring a list the run has moved on from |
| `src/config.js` | Resolves `.xslint.yml` (severities/`off`, excludes, `max-warnings`) |
| `src/directives.js` | Parses inline `xslint-disable-*` comment directives |
| `src/reporters.js` | `reporterOf(format)` — `text`, `json`, `sarif`, or `github` output |
| `src/validators/xsl-validator.js` | Builds the corpus; reports each non-well-formed stylesheet |
| `src/validators/xpath-validator.js` | Splits the corpus's expressions into valid (kept) and malformed (reported), asking `parseOf` about each record `expressionsOf` yields — the same derivation the code-based linters read, rather than a walk of its own over a list of attribute *names* got by subtracting the pattern-holding ones from `ATTRIBUTES`. That subtraction reached 286 of this repository's 453 expressions, so a `match` no grammar accepts, a `{1 +}` in an attribute value template, a 3.0 text value template and a shadow attribute were validated by nothing at all, while the code-based linters — staged over the whole corpus — read those same expressions and reported what they found in them, with only `defect`'s parse gate keeping a fix off it (#589). What it keeps is what all eleven expression linters are staged over since #750, so a refusal reported here is the only defect that fault draws. A pattern illegal before XSLT 3.0 comes with it, which is #631: `matched` has refused one since #723 and had nobody to say so. The defect goes through `defect` in `src/checks.js` rather than being built by hand, so it stands at the offset the refusal carries instead of at the attribute's opening quote — which the widening makes necessary rather than merely nicer, two braces of one attribute value being two expressions that would otherwise report one column |
| `src/linters/xpath-linter.js` | Loads `checks/xpath/*.yaml`; attaches any `src/fixers.js` fix, unless the node — or the element carrying it — holds an expression the grammar refuses (#651) |
| `src/linters/parameter-linter.js` | `unused-function-template-parameter`, the first check to leave `checks/xpath/` for code (#776). Its selector asked `not(some $x in ..//(node() \| @*) satisfies contains($x, concat('$', @name)))` — one descendant step per *parameter*, and fontoxpath evaluates one of those over an xmldom tree quadratically, which is #635's cost re-entered once per parameter and never reaching the walk `src/tree.js` remembers. So a template cost its parameter count times the square of its body: 3.54, 3.82 and 4.27 per doubling of the body at five parameters, 2.05 to 2.20 per doubling of the parameters against a 400-element body, 6.6 seconds for one template of 1600 elements. It was the single most expensive thing in a run, 2.82 s of DocBook-XSL's 11.0 s of per-file checking, and it is 0.08 s here — one walk per holder rather than one per parameter, which is `walked` filtered for the `@name` of an `xsl:param` whose parent takes one. What the substring could not ask is what a *reference* is, and the tree closes four blind spots the selector had: `$name` is not a use of `$n`, though it holds those characters; a `'$quoted'` is a string literal, which XPath evaluates to text; the output text of a literal result element is characters bound for the result tree; and a name inside an XML comment is a reference somebody switched off, which is the commonest of the four in real code — 15 of the 19 new defects over the three corpora, against 4 of the prefix class (`$row` silenced by `$rownum`, `$minimal` by `$minimalCrossRef`, `$force` by `$forcePageMaster`, `$prefix` by `$prefixTokens`), and nothing at all withdrawn. It is a *document* linter rather than an expression one for a reason worth keeping: it reports a **declaration**, an element no expression names, and a stylesheet holding no expression at all still declares parameters — staged over what the validator kept, such a file would contribute no record and its dead parameters would go unreported. So it reaches `expressionsOf` itself, and an expression the grammar refuses is the one place the substring survives: what such text references cannot be read, and staying quiet about a name whose characters stand in it beats inventing an unused parameter on a file the same run already reports for its syntax |
| `src/linters/corpus-linter.js` | Loads `checks/corpus/*.yaml`; cross-file rules. A cross-file check asks one question of every declaration against every usage, so both sides grow with the project and the work is their product; three things made that product far dearer than it is. A usage selector is now evaluated once for each corpus and xpath (`across`) rather than once for each check naming it — three of the four checks give `//@*`, and choosing every attribute of DocBook-XSL's 291 stylesheets costs 1.7 seconds, so the run spent five answering one question three times over. A reference string is built once for each declaration rather than once per pair, and the usages holding it are scanned once for each *distinct* reference (`mentioning`), DocBook-XSL declaring 3436 variables under 1207 names. And the cheap test now leads: `within` climbs to the document root for every pair it rejects, and it stood in front of the `includes` that rejects almost every pair, so a full ancestor walk was spent per pair to learn what a substring already said. Together those take the four checks from 35.0 to 10.2 seconds over that corpus with the report byte-identical, and the whole run from 40.2 to 29.8 (#755). What they do not take away is the product itself: the growth is still superlinear, 2.1x to 3.1x per doubling where master ran 3.4x to 3.9x, because the scan is still every distinct name against every usage. Retiring that wants an index — the names a usage value references, collected once and asked per declaration — which is #755's remainder and not landed |
| `src/linters/*-linter.js` | Code-based `checks/format/*.yaml`, one construct each (axis, namespace, count, name, ...); see the flow diagram. Seven of the eleven read the tree rather than the expression's text, which is what Phase 4 of #644 is moving all of them onto: `count-compared-to-zero` and `string-length-compared-to-zero` through `src/comparisons.js` (#577); `predicate-position-literal`, which walks the `predicate` nodes the grammar built rather than matching brackets and reducing what stands between them to one character per token (#575); and `redundant-boolean-call` and `redundant-double-negation` through `src/booleans.js`, which answers where a truth is all that is taken (#561, #596); and `name-compared-to-string` and `translate-for-case`, which read what a literal *holds* rather than how it is quoted (#598, #562). Those two are one blind spot twice over: a regular expression naming `'([^']*)'` cannot see `"x"`, and an attribute value already standing in double quotes is written the other way round, so half the spellings of each construct went unreported. The tree closes four more gaps their tickets do not name — the value comparison, blind on `name() eq 'x'` as #763 was blind on `count(x) eq 0`; the prefixed and inline spellings of both standard calls, where `[^\w:.-]` refused `fn:name()` outright and read `Q{urn:mine}translate(...)` as the bare call; a binding clause inside one argument, whose depth-zero commas made a three-argument `translate` read as four; and a name no ASCII class spells, `qualified` in `src/tokens.js` answering that where a `NAME` regular expression of the linter's own refused `name() = 'é'` a `self::é` step says perfectly well. The two of those are one pair rather than two migrations: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`, so migrating one alone would have `--fix` write the very defect the other reports next. What a text scan cannot answer for either is what a place *is* — `not(boolean(@x))` is a question about the node above, and a prefixed `fn:not(fn:not(@x))` one about a namespace — and the overlap of a run of them: a scan matching the character in front of a call consumed it, so `not(not(not(not(@deep))))` drew two defects rather than three. Three things follow from `predicate-position-literal`'s own migration, and are about a predicate rather than about a truth. A predicate is judged by what its one child *is*, so `[position() = 1 and @on]` holds a comparison and is not one — an `and` is what the predicate holds, and rewriting the comparison inside it would turn a positional test into the boolean `[1 and @on]`. The operand that survives keeps the spelling its author gave it, so a `fn:last()` stays prefixed, where a signature reading `TOKENS.NAME` alone never saw a prefixed call and left the predicate unreported. And the defect stands where its comparison does rather than just inside the `[`, so a padded `[ position() = 1 ]` is reported at the `p` and the fix replaces the comparison alone, leaving the author's gaps where they were |
| `src/checks.js` | Shared for code-based linters: `metaOf`, `suppressed`, `defect(check, meta, source, found, offset, fix)` — takes the expression whole, as `expressionsOf` yields it, and adds its `start` to the offset itself (#648); walks the raw text so a wrapped or entity-shifted value reports where it truly stands (#611). It asks nothing about whether the expression parses: that gate stood here from #636 until #750 staged every code-based linter over the expressions the validator kept, which left it a condition no call could fail — a rule every caller has to remember is worse than a stage that cannot break it. That walk is `rawly(source, found, offset)`, exported beside it, because a linter needs the raw offset as much as a defect does: an attribute value arrives with its line endings normalised to spaces, so a check reasoning about whitespace cannot see a wrap in the value it holds and has to ask the source (#628) |
| `src/source.js` | Raw-text walking shared by `checks` and `fixer`: `offsetAt`, `placeAt`, `character`, `skip` |
| `src/attributes.js` | `expressionsOf(xsl)` — every expression a stylesheet carries: a bare/AVT attribute, a 3.0 text value template, or a shadow attribute, each saying whether it is a `pattern`; `PATTERNS` names the five attributes that hold one; and `whole(found, name)` for a linter that narrows to one attribute out of the records it is handed. That helper replaced `selectorOf`, an XPath of this module's own over every XSLT element's attribute of a name, and `wholeOf`, which built a record from the node it selected — both of them the shape a linter needed while it scanned the corpus itself (#750). It asks two things in one call because a linter taking the name alone would read the `test="{boolean(x)}"` of a literal result element, which the old selector's namespace test excluded: an attribute's whole value is a record starting at `0`, and a template's expression never does, a brace standing at least one character in |
| `src/xsl-version.js` | `versionOf(node)` — the version in force at a node, from the nearest ancestor's `@version` (XSLT element) or `@xsl:version` (literal result element), canonicalised as a decimal, walking up from the element `src/tree.js`'s `holding` answers; `since(version, floor)` for a lower-bound gate; shared `MODERN`/`KNOWN`/`DECIMAL` |
| `src/tree.js` | `walked(xsl)` — every attribute, text node and CDATA section of a document in document order, walked once and remembered against it, because fontoxpath evaluates a descendant step over an xmldom tree quadratically (#635). Beside it `holding(node)` answers which element a node hangs off — an attribute the element carrying it, a text node its parent, a document its root — which is where anything a stylesheet's *structure* says about a node is read: the version in force there, and the namespace a prefix inside an expression resolves to. It lived in `src/xsl-version.js` while the version was the only such question; the second one is #577's, and xmldom's own `lookupNamespaceURI` answers null on an attribute rather than walking to its element, so both callers need the same answer rather than each reaching for an element its own way |
| `src/comparisons.js` | `comparedToZero(found, name, decide)` — the shared scan for a call compared with `0`/`1` (count, string-length), and the first check to read the tree rather than the text, which is Phase 4 of #644 opening. It walks the nodes `VALUED` names, which `src/syntax.js` hands over — two kinds and one question, where gathering the general comparison alone reported nothing at all on `count(x) eq 0` or `string-length(@x) eq 0` and so on the idiom half of any 2.0 stylesheet is written in, the scan underneath having matched `(!=\|<=\|>=\|=\|<\|>)` and no word at all (#763) — and asks three questions the regular expressions underneath it could only approximate. **What the operands are**: a digit compares against the call when it *is* the whole operand, which a tree says outright and a scan had to bound by hand — `$max + 1 > count(x)` was reported until #573 spelled the arithmetic out, and `count(x) > 0 + $n` with it. **What the call is**: the standard function of that name, told from a user function of the same local name by the URI the prefix resolves to rather than by the prefix, which a character class cannot do at all — `[^\w:.-]` refused every prefixed spelling and so missed the `fn:count` of any 2.0 stylesheet, while an inline `Q{urn:mine}count` walked straight through it, the `}` in front of the name being no letter (#577). **What the arguments are**: the nodes the parse separated, so a comma binding a `for` clause is no separator — `count(for $va in a, $vb in b return $va) = 0` is reported and fixed again, the gap `count-with-a-binding-clause` pins — `BINDINGS` in `test/expressions.test.js` pinned it while a check still counted commas, and went with `lone` at #596 — and a gap around one is no operator, `string-length( @x )` carrying the same lone operand the tight spelling does where a space read as a binary operator withheld the rewrite from it (#578). Three regular expressions and the `masked` blanking went with the text: a call standing inside a string literal is invisible because a literal is one node, not because anything blanked it |
| `src/booleans.js` | `coerced(found)` — every node of the record's tree standing where nothing but its effective boolean value is taken, each paired with whether an expression that binds loosely may stand there as it is; and `unwrapped`, the text that may replace such a node once only its argument's value carries over. The question `redundant-boolean-call` and `redundant-double-negation` share, and the reason they moved together: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`, so migrating one alone would have `--fix` write the defect the other reports next (#561, #596). The places it names are XSLT's own two, a whole `@test` and a whole `use-when` — SaxonJ-HE 12.5 includes a template whose `use-when` wraps its test in `boolean(...)` exactly as it includes the bare spelling, and excludes both `""` and `boolean("")` — and inside the expression XPath's: an operand of `and` or `or`, the argument of `fn:not` or `fn:boolean`, the condition of an `if`, the body of a `satisfies`. Neither attribute is version-gated, since below 2.0 a `use-when` is not XSLT's attribute at all and such a stylesheet is broken for a reason of its own; the `xsl:use-when` a literal result element spells instead is out of reach of every code-based check and of the validator too, `expressionsOf` yielding no record for an XPath attribute outside the XSLT namespace, which is #654 rather than this list. A bracket of the author's own inherits whichever of them it stands in, which is why the answer is walked from the root down rather than climbed to from a node: a span is a range of token indexes and the tree carries no parent. A predicate is deliberately not one, though it coerces: XPath reads a numeric predicate as a test on the context position, and SaxonJ-HE 12.5 answers `item[boolean(count(e))]` with both items of a two-item document where `item[count(e)]` answers the first alone, so what the wrapper hides there is the difference between a truth and a number. Nor is an operand of a comparison, which compares the values themselves. Only an `and`/`or` operand needs brackets round what arrives, everything else on the list standing inside brackets already or with nothing behind it, and `tight` answers that off `LOOSE` — one rung tighter than the operator it is asked about, so a comparison carried into an operand is bracketed where it need not be. That is one ladder borrowed rather than a second one kept in step with the grammar, and brackets nobody needs are noise where a missing pair is a rewrite that means something else |
| `src/expressions.js` | `masked`/`closes` lexer helpers (node-set alone now); `enclosed` — the expressions an AVT holds in its braces. `masked` blanks every kind `OPAQUE` names, so a construct standing inside a string, a comment, or a literal that never closes is invisible to the one linter scanning above it — six until #577 took `comparedToZero` onto the tree, five until #575 took the predicate scan there, three after #596 and #561 took the two negation checks, and one since #598 and #562 took the name and translate scans, where a literal is one node and nothing needs blanking to be read over. What is left is `use-node-set-extension`, whose own migration is #557 and takes the module with it. `lone` went with that last pair, the only readers it had left: it answered whether exactly one argument stood between a call's brackets by counting the commas at depth zero, which a parse answers by separating the arguments. Two things it could not do went with it. A binding clause puts its commas at depth zero inside *one* argument, so `not(not(for $va in a, $vb in b return $va))` went unreported — the gap `BINDINGS` pinned in `test/expressions.test.js` until the checks reading it came onto the tree, and a pack of each pins the construct now, the way `count-with-a-binding-clause` has since #577. And a bracket holding only a literal is not an empty bracket, which the masking hid: `count('abc')` blanked to a gap, so no emptiness test could tell an absent argument from a blanked one and the three checks fell silent on `count('abc') = 0`, `boolean('abc')` and `not(not('abc'))`. Arity stays a question each check asks by name — `fn:count`, `fn:not` and `fn:boolean` take exactly one argument in every version and `fn:string-length` none or one — and `children.length` over the parse is what answers it, where `count()` was reported as a count of a node-set and `not(not())` as a double negation, both carrying a **safe**-tier fix that plain `--fix` applied, so `test=""` was written and the next run reported the `invalid-xpath-expression` the last one had manufactured (#576). The parse gate in `defect` could not have supplied that: it withheld a fix only where the engine refused the expression, and fontoxpath's `compileXPathToJavaScript` resolves no signature, so every one of those calls is valid text to it. Nor can the engine be asked one call further — `evaluateXPath` does raise `XPST0017` statically, but against a registry that is not the XSLT one: 26 of 28 XSLT 3.0 functions and 14 of 29 XPath 3.1 ones are absent from it, `current()`, `key()` and `document()` among them, so a check reading that verdict would report the commonest calls in a 1.0 stylesheet as errors |
| `src/tokens.js` | Positioned XPath lexer (`tokenized`, `TOKENS`), preserving whitespace. A name is lexed whole and greedily as `TOKENS.NAME`, so the operator letters inside one stay part of it — `border` is one token, not `b`/`or`/`der` (#617, #249) — and a word is an operator only where the grammar lets one stand, which `operates` decides from the last token rather than from the spelling: the `or` of `a/or` is a node test, the `or` of `a or b` is not. `WORDS` and `SYMBOLS` are derived as complements of each other from the same operator maps. Every piece of punctuation carries a kind of its own too — `/`, `//`, `@`, `$`, `,`, `.`, `..`, a `::` no axis name claimed, and the operators XPath 3.1 added (`=>`, `:=`, `!`, `#`, `?`, and the braces and `:` of a map constructor) — so `TOKENS.OTHER` holds only what XPath has no token for at all, rather than the undivided run that lexed `a/@b` as one `other` and left nothing a recursive-descent grammar could be written against (#676, #685). The arrow was the sharper of the two, and the distinction is worth keeping: a *missing* kind lands in `OTHER`, where a reader knows it has met something it cannot name, but `=>` was absent from `DOUBLE` where `>=` already sat and so lexed as `=` then `>` — a stream read wrongly rather than not at all, `a => f()` arriving spelled exactly like `a = (> f())`. The node comparisons were that same absence one more time: `<<` and `>>` were missing from `DOUBLE` where `<=` and `>=` already sat, so `$a << $b` arrived as two `<` in a row, and `is` was missing from the word half beside `eq` and `or` (#724). One entry each is the whole of the lexer's share, since `WORDS` and `SYMBOLS` are derived from that map — `is` is an operator only where `operates` admits one, so the `is` of `foo/is` stays the node test it is, and `island` stays one name. Every entry is one word now: `instance of` is two with a gap between them, which a name scan cannot reach past, so the lexer carried a branch of its own to match it and every name it read had to ask whether a longer spelling stood there. The grammar reads that one by value instead, `instance` then `of`, exactly as it has always read `cast as`, `castable as` and `treat as` — which took `opensMore`, the `spelled` branch and the `INSTANCE_OF` kind out with it, and let `xs:integer? instance of x` be the expression every processor reads it as (#742). The word→kind lookup that is left is `worded`, exported for the grammar rather than spelled twice. A braced URI literal is one token too, for a different reason than an operator is: `Q{uri}local` is how XPath 3.0 writes a name's namespace inline, and `BracedURILiteral` is a *terminal* of the grammar, so the whole of `Q{…}` is lexed here rather than assembled above out of a name and two braces — which is what it arrived as, six tokens of which one was the `{` a map constructor opens with, so a production written against either had to reach inside the other's. A malformed one is not a kind of literal: the content is every character up to the closing brace with a brace itself excluded, so `Q{a{b}c` and one that never closes lex on as the `Q` and the brace they always were, and the grammar refuses what those tokens make rather than a new kind having to say so (#708). A literal that never closes is `TOKENS.UNCLOSED` and not a `STRING`, for that same reason: `'unclosed` came back as a finished literal, so the lexer supplied the quote its author never wrote and the grammar accepted an expression no processor parses (#708). A comment that never closes is `UNCLOSED` too, and it took one ticket longer to say so, in the function directly beside it: `afterComment` answered an offset alone and the caller kinded every run a finished comment, so `a (: b` came back as a step and a comment — and a comment is *trivia*, so the grammar read over the whole tail and had nothing left to object to, while the six scanners reading tokens saw nothing after the `(:` either. One mistyped `:)` and a file linted clean, `a (: note \| child::b` drawing neither the `invalid-xpath-expression` it earns nor the `unabbreviated-axis` that `a \| child::b` draws (#752). Both answer `{at, closed}` now, and an unfinished run of either kind is one `UNCLOSED`: opaque to every scan that must read over it, and outside `TRIVIA`, so the grammar meets a token it cannot name and refuses at the offset the quote or the `(:` stands at. Nothing follows such a token, either kind of unfinished run reaching the end of the input by construction, which is why the last-solid-token questions below are unaffected by its arriving solid. Which kinds carry no meaning to a grammar and every meaning to the source is `TRIVIA` — a gap and a comment — and it is one list for exactly the reason below, having been spelled four times over: as `TRIVIA` in `src/grammar.js`, as a `&&` chain inside `tokenized` deciding the last solid token, as a `filter` in `src/linters/predicate-position-linter.js`, and once more in `lone`. Its own `no-restricted-syntax` selector refuses a second copy, and it found that fourth one. Two readers are left, in `src/grammar.js` and in `src/syntax.js`'s `parting`: that linter reads no token at all since #575 took it onto the tree, where trivia is the grammar's business and a predicate arrives already knowing what it holds, and `lone` was deleted with the last two checks counting a call's arguments by hand (#596, #561). Which kinds a scan must read *over* rather than into is `OPAQUE` — string, unclosed and comment together — and it is one list because the two readers of that question, `masked` in `src/expressions.js` and `inside` in `src/linters/xpath-format-linter.js`, each spelled it out and so a kind added to one was a kind missing from the other: it was, and `redundant-double-negation` and `count-compared-to-zero` reported inside `select="'not(not(x))"`, on text nobody evaluates. A `no-restricted-syntax` selector refuses a second copy anywhere in `src/` but `src/tokens.js` itself, which is exempted by filename rather than by naming every kind: an array or a `&&`/`\|\|` chain mentioning `TOKENS.STRING` beside `TOKENS.COMMENT` is the list spelled out again, whether or not it happens to be complete today. Both readers spelled it as a chain, not an array, so a selector reading `ArrayExpression` alone would have matched a shape this repository has never held and passed the two it did. Which kind each of the thirteen axes is lexed as is `AXIS_KINDS`, derived from the axis map and exported for `test/strictness.js`, which reads a spaced separator off it rather than writing the thirteen down again. Which of them ends a value is `ENDS`, so `operates` reads kinds alone: `.`, `..` and a constructor's `}` end one, and the `or` of `. or x` is therefore an operator. A colon runs a name on only where an NCName can start behind it, which is `joins`, and that one rule is every question the lexer had about a colon. It ends a name at a `::` with no clause of its own, a colon opening no NCName either: reading them as name characters is how `a::b` arrived as the single token `a::b` while `a ::b` arrived as three, one grammar read two ways by a gap, with the separator nowhere in the first for a parser to object to — six invalid expressions parsed as a plain step until it was fixed (#703). And it ends one at the `:` of a map entry for that same reason, a space and a digit opening no name, where taking every colon on sight swallowed the separator into the key in front of it: `map{a: 1}` came back with `a:` as one name and `map{a:1}` with the whole of `a:1`, so ten of fourteen key spellings were refused where fontoxpath and Saxon-HE 12.5 both accept them — the glued form every real map is written in, while the spaced `map{a : 1}` parsed all along (#746). A separator ends a name and settles what may follow it: the grammar admits a NodeTest there and nothing else, so a name behind one is the element it names however it is spelled, and `child::child::b` and `child:: child::b` arrive as one stream rather than two told apart by a space (#709). That question is about what precedes rather than about characters, so it is `operates`'s question and answered beside it: both are handed the last *solid* token, which `tokenized` carries forward as it pushes. Only one of the two cares whether a gap stood there, and the claim that neither did was wrong: XPath makes whitespace or a comment stand between two terminals that cannot delimit each other, so `1div 2` and `1eq 2` are syntax errors where `1 div 2` and `1(: c :)div 2` are not, and `operates` takes that as its second argument. `GLUES` names the near side of the pair — a number, and a name for completeness, since a word run against one is absorbed into it and `adiv` arrives as the single name it spells — and it is the *only* place a gap decides what an expression is made of rather than merely how it is written, which is why `separates` still reads the token alone (#742). Handed the token and not the list, because this one is asked of *every* token where `operates` is asked only of a word — deriving the last solid token by filtering the whole list each time turned the lexer quadratic in allocations, 3.4x on a 200-step expression, which is the shape #687 and #689 were each a ticket about. The character walk in `opensAxis` had been answering it by accident, asking `spelling` whether a name was in progress, which counts a `:` as a name character: the tight form walked back over the separator and got the right stream for the wrong reason, and the spaced form stopped at the gap and opened an axis. No verdict rode on it, since nothing accepts either spelling; the message did, and a parser handed two axis tokens said `expected a name, found "child::"` — naming a token the author never wrote as one. Also owns the one definition of a gap — `WHITESPACE`, the XML `S` a gap is spelled with, and `GAP`, the same four characters as a regular-expression class — plus `spelling`, which answers whether a name runs up to an offset, and `qualified`, which answers whether XML can spell one at all. Those two are different questions and the second was nobody's: a name was taken whole and greedily, so `my:25l`, `my:-x` and `my:a:b` each arrived as one `NAME` and read as an ordinary step, the grammar asking the lexer for a name and never how it is spelled — the one place we were the lenient side of the engine (#708). What is left for it to answer is the `USER_FUNCTION` kind, whose own scan takes an ASCII run in front of a bracket and weighs neither part as an NCName, so `my:25l(3)` still arrives whole; a bare `NAME` is a QName by construction since #746, and the `REFUSES` row spelling that call is what keeps the answer reachable at all. A QName is an NCName or two joined by one colon, and each part is weighed with `NAMED` less the colon that split it and `STARTS` for what it may open with, so the answer borrows the classes the lexer spells a name with rather than holding a second opinion about what a letter is. Those classes are what has to be right, then: `NAMED` was XML's `NameChar` less its three extenders — the middle dot and the two ties, `\p{M}` already covering the combining marks — so `a·b` was refused where the engine and both arbiters accept it, eight spellings in all (#731). They are name characters and nothing more, none of them able to open a name, which is `STARTS`'s answer and unchanged. Both parts must hold something: a prefix names nothing on its own, and `$my:` and `my:(1)` are refused by every engine. This answer let them through, permitting a trailing colon because the `my:` of `my:*` arrives spelled that way — the `*` being the wildcard's own token — so a permission a wildcard needed reached a variable and a call as well (#731). A wildcard is `tested`'s business and it takes the tokens of the prefixed spelling itself now, which leaves this answer nothing to make an exception for — and since #746 no name the lexer hands over ends in a colon at all, `my:*` arriving as the three tokens the grammar reads with the adjacency below. Every reader of a gap borrows one of them, and a `no-restricted-syntax` selector bans `\s` outright, because JavaScript's class also takes a no-break space and so reads a call in `boolean&#xA0;(a)` where no processor sees one (#643) |
| `src/grammar.js` | `parsed(xpath, version)` — the XPath 3.1 expression grammar as recursive descent over `tokenized`, one function per production. A node's span is a range of *token indexes*, never a pair of character offsets, so a position is carried from the lexer rather than computed from text, and the text of a node is the tokens of its span joined back together. The whole stream comes back with the tree, trivia and all, so joining it reproduces the expression as written — which is what keeps a fix a span replacement over raw source. The version in force is a parameter rather than a lookup, because the same text is a different language under a different one: `a to b` is a range in 2.0 and two steps around a name in 1.0, so modern syntax in a 1.0 stylesheet is a parse failure rather than an entry on a list somebody has to keep current (#652). The node comparisons are gated that way too: `is`, `<<` and `>>` stand beside the value and general comparisons and are refused below 2.0, the version that added them, so one selector of this project's own — the `$var << .` of `confusing-variable-and-node` — stopped being valid XPath our own parser refuses (#724). Beside them, and not below them: the three classes are one level of the ladder rather than three, because `ComparisonExpr` takes an operand from either side of one operator and admits no run of them (#726). Two levels of the ladder are spelled out rather than folded for that reason — the range between the sums and the comparisons, and the comparison between the concatenations and the `and` — since a `folded` run is left-associative and takes as many operands as it is offered. Three rungs let a comparison chain onto another, so `a = b eq c` and `a < b < c` parsed; over the 225 pairs fifteen comparison operators spell, the engine accepts none and the grammar accepted 144. The node comparisons would have taken that to 225, which is how the defect surfaced: the 81 pairs holding one were refused because the lexer did not know the operator, not because the grammar was right, and fixing the lexer took the accidental cover off. No committed expression chains comparisons, so the corpus gate cannot see any of it and four `REFUSES` rows pin it instead, one per class and one crossing two. A name with a bracket behind it is read off one table, `RESERVED`, which maps each name XPath has taken to the version that took it, what it was taken for, and the production that reads its brackets — a `test` (a kind test, standing where a node test stands), an `item` (an item type, standing in a sequence type and nowhere a node test does) or a `keyword` (`if`, and the `switch` and `typeswitch` this grammar has no production of). 1.0 takes the four node types alone, 2.0 adds its kind tests with `empty-sequence`, `if`, `item` and `typeswitch`, and 3.0 adds `array`, `function`, `map`, `namespace-node` and `switch`. `reserves` asks whether the version has taken the name at all, which is the whole of what a *call* needs to know, and `taken` asks whether it was taken for one of the kinds a particular production will accept. The brackets themselves were *counted* rather than read until #753 — `kinded` walked to the matching `)` and let anything at all stand inside — so `text(a)`, `node($v)`, `element(1)`, `element(a b)` and `element(a, xs:string*)` all parsed, in a pattern as much as in an expression, where every processor answers XPST0003 and since #739 that is a missing `invalid-xpath-expression` on a `match="text(a)"` no processor loads. Each name reads its own now, one production per shape XPath spells: `closes` for the six that take an empty bracket, `instructed` for a processing-instruction test, `elemented` and `attributed` for the two that name a node and optionally its type, `declared` for the two `schema-*` that require a declaration, `documented` for a document test's element-or-schema-element, and `paired`, `listed` and `returned` for the map, array and function tests. The count hid an *under*-acceptance too, which is the direction that invents a defect against working code: a function test's return type stands behind its closing bracket, `TypedFunctionTest` requiring an `as` where `AnyFunctionTest` refuses one, so the walk swallowed the arguments and `$v instance of function() as xs:integer` was refused for text left over at the end. Which production reads which name is the table's third field rather than a `switch` beside it, which is why the table sits below those productions instead of among the version tables it began in: a name taken for a test or an item type cannot lack the production that reads it, and a keyword has no such field. The arbitration is worth recording because a single engine could not have settled it — fontoxpath refuses `element(a, xs:string?)`, which Saxon-HE 12.5 accepts and the specification spells, and it accepts a nillable `attribute(a, xs:string?)`, which Saxon refuses with XPST0003 and the specification has no production for. Reading the arbiter's *code* rather than its exit status is what tells the two apart from the eight rows where Saxon answers XPST0008 or XPST0051 — a missing schema or an unknown type, static errors against text it parsed — and xsltproc settles the one place the versions differ, XPath 1.0's `NodeTest` taking `'processing-instruction' '(' Literal ')'` where 2.0's `PITest` adds the NCName, so `processing-instruction(a)` is a syntax error in a 1.0 stylesheet and a name in a 2.0 one. The floor is half of what a name means, because below it the same characters are an ordinary call to a function so called — unregistered, which is #576's question and not the parser's, and exactly what xsltproc answers at 1.0 about every name in the table: it parses the expression and then goes looking for the function. Two version-blind lists sat beside the floors until #728, the same fact written twice with the version in one copy only, so `element(a)` came back a `step` in a 1.0 stylesheet where a 1.0 processor reads a call. The verdict agreed and the tree did not, which is the half an acceptance diff cannot see — #708 measured against fontoxpath, an XPath 3.1 engine, and every one of these agrees with it at 3.1 — and the half Phase 4 of #644 walks. So a `SHAPED` row in `test/grammar.test.js` asserts the *kind* on both sides of a floor where neither side is a refusal, beside a `RESERVES` row, which is the mirror of a `GATED` one: a construct that stops parsing from a version up rather than starting. Applying an expression is gated the same way and was not gated at all: `$f(1)` is a dynamic call from 3.0, when function items arrived, and before that the characters are no call by another reading either, a `FilterExpr` taking predicates and no argument list — which is how `child::element(b)` came back an `apply` at 1.0 the moment `element` stopped being a kind test there. A name is taken only where a call could stand, in front of a bracket, so `//item` is the path it always was. A refusal is an answer rather than an exception — a corpus asks about thousands of expressions and most callers want a verdict — and it names the offset it stood at, so a report can point at the fault instead of at the attribute holding it. An inline namespace is gated at 3.0 along with everything else that version added, and it reaches four productions rather than one, a name being spelled in more places than a step: `named` composes the braced URI literal with the name behind it, so a variable and a call get it for free; `tested` reads one standing in front of a `*` as the fourth spelling of a wildcard, `Q{uri}*` naming every element of a namespace with no prefix bound to it; `called` asks `pastName` where `reaches` cannot, since a name is one token spelled as a QName and two with its namespace inline, so the bracket that tells a call from a step stands one token away or two; and `steps` counts it among the kinds a step may open with, since a step opening `Q{uri}a` opens with a name like any other. It asks that of `NAMES` rather than of one kind at a time, the lexer kinding a name three ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one has a bracket behind it, a `URI` where it spells its namespace inline. Asking about one kind is a defect that repeated itself before the shape was seen: the first draft of #708 accepted `a/Q{urn:my}b` and refused `//Q{urn:my}a`, the shape the inline form exists for, and with that fixed `a/my:fn(1)` was still accepted while `//my:fn(1)` was refused (#731). Every production that *reads* a name knew all three kinds; the one deciding where a name may stand knew them one at a time, and a path is the only place that distinction shows. Under-acceptance is the direction that invents a defect against working code. A reserved name is never either of those spellings, XPath reserving an unprefixed one alone (#708). Beside it stands `matched(pattern, version)`, because a pattern is a different language and not a second reading of this one: it is a union of paths and nothing else, so `1 + 1`, `@a = "b"` and `a, b` are fine expressions and no pattern at all, and reading a `match` with the expression grammar admits every one of them (#589, #649). The version decides which language it is, by more than a detail: 3.0 rebuilt the pattern grammar on top of the expression one, so `a intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`, `(self::node())`, `.` and the word `union` are all patterns there and none of them is one in 1.0 or 2.0, whose whole grammar is `IdKeyPattern` and a union of relative paths — each is gated on `REWRITE` rather than admitted everywhere, since a pattern accepted under a version with no production for it is a stylesheet called valid that no processor loads. A `/` may stand alone and a `//` may not, the step being what the descent descends to. A bracketed branch is where a pattern parts from an expression rather than borrowing it: 3.0's `StepExprP` admits one at *any* position in a path, so `a/(b \| c)` is a pattern as much as `(b \| c)/a` is, while the expression grammar's own parenthesized step may only open a path (#711) — reading the two alike refused a pattern XSLT admits. Its steps are narrower than an expression's at every version, because a pattern is matched by walking *up* from a node rather than evaluated forwards, so an axis such a walk cannot answer is a static error and not an empty match: `treads` names the two of 1.0 and 2.0's `ChildOrAttributeAxisSpecifier` and the six of 3.0's `ForwardAxisP`, which adds `self`, `descendant`, `descendant-or-self` and `namespace`, and no version admits the four reverse axes, `following`, `following-sibling` or `preceding-sibling`. A `..` never spells a step and a `.` spells one from 3.0. Settling that took two processors and neither would have done alone: SaxonJ-HE says what 3.0 refuses, with XTSE0340, but applies its own 3.0 pattern syntax whatever the stylesheet declares — it admits `self::a` and `.` at `version="1.0"` — so only xsltproc, being 1.0 only, can say what an older version refuses. A processor shows that a construct is admitted somewhere; only a version-aware one shows that a version refuses it, which is the trap #717's arbitration fell into as well. Two more borrowings from the expression grammar are paid back. A bracket is `bracketed` rather than the expression grammar's parenthesized primary, so it holds a `Pattern` — optionally, since `()` matches nothing and is a pattern all the same — `(a \| b)/c`, `(a)`, `(a[1])/b` and `(a \| b)[1]` are patterns and `(1 + 1)/a`, `(a = b)/c`, `("s")/a` and `(a, b)/c` are not, though each of those is a fine expression. And `.` is the whole of `PredicatePattern`, read by `whole` before any union, so it stands alone or not at all: `a \| .`, `. \| a` and `.[@x] \| a` are refused. It is still a *step* once a separator stands in front of it, which is the distinction `entered` draws — `b/.`, `/.` and `//.` are patterns while `(.)`, `(.)/a` and `a/(.)` open a path with one and are not. The last borrowing goes with them: `FunctionCallP` took its arguments from the expression grammar, where XSLT admits a literal or a variable reference and nothing else, so `key("k", a/b)`, `id("x" \| "y")` and `doc(concat("a", "b"))/x` parsed as patterns; `anchored` narrows them, and `root` takes no argument at all. A numeric literal is a literal, so `key("k", 1)` is a pattern and `id(1)` is one too — a processor refuses that second one for `XPTY0004`, which is `id`'s signature rather than the pattern grammar, and reading the arbiter's *code* rather than its exit status is what tells the two apart. Eight of a first sweep's apparent over-acceptances were static-type, undeclared-prefix, arity and classpath errors. A type is read by three productions rather than one, because XPath spells three and they have three shapes: `kinded` for the kind test of a `NodeTest`, `sequenced` for the `SequenceType` an `instance of`, a `treat as` and a function's `as` take, and `singled` for the `SingleType` a cast takes. One function served all three and took an occurrence indicator wherever it was called, so a step lost the `+` of `text() + 1` to a type that has none, `$v instance of (xs:integer)` was refused where a `ParenthesizedItemType` stands, and `1 cast as node()` was accepted where a cast makes an atomic value (#740). Two more borrowings went with it. `postfixed` hung its `(`, `?` and `[` off whatever `primary` answered, and `primary` answered a *step* when nothing else matched, so `a?b` came back a lookup into a step and `@a(1)` a call applied to one — `StepExpr ::= PostfixExpr \| AxisStep` is a fork, and `opens` is now the whole of it, one predicate naming the same shapes `primary` reads. A named function reference is a `PrimaryExpr` of its own on that reading, not a postfix, which is what `referred` says. And the simple map came off the ladder: `ValueExpr` *is* a `SimpleMapExpr`, so `!` binds tighter than the unary signs and far tighter than the four expressions taking a type, where a rung of the ladder put it looser than all of them and `a instance of xs:integer ! b` parsed as a map over a sequence type. Two questions the lexer cannot answer are answered here instead, both of them about a word (#742). `counted` takes the occurrence indicator a type ends with and reads the word behind it as the operator it spells, since the `?` of `xs:integer?` and the `?` of `$m?div` are one character with one token of lookahead behind each: the first ends a value and the second opens a lookup key, so a wider `ENDS` answers for the type and breaks the lookup, and only the production being read can tell them apart. The `*` never needed it, `MULTI` already ending a value by spelling the wildcard of `a/*` — an accident that made `item()* div 2` right for a reason no rule stated. And `glued` refuses a keyword run against the terminal in front of it, the same gap rule `operates` applies to the words the lexer kinds, for the ones it hands over as names: `1to 3`, `1cast as xs:integer` and the `1else` of `if (1) then 1else 2` are all XPST0003 and every one of them parsed. `glued` is `abuts` narrowed to the kinds `GLUES` names, so every question this file asks about a gap is one adjacency test underneath, and `abuts` is the absence of a trivia token rather than arithmetic over offsets — the stream being lossless, a gap or a comment between two terminals is a token of its own. `welded` is the same question one token further out, `reaches` with adjacency required, and the pair is what a *terminal spelled out of several tokens* needs: a wildcard is the only one XPath has, `Wildcard` being marked `ws: explicit`, so `my: *`, `* :a`, `*: a`, `* : a`, `Q{urn:my} *` and `a/my: *` are not loose spellings of one but XPST0003 in Saxon-HE 12.5, and `tested` read all six as wildcards because `take` and `expect` skip trivia everywhere else, rightly (#736). Each of the three composite spellings asks for adjacency in its own condition and none refuses on its own account, a `*` being a whole wildcard already: what a gap parts from it is the next production's business, which is what leaves the `:` of `map {* : 1}` to the map constructor it separates. Both are read by `isValid` since #732, which is Phase 3 of #644 opening — in `src/xpath.js` then and in `src/syntax.js` now, where the parse is kept rather than thrown away once its verdict is read (#577): a run's verdict on whether an expression is valid is this file's, taken behind the two gates of #680 that `test/grammar-corpus.test.js` holds `parsed` to, and the shape sweep of `test/grammar-shapes.test.js` beside them |
| `src/syntax.js` | The one door between a record and what the grammar makes of it, and where every check that reads a tree begins (#577). `parseOf(found)` forks on the record — `matched` for a pattern, `parsed` for an expression — at the version `versionOf` reads at the node, or at `ASSUMED` where it can place none: the most permissive version `KNOWN` holds, derived rather than spelled, because a missing `version` is already `missing-version-in-stylesheet`'s defect and letting it decide a syntax question would answer one defect with an `invalid-xpath-expression` for every modern expression the file carries. One parse per distinct expression, keyed by version and language as well as by text, since a corpus asks about `.` and `@name` and `text()` over and over (#689); and the *tree* is kept now, where the verdict alone was the cheaper bargain while nothing above asked for more, because a check that walks it would otherwise parse a second time. `isValid` is that verdict with the complaint dropped, for the two gates wanting a boolean, and `refusalOf` is gone — the offset the fault stands at comes off the parse itself, which is what lets the validator point at the fault rather than at the attribute holding it (#589). Beside them, what a check needs of a node: `tokensOf`, the tokens a span covers, with `textOf` and `offsetOf` derived from it, so a position is the lexer's rather than anything computed from text — and the tokens themselves because the tree gives one kind to what the lexer told apart, a `literal` being a number or a string with only its token saying which, which is the whole difference between `[position() = 1]` and `[position() = '1']` (#575); `gathered(found, kinds)`, every node of one of the kinds, outermost first, a list rather than one kind because a construct is often two of them — which two is `VALUED`, the general and the value comparison, one list here rather than one per check for the reason `TRIVIA` and `OPAQUE` are one each, with a `no-restricted-syntax` selector refusing a second copy anywhere in `src/` but this file and `src/grammar.js`, where the kinds are minted and all three are named in the table deciding which operator builds which; `operatorOf`, the operator standing between two operands, read off the `parting` tokens the grammar consumed without building a node of its own and canonicalised through `WORDED` — the one table pairing each general comparison with the word XPath 2.0 spells the same question in, so `eq` reaches a classifier as `=` and one keyed on six symbols answers for twelve spellings (#763). `test/syntax.test.js` holds that table to the grammar as it holds `LOOSE`, asking of each pair whether the two spellings really do come back a `comparison` and a `value-comparison`, and sweeping every word operator the lexer knows for one the pairing misses — the direction that has actually moved, 2.0 having added all six words at once. A check needing to know which class it was handed reads the node's kind, that *being* the answer: the count collapses to a call and carries no operator either way, while the string-length rewrite carries one and writes back the family it was given rather than moving a value comparison into the general one; `calls(found, node, name)`, whether a node is a call to a *standard* function, resolving the prefix against `holding(found.node)` and admitting the bare, the prefixed and the inline `Q{...}` spellings of the one namespace; `stringOf(found, node)`, the string a literal holds — unquoted, and with a doubled delimiter inside it read as the one character it spells — which is the question `textOf` cannot answer, XPath spelling one string two ways and a check comparing the text seeing two literals (#598, #562, #549); `variableOf(found, node)`, the name a variable reference holds, which is the same shape of question one construct over — XPath lets a gap or a comment stand between the `$` and the name, so `$ para` references `para` and the text of the span does not say so, while a namespace stays part of the name, `$Q{urn:my}para` and `$my:para` each naming a variable `$para` is not (#776); and `tight(node)`, whether a node's text can stand as an operand of a general comparison with no brackets round it. That last one reads `LOOSE`, XPath's own ladder from the comparison up — the comma, the five `ExprSingle` expressions, `and`, `or`, and the three comparison classes that cannot chain — and `test/syntax.test.js` holds the list to the grammar rather than to its comment, taking one expression of every kind the grammar builds and asking whether `<specimen> = ''` really does come back a comparison over the whole of it |
| `src/import-graph.js` | Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf`. A reference with no `@href` names no module and yields no import, rather than joining a null onto the directory and taking the whole run's report down (#597); no check reports that malformed reference yet (#668) |
| `src/fixers.js` | Maps a declarative check name to a `node => fix` builder, each built from `src/fixes.js` rather than by hand: `deletion` for one that cuts an attribute, `substitution` for one that rewrites its value |
| `src/fixes.js` | Shared fix builders: `deletion(attribute, content)`, which reads the span to cut from the raw source — xmldom reports an attribute at its opening delimiter, so the quote is whichever stands there and the walk back over the `=` and the name crosses a gap of any width. Rebuilding the text as `name="value"` behind a space made the fixer decline every other spelling of it (#594). Beside it, `standsAt(attribute, content)` answers where an attribute *stands*, in the line and column a defect is reported in, off the same walk: a reporter that instead subtracted the name's length from `columnNumber` was right only where the source spelled the attribute `name="value"` exactly, so `xmlns:dead = "urn:dead"` was reported two columns right of itself and one standing on its own line six (#681). The two answers differ by one gap on purpose — a deletion takes the gap in front of the name with it, or it would close two attributes up against each other. `substitution(attribute, replacement)` is the third, for a fix that rewrites a value rather than cutting it: it anchors one character past the delimiter and replaces the value alone, so the name, the gaps around the `=` and the quote stay as the source spells them and none of the three has to be found. Five builders rebuilt the whole attribute as `name="value"` instead, which assumed all three at once and failed on each — on `select = "//para"` the fix named a column two to the right and a text standing nowhere in the file, so it was announced and then declined as no longer matching (#718). The arithmetic behind it is banned outright now by a `no-restricted-syntax` selector, since nothing in `src/` needs to guess where an attribute begins. It does read the delimiter, though, because what a fix carries is the *decoded* value: an expression the source spelled `//a[@x &lt; 1]` arrives holding a bare `<`, and writing it back as it stands closes the element early. So `escaped` re-encodes the `&`, the `<` and whichever quote the value stands in — the delimiter being the one position the parser reports exactly, which is why `deletion` reads it too. A `>` is left bare, legal in an attribute value: re-encoding cannot recover which characters the author chose to write as references, so the line is drawn at what XML forbids. Rewriting the whole value swept every entity in it before that, which master does today on the plain spelling and this change would otherwise have carried to the spaced one |
| `src/fixer.js` | Applies a defect's `fix` to source (decode-walk, verify-before-apply, end-to-start). A line ending in the source answers to a space in the fix's `value`, the last normalisation between the two texts, without which no fix could reach an expression a line wrap crossed — announced as fixable and then refused with "the source no longer matches", naming an edit that never happened (#629) |
| `src/xpath.js` | The fontoxpath environment, and since #577 only that: prefixes, the two evaluators the declarative loaders issue their selectors through, and `compiles`, the engine as it stands, exported for the two sweeps that diff the grammar against it — a second opinion rather than a verdict, which is what lets it stay strict where the specification is not. The front door moved out to `src/syntax.js`, which is what #738 left half-done: it deleted the 204 lines of respelling that rewrote an expression before the engine was asked about it, so what stayed behind was a verdict this file no longer had any part in answering, sitting in the one module that loads a 3.1 engine. A check reading the tree would have pulled fontoxpath in behind it for a question the grammar answers |
| `src/helpers.js` | XML parsing (expands internal-subset entities), YAML parsing, file recursion. `allFilesFrom` joins each subtree on with `flatMap` rather than spreading it into a `push`, since a spread hands every path over as an argument and V8 caps those at roughly 125 per kilobyte of stack: this repository's own checkout grew to 768,731 files and every run over it died with a `RangeError` before a byte of XSL was read, the walk being asked before anything is filtered for `.xsl` (#758). It refuses what `@xmldom/xmldom` would repair rather than reject: the level of a diagnostic is not consulted, since an attribute written without quotes arrives a mere `warning` and is then invented into a value (#574), and `forbidden` walks the text nodes for the two sequences character data may not hold — an `&` that opens no reference, which the parser rewrites to `&amp;`, and a `]]>` that closes no section, which it keeps as it stands (#691). Both are accepted in silence, at no level. Text nodes come from `src/tree.js`'s `walked`, not from a scan of the source, because both are legal in a comment and a processing instruction, and inside a CDATA section an `&` is text while a `]]>` is the close — a text node cannot be any of the three, so those are excluded by construction rather than by finding them, and an attribute value, where `]]>` is legal because it is not content, is outside the walk for the same reason. The YAML parser is required inside the function, not at the top: nothing on the linting path reads YAML any more, so a run that has no `.xslint.yml` never loads it |
| `src/resources/checks.json` | Every check as a run reads it, built from the YAML by `scripts/generate-checks.js`. Never edited by hand — `test/conformance.test.js` re-renders it and fails on any difference |
| `src/logger.js` | 4-level logger |
| `scripts/generate-docs.js` | Builds the `docs/` site from checks + motives |
| `scripts/generate-checks.js` | Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`) |
| `test/conformance.test.js` | Enforces naming, motives, selector hygiene — including that a selector comparing an expression's text with a quoted literal names both quote spellings of it, since `incorrect-use-of-boolean-constants` named `"'true'"` alone and read half the stylesheets it is about (#549) — pack/test coverage, the `mature` freeze across all kinds, the fast/deep split of the suite itself, and that no test writes a scratch file outside a temporary directory |
| `test/grammar-corpus.test.js` | The two gates #680 stands in front of the parser, asked of every expression the repository carries — 644 of them, from the committed stylesheets, from the ones the packs hold inline, and from the selectors the declarative checks are themselves written in. **Round trip**: a parse's tokens join back into the expression byte for byte, every node's span slices to its own text, and every child nests inside its parent in order — the last of those is what slicing cannot see, since shifting a node and its children together still slices. **Acceptance diff**: the verdict is diffed against the engine's, asked as `compiles` and asked alone — a respelling retry sits on the engine's side of that comparison and hides every expression fontoxpath refuses and the squeeze rescues. Forty do, and they are #639's family exactly, a spaced axis or a `namespace::`; asking `compiles(xpath) \|\| compiles(squeezed(xpath))`, which is what `isValid` was until #732, cancels every one and reports the evidence for retiring the retry as absent from the tree, when what is absent is a comparison that can see it. So the forty are *subtracted* rather than cancelled: `insists` in `test/strictness.js` reads the class off the token stream, `EXPLAINED` takes it out of the diff, and what is left over is annotated one line each in `GAPS`, naming the side that accepts and the gap it stands for, so a new one and a stale one both turn red. Subtracting a class can hide a defect the way the retry did, in one direction, and that direction is gated: the class may only ever excuse the grammar accepting where the engine refuses, never the engine accepting where the grammar refuses, which would be an invented defect excused (#738). Eleven stood when #680 wrote that list and **none** does now, which is the measure working rather than the measure going quiet: nine were a parenthesized step (#711), one a node comparison (#724) and the last a name no NCName can spell (#708). An empty list is an assertion, not the absence of one — every expression the repository carries takes the same verdict from both sides, so a disagreement of either kind turns it red — and it does not claim the two agree everywhere, the corpus reaching only what the corpus holds, which is why the classes #708 closed that no fixture spells are pinned in `test/grammar.test.js` instead. The corpus is gated as well, because a sweep can pass by finding nothing: each of the three sources must still yield what it did when the gates were written, and the class must still have forty expressions to subtract. The selectors are one expression in twelve and held ten of the original eleven gaps — the checks are written in an idiom the stylesheets never use, which is why a corpus of stylesheets alone (#708) agreed completely and proved little |
| `test/grammar-shapes.test.js` | The same acceptance diff as `grammar-corpus.test.js`, asked of 14112 expressions nobody wrote: every shape a head and one or two tails spell, spaced and glued. A corpus covers only what somebody has already written down, and every class #740 closed stood outside the repository's — so `GAPS` read empty while the grammar refused `text() + 1` and accepted `a?b`, and this sweep parted from the engine 1603 times on the same head. Both classes it was left with are closed by #742, and a generated sweep covers only what its own lists spell, which is the corpus limit one level up: the second was annotated `\? (WORDS)` over a `TAILS` naming no `+` at all, so `xs:integer+ and @b` stood outside its own net, and widening the annotation to `[?+]` uncovered `cast as xs:integer? instance of x` behind it. A predicate too broad to be a class is one failure mode, since an annotation that swallows the next defect turns nothing red; too narrow is the other, and this file was in it. What is annotated now is not a gap in the grammar at all — fontoxpath accepts a word run against the *arity* of a named function reference, where Saxon-HE 12.5 answers `abs#1div 2` with XPST0003 exactly as it answers `1div 2`. One engine's verdict is evidence and not an answer, which is why a second arbiter settles it; `net.sf.saxon.s9api`'s `XPathCompiler` judges them in well under a second, and reading its *code* rather than its exit status is what tells a syntax error from the undeclared prefix or unknown function behind one. That cost is why the fast half now answers in under two seconds rather than under one. The lists grew by four heads and three tails at #753, from 8064 shapes to 14112: a kind test carrying arguments is a head now, and the item types whose brackets hold a type are tails, so the productions that read them stand inside the net rather than beside it. The gate on the count moved with them, since a sweep that has been narrowed reads exactly like one that agrees |
| `test/strictness.js` | `insists(xpath)` — whether fontoxpath refuses an expression over its own strictness rather than over anything malformed in it: a `namespace::` axis, ExprWhitespace around an axis separator, ExprWhitespace inside a node test (#615, #639). It is the account that replaced the respelling retry #738 deleted, and it is a test-side module because a run has no use for it — nothing in `src/` asks what one engine insists on. Read off the token stream, which is what tells the axis of `1-namespace::x` from the one name of `a-namespace::x`, the lexer having already decided which a `-` is where a lookbehind would be reading characters about a question that is about tokens; the thirteen axis kinds are borrowed from `src/tokens.js`'s `AXIS_KINDS` rather than written down a second time. What it is not is an oracle of validity — `child ::` holds a spaced separator and is no expression — so a gate reads it *beside* `parsed`, never instead of it, and `test/strictness.test.js` pins that with the class it names and refuses all the same |
| `test/helpers.js` | The only door to a child process in the suite: `runXslint`/`xslintStatus`/`xslintStreams` run the CLI, `xcopped` runs xcop once over a directory, `cmdAvailable` answers whether a tool is there by running it, and `walkedWith(dir, kilobytes)` runs `allFilesFrom` in a process whose JavaScript stack is that small. That last one hands back the largest spread the stack allows beside the walk's own answer, because a walk that survives proves nothing unless the trap was armed and how many arguments a spread carries is V8's business — a Node that moved the number would otherwise leave the test quietly proving nothing (#758). The kilobytes are the smallest stack worth asking for rather than the stack: node needs some seventy to start here and more where a platform's frames are wider, so the ask doubles until one answers and the stack that did comes back, for a caller that has a second question to put to the same size |
| `test/scaling.test.js` | The speed gate (see **Speed**): charges every stage its own processor time over a generated corpus at 40 stylesheets and again at 160, and fails one that costs more beside the middle stage of its run than `SHARES` allows it, or — where it has no entry there — grew more than `GROWTH` beside that stage's growth. Cost is the sharp question and growth the loose one, because #755 changed a constant and not an exponent, which is a difference the two distributions show plainly: 9.6 to 10.4 against 16.7 to 17.1 in cost, where in growth the fix reads 1.85 to 2.04 and the quadratic 1.66 to 2.43 — the lowest reading being the one judged, growth ranks them backwards. The corpus is the assertion as much as the bar is. It is copied from one committed `test/resources/scaling/stylesheet.xsl`, the way every test stylesheet here lives in a file, with the number of each file substituted into every name it holds — so no two share an expression, a declaration or a namespace, and the memo in `src/syntax.js` cannot make the larger corpus look cheaper than it is. That stylesheet holds a namespace nothing uses, an import, a literal result element, one unused parameter, and a call of every shape a linter is about, because a stage handed nothing it reads cannot be measured at all: the three per-document linters were exactly that, 0.3 ms with a spread of 358%, until it grew namespaces and imports. How *much* of a construct it grows is its own question, and the parameter is where that showed. A pair in each of the four templates read fine for `parameter-linter` and pushed `corpus-linter` from 9.5 of the middle to 14.4, past the 13 that catches #755 — every `@name` being a usage, and three of the four cross-file checks giving `//@*`. So it is armed with the fewest attributes that still leave the new stage a defect to build, which is one unused parameter: 0.86 to 0.94 of the middle for it, and 6.9 to 9.3 for the cross-file linter. A corpus that arms one stage must not disarm the bar on another. What that costs on a runner of another character is not presently answerable and nothing here should be read as answering it: the macOS runner failing this branch at 13.26 and then 14.84 fails master itself at 23.76, which is #777 — a denominator two cheap stages keep swapping places at, and a bar that cannot be calibrated against it until #778 lands |
| `test/xcop.deep.test.js` | Writes every pack's inline XSL to one `mkdtempSync` directory and runs xcop over it once; pending, never absent, where the tool does not run |
