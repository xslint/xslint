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
are deep, and they still cost most of what the suite costs: 604 of the 2470
tests, 9 of the 14 seconds. The other 1866 finish inside one, which is why
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
questions of each: what **percentage of its own run** it costs, and how it
**grew** beside the middle stage's growth. Both are quotients taken inside
one process, which is what cancels the machine — an absolute threshold on a
shared runner either flakes or is set so loose it catches nothing. Each stage is
timed **directly** rather than by subtracting one run from another, since the
error of two timings compounds: a stage whose own reading holds to three percent
reads twenty measured that way. It spawns nothing and writes nothing, so it
belongs in the fast half, where it costs 4.5 seconds — and costs it every run
rather than on average, one measurement being discarded and none retried. It
cost 3.3 until #800 gave its corpus the file-size skew the real ones have, and
6.4 until #784's shared walk gave a second and a half of that back.

The cost is the assertion the gate stands on, and growth is the looser check
beside it, which is the opposite of how it was first written. The reason is
that #755, the regression this tier exists for, was a **constant and not a
shape**: it left the cross-file linter's exponent where it was — 1.46 against
1.57 over this corpus — and doubled what it spent at every size. So the two
growth distributions overlap, the fix reading 1.85 to 2.04 and the quadratic
1.66 to 2.43 — and since the lowest reading is the one judged, growth does not
merely fail to separate them, at 1.66 against 1.85 it ranks them backwards —
while the costs have nothing between them, the fix reading 15.1% to 15.7% of the
run against the quadratic's 29.1% to 30.1% over three alternating pairs on one
machine. Reverting `src/linters/corpus-linter.js` to its pre-#755 state fails the
gate thirty-seven times out of thirty-seven, its judged reading ranging 26.54% to
31.86% against the 26 that `SHARES` then allowed it, and master passes three of three
under a load average of eighteen. A bar enough to have caught that in growth
would have to separate 2.31 from 1.93, which is inside the noise of any machine.

What a share is a share **of** is the whole run, the readings summed, and it was
the *middle* reading of the run until #777 — on the argument that fourteen of
the eighteen stages sit within a factor of two of each other, so their median is
any ordinary stage's cost and no one stage can move it. Fourteen readings within
a factor of two are fourteen that keep swapping places, and a median is the mean
of the 9th and 10th, so whichever pair lands there sets the denominator of every
share. Three runs on one idle machine, nothing touched between them, read the
middle at 19.27, 16.79 and 27.86 ms — while `corpus-linter` spent 220.52, 247.30
and 282.54 ms, which is 16.43%, 17.85% and 16.06% of its run and 11.44, 14.73
and 10.14 of the middle. Making a *cheap* stage cheaper moved it hardest, a
cheap stage being what the median is made of: #775 halved `node-set-linter`, one
of the two straddling it, and lifted every other share by about a quarter, so an
optimisation anywhere failed the gate for the cross-file linter — which had cost
the same to the millisecond. `SLACK` cannot see that either, ratcheting only
when a *named* stage gets cheap. The sum moves as a whole run does and nothing
but a real change in the mix moves a share within it — with one residual,
recorded rather than hidden: `xpath-linter` was over half the run when that was
written, 52.1% to 57.0% here, so an optimisation **there** really would move
every other share, and the whole table would want re-deriving rather than
reading as regressions of stages nobody touched. What the sum buys is that a
change to one of the fourteen *cheap* stages no longer does, which is #775 and
every other optimisation landed so far. That residual is no longer
hypothetical: #784 narrowed eight selectors and took `xpath-linter` from 62.41%
of the run to 57.95%, which lifted every one of the sixteen cheap stages without
one of them costing a millisecond more — 1.013 to 1.258 times what it read
before, median 1.122. So the prediction held, and the response is the one #783
set: re-derive what the denominator moved, or say why an entry stays. The second
half of #784 answers it again and further, over the corpus #800 gave the gate:
serving a declarative axis from one shared walk took `xpath-linter` from 44.88%
of the run to 31.02%, so the dearest stage is no longer near half of it, and the
nineteen cheap stages came up once more, by 1.217 to 1.439 times what they read
before, median 1.334. Three re-derivations of one table for one cause — those
of #783, #800 and this one, the fourth move of it being #777's change of divisor
rather than any stage's cost — is the argument for a gate of another kind, which
is why that change carries a structural one beside the bars: no share ceiling can
stop a selector asking the engine to descend a tree the run has already walked,
and `UNINDEXED` in `test/conformance.test.js` can.

The sixth move is #811's union phase, and it is the first to move the dearest
stage by making it cheaper rather than by moving what the others are a share of.
Three checks are written as a union of two paths and no shape of theirs was
served without it, a `|` at the top level being one selector to the split and
two descendant sweeps to the engine:
`xpath-linter` goes from 3.83 s to 3.11 s over DocBook-XSL, 2.93 to 2.38 over
TEI and 1.37 to 1.14 over DITA-OT, the lowest of three interleaved rounds a side
of processor time, which is 19%, 19% and 17% off the stage and 11%, 9% and 8%
off the staged run, with the report byte-identical on all three at 3843, 5716
and 1266 defects. Over the gate's own corpus the stage reads 33.93% where it read
41.14%, dearest of five gate runs a side, so its entry comes down by its own
ratio, 64 to 53. The other twenty-two stages cost what they always did and every
one of them reads dearer for it, by 1.02 to 1.19 — which is the same
denominator arithmetic as ever, and this time it crosses two bars rather than
none: `xpath-validator` at 12.29% reads 14.15%, putting its entry of 20 at 1.41
times a reading the band allows no closer than half again, so it goes to 22, and
the dearest cheap stage goes 3.72% to 4.08%, putting `SHARE` at 1.47 and so 6 to
7. `xsl-validator` keeps its 14 at 1.52 of a 9.18% reading, inside the band,
a bar raised on nobody's failure being a bar loosened.

The fifth move is #811, and the same cause a fourth time one stage over: the
walk answers an **attribute** axis now, so `//@*` — the usage of three of the
four cross-file checks, and 60% to 74% of what that stage spent — comes off a
sequence the run has already built rather than costing a descendant traversal
per document. `corpus-linter` falls from 2.26 s to 0.11 s over DocBook-XSL,
1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT, lowest of three
interleaved rounds a side, which takes the staged run down 25%, 17% and 11% and
leaves the report byte-identical on all three at 3843, 5716 and 1266 defects.
Every one of those is **processor time** against the **whole staged run**, the
two validators in the divisor, because a saving read off one clock and a share
read off another are not one measurement: the wall clock charges this same
change 29%, 20% and 24% over the same three corpora, and the linters alone are
a denominator a fifth too small. Both were written here before the mixture
was caught, and the second of them is what #777 is the history of.
Over the gate's own corpus that is 20.89% of the run to 1.23%, dearest of five
gate runs a side, and the three stages nobody touched rose by the fifth taken
out of their denominator — `xpath-linter` 31.86% to 40.60%, `xpath-validator`
9.49% to 11.98%, `xsl-validator` 5.86% to 8.23% — so their entries are
re-derived by their own ratios, 50 to 64, 16 to 20 and 10 to 14, and the twenty
cheap stages came up by 1.18 to 1.41, median 1.26. This time `SHARE` comes up
with them, 5 to 6, by the ratio of the dearest reading among them, 3.06% to
3.80%: a bar left where it stood would have tightened by a quarter as a side
effect of a stage those twenty have nothing to do with, and against 3.80% a bar
of 5 stands 1.34 times above where the placement rule asks for half again.

What that lift is measured **by** matters, because the first reading of it here
was wrong in a way worth recording. A share was read off one printed table and
divided into each bar, which is a single measurement standing in for a
distribution: it put the cheap range at 0.24% to 2.77% where an interleaved
master-branch pair, dearest of nine gate runs a side on one machine, puts it at
0.21% to 2.25% against 0.21% to 2.48% — endpoints that move more from noise than
the denominator moves them, since the low end is a stage costing a fifth of a
millisecond. The **per-stage** lift is the statistic that survives; a range of
extremes is not. Read the same way, all four entries stay: 85 against a dearest
57.95%, 12 against 8.15%, 15 against 8.07%, 9 against 4.94%, which is 1.47,
1.47, 1.86 and 1.82 times each reading.

Two of those four sit inside the half-again-to-twice band an entry is placed by
and two sit just under its lower edge, which is the safe side — an entry tighter
than the convention asks catches more and not less — and `SLACK` is untroubled
by any of them at four. `SHARE` stayed at 5 then, because nothing had crossed
it: a bar raised on nobody's failure is a bar loosened. The cross-file entry
answers to a different rule and the band is the wrong yardstick for it, since it
is the one ceiling standing **between two distributions** — 12 sits above the
dearest reading #783's index has given here and a sixth below the cheapest the
scan it replaced gave on any runner, 14.4%. What holds all four is CI over six
runners rather than a factor carried across from another stage: the 1.53 the
runners disagree with this machine by was measured for that scan, and applying
it to a stage it was not measured on would have predicted `xpath-linter` failing
at 88.7%, where all six pass. Read the same way after the shared walk, the table
moves a fourth time, and this time what moves with it is the stage that got
cheaper rather than the three it lifted: dearest of six gate runs a side,
interleaved on one machine, `xpath-linter` goes 44.88% to 31.02%,
`corpus-linter` 16.73% to 20.08%, `xpath-validator` 7.65% to 9.94% and
`xsl-validator` 4.51% to 5.94%, none of the three costing a millisecond more.
So `xpath-linter`'s own entry comes down by its own ratio, 73 to 50, where
against a dearest 31.02% the old one would stand at 2.35 times a reading the
band allows twice — and the two that answer to the band keep theirs, 16 and 10
standing 1.61 and 1.68 times their dearest readings, which is where an entry
belongs. `SHARE` stays at 5 for the reason it has stayed there before: the
dearest cheap stage reads 3.27%, which 5 stands 1.53 times above, and the one
runner table on record charges the dearest of them 1.82% where this machine
charged it 2.53% — a bar raised on nobody's failure is a bar loosened. The
cross-file entry answers the two-distribution rule and is measured rather than
scaled, both of its edges having moved with the denominator: 32 is the geometric
middle of an index reading 20.08% at its dearest here and the pre-#783 scan's
cheapest 50.34% over five runs of the gate, which is 1.59 above the one and 1.57
below the other, and the real gate fails three of three with that scan in place
at 50.80%, 51.42% and 50.96%.

What is timed is **processor time and not the wall clock**, `process.cpuUsage`
rather than `process.hrtime`. The wall charges a stage for every slice the
scheduler hands to something else, so the gate it produced was unusable on a
busy machine: under sixteen processes competing for ten cores it failed seven
runs of eight, naming stages nothing had touched at 2.36 and 2.97 of the middle
stage — indistinguishable, to whoever reads the build, from the one true
failure — and reading `corpus-linter` itself at 0.78 of it, which is its bar's
*other* side and would have announced #755 as settled. Those readings are in the
unit the gate used before #777, the middle stage rather than the whole run, and
are left in it: what they are evidence about is the clock, not the divisor.
Retrying does not help, because
contention lasts longer than a run and inflates the same stage in every attempt.
Processor time is what the stage itself spent, so the same sixteen processes
move it by a tenth, every entry staying within that of its idle reading, and the
gate passes every run under the load that broke the wall clock.

What processor time costs is resolution, and one platform pays it. Windows
charges in ticks far coarser than a cheap stage costs over the *small* corpus,
so eight of the stages with no entry measure `0` there and their growth
arrives `Infinity` or `NaN`. A growth that is not a finite number is therefore no reading and is
dropped rather than judged — verified by quantising the clock to 6 ms here,
which turns 3 to 5 growths of 18 non-finite and leaves the gate passing. The
share is unaffected, being taken over the corpus four times larger and against
the whole run rather than one reading of it: under that same coarse clock
`corpus-linter` reads 14.0% to 14.9% where a fine one reads 15.1% to 15.7%. So a
coarse clock costs the looser of the two questions on one platform, not the
gate.

It stands down in one process and says so: `npm run coverage` runs mocha under
c8, and V8's branch bookkeeping does not fall evenly across the stages — it
charges `xpath-linter`, the one putting every declarative check through
fontoxpath, 65% to 69% of the run where an uninstrumented run charges it 52% to
57%. A ceiling honest about one of those readings says nothing true about the
other, which is the reason to stand down, and it is not the same thing as a
breach: no ceiling here is crossed at all, 69% sitting comfortably under the 75
that entry allows. What fires is the **floor**, and only sometimes — run alone
under c8, `xsl-validator`'s judged reading came to 1.93%, 1.95% and 1.97%
against the 2.00 that `SLACK` leaves an entry of 8, and the ratchet called that
entry stale in three runs of five, where under `npm run coverage` itself it read
2.14% to 2.34% and passed three of three. An instrumented process therefore
answers about c8 rather than about the pipeline, intermittently red on a tree
nobody has touched, so the measurement skips itself when `NODE_V8_COVERAGE` is
set (in the body, with `this.skip()`, never by registering behind a condition)
and the coverage run reports it pending. Nothing is lost either way: every branch it reaches is
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

`SHARES` names the three stages that legitimately cost more of a run than the
rest: `xpath-linter` at 53%, `xpath-validator` at 22%, `xsl-validator` at 14%.
Every other stage answers to one bar, `SHARE` at 7%, which the twenty of them
sit far below at 0.28% to 4.08% — so a cheap stage that becomes an expensive one
turns red, and earns either a fix or an entry. It named four until #811, and the
fourth is the one worth reading the rule off. Two
things set a ceiling. Where there is a defect to catch it goes **between the two
measured distributions**: `corpus-linter` stood at 32, the **geometric middle** of
the dearest reading #783's index had given here, 20.08%, and the cheapest the
scan it replaced gave over the same corpus, 50.34% — geometric rather than
arithmetic because the risk is multiplicative on either side, a runner of
another character moving a share by as much as a half. Putting that linter back
to its pre-#783 state failed the gate three times of three at 50.80%, 51.42% and
50.96%, and the index passed it five of five. Both of those edges move whenever
the denominator does, so neither is carried over: they read 18.94% and 45.27%
before #784's shared walk took a third out of the dearest stage, and 6.05%
against a scan the runners charged 14.4% before #800 gave the corpus the skew a
real one has. What ends that entry is #811, which serves the `//@*` three of the
four cross-file checks are written in off the same walk and takes the stage from
20.89% of the run to 1.23%: an entry is for a stage that legitimately costs more
than the rest, and one that no longer does answers to `SHARE` like any other —
a bar five times tighter than the 32 it leaves behind, and one that asks the
growth question of it as well, which an entry does not. The regression the pair
was placed to catch is caught by a wider margin than before, that scan having
read 50.34% of a run whose denominator was a fifth larger than this one's, and
the real gate fails at 15.23% with the usage selector merely unserved. Three of
those four entries moved without their stages costing a millisecond more or
less, and that is worth knowing rather than hiding: taking
`corpus-linter` from some 16% of the run to some 6% takes a ninth out of the
denominator every share is a share of, and `xpath-linter`, `xpath-validator` and
`xsl-validator` each rose by exactly that — 1.13, 1.17 and 1.13 against the 1.12
the arithmetic predicts — so their entries are re-derived by it (75 to 85, 13 to
15, 8 to 9) rather than left to tighten by a ninth as a side effect of a stage
they have nothing to do with. #784 is the same thing in the other direction and
about the dearest stage rather than the cross-file one: the shared walk took
`xpath-linter` from 44.88% of the run to 31.02%, so its own entry comes down by
that ratio, 73 to 50, and the three it lifted — 1.20, 1.30 and 1.32 times what
they read — keep theirs, each still standing between half again and twice its
dearest reading. The entry read 26 while the scan was what the gate had to hold,
drawn a tenth above the dearest reading that scan gave on any runner and a
fortieth below the cheapest #755's quadratic gave here, on CI evidence rather
than caution — this is the entry a runner disagrees about most, four of them
charging the scan 14.4%, 19.1%, 22.0% and 23.5% of the run where this machine
charged 15.4%. Everywhere else the ceiling stands between **half again and
twice** the dearest reading, there being no second distribution to leave room
for. The table is a ratchet rather than a licence, the `SPRAWLING` pattern one
property over, and it turns red from both sides: past the ceiling, or so far
under it that `SLACK` (four, for the same runner's sake) says the ceiling has
stopped being a bar and wants retightening. Growth is asked only
of the stages with no entry, since an entry pins what a stage costs outright,
which is the stronger statement; those nineteen read 0.47 to 1.24, against a
`GROWTH` bar of 3.0 and the 4.0 a stage that had gone quadratic would read.

Three stages arrived at #788, and the corpus was armed for each in the same
change: an `xsl:element` with a static name, an `xsl:output` beside an `html`
the root template builds, and an `xsl:apply-templates` selecting the bare name
of a variable declared above it. Unarmed, `bare-name-linter` walked the
expression list and reached nothing — 0.04% of the run with a growth of 2.30 to
2.63 against a bar of 3.0, which is noise reported as a shape — and armed it
reads 0.21% to 0.24% and grows 0.69 to 1.18. The other two read 0.16% to 0.17%
and 0.29% to 0.32%. Every entry held at the time, 85 against a dearest 55.62%,
15 against 8.09%, 12 against 8.75%, 9 against 5.77%; #800 re-derived all four.

What #800 changed is the corpus and not a stage, and what it turned up is not
what its title says. The cross-file linter read 6.72% to 9.06% of the run here
where TEI charges it 13.73% and DocBook-XSL 21.95%, and the gap is neither
declaration density — the ticket's diagnosis — nor corpus size. Almost the whole
of that stage is **one selector**: `//@*` is 60% of it over TEI and 74% over
DocBook-XSL, against 4.5% and 3.1% for the `within` walk #783 left behind, which
the ticket named as the thing the gate was blind to. Since fontoxpath evaluates
a descendant step over an xmldom tree quadratically (#635), what that selector
costs **per node** is flat at 1.3 to 3.2 us up to some 350 nodes and then
climbs — 4.2 at 689, 5.2 at 1491, 8.7 at 2829 and 50.4 at 4853 — so five of
DocBook-XSL's 315 stylesheets are two thirds of what it spends over the whole
corpus, and eleven of TEI's 363 are half. That is a **skew** and not a density,
and a corpus of one uniform size cannot show it at any density: twelve more
variables in each of the four templates read 9.18% to 10.75%, forty more
attributes read 7.39% to 9.81%, and twenty stylesheets of 393 elements — the
same bulk in fewer, larger files — read 7.87%. So one stylesheet in every forty
is a **heavy** one, the body written out again forty-eight times over under
names of its own, 5207 elements and attributes where DocBook-XSL's largest holds
8790: the stage reads 15.95% to 18.94%, which is where the real corpora put it.
Every fortieth rather than a fixed count, so a corpus of forty holds one and a
corpus of 160 holds four and both carry the same fraction of them. The other
three entries are re-derived by the ratio of their dearest readings over four
gate runs a side, interleaved on one machine — `xpath-linter` 49.69%-56.08% to
44.61%-48.23%, `xpath-validator` 7.50%-11.53% to 7.23%-12.34%, `xsl-validator`
4.05%-6.11% to 3.85%-6.62% — which is 85 to 73, 15 to 16 and 9 to 10, each
keeping the headroom it had. The stage also builds a defect now, where it built
none: the sheet declares one variable nothing references, which is 160
`unused-variable` over the large corpus and the same principle the arming above
stands on.

Two earlier spellings are recorded so nobody spends the week again. Absolute
growth bars were tuned until nothing flaked here, then failed on all six CI
runners at once, `corpus-linter` reading 8.7 on macOS where it read 7.1 here.
Growth as a multiple of the median passed all six — and could neither separate
the defect it was written for nor survive a loaded runner, which is both halves
of this design's reason for being.

What a gate measured at one size cannot see is a quadratic whose constant is
still small there. `circular-import` asked whether one edge's target reaches
back to its source by walking the whole import graph, once per edge, and so cost
the square of a chain of imports: 2.48, 3.39, 3.53 and 3.99 per doubling from 100
stylesheets to 1600, converging on the 4.0 a quadratic predicts, where at forty
it read a flat 1.0 to 1.6 and the per-edge cost was the whole of what the gate
could see (#769). Cycle membership is a property of the graph rather than of an
edge — two files sit on one cycle exactly when each reaches the other — so one
pass of Kosaraju's answers every edge at once, and the check is linear in them
at 3.4 to 4.2 microseconds a file, flat over the same range.

What holds that is a third instrument, neither tier being able to. The
per-pull-request gate cannot grow its corpus to the size the shape shows at,
since every stage lints that corpus and the nineteen cheap ones would each pay
for the size one of them needs; the nightly tier would meet the shape as a
budget overrun, a night late and over a corpus chosen for something else. So
`test/import-linter.test.js` times the one check over a chain of 200 stylesheets
and again over 800, and fails past a growth of **8** — the geometric middle of
the 4.0 a single pass predicts and the 16.0 a walk-per-edge predicts, and of the
two measured distributions with it, 4.34 to 4.66 over eight runs of the test
against 14.58 to 16.22 over eight more. Putting the walk back fails it three
times of three, at 15.10, 15.26 and 15.32. It costs a third of a second, timing
one stage over a chain it builds itself rather than a whole pipeline over a
corpus every stage reads — which is what lets it ask about a corpus five times
the size of the one the first tier can afford.

What a window holds is sixty-four passes over the short chain and sixteen over
the long one, not one apiece, because a reading has to clear the clock's own
granularity and one platform's is coarse. Windows charges processor time in
scheduler ticks of some sixteen milliseconds, where a pass over the short chain
costs a millisecond and one over the long chain four, so a single pass read
`0` on both and the growth arrived `NaN` there — and worse than a gate
answering nothing, two readings of one tick apiece would have answered 1.0 and
passed with the defect in place, which is the failure a dropped non-finite
reading does not cover. Sixty-four of them make each window some sixty
milliseconds, four ticks even there, and the fine-clocked platforms gain by it
too: a window of one pass needed a whole measurement discarded in front of it,
the way the speed gate does, and read the growth 3.10 to 4.56 over ten runs even
so, where a window of sixty-four is warm by its own fourth pass and reads 4.34
to 4.66 with no warm-up at all.

The second tier is for what a corpus of our own making cannot show at all.
`corpora.yml` runs nightly, cloning DocBook-XSL, TEI and DITA-OT **at pinned
commits** — a branch tip would drift under the numbers — restoring them
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

The budget is a **ratchet and not a licence**, which is the half that was
missing for as long as the tier has existed. Cut once when it was written and
then left behind by #755, #770, #776, #777, #783 and #784, the three stood 9, 14
and 18 times what they gated by the time #785 was filed, so nothing short of a
total collapse could have failed them — #755's own quadratic cost DocBook-XSL
44 s against a budget of 180 and would have passed it twice over. So
`scripts/budget.js` judges a reading from both sides, past the budget and
further than `SLACK` (four, as in `test/scaling.test.js` and for the same
reason) under it, and the step calls it rather than comparing two numbers of its
own — which `test/budget.test.js` asserts, a ratchet nobody has to route through
being one an inline comparison quietly replaces. What a budget answers to is a
measurement **on the runner**: a share cancels a machine's speed where a wall
clock carries it, so a developer machine cannot set this bar, and the notice each
run now prints is where the reading is read off. Six runs of it on the tree #784
left — one nightly, five dispatched — give 13, 14, 20, 13, 13 and 14 seconds
over DocBook-XSL, 9, 10, 11, 10, 10 and 8 over TEI, and 5, 4, 5, 4, 3 and 5 over
DITA-OT, so the runner disagrees with itself about one tree by half as much again
and the window has to hold a slow night as well as a fast one. The budgets are
twice the dearest of those — **40, 22 and 10** — which puts each budget's own
quarter at 10, 5.5 and 2.5 seconds and so leaves the ratchet firing **at 9, 5 and
2 and under**, the clock counting in whole seconds. Those three stand below the
13, 8 and 3 their corpora have given, which is the property a budget has to hold
and not merely a fact about these numbers: `CHEAPEST` in `test/budget.test.js`
asserts it, since a budget wide enough to fire on a night that has already
happened reddens a build on a tree nobody has touched — one tick past it, TEI at
33, turns that test red. Two of the three margins are thin and one is a tick.
DITA-OT stands near the clock's own edge, three to five seconds where a tick is a
fifth of the reading, so it is the corpus whose ratchet speaks first; TEI's
cheapest fell from 9 to 8 in the sixth of those runs, which is the same thinness
one corpus up. Answering either costs one number.

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
      namespace, result-namespace, imports, parameter, element,
      root-template              — the DOM, not one expression
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
the same field. What pins it is a run over twenty stylesheets whose reader stays
paused until stderr says how many defects were found, counting the report's
lines against that number. The package `main` re-exports `lint` and
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
  Nor may it name an element by its **prefix**: `name()` answers the lexical
  QName, so `name() = 'xsl:variable'` is a question about how one document spells
  the XSLT namespace and not about XSLT at all. Write the node test —
  `//(xsl:variable | xsl:template)`, whose prefix XPath binds for us — never
  `//*[name() = ...]`. Both directions were live in the tree: TEI's
  `rdf/make-acdc.xsl` writes its XSLT as `XSL:` and binds lowercase `xsl:` to
  something else, so eight checks read none of it, and a literal result element
  whose `xsl:` is bound elsewhere drew all eight. This is
  machine-enforced by `test/conformance.test.js` over every selector of every
  kind. `local-name()` is not banned with it — it asks nothing about a prefix,
  and `text-outside-xsl-text` needs a negated set no union of node tests can
  spell — but a union is the shorter reading wherever the list is closed (#784).
  And a selector that opens `//name` or `//(name | name)` is served from the
  shared walk rather than by a descendant step of its own, so how a selector
  opens decides what it costs: the axis comes off `named` in `src/tree.js` and
  only the predicates reach fontoxpath. A **union** of such paths is served the
  same way since #811, each branch carrying an axis and a tail of its own and
  the survivors merged by rank, since XPath answers a union in document order
  over both sides at once — so `//xsl:when[…] | //xsl:otherwise[…]` is two
  buckets the walk holds rather than two descendant sweeps the engine pays for. A wildcard, a root
  anchor, or a predicate that could answer a number — picking one node out of
  the sequence rather than filtering it — cannot be served, and a selector
  spelling one of those goes on `UNINDEXED` in `test/conformance.test.js`
  beside the shape that keeps it out — which is enforced from both sides, so
  neither a selector that could be served and is listed nor one that is served
  and unlisted survives (#784). An attribute axis is served since #811, both
  `//@*` and one named attribute of named elements, so it is no longer a reason
  to be on that list; a cross-file check answers to a gate with no list at all,
  every one of its selectors being served and a fifth belonging in that shape
  too.
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
  (#553). Every entry is **asserted** rather than merely skipped — the fixture
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

| File | Role |
| --- | --- |
| `src/xslint.js` | Orchestrates discovery, config, staging, output; exports the pure `lint` (package `main`), `fixed`, and `STAGES` — every linter the pipeline runs, named by its module and paired with what it is handed, derived from `LINTERS`/`EXPRESSION_LINTERS` rather than written out beside them so the speed gate cannot be measuring a list the run has moved on from |
| `src/config.js` | Resolves `.xslint.yml` (severities/`off`, excludes, `max-warnings`) |
| `src/directives.js` | Parses inline `xslint-disable-*` comment directives |
| `src/reporters.js` | `reporterOf(format)` — `text`, `json`, `sarif`, or `github` output |
| `src/validators/xsl-validator.js` | Builds the corpus; reports each non-well-formed stylesheet |
| `src/validators/xpath-validator.js` | Splits the corpus's expressions into valid (kept) and malformed (reported), asking `parseOf` about each record `expressionsOf` yields — the same derivation the code-based linters read, rather than a walk of its own over a list of attribute *names* got by subtracting the pattern-holding ones from `ATTRIBUTES`. That subtraction reached 286 of this repository's 453 expressions, so a `match` no grammar accepts, a `{1 +}` in an attribute value template, a 3.0 text value template and a shadow attribute were validated by nothing at all, while the code-based linters — staged over the whole corpus — read those same expressions and reported what they found in them, with only `defect`'s parse gate keeping a fix off it (#589). One expression stayed outside both readings until #654, the derivation itself having missed it: the `xsl:use-when` of a literal result element, which is a static expression a processor evaluates before it transforms anything and the only spelling of that attribute a simplified stylesheet has. What it keeps is what all thirteen expression linters are staged over since #750, so a refusal reported here is the only defect that fault draws. A pattern illegal before XSLT 3.0 comes with it, which is #631: `matched` has refused one since #723 and had nobody to say so. The defect goes through `defect` in `src/checks.js` rather than being built by hand, so it stands at the offset the refusal carries instead of at the attribute's opening quote — which the widening makes necessary rather than merely nicer, two braces of one attribute value being two expressions that would otherwise report one column |
| `src/linters/xpath-linter.js` | Loads `checks/xpath/*.yaml`; attaches any `src/fixers.js` fix, unless the node — or the element carrying it — holds an expression the grammar refuses (#651). The element is listed because a rule selects it while its fixer reaches sideways for an attribute no gate can read; its own attributes are listed with it because a rule may select the attribute instead, which is what `starts-with-double-slash` did until #586 took it to code, so nothing declarative selects one today and that half of the set stands for the shape rather than for a rule the tree still holds. It is the dearest stage there is, 42% to 53% of a run over the three corpora — 46% to 58% before #811's union phase, which is the first of those moves to have made the stage itself cheaper rather than the denominator smaller, 39% to 44% after #784, and 49% to 55% before that, all of them read the same way, as processor time over the whole staged run with both validators in the divisor: read against the linters alone this stage is 61% to 72% of them, a number that belongs beside none of the others, and what makes it dear is the **breadth of a step** rather than the number of checks: fontoxpath evaluates a descendant step over an xmldom tree quadratically (#635), so a `//*` or a `//xsl:*` pays for every element in the document and then filters, where a `//(xsl:variable \| xsl:template)` pays for the two names. Eight selectors were written the broad way and are narrowed at #784 — `xpath-linter` falls from 7.52 to 6.11 seconds over DocBook-XSL, 6.20 to 4.90 over TEI and 2.33 to 1.82 over DITA-OT, taking the whole run down 13% to 15%. Three of the eight are a *correctness* fix in the same edit, which is why the narrowing is not merely a refactoring: `name()` answers the lexical QName, so `//*[name() = 'xsl:variable']` asks how one document happens to spell the XSLT namespace rather than anything about XSLT. TEI's `rdf/make-acdc.xsl` writes its XSLT as `XSL:` and binds lowercase `xsl:` to a `TransformAlias`, and `short-names` reports a template there that master reads past — the false negative, one defect over the three corpora with none withdrawn. The false positive is the same fault mirrored, an aliased `xsl:` on a literal result element drawing a check about XSLT, and it is pinned by a pack rather than by a corpus: no committed stylesheet spells it, which is what let the shape survive. The other five ask no question about a prefix and are narrowed alone — three of them by anchoring on the attribute the check is really about, `//@select[...]/..` in place of `//*[...@select...]`, and one by folding two descendant walks into one parent test. What the ticket proposed instead was a precondition per check — skip a (document, check) pair whose name the document does not hold — and that measures **4.5%**, not the 54.7% it is aimed at, because the pairs a precondition can skip are the cheapest pairs there are: proving `//xsl:sort` empty on a document holding no sort is nearly free, and the cost was never in the checks that find nothing. What was left of the ticket after that change was one selector evaluation per check per document — 38 of them, 35 holding a descendant step — and the answer is the walk `src/tree.js` already remembers, not a precondition in front of each. `splitOf` in `src/selectors.js` parts a selector into the names a bucketed walk can serve and the tail the engine must still answer, so 24 of the 38 take their axis off one native pass and pay fontoxpath for a predicate over the candidates alone — 27 since #811 served a union of them. `xpath-linter` falls from 5.64 to 3.64 seconds over DocBook-XSL, 4.63 to 2.82 over TEI and 1.97 to 1.32 over DITA-OT — 35%, 39% and 33%, the lowest of three interleaved rounds a side — taking the staged run down 20%, 21% and 16%, and the report is byte-identical on all three, at 3843, 5716 and 1266 defects. What the uniformity costs is one wrapper per candidate: a tail is asked as `self::node()` followed by the selector's own predicates, which is 0.05 s over DocBook-XSL against asking each predicate bare, the lowest of seven interleaved rounds a side, and it is kept because one shape for every tail is worth more than a special case per selector. The eleven it cannot serve are listed in `UNINDEXED` in `test/conformance.test.js`, each beside the shape that keeps it out, and that gate turns red from both sides: a selector that becomes servable and stays listed fails as loudly as one that stops being served. What those fifteen still spent when that was measured is 2.78 of the stage's 3.64 seconds over DocBook-XSL, and a reason on that list is not a statement about cost: nine of them are root-anchored, which keeps them out because a root step is no descendant sweep, yet six of those nine descend below the anchor and the dearest selector left is one of them — `modern-construct-in-xslt-1` at 0.60 s, whose union ends in an `xsl:*[@as]`. So what a richer index takes next is drawn by cost rather than by the shape that excluded it. Swapping the DOM underneath was measured instead and refused: slimdom, fontoxpath's own development dependency, answers `//*` over DocBook-XSL in 0.271 s where xmldom takes 0.869 and the native walk of those 69,842 elements takes 0.011 to 0.020, so it buys a quarter of a traversal and leaves the rest — and it parses 283 of the 315 stylesheets where xmldom parses 297, which is a different report rather than a faster one |
| `src/linters/parameter-linter.js` | `unused-function-template-parameter`, the first check to leave `checks/xpath/` for code (#776). Its selector asked `not(some $x in ..//(node() \| @*) satisfies contains($x, concat('$', @name)))` — one descendant step per *parameter*, and fontoxpath evaluates one of those over an xmldom tree quadratically, which is #635's cost re-entered once per parameter and never reaching the walk `src/tree.js` remembers. So a template cost its parameter count times the square of its body: 3.54, 3.82 and 4.27 per doubling of the body at five parameters, 2.05 to 2.20 per doubling of the parameters against a 400-element body, 6.6 seconds for one template of 1600 elements. It was the single most expensive thing in a run, 2.82 s of DocBook-XSL's 11.0 s of per-file checking, and it is 0.08 s here — one walk per holder rather than one per parameter, which is `walked` filtered for the `@name` of an `xsl:param` whose parent takes one. What the substring could not ask is what a *reference* is, and the tree closes four blind spots the selector had: `$name` is not a use of `$n`, though it holds those characters; a `'$quoted'` is a string literal, which XPath evaluates to text; the output text of a literal result element is characters bound for the result tree; and a name inside an XML comment is a reference somebody switched off, which is the commonest of the four in real code — 15 of the 19 new defects over the three corpora, against 4 of the prefix class (`$row` silenced by `$rownum`, `$minimal` by `$minimalCrossRef`, `$force` by `$forcePageMaster`, `$prefix` by `$prefixTokens`), and nothing at all withdrawn. It is a *document* linter rather than an expression one for a reason worth keeping: it reports a **declaration**, an element no expression names, and a stylesheet holding no expression at all still declares parameters — staged over what the validator kept, such a file would contribute no record and its dead parameters would go unreported. So it reaches `expressionsOf` itself, and an expression the grammar refuses is the one place the substring survives: what such text references cannot be read, and staying quiet about a name whose characters stand in it beats inventing an unused parameter on a file the same run already reports for its syntax |
| `src/linters/element-linter.js` | `not-creating-element-correctly`, one of the five checks #788 took off the declarative kind (#558). What makes an `xsl:element`'s name dynamic is an attribute value template and nothing else, which is `expressionsOf`'s answer rather than a substring's: the selector read a `$`, a bracket pair and a brace pair out of the value, so a `name="$wanted"` counted as dynamic where XSLT evaluates nothing there — the dollar is part of the name the element is given — while the AVT it did catch it caught by two characters rather than by holding an expression, so a constant `name="{'div'}"` went unreported. It reads the `@name` of every `xsl:element` off the one walk `src/tree.js` remembers, never a descendant step of its own (#635). Two static names keep the instruction. One whose prefix binds to the XSLT namespace has no literal form at all: `<xsl:element name="xsl:template"/>` writes an element into the result tree where `<xsl:template>` is an instruction the processor runs, so the advice would turn a stylesheet that emits into one that declares — and it is the namespace the prefix resolves to that answers, never the prefix, a document binding `xsl:` where it pleases. The other carries a `namespace` attribute, which names a namespace outright where a literal result element takes its own from the prefixes in scope |
| `src/linters/root-template-linter.js` | `null-output-from-stylesheet` and `output-method-xml`, the two checks that ask which template is the *root* one — `starts-with(@match, '/')` until #788, where every absolute pattern begins that way. So a `match="/alpha"`, a template for an `alpha` element standing at a document's root, was read as the root template and told that it "contains only variable declarations", which is advice about a template the stylesheet does not have; this repository's own motive rule names that error. The pattern grammar answers it now: a pattern is a union of branches and the root is the branch holding no step at all, so `match="/"` is one and `match="alpha \| /"` is one, where `match="/alpha"` and `match="document-node()"` are not. A template writes nothing when every element it holds is an `xsl:variable` and every text node of it is blank — a CDATA section being one kind of text and not a construct of its own, which is what a `text()` step says too. The `xsl:output` the second check reports is taken from the stylesheet's own children, XSLT reading a declaration nowhere else, and its fix rewrites the value alone through `substitution`. What makes the result HTML is the **outermost** element the template builds and not an `html` anywhere under it, which is #495: an XML document may embed an HTML fragment and stay XML — an Atom entry's `content`, an XHTML island — so a check reading any descendant told a valid feed to serialize itself as HTML and `--fix-suggestions` rewrote the `method` to match, which emits unclosed tags and no XML declaration. Outermost means every element up to the template is an XSLT instruction that passes its content through, which is every one of them but the eleven in `DIVERTED` — three binding a value (`xsl:variable`, `xsl:param`, `xsl:with-param`), `xsl:element` building the wrapper its content becomes children of, three reducing it to a string (`xsl:attribute`, `xsl:comment`, `xsl:processing-instruction`), `xsl:message` writing to the message stream, `xsl:result-document` opening a secondary document with a serialization of its own, and `xsl:map-entry` and `xsl:array-member` building a map's value or an array's member, which is a value and not a node the element above it holds. Their containers are outside the list and the asymmetry is deliberate: an `xsl:map` holds a sequence of maps and an `xsl:array` a sequence of arrays, so an `html` directly inside one is invalid XSLT rather than output standing anywhere — that last being the one with teeth, since a stylesheet already declaring `method="html"` there drew the warning against its *primary* output and the fix would have rewritten that. The list is named for the rule rather than enumerated to fit it, which is what the first spelling did: `BOUND`, two names and a docblock about binding, left four shapes reporting that its own sentence excluded. What keeps it honest is a gate rather than the reviewer who found that, since the second round of the same defect was the packs and not the list — four names sat behind a `<report>` literal result element, which makes an `html` non-outermost whatever the list holds, so dropping all four left every test green, and `param` was asserted by nothing at all, inherited from the two-name spelling. A pack's zero has to come from the name under test: `test/root-template-linter.test.js` walks each `html` in each pack up to its template and refuses a name that no pack leaves standing **alone** above one, so a name masked by a wrapper or added without a shape of its own turns red — which is #645's shape, a fixture whose zero another mechanism produces reading exactly like one that passed. xsltproc settles the eight of them XSLT 1.0 has by showing what each builds — an `html` under `xsl:element` comes out `<wrapper><html/></wrapper>` and one under `xsl:message` never comes out at all — and `xsl:copy` is deliberately absent, copying the *document node* being transparent, so under a root template an `html` inside one really is the document element and xsltproc answers `<html><body/></html>`. The namespace decides the other half: an `html` a document puts in the XHTML namespace is XHTML, which serializes as `xml` in 1.0 and `xhtml` from 2.0 and never as the `html` this check recommends, so it is left alone rather than given advice its version cannot take — the false negative #495 names beside the false positive, which wants a check of its own rather than the wrong half of this one |
| `src/linters/corpus-linter.js` | Loads `checks/corpus/*.yaml`; cross-file rules. A cross-file check asks one question of every declaration against every usage, so both sides grow with the project and the work is their product; three things made that product far dearer than it is. A usage selector is now evaluated once for each corpus and xpath (`across`) rather than once for each check naming it — three of the four checks give `//@*`, and choosing every attribute of DocBook-XSL's 291 stylesheets costs 1.7 seconds, so the run spent five answering one question three times over. A reference string was built once for each declaration rather than once per pair, and the usages holding it scanned once for each *distinct* reference, DocBook-XSL declaring 3436 variables under 1207 names; and the cheap test led, `within` climbing to the document root for every pair it rejects where one `includes` rejects almost every pair. Together those took the four checks from 35.0 to 10.2 seconds over that corpus and the whole run from 40.2 to 29.8 (#755). What they left standing was the product itself, the scan still being every distinct name against every usage — 1207 against 72,077 attributes, 87 million substring tests, and 98% of what the stage spent, `unused-variable` alone accounting for 13.58 of its 13.81 seconds of scanning. The index is what retires it (#783). `referencing` reads each usage value once for a template and yields the names it *references*; `indexed` maps each name to the usages holding it, once for a usage set and template; and a declaration is a `Map.get` rather than a scan. `corpus-linter` falls from 8.52 to 2.20 seconds over DocBook-XSL, 6.26 to 1.21 over TEI and 1.37 to 0.56 over DITA-OT, taking the staged run from 17.54 to 11.13, 14.33 to 9.34 and 4.48 to 3.62, and the stage from half the run to a fifth of it. Speed is the smaller half. A substring is not a reference: `includes('$row')` is answered by `$rownum`, which is #776's defect on the other side of the same product, so the fix and the speed-up are one edit and the report is not byte-identical — four declarations that were silenced by a longer name holding their characters are reported, `$page` behind `$pageid` and `$target` behind `$targets` in DocBook-XSL, `$v` behind `$values` and `$Heading` behind `$Heading1` in TEI, with none removed. A name is the run of characters `NAMED` in `src/tokens.js` spells one with, borrowed rather than a second opinion about what a name character is. What that costs is a shape, which `anchoring` reads once for a template rather than once per usage value and refuses where it is wrong: the index finds the template's fixed text and takes the name from the side that text stands on, so **exactly one** end may carry it. `${name}` and `{name}(` are the two spellings, and both a bare `{name}` and an `a{name}b` are errors rather than checks that half work. Neither half is theoretical. Text at both ends leaves the far side unmatched, so a declaration something uses is reported dead; text at neither leaves the mark empty, and `indexOf` finds that at every offset and answers the *length* rather than -1 once asked past the end, so the scan never advances and the whole run hangs before it reports anything. `test/conformance.test.js` holds every check to the same shape, which is the line that would have caught it — the first spelling of that gate asked only that the template start or end with `{name}`, which a bare `{name}` satisfies twice over, so the one shape that hangs was the one shape the gate admitted. What #783 left standing was the traversal itself, this being the one stage that reached the engine directly: three of its four checks give `//@*` and the fourth `//xsl:call-template/@name`, and neither is an axis a bucket of elements can hold. It goes through `chosen` and `valued` in `src/selectors.js` since #811, which serves both of those and its three element declarations besides, so the stage falls from 2.26 s to 0.11 s over DocBook-XSL, 1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT — a tenth to a twentieth of what it cost, taking the staged run down 25%, 17% and 11% with the report byte-identical on all three. Half a run was this stage over DocBook-XSL when #755 was filed and it is 1.5% to 2.3% of one now, which is why its entry in `SHARES` is gone rather than re-derived |
| `src/linters/bare-name-linter.js` | `confusing-variable-and-node`, the head step of a path whose node test is a bare name a variable in scope has already taken — `<xsl:apply-templates select="items"/>` under an `$items` — which the tree answers and the front of an attribute's text cannot. `starts-with(@select, concat($var/@name, '/'))` read the value's first characters, so the same name behind a gap, under a predicate, or in any branch of a union but the first went unreported, and what it did read it read as characters: an `@title` and a `child::title` hold them and test nothing of the kind. Only a head is confusable, a step deeper in a path being a child of whatever stands in front of it and reading as nothing else. Scope is the nearest ancestor template and the variables declared in front of the element, which is what the selector's `$var << .` said (#788) |
| `src/linters/*-linter.js` | Code-based `checks/format/*.yaml`, one construct each (axis, namespace, count, name, ...); see the flow diagram. Ten of the thirteen read the tree rather than the expression's text, which is what Phase 4 of #644 is moving all of them onto: `count-compared-to-zero` and `string-length-compared-to-zero` through `src/comparisons.js` (#577); `predicate-position-literal`, which walks the `predicate` nodes the grammar built rather than matching brackets and reducing what stands between them to one character per token (#575); and `redundant-boolean-call` and `redundant-double-negation` through `src/booleans.js`, which answers where a truth is all that is taken (#561, #596); and `name-compared-to-string` and `translate-for-case`, which read what a literal *holds* rather than how it is quoted (#598, #562); and `starts-with-double-slash` with `use-double-slash`, the pair a selector could not tell apart (#490, #586); and `use-node-set-extension`, where the extension is the function two namespaces declare and not a local name behind any prefix at all (#557). The tenth arrived at #788 and has a row of its own above, `confusing-variable-and-node`, which reads the head step of a path where a substring read the front of an attribute. That last one had a false positive and a false negative of its own and one shape underneath both: `[\w.-]+:node-set` took the local name as the whole of the question, so `my:node-set($v)` drew advice to drop a call to somebody's own function while the inline `Q{http://exslt.org/common}node-set($v)` drew nothing, and `msxsl:node-set` was right by accident rather than because the URI says so. It also scanned `@select` alone, so the same wrapper in a `@test` was invisible, and the braces of an attribute value template with it — where a processor evaluates the expression whatever element carries the attribute, the whole `select` of a literal result element being the only one that is output text. And it read a call's arity by counting commas, so `exsl:node-set()` was unwrapped into nothing: `select="/alpha"`, a **safe**-tier fix writing the expression the next run reports, which is #576's family exactly. What it writes keeps the brackets the call supplied where the argument binds looser than a step, which is `STEPPED` in `src/syntax.js` and the last unwrapper to get a precedence answer of its own (#774). Those two are one blind spot twice over: a regular expression naming `'([^']*)'` cannot see `"x"`, and an attribute value already standing in double quotes is written the other way round, so half the spellings of each construct went unreported. The tree closes four more gaps their tickets do not name — the value comparison, blind on `name() eq 'x'` as #763 was blind on `count(x) eq 0`; the prefixed and inline spellings of both standard calls, where `[^\w:.-]` refused `fn:name()` outright and read `Q{urn:mine}translate(...)` as the bare call; a binding clause inside one argument, whose depth-zero commas made a three-argument `translate` read as four; and a name no ASCII class spells, `qualified` in `src/tokens.js` answering that where a `NAME` regular expression of the linter's own refused `name() = 'é'` a `self::é` step says perfectly well. The two of those are one pair rather than two migrations: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`, so migrating one alone would have `--fix` write the very defect the other reports next. What a text scan cannot answer for either is what a place *is* — `not(boolean(@x))` is a question about the node above, and a prefixed `fn:not(fn:not(@x))` one about a namespace — and the overlap of a run of them: a scan matching the character in front of a call consumed it, so `not(not(not(not(@deep))))` drew two defects rather than three. Three things follow from `predicate-position-literal`'s own migration, and are about a predicate rather than about a truth. A predicate is judged by what its one child *is*, so `[position() = 1 and @on]` holds a comparison and is not one — an `and` is what the predicate holds, and rewriting the comparison inside it would turn a positional test into the boolean `[1 and @on]`. The operand that survives keeps the spelling its author gave it, so a `fn:last()` stays prefixed, where a signature reading `TOKENS.NAME` alone never saw a prefixed call and left the predicate unreported. And the defect stands where its comparison does rather than just inside the `[`, so a padded `[ position() = 1 ]` is reported at the `p` and the fix replaces the comparison alone, leaving the author's gaps where they were. The double slash trio is one construct read three ways, and two of the questions it asks are ones a selector had no way to put. What a `//` *is*: `contains(@match, '//')` counted the one in `match="alpha[@url = 'http://example.com']"`, where the lexer gives a string literal, a comment and an inline `Q{...}` one token each and not one of them holds a separator (#490). And where one *stands*: the checks split the work by whether the slashes led the string, which holds only while the pattern is one branch, since a branch of a union is matched unanchored exactly as the whole pattern is. So the `//` of `match="alpha \| //beta"` is the first check's redundancy and drew the second's advice instead, with no fix behind it — while the `//` of `mu[nu \| //xi]` opens no branch, a predicate holding an expression rather than a pattern, and stays the broad step it is. A `branch` node with nothing of its own to the left of the `//` is the whole of the test, so a bracketed branch counts and 3.0 admits one anywhere in a path. Two more things came with the kind. The fix cuts the two characters where they stand rather than rewriting the value around them, so it no longer overlaps `redundant-whitespace` on a `match=" //spaced"` and both land in one run, and every branch of `match="alpha \| //beta \| //gamma"` loses its own where one whole-value substitution could only ever drop the first (#571). And the pair reads every attribute holding a pattern — `PATTERNS`' five names, standing in seven places over five elements — rather than `xsl:template/@match` alone, so an `xsl:key` matching `gamma//delta` is reported at last. The third check is the same shape one attribute over: `select-starts-with-double-slash` was declarative and selected `//*`, so it read the `select` of a literal result element as XPath — output data no processor evaluates — and `--fix-suggestions` wrote `.//` into the result tree, a check about expressions changing what a stylesheet emits (#788). It is handed the records the validator kept, which hold no such attribute, and the `//` it reports is the first token of the parse rather than the first characters of a value, so a comment or a gap standing in front of one no longer hides it |
| `src/checks.js` | Shared for code-based linters: `metaOf`, `suppressed`, `defect(check, meta, source, found, offset, fix)` — takes the expression whole, as `expressionsOf` yields it, and adds its `start` to the offset itself (#648); walks the raw text so a wrapped or entity-shifted value reports where it truly stands (#611). It asks nothing about whether the expression parses: that gate stood here from #636 until #750 staged every code-based linter over the expressions the validator kept, which left it a condition no call could fail — a rule every caller has to remember is worse than a stage that cannot break it. That walk is `rawly(source, found, offset)`, exported beside it, because a linter needs the raw offset as much as a defect does: an attribute value arrives with its line endings normalised to spaces, so a check reasoning about whitespace cannot see a wrap in the value it holds and has to ask the source (#628) |
| `src/source.js` | Raw-text walking shared by `checks` and `fixer`: `offsetAt`, `placeAt`, `character`, `skip` |
| `src/selectors.js` | `splitOf(xpath)` — a declarative selector parted into the **names** a shared walk can serve as its axis and the **tail** the engine must still answer, or no names at all where it can serve nothing (#784). One shape is split, `//name` or `//(name \| name)` with predicates behind it, because that is the shape a walk bucketed by name answers exactly: a wildcard names no one bucket, an attribute axis yields no element, and a selector anchored at the root is not a descendant sweep at all. Two refusals are worth knowing. A **positional** predicate cannot be split, `//x[1]` and `//x[last()]` asking about the sequence the descendant step produced where a candidate tested on its own is a sequence of one. Which predicates those are is `filters` in `src/syntax.js`, read off the **parse** and never off the text, because a number wears more spellings than a digit: `[2 - 1]`, `[1.0]`, `[- 1]`, `[number("2")]` and `[count(@name)]` pick a position exactly as `[1]` does, and a scan for a digit catches the last of them alone. A predicate is served only where the parse proves it cannot be a number, which a kind alone cannot say of two of them: a `call` is its name, `not(@a)` and `count(@a)` coming back alike, and a **path** is its last step, XPath 2.0 letting one end in a call that answers an atomic value — so `[a/count(.)]` picks the first candidate where `[a/b]` filters, and reading the kind alone served eight such spellings. Each top-level predicate is asked separately too, so `//x[1][@a]` and `//x[@a][1]` are refused as much as `//x[1]` — while a `[1]` nested inside a path of its own is left alone, the predicate of an `ancestor::xsl:template[1]` being about that path and not this one. And a prefix the run does not bind is refused rather than guessed, `namespaced` reading `PREFIXES` from `src/xpath.js` so a bucket means by `xsl:` exactly what the predicate beside it will mean. The bracket scan walks characters rather than matching a regular expression, because a predicate may hold a bracket inside a string literal: `contains(@match, '[')` is one predicate holding one, and counting brackets would part the selector inside the literal. Two more shapes are served since #811, both of them an **attribute** axis: `//@*`, which `attributed` in `src/tree.js` answers whole, and one named attribute of named elements, taken off each element a bucket yielded. A wildcard behind an element name is refused with the rest, no selector spelling one and the order an element's attributes come in being a question the walk answers for a document rather than for one element; an unprefixed attribute is not, standing in no namespace by XPath's own rule where an unprefixed *element* name is a refusal. Beside `splitOf` stand the two doors onto the served answer, `chosen(xsl, xpath)` and `valued(xsl, xpath)` — the second for a usage read as strings, an attribute's string value being the value it holds. They live here rather than in a linter because both the per-file and the cross-file kind ask them and no linter may import another. The engine is asked inside the branch that needs it rather than as the binding's initial value, though a value that branches is initialised to its fallback everywhere else in this project: the fallback here is the very traversal being avoided, so spelling it that way asked fontoxpath for every served selector as well and then dropped the answer — `xpath-linter` read 50.78% of its run against master's 31.64% before that was seen, the whole saving spent twice over. A selector is a **union of branches** since #811's second phase, each branch an axis and a tail of its own: `branched` parts one at a `\|` standing at depth zero — never inside brackets, where it parts the names of one axis, nor inside a literal, where `contains(@match, '\|')` holds one as a character — and `merged` puts the survivors of every branch back into document order by the rank `named` remembers, deduplicated, both of those being what XPath's own `\|` answers rather than a convenience. Appending branch to branch would report every `xsl:otherwise` after every `xsl:when`, which is the defect two buckets of *one* axis had before #784 merged them this way. A union is served whole or not at all, a branch left to the engine needing the two answers merged across a sequence one side never enumerated; and a union of **attribute** axes is refused for a reason of another kind — the merge orders by a rank the walk keeps for elements, an attribute having none, so `(//@version \| //@xsl:version)`, the one selector spelling it, stays with the engine while one branch carrying an attribute is served as it always was |
| `src/attributes.js` | `expressionsOf(xsl)` — every expression a stylesheet carries: a bare/AVT attribute, a 3.0 text value template, or a shadow attribute, each saying whether it is a `pattern`; `PATTERNS` names the five attributes that hold one; and `whole(found, name)` for a linter that narrows to one attribute out of the records it is handed. That helper replaced `selectorOf`, an XPath of this module's own over every XSLT element's attribute of a name, and `wholeOf`, which built a record from the node it selected — both of them the shape a linter needed while it scanned the corpus itself (#750). It asks two things in one call because a linter taking the name alone would read the `test="{boolean(x)}"` of a literal result element, which the old selector's namespace test excluded: an attribute's whole value is a record starting at `0`, and a template's expression never does, a brace standing at least one character in. The name it is asked for is the unprefixed one and an attribute in the XSLT namespace answers to it, `use-when` naming the `xsl:use-when` a literal result element carries as much as the bare attribute of an XSLT element — the two being one attribute XSLT spells twice, and the second spelling the only one a simplified stylesheet has (#654). `wholly` is the same fork one level down, deciding which attributes hold a bare XPath at all: unprefixed on an XSLT element, or any name `ATTRIBUTES` holds under the XSLT namespace anywhere. That second half is `xsl:use-when` in every stylesheet a processor loads, and the rest of its reach is an attribute no version permits — so what a widened list costs is a second report on a file already refused, not a defect against working code, which is why the fork is on the namespace rather than on a list of permitted names kept in step with XSLT by hand |
| `src/xsl-version.js` | `versionOf(node)` — the version in force at a node, from the nearest ancestor's `@version` (XSLT element) or `@xsl:version` (literal result element), canonicalised as a decimal, walking up from the element `src/tree.js`'s `holding` answers; `since(version, floor)` for a lower-bound gate; shared `MODERN`/`KNOWN`/`DECIMAL` |
| `src/tree.js` | `walked(xsl)` — every attribute, text node and CDATA section of a document in document order, walked once and remembered against it, because fontoxpath evaluates a descendant step over an xmldom tree quadratically (#635). Beside it `holding(node)` answers which element a node hangs off — an attribute the element carrying it, a text node its parent, a document its root — which is where anything a stylesheet's *structure* says about a node is read: the version in force there, and the namespace a prefix inside an expression resolves to. It lived in `src/xsl-version.js` while the version was the only such question; the second one is #577's, and xmldom's own `lookupNamespaceURI` answers null on an attribute rather than walking to its element, so both callers need the same answer rather than each reaching for an element its own way. Beside them `named(xsl)` answers that walk asked a different way: every element of the document in one pass, bucketed by `namespaceURI` and `localName`, with the document-order rank of each — which is what lets a declarative check take its **axis** off the walk instead of having fontoxpath descend the tree once per check (#784). One walk over 66,008 elements costs 11 to 20 ms where one fontoxpath `//*` over the same tree costs 817 to 1003, so the 43 selectors needing a descendant step were paying for 43 traversals of a corpus the run had already walked. The rank is what a union needs: `//(xsl:variable \| xsl:template)` is a path, XPath answers a path in document order, and nothing downstream sorts a defect list — so two buckets are merged by rank rather than concatenated, or every `xsl:template` defect would be reported after every `xsl:variable` one. `attributed(xsl)` is the third question over the same pass, every attribute of a document in document order: the sequence `//@*` selects, which three of the four cross-file checks are written in and which cost fontoxpath 1.613 s over DocBook-XSL — 18% of a whole run for one selector — where these 72,077 attributes come off the walk in 8 ms (#811). Correcting one thing made that possible: the walk sorted an element's attributes by **node** name and this row claimed that was the order the engine yields them in, which holds only until an attribute carries a prefix. fontoxpath sorts by **local** name, ties left as written, so a `table` written `summary border xml:id` comes back `border xml:id summary` where the whole name puts `summary` first — 37 files of the three corpora hold such an element, and with the comparator corrected the walk and the engine agree on all 152,296 attributes of them |
| `src/comparisons.js` | `comparedToZero(found, name, decide)` — the shared scan for a call compared with `0`/`1` (count, string-length), and the first check to read the tree rather than the text, which is Phase 4 of #644 opening. It walks the nodes `VALUED` names, which `src/syntax.js` hands over — two kinds and one question, where gathering the general comparison alone reported nothing at all on `count(x) eq 0` or `string-length(@x) eq 0` and so on the idiom half of any 2.0 stylesheet is written in, the scan underneath having matched `(!=\|<=\|>=\|=\|<\|>)` and no word at all (#763) — and asks three questions the regular expressions underneath it could only approximate. **What the operands are**: a digit compares against the call when it *is* the whole operand, which a tree says outright and a scan had to bound by hand — `$max + 1 > count(x)` was reported until #573 spelled the arithmetic out, and `count(x) > 0 + $n` with it. **What the call is**: the standard function of that name, told from a user function of the same local name by the URI the prefix resolves to rather than by the prefix, which a character class cannot do at all — `[^\w:.-]` refused every prefixed spelling and so missed the `fn:count` of any 2.0 stylesheet, while an inline `Q{urn:mine}count` walked straight through it, the `}` in front of the name being no letter (#577). **What the arguments are**: the nodes the parse separated, so a comma binding a `for` clause is no separator — `count(for $va in a, $vb in b return $va) = 0` is reported and fixed again, the gap `count-with-a-binding-clause` pins — `BINDINGS` in `test/expressions.test.js` pinned it while a check still counted commas, and went with `lone` at #596 — and a gap around one is no operator, `string-length( @x )` carrying the same lone operand the tight spelling does where a space read as a binary operator withheld the rewrite from it (#578). Three regular expressions and the `masked` blanking went with the text: a call standing inside a string literal is invisible because a literal is one node, not because anything blanked it |
| `src/booleans.js` | `coerced(found)` — every node of the record's tree standing where nothing but its effective boolean value is taken, each paired with whether an expression that binds loosely may stand there as it is; and `unwrapped`, the text that may replace such a node once only its argument's value carries over. The question `redundant-boolean-call` and `redundant-double-negation` share, and the reason they moved together: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`, so migrating one alone would have `--fix` write the defect the other reports next (#561, #596). The places it names are XSLT's own two, a whole `@test` and a whole `use-when` — SaxonJ-HE 12.5 includes a template whose `use-when` wraps its test in `boolean(...)` exactly as it includes the bare spelling, and excludes both `""` and `boolean("")` — and inside the expression XPath's: an operand of `and` or `or`, the argument of `fn:not` or `fn:boolean`, the condition of an `if`, the body of a `satisfies`. Neither attribute is version-gated, since below 2.0 a `use-when` is not XSLT's attribute at all and such a stylesheet is broken for a reason of its own; the `xsl:use-when` a literal result element spells instead is the same entry rather than a second one, `expressionsOf` yielding a record for either spelling since #654 and `whole` reading the local name of an attribute in the XSLT namespace, so the unprefixed name on the list answers for both and the prefix a document binds never comes into it. A bracket of the author's own inherits whichever of them it stands in, which is why the answer is walked from the root down rather than climbed to from a node: a span is a range of token indexes and the tree carries no parent. A predicate is deliberately not one, though it coerces: XPath reads a numeric predicate as a test on the context position, and SaxonJ-HE 12.5 answers `item[boolean(count(e))]` with both items of a two-item document where `item[count(e)]` answers the first alone, so what the wrapper hides there is the difference between a truth and a number. Nor is an operand of a comparison, which compares the values themselves. Only an `and`/`or` operand needs brackets round what arrives, everything else on the list standing inside brackets already or with nothing behind it, and `tight` answers that off `LOOSE` — one rung tighter than the operator it is asked about, so a comparison carried into an operand is bracketed where it need not be. That is one ladder borrowed rather than a second one kept in step with the grammar, and brackets nobody needs are noise where a missing pair is a rewrite that means something else |
| `src/expressions.js` | `enclosed` — the expressions an attribute value template holds in its braces, and since #557 the whole of what this module is for. `masked`, which blanks every kind `OPAQUE` names, is private to it now and `closes` is gone: six checks scanned above them and each is on the tree, #577 taking `comparedToZero` there, #575 the predicate scan, #596 and #561 the two negation checks, #598 and #562 the name and translate scans, and #557 the node-set one — where a literal is one node and nothing needs blanking to be read over. The module survives its last check because the brace scan is text work by nature rather than a scan that had not been migrated yet: an attribute value is not XPath, so where its expressions begin and end is a question about the value, and a `{` standing inside one of them is what `masked` is still blanking. `lone` went with the negation pair, the only readers it had left: it answered whether exactly one argument stood between a call's brackets by counting the commas at depth zero, which a parse answers by separating the arguments. Two things it could not do went with it. A binding clause puts its commas at depth zero inside *one* argument, so `not(not(for $va in a, $vb in b return $va))` went unreported — the gap `BINDINGS` pinned in `test/expressions.test.js` until the checks reading it came onto the tree, and a pack of each pins the construct now, the way `count-with-a-binding-clause` has since #577. And a bracket holding only a literal is not an empty bracket, which the masking hid: `count('abc')` blanked to a gap, so no emptiness test could tell an absent argument from a blanked one and the three checks fell silent on `count('abc') = 0`, `boolean('abc')` and `not(not('abc'))`. Arity stays a question each check asks by name — `fn:count`, `fn:not` and `fn:boolean` take exactly one argument in every version and `fn:string-length` none or one — and `children.length` over the parse is what answers it, where `count()` was reported as a count of a node-set and `not(not())` as a double negation, both carrying a **safe**-tier fix that plain `--fix` applied, so `test=""` was written and the next run reported the `invalid-xpath-expression` the last one had manufactured (#576). The parse gate in `defect` could not have supplied that: it withheld a fix only where the engine refused the expression, and fontoxpath's `compileXPathToJavaScript` resolves no signature, so every one of those calls is valid text to it. Nor can the engine be asked one call further — `evaluateXPath` does raise `XPST0017` statically, but against a registry that is not the XSLT one: 26 of 28 XSLT 3.0 functions and 14 of 29 XPath 3.1 ones are absent from it, `current()`, `key()` and `document()` among them, so a check reading that verdict would report the commonest calls in a 1.0 stylesheet as errors |
| `src/tokens.js` | Positioned XPath lexer (`tokenized`, `TOKENS`), preserving whitespace. A name is lexed whole and greedily as `TOKENS.NAME`, so the operator letters inside one stay part of it — `border` is one token, not `b`/`or`/`der` (#617, #249) — and a word is an operator only where the grammar lets one stand, which `operates` decides from the last token rather than from the spelling: the `or` of `a/or` is a node test, the `or` of `a or b` is not. `WORDS` and `SYMBOLS` are derived as complements of each other from the same operator maps. Every piece of punctuation carries a kind of its own too — `/`, `//`, `@`, `$`, `,`, `.`, `..`, a `::` no axis name claimed, and the operators XPath 3.1 added (`=>`, `:=`, `!`, `#`, `?`, and the braces and `:` of a map constructor) — so `TOKENS.OTHER` holds only what XPath has no token for at all, rather than the undivided run that lexed `a/@b` as one `other` and left nothing a recursive-descent grammar could be written against (#676, #685). The arrow was the sharper of the two, and the distinction is worth keeping: a *missing* kind lands in `OTHER`, where a reader knows it has met something it cannot name, but `=>` was absent from `DOUBLE` where `>=` already sat and so lexed as `=` then `>` — a stream read wrongly rather than not at all, `a => f()` arriving spelled exactly like `a = (> f())`. The node comparisons were that same absence one more time: `<<` and `>>` were missing from `DOUBLE` where `<=` and `>=` already sat, so `$a << $b` arrived as two `<` in a row, and `is` was missing from the word half beside `eq` and `or` (#724). One entry each is the whole of the lexer's share, since `WORDS` and `SYMBOLS` are derived from that map — `is` is an operator only where `operates` admits one, so the `is` of `foo/is` stays the node test it is, and `island` stays one name. Every entry is one word now: `instance of` is two with a gap between them, which a name scan cannot reach past, so the lexer carried a branch of its own to match it and every name it read had to ask whether a longer spelling stood there. The grammar reads that one by value instead, `instance` then `of`, exactly as it has always read `cast as`, `castable as` and `treat as` — which took `opensMore`, the `spelled` branch and the `INSTANCE_OF` kind out with it, and let `xs:integer? instance of x` be the expression every processor reads it as (#742). The word→kind lookup that is left is `worded`, exported for the grammar rather than spelled twice. A braced URI literal is one token too, for a different reason than an operator is: `Q{uri}local` is how XPath 3.0 writes a name's namespace inline, and `BracedURILiteral` is a *terminal* of the grammar, so the whole of `Q{…}` is lexed here rather than assembled above out of a name and two braces — which is what it arrived as, six tokens of which one was the `{` a map constructor opens with, so a production written against either had to reach inside the other's. A malformed one is not a kind of literal: the content is every character up to the closing brace with a brace itself excluded, so `Q{a{b}c` and one that never closes lex on as the `Q` and the brace they always were, and the grammar refuses what those tokens make rather than a new kind having to say so (#708). A literal that never closes is `TOKENS.UNCLOSED` and not a `STRING`, for that same reason: `'unclosed` came back as a finished literal, so the lexer supplied the quote its author never wrote and the grammar accepted an expression no processor parses (#708). A comment that never closes is `UNCLOSED` too, and it took one ticket longer to say so, in the function directly beside it: `afterComment` answered an offset alone and the caller kinded every run a finished comment, so `a (: b` came back as a step and a comment — and a comment is *trivia*, so the grammar read over the whole tail and had nothing left to object to, while the six scanners reading tokens saw nothing after the `(:` either. One mistyped `:)` and a file linted clean, `a (: note \| child::b` drawing neither the `invalid-xpath-expression` it earns nor the `unabbreviated-axis` that `a \| child::b` draws (#752). Both answer `{at, closed}` now, and an unfinished run of either kind is one `UNCLOSED`: opaque to every scan that must read over it, and outside `TRIVIA`, so the grammar meets a token it cannot name and refuses at the offset the quote or the `(:` stands at. Nothing follows such a token, either kind of unfinished run reaching the end of the input by construction, which is why the last-solid-token questions below are unaffected by its arriving solid. Which kinds carry no meaning to a grammar and every meaning to the source is `TRIVIA` — a gap and a comment — and it is one list for exactly the reason below, having been spelled four times over: as `TRIVIA` in `src/grammar.js`, as a `&&` chain inside `tokenized` deciding the last solid token, as a `filter` in `src/linters/predicate-position-linter.js`, and once more in `lone`. Its own `no-restricted-syntax` selector refuses a second copy, and it found that fourth one. Two readers are left, in `src/grammar.js` and in `src/syntax.js`'s `parting`: that linter reads no token at all since #575 took it onto the tree, where trivia is the grammar's business and a predicate arrives already knowing what it holds, and `lone` was deleted with the last two checks counting a call's arguments by hand (#596, #561). Which kinds a scan must read *over* rather than into is `OPAQUE` — string, unclosed and comment together — and it is one list because the two readers of that question, `masked` in `src/expressions.js` and `inside` in `src/linters/xpath-format-linter.js`, each spelled it out and so a kind added to one was a kind missing from the other: it was, and `redundant-double-negation` and `count-compared-to-zero` reported inside `select="'not(not(x))"`, on text nobody evaluates. A `no-restricted-syntax` selector refuses a second copy anywhere in `src/` but `src/tokens.js` itself, which is exempted by filename rather than by naming every kind: an array or a `&&`/`\|\|` chain mentioning `TOKENS.STRING` beside `TOKENS.COMMENT` is the list spelled out again, whether or not it happens to be complete today. Both readers spelled it as a chain, not an array, so a selector reading `ArrayExpression` alone would have matched a shape this repository has never held and passed the two it did. Which kind each of the thirteen axes is lexed as is `AXIS_KINDS`, derived from the axis map and exported for `test/strictness.js`, which reads a spaced separator off it rather than writing the thirteen down again. Which of them ends a value is `ENDS`, so `operates` reads kinds alone: `.`, `..` and a constructor's `}` end one, and the `or` of `. or x` is therefore an operator. A colon runs a name on only where an NCName can start behind it, which is `joins`, and that one rule is every question the lexer had about a colon. It ends a name at a `::` with no clause of its own, a colon opening no NCName either: reading them as name characters is how `a::b` arrived as the single token `a::b` while `a ::b` arrived as three, one grammar read two ways by a gap, with the separator nowhere in the first for a parser to object to — six invalid expressions parsed as a plain step until it was fixed (#703). And it ends one at the `:` of a map entry for that same reason, a space and a digit opening no name, where taking every colon on sight swallowed the separator into the key in front of it: `map{a: 1}` came back with `a:` as one name and `map{a:1}` with the whole of `a:1`, so ten of fourteen key spellings were refused where fontoxpath and Saxon-HE 12.5 both accept them — the glued form every real map is written in, while the spaced `map{a : 1}` parsed all along (#746). A separator ends a name and settles what may follow it: the grammar admits a NodeTest there and nothing else, so a name behind one is the element it names however it is spelled, and `child::child::b` and `child:: child::b` arrive as one stream rather than two told apart by a space (#709). That question is about what precedes rather than about characters, so it is `operates`'s question and answered beside it: both are handed the last *solid* token, which `tokenized` carries forward as it pushes. Only one of the two cares whether a gap stood there, and the claim that neither did was wrong: XPath makes whitespace or a comment stand between two terminals that cannot delimit each other, so `1div 2` and `1eq 2` are syntax errors where `1 div 2` and `1(: c :)div 2` are not, and `operates` takes that as its second argument. `GLUES` names the near side of the pair — a number, and a name for completeness, since a word run against one is absorbed into it and `adiv` arrives as the single name it spells — and it is the *only* place a gap decides what an expression is made of rather than merely how it is written, which is why `separates` still reads the token alone (#742). Handed the token and not the list, because this one is asked of *every* token where `operates` is asked only of a word — deriving the last solid token by filtering the whole list each time turned the lexer quadratic in allocations, 3.4x on a 200-step expression, which is the shape #687 and #689 were each a ticket about. The character walk in `opensAxis` had been answering it by accident, asking `spelling` whether a name was in progress, which counts a `:` as a name character: the tight form walked back over the separator and got the right stream for the wrong reason, and the spaced form stopped at the gap and opened an axis. No verdict rode on it, since nothing accepts either spelling; the message did, and a parser handed two axis tokens said `expected a name, found "child::"` — naming a token the author never wrote as one. Also owns the one definition of a gap — `WHITESPACE`, the XML `S` a gap is spelled with, and `GAP`, the same four characters as a regular-expression class — plus `spelling`, which answers whether a name runs up to an offset, and `qualified`, which answers whether XML can spell one at all. Those two are different questions and the second was nobody's: a name was taken whole and greedily, so `my:25l`, `my:-x` and `my:a:b` each arrived as one `NAME` and read as an ordinary step, the grammar asking the lexer for a name and never how it is spelled — the one place we were the lenient side of the engine (#708). What is left for it to answer is the `USER_FUNCTION` kind, whose own scan takes an ASCII run in front of a bracket and weighs neither part as an NCName, so `my:25l(3)` still arrives whole; a bare `NAME` is a QName by construction since #746, and the `REFUSES` row spelling that call is what keeps the answer reachable at all. A QName is an NCName or two joined by one colon, and each part is weighed with `NAMED` less the colon that split it and `STARTS` for what it may open with, so the answer borrows the classes the lexer spells a name with rather than holding a second opinion about what a letter is. Those classes are what has to be right, then: `NAMED` was XML's `NameChar` less its three extenders — the middle dot and the two ties, `\p{M}` already covering the combining marks — so `a·b` was refused where the engine and both arbiters accept it, eight spellings in all (#731). They are name characters and nothing more, none of them able to open a name, which is `STARTS`'s answer and unchanged. Both parts must hold something: a prefix names nothing on its own, and `$my:` and `my:(1)` are refused by every engine. This answer let them through, permitting a trailing colon because the `my:` of `my:*` arrives spelled that way — the `*` being the wildcard's own token — so a permission a wildcard needed reached a variable and a call as well (#731). A wildcard is `tested`'s business and it takes the tokens of the prefixed spelling itself now, which leaves this answer nothing to make an exception for — and since #746 no name the lexer hands over ends in a colon at all, `my:*` arriving as the three tokens the grammar reads with the adjacency below. Every reader of a gap borrows one of them, and a `no-restricted-syntax` selector bans `\s` outright, because JavaScript's class also takes a no-break space and so reads a call in `boolean&#xA0;(a)` where no processor sees one (#643) |
| `src/grammar.js` | `parsed(xpath, version)` — the XPath 3.1 expression grammar as recursive descent over `tokenized`, one function per production. A node's span is a range of *token indexes*, never a pair of character offsets, so a position is carried from the lexer rather than computed from text, and the text of a node is the tokens of its span joined back together. The whole stream comes back with the tree, trivia and all, so joining it reproduces the expression as written — which is what keeps a fix a span replacement over raw source. The version in force is a parameter rather than a lookup, because the same text is a different language under a different one: `a to b` is a range in 2.0 and two steps around a name in 1.0, so modern syntax in a 1.0 stylesheet is a parse failure rather than an entry on a list somebody has to keep current (#652). The node comparisons are gated that way too: `is`, `<<` and `>>` stand beside the value and general comparisons and are refused below 2.0, the version that added them, so one selector of this project's own — the `$var << .` of `confusing-variable-and-node` — stopped being valid XPath our own parser refuses (#724). Beside them, and not below them: the three classes are one level of the ladder rather than three, because `ComparisonExpr` takes an operand from either side of one operator and admits no run of them (#726). Two levels of the ladder are spelled out rather than folded for that reason — the range between the sums and the comparisons, and the comparison between the concatenations and the `and` — since a `folded` run is left-associative and takes as many operands as it is offered. That associativity is why one production is one rung of `LADDER` and every spelling it takes stands on that rung: three of them were two rungs apiece until #764, split so a spelling could carry a kind or a floor the other had not got — the word `union` above `\|`, `idiv` above the other multiplicatives, `except` above `intersect` — and a rung is what decides how tightly an operator binds, so the split made the second of each pair the looser and nested a mixed run to the right. `9 idiv 2 * 3` came back `9 idiv (2 * 3)`, which is 1 where XPath computes 12, and `a except b intersect c` selected what `a except (b intersect c)` selects; a `RUNS` row in `test/grammar.test.js` now asks of every mixed pair that its left operand covers the first operator. The kind names the production, as `sum` has always covered a `-`, and a spelling younger than its rung carries its floor in `SPELLS` — asked of the operator ahead rather than of the node about to be built, since both spellings of a union build a `union` and `SINCE`, keyed on the kind, can only speak for the rung as a whole. Three rungs let a comparison chain onto another, so `a = b eq c` and `a < b < c` parsed; over the 225 pairs fifteen comparison operators spell, the engine accepts none and the grammar accepted 144. The node comparisons would have taken that to 225, which is how the defect surfaced: the 81 pairs holding one were refused because the lexer did not know the operator, not because the grammar was right, and fixing the lexer took the accidental cover off. No committed expression chains comparisons, so the corpus gate cannot see any of it and four `REFUSES` rows pin it instead, one per class and one crossing two. A name with a bracket behind it is read off one table, `RESERVED`, which maps each name XPath has taken to the version that took it, what it was taken for, and the production that reads its brackets — a `test` (a kind test, standing where a node test stands), an `item` (an item type, standing in a sequence type and nowhere a node test does) or a `keyword` (`if`, and the `switch` and `typeswitch` this grammar has no production of). 1.0 takes the four node types alone, 2.0 adds its kind tests with `empty-sequence`, `if`, `item` and `typeswitch`, and 3.0 adds `array`, `function`, `map`, `namespace-node` and `switch`. `reserves` asks whether the version has taken the name at all, which is the whole of what a *call* needs to know, and `taken` asks whether it was taken for one of the kinds a particular production will accept. The brackets themselves were *counted* rather than read until #753 — `kinded` walked to the matching `)` and let anything at all stand inside — so `text(a)`, `node($v)`, `element(1)`, `element(a b)` and `element(a, xs:string*)` all parsed, in a pattern as much as in an expression, where every processor answers XPST0003 and since #739 that is a missing `invalid-xpath-expression` on a `match="text(a)"` no processor loads. Each name reads its own now, one production per shape XPath spells: `closes` for the six that take an empty bracket, `instructed` for a processing-instruction test, `elemented` and `attributed` for the two that name a node and optionally its type, `declared` for the two `schema-*` that require a declaration, `documented` for a document test's element-or-schema-element, and `paired`, `listed` and `returned` for the map, array and function tests. The count hid an *under*-acceptance too, which is the direction that invents a defect against working code: a function test's return type stands behind its closing bracket, `TypedFunctionTest` requiring an `as` where `AnyFunctionTest` refuses one, so the walk swallowed the arguments and `$v instance of function() as xs:integer` was refused for text left over at the end. Which production reads which name is the table's third field rather than a `switch` beside it, which is why the table sits below those productions instead of among the version tables it began in: a name taken for a test or an item type cannot lack the production that reads it, and a keyword has no such field. The arbitration is worth recording because a single engine could not have settled it — fontoxpath refuses `element(a, xs:string?)`, which Saxon-HE 12.5 accepts and the specification spells, and it accepts a nillable `attribute(a, xs:string?)`, which Saxon refuses with XPST0003 and the specification has no production for. Reading the arbiter's *code* rather than its exit status is what tells the two apart from the eight rows where Saxon answers XPST0008 or XPST0051 — a missing schema or an unknown type, static errors against text it parsed — and xsltproc settles the one place the versions differ, XPath 1.0's `NodeTest` taking `'processing-instruction' '(' Literal ')'` where 2.0's `PITest` adds the NCName, so `processing-instruction(a)` is a syntax error in a 1.0 stylesheet and a name in a 2.0 one. The floor is half of what a name means, because below it the same characters are an ordinary call to a function so called — unregistered, which is #576's question and not the parser's, and exactly what xsltproc answers at 1.0 about every name in the table: it parses the expression and then goes looking for the function. Two version-blind lists sat beside the floors until #728, the same fact written twice with the version in one copy only, so `element(a)` came back a `step` in a 1.0 stylesheet where a 1.0 processor reads a call. The verdict agreed and the tree did not, which is the half an acceptance diff cannot see — #708 measured against fontoxpath, an XPath 3.1 engine, and every one of these agrees with it at 3.1 — and the half Phase 4 of #644 walks. So a `SHAPED` row in `test/grammar.test.js` asserts the *kind* on both sides of a floor where neither side is a refusal, beside a `RESERVES` row, which is the mirror of a `GATED` one: a construct that stops parsing from a version up rather than starting. Applying an expression is gated the same way and was not gated at all: `$f(1)` is a dynamic call from 3.0, when function items arrived, and before that the characters are no call by another reading either, a `FilterExpr` taking predicates and no argument list — which is how `child::element(b)` came back an `apply` at 1.0 the moment `element` stopped being a kind test there. A name is taken only where a call could stand, in front of a bracket, so `//item` is the path it always was. A refusal is an answer rather than an exception — a corpus asks about thousands of expressions and most callers want a verdict — and it names the offset it stood at, so a report can point at the fault instead of at the attribute holding it. An inline namespace is gated at 3.0 along with everything else that version added, and it reaches four productions rather than one, a name being spelled in more places than a step: `named` composes the braced URI literal with the name behind it, so a variable and a call get it for free; `tested` reads one standing in front of a `*` as the fourth spelling of a wildcard, `Q{uri}*` naming every element of a namespace with no prefix bound to it; `called` asks `pastName` where `reaches` cannot, since a name is one token spelled as a QName and two with its namespace inline, so the bracket that tells a call from a step stands one token away or two; and `steps` counts it among the kinds a step may open with, since a step opening `Q{uri}a` opens with a name like any other. It asks that of `NAMES` rather than of one kind at a time, the lexer kinding a name three ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one has a bracket behind it, a `URI` where it spells its namespace inline. Asking about one kind is a defect that repeated itself before the shape was seen: the first draft of #708 accepted `a/Q{urn:my}b` and refused `//Q{urn:my}a`, the shape the inline form exists for, and with that fixed `a/my:fn(1)` was still accepted while `//my:fn(1)` was refused (#731). Every production that *reads* a name knew all three kinds; the one deciding where a name may stand knew them one at a time, and a path is the only place that distinction shows. Under-acceptance is the direction that invents a defect against working code. A reserved name is never either of those spellings, XPath reserving an unprefixed one alone (#708). Beside it stands `matched(pattern, version)`, because a pattern is a different language and not a second reading of this one: it is a union of paths and nothing else, so `1 + 1`, `@a = "b"` and `a, b` are fine expressions and no pattern at all, and reading a `match` with the expression grammar admits every one of them (#589, #649). The version decides which language it is, by more than a detail: 3.0 rebuilt the pattern grammar on top of the expression one, so `a intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`, `(self::node())`, `.` and the word `union` are all patterns there and none of them is one in 1.0 or 2.0, whose whole grammar is `IdKeyPattern` and a union of relative paths — each is gated on `REWRITE` rather than admitted everywhere, since a pattern accepted under a version with no production for it is a stylesheet called valid that no processor loads. A `/` may stand alone and a `//` may not, the step being what the descent descends to. A bracketed branch is where a pattern parts from an expression rather than borrowing it: 3.0's `StepExprP` admits one at *any* position in a path, so `a/(b \| c)` is a pattern as much as `(b \| c)/a` is, while the expression grammar's own parenthesized step may only open a path (#711) — reading the two alike refused a pattern XSLT admits. Its steps are narrower than an expression's at every version, because a pattern is matched by walking *up* from a node rather than evaluated forwards, so an axis such a walk cannot answer is a static error and not an empty match: `treads` names the two of 1.0 and 2.0's `ChildOrAttributeAxisSpecifier` and the six of 3.0's `ForwardAxisP`, which adds `self`, `descendant`, `descendant-or-self` and `namespace`, and no version admits the four reverse axes, `following`, `following-sibling` or `preceding-sibling`. A `..` never spells a step and a `.` spells one from 3.0. Settling that took two processors and neither would have done alone: SaxonJ-HE says what 3.0 refuses, with XTSE0340, but applies its own 3.0 pattern syntax whatever the stylesheet declares — it admits `self::a` and `.` at `version="1.0"` — so only xsltproc, being 1.0 only, can say what an older version refuses. A processor shows that a construct is admitted somewhere; only a version-aware one shows that a version refuses it, which is the trap #717's arbitration fell into as well. Two more borrowings from the expression grammar are paid back. A bracket is `bracketed` rather than the expression grammar's parenthesized primary, so it holds a `Pattern` — optionally, since `()` matches nothing and is a pattern all the same — `(a \| b)/c`, `(a)`, `(a[1])/b` and `(a \| b)[1]` are patterns and `(1 + 1)/a`, `(a = b)/c`, `("s")/a` and `(a, b)/c` are not, though each of those is a fine expression. And `.` is the whole of `PredicatePattern`, read by `whole` before any union, so it stands alone or not at all: `a \| .`, `. \| a` and `.[@x] \| a` are refused. It is still a *step* once a separator stands in front of it, which is the distinction `entered` draws — `b/.`, `/.` and `//.` are patterns while `(.)`, `(.)/a` and `a/(.)` open a path with one and are not. The last borrowing goes with them: `FunctionCallP` took its arguments from the expression grammar, where XSLT admits a literal or a variable reference and nothing else, so `key("k", a/b)`, `id("x" \| "y")` and `doc(concat("a", "b"))/x` parsed as patterns; `anchored` narrows them, and `root` takes no argument at all. A numeric literal is a literal, so `key("k", 1)` is a pattern and `id(1)` is one too — a processor refuses that second one for `XPTY0004`, which is `id`'s signature rather than the pattern grammar, and reading the arbiter's *code* rather than its exit status is what tells the two apart. Eight of a first sweep's apparent over-acceptances were static-type, undeclared-prefix, arity and classpath errors. A type is read by three productions rather than one, because XPath spells three and they have three shapes: `kinded` for the kind test of a `NodeTest`, `sequenced` for the `SequenceType` an `instance of`, a `treat as` and a function's `as` take, and `singled` for the `SingleType` a cast takes. One function served all three and took an occurrence indicator wherever it was called, so a step lost the `+` of `text() + 1` to a type that has none, `$v instance of (xs:integer)` was refused where a `ParenthesizedItemType` stands, and `1 cast as node()` was accepted where a cast makes an atomic value (#740). Two more borrowings went with it. `postfixed` hung its `(`, `?` and `[` off whatever `primary` answered, and `primary` answered a *step* when nothing else matched, so `a?b` came back a lookup into a step and `@a(1)` a call applied to one — `StepExpr ::= PostfixExpr \| AxisStep` is a fork, and `opens` is now the whole of it, one predicate naming the same shapes `primary` reads. A named function reference is a `PrimaryExpr` of its own on that reading, not a postfix, which is what `referred` says. And the simple map came off the ladder: `ValueExpr` *is* a `SimpleMapExpr`, so `!` binds tighter than the unary signs and far tighter than the four expressions taking a type, where a rung of the ladder put it looser than all of them and `a instance of xs:integer ! b` parsed as a map over a sequence type. Two questions the lexer cannot answer are answered here instead, both of them about a word (#742). `counted` takes the occurrence indicator a type ends with and reads the word behind it as the operator it spells, since the `?` of `xs:integer?` and the `?` of `$m?div` are one character with one token of lookahead behind each: the first ends a value and the second opens a lookup key, so a wider `ENDS` answers for the type and breaks the lookup, and only the production being read can tell them apart. The `*` never needed it, `MULTI` already ending a value by spelling the wildcard of `a/*` — an accident that made `item()* div 2` right for a reason no rule stated. And `glued` refuses a keyword run against the terminal in front of it, the same gap rule `operates` applies to the words the lexer kinds, for the ones it hands over as names: `1to 3`, `1cast as xs:integer` and the `1else` of `if (1) then 1else 2` are all XPST0003 and every one of them parsed. `glued` is `abuts` narrowed to the kinds `GLUES` names, so every question this file asks about a gap is one adjacency test underneath, and `abuts` is the absence of a trivia token rather than arithmetic over offsets — the stream being lossless, a gap or a comment between two terminals is a token of its own. `welded` is the same question one token further out, `reaches` with adjacency required, and the pair is what a *terminal spelled out of several tokens* needs: a wildcard is the only one XPath has, `Wildcard` being marked `ws: explicit`, so `my: *`, `* :a`, `*: a`, `* : a`, `Q{urn:my} *` and `a/my: *` are not loose spellings of one but XPST0003 in Saxon-HE 12.5, and `tested` read all six as wildcards because `take` and `expect` skip trivia everywhere else, rightly (#736). Each of the three composite spellings asks for adjacency in its own condition and none refuses on its own account, a `*` being a whole wildcard already: what a gap parts from it is the next production's business, which is what leaves the `:` of `map {* : 1}` to the map constructor it separates. Both are read by `isValid` since #732, which is Phase 3 of #644 opening — in `src/xpath.js` then and in `src/syntax.js` now, where the parse is kept rather than thrown away once its verdict is read (#577): a run's verdict on whether an expression is valid is this file's, taken behind the two gates of #680 that `test/grammar-corpus.test.js` holds `parsed` to, and the shape sweep of `test/grammar-shapes.test.js` beside them |
| `src/syntax.js` | The one door between a record and what the grammar makes of it, and where every check that reads a tree begins (#577). `parseOf(found)` forks on the record — `matched` for a pattern, `parsed` for an expression — at the version `versionOf` reads at the node, or at `ASSUMED` where it can place none: the most permissive version `KNOWN` holds, derived rather than spelled, because a missing `version` is already `missing-version-in-stylesheet`'s defect and letting it decide a syntax question would answer one defect with an `invalid-xpath-expression` for every modern expression the file carries. One parse per distinct expression, keyed by version and language as well as by text, since a corpus asks about `.` and `@name` and `text()` over and over (#689); and the *tree* is kept now, where the verdict alone was the cheaper bargain while nothing above asked for more, because a check that walks it would otherwise parse a second time. `isValid` is that verdict with the complaint dropped, for the two gates wanting a boolean, and `refusalOf` is gone — the offset the fault stands at comes off the parse itself, which is what lets the validator point at the fault rather than at the attribute holding it (#589). Beside them, what a check needs of a node: `tokensOf`, the tokens a span covers, with `textOf` and `offsetOf` derived from it, so a position is the lexer's rather than anything computed from text — and the tokens themselves because the tree gives one kind to what the lexer told apart, a `literal` being a number or a string with only its token saying which, which is the whole difference between `[position() = 1]` and `[position() = '1']` (#575); `gathered(found, kinds)`, every node of one of the kinds, outermost first, a list rather than one kind because a construct is often two of them — which two is `VALUED`, the general and the value comparison, one list here rather than one per check for the reason `TRIVIA` and `OPAQUE` are one each, with a `no-restricted-syntax` selector refusing a second copy anywhere in `src/` but this file and `src/grammar.js`, where the kinds are minted and all three are named in the table deciding which operator builds which; `operatorOf`, the operator standing between two operands, read off the `parting` tokens the grammar consumed without building a node of its own and canonicalised through `WORDED` — the one table pairing each general comparison with the word XPath 2.0 spells the same question in, so `eq` reaches a classifier as `=` and one keyed on six symbols answers for twelve spellings (#763). `test/syntax.test.js` holds that table to the grammar as it holds `LOOSE`, asking of each pair whether the two spellings really do come back a `comparison` and a `value-comparison`, and sweeping every word operator the lexer knows for one the pairing misses — the direction that has actually moved, 2.0 having added all six words at once. A check needing to know which class it was handed reads the node's kind, that *being* the answer: the count collapses to a call and carries no operator either way, while the string-length rewrite carries one and writes back the family it was given rather than moving a value comparison into the general one; `calls(found, node, name, namespaces)`, whether a node is a call to that function, resolving the prefix against `holding(found.node)` and admitting the bare, the prefixed and the inline `Q{...}` spellings of each namespace it is given — the standard ones by default, since a function is its name and its namespace together and most of the names a check asks about are XPath's own. A list rather than one URI because some functions are declared in more than one: `node-set` is EXSLT's and Microsoft's for the same purpose, so `use-node-set-extension` asks about both and a `node-set` of the author's own answers no (#557); `stringOf(found, node)`, the string a literal holds — unquoted, and with a doubled delimiter inside it read as the one character it spells — which is the question `textOf` cannot answer, XPath spelling one string two ways and a check comparing the text seeing two literals (#598, #562, #549); `variableOf(found, node)`, the name a variable reference holds, which is the same shape of question one construct over — XPath lets a gap or a comment stand between the `$` and the name, so `$ para` references `para` and the text of the span does not say so, while a namespace stays part of the name, `$Q{urn:my}para` and `$my:para` each naming a variable `$para` is not (#776); and `tight(node)`, whether a node's text can stand as an operand of a general comparison with no brackets round it. Beside those, `filters(tokens, node)` — whether a node can stand as a predicate asked of one candidate at a time, which is what a check served from `named`'s walk needs of each predicate it wrote (#784): XPath reads a predicate whose value is a *number* as a test on the context position, and a candidate handed over alone is a sequence of one where every position test answers true. `FILTERS` names the kinds that cannot be a number, `BOOLEAN` the standard functions answering `xs:boolean`, and `positional` walks for a `position()` or `last()` under the node, either of which hides inside a `comparison` the kinds would pass. Two kinds are not on the list because their kind does not settle what they answer: a `call`, `not(@a)` and `count(@a)` coming back alike, which its name decides; and a `path`, which its **last step** decides, since from XPath 2.0 a path may end in a call answering an atomic value and `a/count(.)` is a number spelled as a path. Reading a path by its kind served `[a/count(.)]`, `[a/(count(.))]`, `[a/count(.)[1]]` and five more, each of which the engine answers with one node where serving answered every match. `test/syntax.test.js` holds both lists to the grammar as it holds `LOOSE` and `STEPPED`. `ASSUMED` is exported with it, a check's selector carrying no `version` of its own and being read at the most permissive one for the same reason a stylesheet declaring none is. That last one reads `LOOSE`, XPath's own ladder from the comparison up — the comma, the five `ExprSingle` expressions, `and`, `or`, and the three comparison classes that cannot chain — and `test/syntax.test.js` holds the list to the grammar rather than to its comment, taking one expression of every kind the grammar builds and asking whether `<specimen> = ''` really does come back a comparison over the whole of it. Beside it `stepped(node)` reads `STEPPED`, the same ladder from the other end: the kinds a `StepExpr` can be, which is everywhere XPath binds most tightly and so everywhere a *call* stands. That is the question a rewrite unwrapping a call has to ask, and `use-node-set-extension` was the one unwrapper with no answer behind it, substituting the bare text of its argument and dropping the brackets the call had supplied — `exsl:node-set($one \| $two)/alpha` became `$one \| $two/alpha`, which selects `$one` beside the `alpha` children rather than them (#774). A `path` is deliberately outside the list although it stands as a step: a predicate binds to the last step of one, so `exsl:node-set(alpha/beta)[1]` is `(alpha/beta)[1]`, and a predicate is the one postfix a node set can carry. The same sweep holds it to the grammar, asking of each specimen whether `b/<specimen>` comes back a path whose far step is the specimen whole |
| `src/import-graph.js` | Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf`. A reference with no `@href` names no module and yields no import, rather than joining a null onto the directory and taking the whole run's report down (#597); no check reports that malformed reference yet (#668). Each import carries the raw text of the file it stands in beside its node, because a fix that cuts one reads its span from the source rather than rebuilding the element (#793) |
| `src/fixers.js` | Maps a declarative check name to a `node => fix` builder, each built from `src/fixes.js` rather than by hand: `deletion` for one that cuts an attribute, `substitution` for one that rewrites its value |
| `src/fixes.js` | Shared fix builders: `deletion(attribute, content)`, which reads the span to cut from the raw source — xmldom reports an attribute at its opening delimiter, so the quote is whichever stands there and the walk back over the `=` and the name crosses a gap of any width. Rebuilding the text as `name="value"` behind a space made the fixer decline every other spelling of it (#594). Beside it, `standsAt(attribute, content)` answers where an attribute *stands*, in the line and column a defect is reported in, off the same walk: a reporter that instead subtracted the name's length from `columnNumber` was right only where the source spelled the attribute `name="value"` exactly, so `xmlns:dead = "urn:dead"` was reported two columns right of itself and one standing on its own line six (#681). The two answers differ by one gap on purpose — a deletion takes the gap in front of the name with it, or it would close two attributes up against each other. `substitution(attribute, replacement)` is the third, for a fix that rewrites a value rather than cutting it: it anchors one character past the delimiter and replaces the value alone, so the name, the gaps around the `=` and the quote stay as the source spells them and none of the three has to be found. Five builders rebuilt the whole attribute as `name="value"` instead, which assumed all three at once and failed on each — on `select = "//para"` the fix named a column two to the right and a text standing nowhere in the file, so it was announced and then declined as no longer matching (#718). The arithmetic behind it is banned outright now by a `no-restricted-syntax` selector, since nothing in `src/` needs to guess where an attribute begins. It does read the delimiter, though, because what a fix carries is the *decoded* value: an expression the source spelled `//a[@x &lt; 1]` arrives holding a bare `<`, and writing it back as it stands closes the element early. So `escaped` re-encodes the `&`, the `<` and whichever quote the value stands in — the delimiter being the one position the parser reports exactly, which is why `deletion` reads it too. A `>` is left bare, legal in an attribute value: re-encoding cannot recover which characters the author chose to write as references, so the line is drawn at what XML forbids. Rewriting the whole value swept every entity in it before that, which master does today on the plain spelling and this change would otherwise have carried to the spaced one. `excision(element, content)` is the fourth, and it cuts a whole *element*: the tag closes at the first `>` standing outside an attribute value, so a `>` written inside one is stepped over rather than mistaken for the end of the tag, and an element spelled the long way ends at the `>` of its end tag instead — found only where the source between the two tags is gap, since a comment holding a `</` of its own puts that search inside itself, and no fix at all beats a span cut through the middle of something. Such a comment is legal XSLT rather than a broken file, xsltproc and SaxonJ-HE 12.5 both honouring an `xsl:import` that holds one, so what is withheld is a fix and not a report. What the cut takes beyond the element is `lined`'s question and one rule: the whole line where the element owns it, indentation and line ending together, and the element alone where anything else stands on that line, the indentation of a shared line belonging to the line rather than to whichever element is cut out of it. `redundant-import`'s fix rebuilt the element instead, as an indentation repeated `columnNumber` times and a tag spelled out of the name and the href, which assumed a gap, a delimiter and an empty-tag spelling all at once. Of the eight spellings one fixture now holds — a gap around the `=`, single quotes with a trailing gap behind them, a space in front of the `/>`, the long form, a wider gap after the element name, an element wrapped across two lines, one sharing its line with a sibling that survives, and one ending a line it does not own — master applies **none**, each announced and then refused with "the source no longer matches", the wording reserved for a span an earlier edit had moved, on a file nothing had touched (#793). A fix's `value` cannot be spelled out at all now, a `no-restricted-syntax` selector refusing a template literal or a concatenation under that key anywhere in `src/`: it is the text the source already holds, and #718's ban saw only the subtraction it was written for |
| `src/fixer.js` | Applies a defect's `fix` to source (decode-walk, verify-before-apply, end-to-start). A line ending in the source answers to a space in the fix's `value`, the last normalisation between the two texts, without which no fix could reach an expression a line wrap crossed — announced as fixable and then refused with "the source no longer matches", naming an edit that never happened (#629) |
| `src/xpath.js` | The fontoxpath environment, and since #577 only that: prefixes, the two evaluators the declarative loaders issue their selectors through, and `compiles`, the engine as it stands, exported for the two sweeps that diff the grammar against it — a second opinion rather than a verdict, which is what lets it stay strict where the specification is not. The front door moved out to `src/syntax.js`, which is what #738 left half-done: it deleted the 204 lines of respelling that rewrote an expression before the engine was asked about it, so what stayed behind was a verdict this file no longer had any part in answering, sitting in the one module that loads a 3.1 engine. A check reading the tree would have pulled fontoxpath in behind it for a question the grammar answers. Beside them `satisfies(node, xpath)` asks the engine about one node and gets one boolean, which is the half of a split selector a walk cannot answer: the axis comes off `named` — or, since #811, off `attributed` — and the tail is asked of each candidate as `self::node()` followed by the predicates the selector wrote, which an attribute answers as readily as an element, `node()` being the one node test that matches both (#784, #811). `PREFIXES` is exported for that same change rather than copied into the index, since a bucket keyed on what `xsl:` means here and a predicate asked of what it means to the engine would be answering two different questions |
| `src/helpers.js` | XML parsing (expands internal-subset entities), YAML parsing, file recursion. `allFilesFrom` joins each subtree on with `flatMap` rather than spreading it into a `push`, since a spread hands every path over as an argument and V8 caps those at roughly 125 per kilobyte of stack: this repository's own checkout grew to 768,731 files and every run over it died with a `RangeError` before a byte of XSL was read, the walk being asked before anything is filtered for `.xsl` (#758). It refuses what `@xmldom/xmldom` would repair rather than reject: the level of a diagnostic is not consulted, since an attribute written without quotes arrives a mere `warning` and is then invented into a value (#574), and `forbidden` walks the text nodes for the two sequences character data may not hold — an `&` that opens no reference, which the parser rewrites to `&amp;`, and a `]]>` that closes no section, which it keeps as it stands (#691). Both are accepted in silence, at no level. Text nodes come from `src/tree.js`'s `walked`, not from a scan of the source, because both are legal in a comment and a processing instruction, and inside a CDATA section an `&` is text while a `]]>` is the close — a text node cannot be any of the three, so those are excluded by construction rather than by finding them, and an attribute value, where `]]>` is legal because it is not content, is outside the walk for the same reason. The YAML parser is required inside the function, not at the top: nothing on the linting path reads YAML any more, so a run that has no `.xslint.yml` never loads it |
| `src/resources/checks.json` | Every check as a run reads it, built from the YAML by `scripts/generate-checks.js`. Never edited by hand — `test/conformance.test.js` re-renders it and fails on any difference |
| `src/logger.js` | 4-level logger |
| `scripts/generate-docs.js` | Builds the `docs/` site from checks + motives |
| `scripts/generate-checks.js` | Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`) |
| `scripts/budget.js` | Judges what a corpus cost the nightly tier against the budget `corpora.yml` gives it, from both sides: past the budget the run has slowed, and further than `SLACK` under it the budget has stopped being a bar and wants re-cutting. The step calls it rather than comparing two numbers of its own, since a ratchet nobody routes through is one an inline comparison replaces — which is what had happened, the three budgets standing 9, 14 and 18 times their runs by #785. A reading of no seconds at all is no reading, a whole-second clock being unable to measure a faster run, and an empty corpus is the count check's defect to report rather than this one's. `test/budget.test.js` holds every budget to both ends of what its corpus has read on the runner — above the dearest night, and quiet on the cheapest, since a budget of four times a reading fires on everything below a quarter of it and a budget wide enough to fire on a night that has already happened reddens a build on a tree nobody has touched — and asserts that the step still calls the script; `test/budget.deep.test.js` runs the file the way the shell does, since the exit code is the whole of what arms the gate and a verdict returned to nobody leaves the tier as unable to fail as #785 found it |
| `test/conformance.test.js` | Enforces naming, motives, selector hygiene — including that a selector comparing an expression's text with a quoted literal names both quote spellings of it, since `incorrect-use-of-boolean-constants` named `"'true'"` alone and read half the stylesheets it is about (#549), and that none names an element by `name()`, which answers a *prefix* where a node test answers a namespace (#784) — pack/test coverage, the `mature` freeze across all kinds, the fast/deep split of the suite itself, and that no test writes a scratch file outside a temporary directory. A pack gives one position per defect it expects, too: the harness walks the `positions`, so an `amount` standing above their number is a count asserted and a place asserted nowhere — three packs of #565's own were written that way and passed, pinning four runs' replacements while saying nothing about where any of them stood. It also asks `splitOf` of every `xpath` selector and holds the answer to `UNINDEXED`, the eleven that a shared walk cannot serve as an axis, each listed beside the shape that keeps it out (#784) — fourteen until #811's union phase served three of them, and a union is no longer a reason to be on the table, so `malformed-version-in-stylesheet` stays out as a **bracketed** union of attribute paths, which is one predicate standing outside the brackets and an axis the merge cannot order — fifteen until #556 gave `using-disable-output-escaping` an element test, which took it off the table by making it servable rather than by anybody editing the list. A structural gate rather than a share bar, because a bar can only notice the cost after a selector has been written the broad way: a check whose selector becomes servable and stays on the list fails, and so does one on nobody’s list that has stopped being served, so neither half can rot in silence. It also holds the pack harness to being one, from both ends. Every directory holding packs is handed to it exactly once, matched one-to-one against the `dir:` a harness call names — the gate that was missing while the harnesses were twenty-two files, because deleting one deleted a loop and left its neighbours to notice, where deleting one call now deletes every assertion over a directory at once: eleven of the twenty-two could go with the coverage gate still reading 100%, `xpath-packs` and its thirty-eight declarative checks among them. And a second copy of the harness is refused, by refusing any `.test.js` but its own to read what a pack expects — `found.amount`, `found.positions`, `found.fixes` or `found.values` — which together replace the one asking whether the harness owning a directory mentioned `found.fixes` at all: a text check standing in for structure, reaching 19 of the 22 and able only to ask whether the string appeared rather than whether it was asserted correctly (#660). A third way it can rot is one the sweep cannot see, walking the checks rather than the table: #788 took five selectors into code and three of them were listed here, so the entries outlived the checks they were written for, and a test of its own holds every name on the table to `checks/xpath/`. A cross-file selector answers to a gate beside it with no table at all: all five of them are served since #811, and where the per-file kind has fourteen shapes a walk cannot reach, four checks of one shape each are few enough that a fifth belongs in that shape too. An attribute axis has also stopped being a reason to be on the table, which is the second way an entry rots — a refusal that stands while the reason for it has gone: `malformed-version-in-stylesheet` stays out as a union of two whole paths, not as the attribute path each half of it opens with |
| `test/grammar-corpus.test.js` | The two gates #680 stands in front of the parser, asked of every expression the repository carries — 644 of them, from the committed stylesheets, from the ones the packs hold inline, and from the selectors the declarative checks are themselves written in. **Round trip**: a parse's tokens join back into the expression byte for byte, every node's span slices to its own text, and every child nests inside its parent in order — the last of those is what slicing cannot see, since shifting a node and its children together still slices. **Acceptance diff**: the verdict is diffed against the engine's, asked as `compiles` and asked alone — a respelling retry sits on the engine's side of that comparison and hides every expression fontoxpath refuses and the squeeze rescues. Forty do, and they are #639's family exactly, a spaced axis or a `namespace::`; asking `compiles(xpath) \|\| compiles(squeezed(xpath))`, which is what `isValid` was until #732, cancels every one and reports the evidence for retiring the retry as absent from the tree, when what is absent is a comparison that can see it. So the forty are *subtracted* rather than cancelled: `insists` in `test/strictness.js` reads the class off the token stream, `EXPLAINED` takes it out of the diff, and what is left over is annotated one line each in `GAPS`, naming the side that accepts and the gap it stands for, so a new one and a stale one both turn red. Subtracting a class can hide a defect the way the retry did, in one direction, and that direction is gated: the class may only ever excuse the grammar accepting where the engine refuses, never the engine accepting where the grammar refuses, which would be an invented defect excused (#738). Eleven stood when #680 wrote that list and **none** does now, which is the measure working rather than the measure going quiet: nine were a parenthesized step (#711), one a node comparison (#724) and the last a name no NCName can spell (#708). An empty list is an assertion, not the absence of one — every expression the repository carries takes the same verdict from both sides, so a disagreement of either kind turns it red — and it does not claim the two agree everywhere, the corpus reaching only what the corpus holds, which is why the classes #708 closed that no fixture spells are pinned in `test/grammar.test.js` instead. The corpus is gated as well, because a sweep can pass by finding nothing: each of the three sources must still yield what it did when the gates were written, and the class must still have forty expressions to subtract. The selectors are one expression in twelve and held ten of the original eleven gaps — the checks are written in an idiom the stylesheets never use, which is why a corpus of stylesheets alone (#708) agreed completely and proved little |
| `test/grammar-shapes.test.js` | The same acceptance diff as `grammar-corpus.test.js`, asked of 14112 expressions nobody wrote: every shape a head and one or two tails spell, spaced and glued. A corpus covers only what somebody has already written down, and every class #740 closed stood outside the repository's — so `GAPS` read empty while the grammar refused `text() + 1` and accepted `a?b`, and this sweep parted from the engine 1603 times on the same head. Both classes it was left with are closed by #742, and a generated sweep covers only what its own lists spell, which is the corpus limit one level up: the second was annotated `\? (WORDS)` over a `TAILS` naming no `+` at all, so `xs:integer+ and @b` stood outside its own net, and widening the annotation to `[?+]` uncovered `cast as xs:integer? instance of x` behind it. A predicate too broad to be a class is one failure mode, since an annotation that swallows the next defect turns nothing red; too narrow is the other, and this file was in it. What is annotated now is not a gap in the grammar at all — fontoxpath accepts a word run against the *arity* of a named function reference, where Saxon-HE 12.5 answers `abs#1div 2` with XPST0003 exactly as it answers `1div 2`. One engine's verdict is evidence and not an answer, which is why a second arbiter settles it; `net.sf.saxon.s9api`'s `XPathCompiler` judges them in well under a second, and reading its *code* rather than its exit status is what tells a syntax error from the undeclared prefix or unknown function behind one. That cost is why the fast half now answers in under two seconds rather than under one. The lists grew by four heads and three tails at #753, from 8064 shapes to 14112: a kind test carrying arguments is a head now, and the item types whose brackets hold a type are tails, so the productions that read them stand inside the net rather than beside it. The gate on the count moved with them, since a sweep that has been narrowed reads exactly like one that agrees |
| `test/strictness.js` | `insists(xpath)` — whether fontoxpath refuses an expression over its own strictness rather than over anything malformed in it: a `namespace::` axis, ExprWhitespace around an axis separator, ExprWhitespace inside a node test (#615, #639). It is the account that replaced the respelling retry #738 deleted, and it is a test-side module because a run has no use for it — nothing in `src/` asks what one engine insists on. Read off the token stream, which is what tells the axis of `1-namespace::x` from the one name of `a-namespace::x`, the lexer having already decided which a `-` is where a lookbehind would be reading characters about a question that is about tokens; the thirteen axis kinds are borrowed from `src/tokens.js`'s `AXIS_KINDS` rather than written down a second time. What it is not is an oracle of validity — `child ::` holds a spaced separator and is no expression — so a gate reads it *beside* `parsed`, never instead of it, and `test/strictness.test.js` pins that with the class it names and refuses all the same |
| `test/helpers.js` | The only door to a child process in the suite: `runXslint`/`xslintStatus`/`xslintStreams` run the CLI, `xcopped` judges every stylesheet a directory holds, asking xcop over the directory rather than once per file — 0.1 seconds against 25 (#687) — and rather than over a list of paths, `cmd.exe` taking a command line of 8191 characters where 356 of these are four times that. What one run cannot give is a verdict apiece, xcop stopping at the first stylesheet it refuses, so it asks again from there: a refusal is recorded against the file it names and that file is renamed out of the five extensions xcop globs, which makes a sound directory one process, a directory holding two bad files three, and a bad file the only thing that ever fails (#694). A file no run mentioned takes the whole of what xcop printed as its verdict rather than asserting against nothing, `cmdAvailable` answers whether a tool is there by running it, and `walkedWith(dir, kilobytes)` runs `allFilesFrom` in a process whose JavaScript stack is that small. That last one hands back the largest spread the stack allows beside the walk's own answer, because a walk that survives proves nothing unless the trap was armed and how many arguments a spread carries is V8's business — a Node that moved the number would otherwise leave the test quietly proving nothing (#758). The kilobytes are the smallest stack worth asking for rather than the stack: node needs some seventy to start here and more where a platform's frames are wider, so the ask doubles until one answers and the stack that did comes back, for a caller that has a second question to put to the same size |
| `test/packs.js` | The one harness every pack directory is read through — `test/conformance.test.js` holds that one-to-one rather than leaving it to the prose: `harness({dir, noun, run})` asserts the amount, the position, the name, the severity and the message of every defect a pack expects, the `fixes` and `values` it declares, and that each check the directory expects a defect from goes quiet when the run suppresses it. It was twenty-two files of one loop with three things swapped, so an assertion had to be written twenty-two times and one written twenty-one times failed nowhere — which is how `import-packs` came to assert no fix while `redundant-import` attached a real deletion (#660). Suppression is asked under a *prefix* of the check's name, `--suppress` matching by substring, so a linter comparing the two for identity fails rather than passes. Which checks to ask it of is derived twice and the two answers compared, because the first spelling marked a name seen whether or not the pack was loud and so registered nothing at all for the two directories whose quiet pack comes first — a harness that silently asks nothing reads exactly like one where everything is covered |
| `test/scaling.test.js` | The speed gate (see **Speed**): charges every stage its own processor time over a generated corpus at 40 stylesheets and again at 160, and fails one that spends more of its own run than `SHARES` allows it — `xpath-linter` at 53%, `xpath-validator` at 22%, `xsl-validator` at 14% since #811's union phase took the dearest stage from 41.14% of the run to 33.93% and lifted the twenty-two others by the fifth it left the denominator, or — where it has no entry there — grew more than `GROWTH` beside the middle stage's growth. Cost is the sharp question and growth the loose one, because #755 changed a constant and not an exponent, which is a difference the two distributions show plainly: 15.1% to 15.7% of the run against the quadratic's 26.5% to 31.9%, where in growth the fix reads 1.85 to 2.04 and the quadratic 1.66 to 2.43 — the lowest reading being the one judged, growth ranks them backwards. What the cost is a share **of** is the whole run, the readings summed, and it was the middle reading until #777: fourteen of the eighteen stages lie within a factor of two and keep swapping places, so the pair landing 9th and 10th decided the denominator of every share, and #775 — which made one of those two cheaper and touched the cross-file linter not at all — lifted every share by about a quarter and failed the gate. Growth still divides by the median, and for the reason cost cannot: every ordinary stage grows about as the corpus does, so a median growth is any ordinary stage's growth, where an ordinary *cost* is a coin toss between two near-identical readings. The corpus is the assertion as much as the bar is. It is copied from one committed `test/resources/scaling/stylesheet.xsl`, the way every test stylesheet here lives in a file, with the number of each file substituted into every name it holds — so no two share an expression, a declaration or a namespace, and the memo in `src/syntax.js` cannot make the larger corpus look cheaper than it is. That stylesheet holds a namespace nothing uses, an import, a literal result element, one unused parameter, one pattern opening with a `//`, and a call of every shape a linter is about, because a stage handed nothing it reads cannot be measured at all: the three per-document linters were exactly that, 0.3 ms with a spread of 358%, until it grew namespaces and imports. How *much* of a construct it grows is its own question, and the parameter is where that showed. A pair in each of the four templates read fine for `parameter-linter` and took `corpus-linter` from 9.5 to 14.4 of the middle reading, past the 13 the bar stood at before #777 — every `@name` being a usage, and three of the four cross-file checks giving `//@*`. So it is armed with the fewest attributes that still leave the new stage a defect to build, which is one unused parameter, and against the whole run that costs nothing a reading can see: 16.4% to 17.7% for the cross-file linter where master reads 14.4% to 18.1% on the same machine, and 0.94% to 1.07% for the new stage. The `//` of #586 is armed the same way and for the same reason — five patterns a file reach `double-slash-linter` and none of them built a defect, so 0.08% to 0.11% of the run was the walk alone and every step past it went untimed, where one leading `//` reads 0.18% to 0.19% and takes the cross-file linter nowhere a reading can see, 6.46% to 7.10% against the 6.69% to 7.24% the unarmed corpus gives on the same machine. A corpus that arms one stage must not disarm the bar on another — which under the middle reading it could, one attribute per file having been enough to move a denominator two cheap stages were swapping places at. What one sheet copied cannot arm at all is the *skew* of a real corpus, which is where the cross-file stage really spends: `//@*` costs 1.3 to 3.2 us a node under some 350 nodes and 50.4 at 4853, so five of DocBook-XSL's 315 stylesheets are two thirds of that selector's whole cost. Every fortieth stylesheet is a **heavy** one since #800 — the repeatable part of the sheet written out forty-eight times over under names of its own, 5207 elements and attributes — which the sheet marks with a `<!-- repeated -->` comment of its own, since the `fixtures` job fails a `.test.js` holding a start tag and a marker a test matches on is the fixture's to spell either way, and the stage reads 15.95% to 18.94% where a uniform corpus of any density reads 7% to 10% against the 13.73% TEI charges it and the 21.95% DocBook-XSL does. `SHARES` and `SHARE` were re-derived a fourth time at #784, whose shared walk took `xpath-linter` under a third of the run and lifted every share taken against it (see **Speed**) — and the corpus this one built survives that, both sides having risen together: the stage reads 19.51% to 20.08% here against the 17.3% TEI charges it and the 25.7% DocBook-XSL does. That walk did not serve `//@*` itself, an attribute axis standing outside buckets that hold elements, so the one selector this stage is almost all of paid #635 in full until #811 gave the walk an attribute of its own — after which the stage reads 1.20% to 1.23% of the run here, its entry in `SHARES` is gone and `SHARE` is what it answers to, and the heavy stylesheet #800 armed it with arms the parse and the per-file checks alone |
| `test/xcop.deep.test.js` | Writes every pack's inline XSL to one `mkdtempSync` directory — under a subdirectory named for the pack's own, since a basename names two packs as readily as one (#693) — and runs xcop over it; pending, never absent, where the tool does not run. `UNFORMATTED` names the packs whose fixture xcop must refuse, by the path each stands at, and every entry is asserted rather than skipped: one whose pack xcop accepts turns red, which is how four stale exemptions were found. Two gates need no xcop at all and so run wherever the suite does — every entry names a pack that is there, and no two fixtures share a path |
