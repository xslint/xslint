# `test/` — the suite's instruments

What each instrument of the suite measures, and the evidence every bar in it stands on.
The bars themselves, and the rules for placing one, are in the root `CLAUDE.md`; this file
is the derivation under each. A bar re-derived without its reading recorded here is a bar
nobody can check.

## Speed

Speed is machine-enforced like every other convention here, and it was the one that was not: the
cross-file linter went quadratic and reached master with eighteen jobs green, at 52% to 72% of the
whole run over the three corpora the README advertises (#755, #756). Two tiers hold it now.

`test/scaling.test.js` is the per-pull-request one. It builds a corpus in memory, hands it to every
stage at 40 stylesheets and again at 160, and asks two questions of each: what **percentage of its
own run** it costs, and how it **grew** beside the middle stage's growth. Both are quotients taken
inside one process, which is what cancels the machine — an absolute threshold on a shared runner
either flakes or is set so loose it catches nothing. Each stage is timed **directly** rather than by
subtracting one run from another, since the error of two timings compounds: a stage whose own
reading holds to three percent reads twenty measured that way. It spawns nothing and writes nothing,
so it belongs in the fast half, where it costs 4.5 seconds — and costs it every run rather than on
average, one measurement being discarded and none retried. It cost 3.3 until #800 gave its corpus
the file-size skew the real ones have, and 6.4 until #784's shared walk gave a second and a half of
that back.

The cost is the assertion the gate stands on, and growth is the looser check beside it, which is the
opposite of how it was first written. The reason is that #755, the regression this tier exists for,
was a **constant and not a shape**: it left the cross-file linter's exponent where it was — 1.46
against 1.57 over this corpus — and doubled what it spent at every size. So the two growth
distributions overlap, the fix reading 1.85 to 2.04 and the quadratic 1.66 to 2.43 — and since the
lowest reading is the one judged, growth does not merely fail to separate them, at 1.66 against 1.85
it ranks them backwards — while the costs have nothing between them, the fix reading 15.1% to 15.7%
of the run against the quadratic's 29.1% to 30.1% over three alternating pairs on one machine.
Reverting `src/linters/corpus-linter.js` to its pre-#755 state fails the gate thirty-seven times out
of thirty-seven, its judged reading ranging 26.54% to 31.86% against the 26 that `SHARES` then
allowed it, and master passes three of three under a load average of eighteen. A bar enough to have
caught that in growth would have to separate 2.31 from 1.93, which is inside the noise of any
machine.

What a share is a share **of** is the whole run, the readings summed, and it was the *middle*
reading of the run until #777 — on the argument that fourteen of the eighteen stages sit within a
factor of two of each other, so their median is any ordinary stage's cost and no one stage can move
it. Fourteen readings within a factor of two are fourteen that keep swapping places, and a median is
the mean of the 9th and 10th, so whichever pair lands there sets the denominator of every share.
Three runs on one idle machine, nothing touched between them, read the middle at 19.27, 16.79 and
27.86 ms — while `corpus-linter` spent 220.52, 247.30 and 282.54 ms, which is 16.43%, 17.85% and
16.06% of its run and 11.44, 14.73 and 10.14 of the middle. Making a *cheap* stage cheaper moved it
hardest, a cheap stage being what the median is made of: #775 halved `node-set-linter`, one of the
two straddling it, and lifted every other share by about a quarter, so an optimisation anywhere
failed the gate for the cross-file linter — which had cost the same to the millisecond. `SLACK`
cannot see that either, ratcheting only when a *named* stage gets cheap. The sum moves as a whole
run does and nothing but a real change in the mix moves a share within it — with one residual,
recorded rather than hidden: `xpath-linter` was over half the run when that was written, 52.1% to
57.0% here, so an optimisation **there** really would move every other share, and the whole table
would want re-deriving rather than reading as regressions of stages nobody touched. What the sum
buys is that a change to one of the fourteen *cheap* stages no longer does, which is #775 and every
other optimisation landed so far. That residual is no longer hypothetical: #784 narrowed eight
selectors and took `xpath-linter` from 62.41% of the run to 57.95%, which lifted every one of the
sixteen cheap stages without one of them costing a millisecond more — 1.013 to 1.258 times what it
read before, median 1.122. So the prediction held, and the response is the one #783 set: re-derive
what the denominator moved, or say why an entry stays. The second half of #784 answers it again and
further, over the corpus #800 gave the gate: serving a declarative axis from one shared walk took
`xpath-linter` from 44.88% of the run to 31.02%, so the dearest stage is no longer near half of it,
and the nineteen cheap stages came up once more, by 1.217 to 1.439 times what they read before,
median 1.334. Three re-derivations of one table for one cause — those of #783, #800 and this one,
the fourth move of it being #777's change of divisor rather than any stage's cost — is the argument
for a gate of another kind, which is why that change carries a structural one beside the bars: no
share ceiling can stop a selector asking the engine to descend a tree the run has already walked,
and `UNINDEXED` in `test/conformance.test.js` can.

The seventh move is #811's anchor phase, and what it shows is that a shape's name is not its cost.
Three checks spell a guard in front of their descendant step —
`(/xsl:stylesheet | /xsl:transform)//(xsl:stylesheet | xsl:transform)` and two like it — and the
split refused every one of them for being *anchored at the root*, which is a true statement about
the anchor and says nothing about the sweep behind it. `P//X` is every `X` standing below a node `P`
chose, so the anchor is one question the engine answers for a document — 4.4 ms over the whole of
DocBook-XSL — where the sweep behind it was a traversal apiece. `xpath-linter` goes from 3.33 s to
2.78 s over DocBook-XSL, 2.32 to 2.05 over TEI and 1.13 to 1.06 over DITA-OT, lowest of three
interleaved rounds a side of processor time, which is 17%, 12% and 6% off the stage, and the three
checks themselves go from 442 ms to 25 over DocBook-XSL, 334 to 30 over TEI and 132 to 21 over
DITA-OT — the report byte-identical on all three at 3843, 5713 and 1266 defects. Over the gate's own
corpus the stage reads 29.44% where it read 34.03%, dearest of five gate runs a side, so its entry
comes down by its own ratio, 53 to 46, and the twenty-two stages that cost what they always did read
dearer by 0.97 to 1.32 — which this time moves both validators, `xpath-validator` 13.60% to 14.89%
and `xsl-validator` 9.16% to 10.21%, leaving entries of 22 and 14 at 1.48 and 1.37 times their own
readings where the band allows no closer than half again, so each is re-derived by its own ratio to
24 and 16. `SHARE` stays at 7: the dearest cheap stage moved by 1.04 alone.

Two things were measured beside it and refused, which is the more useful half of the phase. Serving
`//xsl:*` off a namespace bucket — the shape the ticket named next, and one line of `src/tree.js` —
makes the run **slower**: 88% of DocBook-XSL's 66,008 elements stand in the XSLT namespace, so the
bucket narrows almost nothing and the split trades one sweep for 58,044 predicate calls at 8.4 us
each. Measured end to end, `text-outside-xsl-text` reads 244 ms where it read 236, and the selector
alone 490 ms where the sweep costs 318. So serving pays only where the axis **narrows**, and the
per-candidate call is the tax that says by how much — a rule the ticket's own sizing did not have.
The same arithmetic re-sizes what is left of it: the dearest unserved check,
`modern-construct-in-xslt-1` at 631 ms, needs that bucket and two more things before it pays, and
with all three it reads 10 ms rather than 620 — the nine narrow arms of its union off the walk, and
its tenth arm's `[@as]` answered by `hasAttribute` rather than by the engine, which is 10 ms against
the 150 the same union costs with that one predicate asked per candidate. Neither of those is this
change, and both are measured rather than estimated.

The sixth move is #811's union phase, and it is the first to move the dearest stage by making it
cheaper rather than by moving what the others are a share of. Three checks are written as a union of
two paths and no shape of theirs was served without it, a `|` at the top level being one selector to
the split and two descendant sweeps to the engine: `xpath-linter` goes from 3.83 s to 3.11 s over
DocBook-XSL, 2.93 to 2.38 over TEI and 1.37 to 1.14 over DITA-OT, the lowest of three interleaved
rounds a side of processor time, which is 19%, 19% and 17% off the stage and 11%, 9% and 8% off the
staged run, with the report byte-identical on all three at 3843, 5716 and 1266 defects. Over the
gate's own corpus the stage reads 33.93% where it read 41.14%, dearest of five gate runs a side, so
its entry comes down by its own ratio, 64 to 53. The other twenty-two stages cost what they always
did and every one of them reads dearer for it, by 1.02 to 1.19 — which is the same denominator
arithmetic as ever, and this time it crosses two bars rather than none: `xpath-validator` at 12.29%
reads 14.15%, putting its entry of 20 at 1.41 times a reading the band allows no closer than half
again, so it goes to 22, and the dearest cheap stage goes 3.72% to 4.08%, putting `SHARE` at 1.47
and so 6 to 7. `xsl-validator` keeps its 14 at 1.52 of a 9.18% reading, inside the band, a bar
raised on nobody's failure being a bar loosened.

The fifth move is #811, and the same cause a fourth time one stage over: the walk answers an
**attribute** axis now, so `//@*` — the usage of three of the four cross-file checks, and 60% to 74%
of what that stage spent — comes off a sequence the run has already built rather than costing a
descendant traversal per document. `corpus-linter` falls from 2.26 s to 0.11 s over DocBook-XSL,
1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT, lowest of three interleaved rounds a side,
which takes the staged run down 25%, 17% and 11% and leaves the report byte-identical on all three
at 3843, 5716 and 1266 defects. Every one of those is **processor time** against the **whole staged
run**, the two validators in the divisor, because a saving read off one clock and a share read off
another are not one measurement: the wall clock charges this same change 29%, 20% and 24% over the
same three corpora, and the linters alone are a denominator a fifth too small. Both were written
here before the mixture was caught, and the second of them is what #777 is the history of. Over the
gate's own corpus that is 20.89% of the run to 1.23%, dearest of five gate runs a side, and the
three stages nobody touched rose by the fifth taken out of their denominator — `xpath-linter` 31.86%
to 40.60%, `xpath-validator` 9.49% to 11.98%, `xsl-validator` 5.86% to 8.23% — so their entries are
re-derived by their own ratios, 50 to 64, 16 to 20 and 10 to 14, and the twenty cheap stages came up
by 1.18 to 1.41, median 1.26. This time `SHARE` comes up with them, 5 to 6, by the ratio of the
dearest reading among them, 3.06% to 3.80%: a bar left where it stood would have tightened by a
quarter as a side effect of a stage those twenty have nothing to do with, and against 3.80% a bar of
5 stands 1.34 times above where the placement rule asks for half again.

What that lift is measured **by** matters, because the first reading of it here was wrong in a way
worth recording. A share was read off one printed table and divided into each bar, which is a single
measurement standing in for a distribution: it put the cheap range at 0.24% to 2.77% where an
interleaved master-branch pair, dearest of nine gate runs a side on one machine, puts it at 0.21% to
2.25% against 0.21% to 2.48% — endpoints that move more from noise than the denominator moves them,
since the low end is a stage costing a fifth of a millisecond. The **per-stage** lift is the
statistic that survives; a range of extremes is not. Read the same way, all four entries stay: 85
against a dearest 57.95%, 12 against 8.15%, 15 against 8.07%, 9 against 4.94%, which is 1.47, 1.47,
1.86 and 1.82 times each reading.

Two of those four sit inside the half-again-to-twice band an entry is placed by and two sit just
under its lower edge, which is the safe side — an entry tighter than the convention asks catches
more and not less — and `SLACK` is untroubled by any of them at four. `SHARE` stayed at 5 then,
because nothing had crossed it: a bar raised on nobody's failure is a bar loosened. The cross-file
entry answers to a different rule and the band is the wrong yardstick for it, since it is the one
ceiling standing **between two distributions** — 12 sits above the dearest reading #783's index has
given here and a sixth below the cheapest the scan it replaced gave on any runner, 14.4%. What holds
all four is CI over six runners rather than a factor carried across from another stage: the 1.53 the
runners disagree with this machine by was measured for that scan, and applying it to a stage it was
not measured on would have predicted `xpath-linter` failing at 88.7%, where all six pass. Read the
same way after the shared walk, the table moves a fourth time, and this time what moves with it is
the stage that got cheaper rather than the three it lifted: dearest of six gate runs a side,
interleaved on one machine, `xpath-linter` goes 44.88% to 31.02%, `corpus-linter` 16.73% to 20.08%,
`xpath-validator` 7.65% to 9.94% and `xsl-validator` 4.51% to 5.94%, none of the three costing a
millisecond more. So `xpath-linter`'s own entry comes down by its own ratio, 73 to 50, where against
a dearest 31.02% the old one would stand at 2.35 times a reading the band allows twice — and the two
that answer to the band keep theirs, 16 and 10 standing 1.61 and 1.68 times their dearest readings,
which is where an entry belongs. `SHARE` stays at 5 for the reason it has stayed there before: the
dearest cheap stage reads 3.27%, which 5 stands 1.53 times above, and the one runner table on record
charges the dearest of them 1.82% where this machine charged it 2.53% — a bar raised on nobody's
failure is a bar loosened. The cross-file entry answers the two-distribution rule and is measured
rather than scaled, both of its edges having moved with the denominator: 32 is the geometric middle
of an index reading 20.08% at its dearest here and the pre-#783 scan's cheapest 50.34% over five
runs of the gate, which is 1.59 above the one and 1.57 below the other, and the real gate fails
three of three with that scan in place at 50.80%, 51.42% and 50.96%.

What is timed is **processor time and not the wall clock**, `process.cpuUsage` rather than
`process.hrtime`. The wall charges a stage for every slice the scheduler hands to something else, so
the gate it produced was unusable on a busy machine: under sixteen processes competing for ten cores
it failed seven runs of eight, naming stages nothing had touched at 2.36 and 2.97 of the middle
stage — indistinguishable, to whoever reads the build, from the one true failure — and reading
`corpus-linter` itself at 0.78 of it, which is its bar's *other* side and would have announced #755
as settled. Those readings are in the unit the gate used before #777, the middle stage rather than
the whole run, and are left in it: what they are evidence about is the clock, not the divisor.
Retrying does not help, because contention lasts longer than a run and inflates the same stage in
every attempt. Processor time is what the stage itself spent, so the same sixteen processes move it
by a tenth, every entry staying within that of its idle reading, and the gate passes every run under
the load that broke the wall clock.

What processor time costs is resolution, and one platform pays it. Windows charges in ticks far
coarser than a cheap stage costs over the *small* corpus, so eight of the stages with no entry
measure `0` there and their growth arrives `Infinity` or `NaN`. A growth that is not a finite number
is therefore no reading and is dropped rather than judged — verified by quantising the clock to 6 ms
here, which turns 3 to 5 growths of 18 non-finite and leaves the gate passing. The share is
unaffected, being taken over the corpus four times larger and against the whole run rather than one
reading of it: under that same coarse clock `corpus-linter` reads 14.0% to 14.9% where a fine one
reads 15.1% to 15.7%. So a coarse clock costs the looser of the two questions on one platform, not
the gate.

It stands down in one process and says so: `npm run coverage` runs mocha under c8, and V8's branch
bookkeeping does not fall evenly across the stages — it charges `xpath-linter`, the one putting
every declarative check through fontoxpath, 65% to 69% of the run where an uninstrumented run
charges it 52% to 57%. A ceiling honest about one of those readings says nothing true about the
other, which is the reason to stand down, and it is not the same thing as a breach: no ceiling here
is crossed at all, 69% sitting comfortably under the 75 that entry allows. What fires is the
**floor**, and only sometimes — run alone under c8, `xsl-validator`'s judged reading came to 1.93%,
1.95% and 1.97% against the 2.00 that `SLACK` leaves an entry of 8, and the ratchet called that
entry stale in three runs of five, where under `npm run coverage` itself it read 2.14% to 2.34% and
passed three of three. An instrumented process therefore answers about c8 rather than about the
pipeline, intermittently red on a tree nobody has touched, so the measurement skips itself when
`NODE_V8_COVERAGE` is set (in the body, with `this.skip()`, never by registering behind a condition)
and the coverage run reports it pending. Nothing is lost either way: every branch it reaches is
reached by the suite around it, so the 100% gate still holds without it — a count is deliberately
not quoted here, since one goes stale on the next commit that adds a branch — and the gate itself
still runs in `npm test`, `npm run fast`, and the `build` job across six runners.

Three things more make it a gate rather than a source of red builds. It takes a whole measurement
first and throws it away, on the one principle a warm-up has: warm the code with the work about to
be timed. A warm-up over ten stylesheets is not that, and it showed — the two validators stayed cold
enough that the first attempt read them nearly twice what they cost, `xsl-validator` 3.96 to 4.38
against a ceiling of 4 where the second attempt read 2.02 to 2.25, and `xpath-validator` 6.36 to
6.92 against 3.25 to 3.52. A bias is not noise, so the retry could not answer it and was
nevertheless answering it on nearly every standalone `npx mocha test/scaling.test.js`: a gate
leaning on the mechanism meant for something else, and one failing about a third of those runs.
Forty stylesheets only shrink it, to 3.2 and 5.1. A discarded measurement removes it — every stage
within five percent over six processes, no attempt ever retried — and costs nothing, being the retry
no longer spent. A disagreeing measurement is still taken again, up to three times, over a corpus of
its own, and the *lowest* reading answers: noise inflates, so the floor of three attempts is the
honest one. And the stages are read from `STAGES`, derived in `src/xslint.js` from the two linter
lists, so a linter cannot be wired into the pipeline and left outside what measures it — one test
asserts exactly that over the `src/linters/` directory, and another that no name in `SHARES` has
stopped being a stage.

`SHARES` names the three stages that legitimately cost more of a run than the rest: `xpath-linter`
at 46%, `xpath-validator` at 24%, `xsl-validator` at 16%. Every other stage answers to one bar,
`SHARE` at 7%, which the twenty of them sit far below at 0.37% to 4.27% — so a cheap stage that
becomes an expensive one turns red, and earns either a fix or an entry. It named four until #811,
and the fourth is the one worth reading the rule off. Two things set a ceiling. Where there is a
defect to catch it goes **between the two measured distributions**: `corpus-linter` stood at 32, the
**geometric middle** of the dearest reading #783's index had given here, 20.08%, and the cheapest
the scan it replaced gave over the same corpus, 50.34% — geometric rather than arithmetic because
the risk is multiplicative on either side, a runner of another character moving a share by as much
as a half. Putting that linter back to its pre-#783 state failed the gate three times of three at
50.80%, 51.42% and 50.96%, and the index passed it five of five. Both of those edges move whenever
the denominator does, so neither is carried over: they read 18.94% and 45.27% before #784's shared
walk took a third out of the dearest stage, and 6.05% against a scan the runners charged 14.4%
before #800 gave the corpus the skew a real one has. What ends that entry is #811, which serves the
`//@*` three of the four cross-file checks are written in off the same walk and takes the stage from
20.89% of the run to 1.23%: an entry is for a stage that legitimately costs more than the rest, and
one that no longer does answers to `SHARE` like any other — a bar five times tighter than the 32 it
leaves behind, and one that asks the growth question of it as well, which an entry does not. The
regression the pair was placed to catch is caught by a wider margin than before, that scan having
read 50.34% of a run whose denominator was a fifth larger than this one's, and the real gate fails
at 15.23% with the usage selector merely unserved. Three of those four entries moved without their
stages costing a millisecond more or less, and that is worth knowing rather than hiding: taking
`corpus-linter` from some 16% of the run to some 6% takes a ninth out of the denominator every share
is a share of, and `xpath-linter`, `xpath-validator` and `xsl-validator` each rose by exactly that —
1.13, 1.17 and 1.13 against the 1.12 the arithmetic predicts — so their entries are re-derived by it
(75 to 85, 13 to 15, 8 to 9) rather than left to tighten by a ninth as a side effect of a stage they
have nothing to do with. #784 is the same thing in the other direction and about the dearest stage
rather than the cross-file one: the shared walk took `xpath-linter` from 44.88% of the run to
31.02%, so its own entry comes down by that ratio, 73 to 50, and the three it lifted — 1.20, 1.30
and 1.32 times what they read — keep theirs, each still standing between half again and twice its
dearest reading. The entry read 26 while the scan was what the gate had to hold, drawn a tenth above
the dearest reading that scan gave on any runner and a fortieth below the cheapest #755's quadratic
gave here, on CI evidence rather than caution — this is the entry a runner disagrees about most,
four of them charging the scan 14.4%, 19.1%, 22.0% and 23.5% of the run where this machine charged
15.4%. Everywhere else the ceiling stands between **half again and twice** the dearest reading,
there being no second distribution to leave room for. The table is a ratchet rather than a licence,
the `SPRAWLING` pattern one property over, and it turns red from both sides: past the ceiling, or so
far under it that `SLACK` (four, for the same runner's sake) says the ceiling has stopped being a
bar and wants retightening. Growth is asked only of the stages with no entry, since an entry pins
what a stage costs outright, which is the stronger statement; those nineteen read 0.47 to 1.24,
against a `GROWTH` bar of 3.0 and the 4.0 a stage that had gone quadratic would read.

Three stages arrived at #788, and the corpus was armed for each in the same change: an `xsl:element`
with a static name, an `xsl:output` beside an `html` the root template builds, and an
`xsl:apply-templates` selecting the bare name of a variable declared above it. Unarmed,
`bare-name-linter` walked the expression list and reached nothing — 0.04% of the run with a growth
of 2.30 to 2.63 against a bar of 3.0, which is noise reported as a shape — and armed it reads 0.21%
to 0.24% and grows 0.69 to 1.18. The other two read 0.16% to 0.17% and 0.29% to 0.32%. Every entry
held at the time, 85 against a dearest 55.62%, 15 against 8.09%, 12 against 8.75%, 9 against
5.77%; #800 re-derived all four.

What #800 changed is the corpus and not a stage, and what it turned up is not what its title says.
The cross-file linter read 6.72% to 9.06% of the run here where TEI charges it 13.73% and
DocBook-XSL 21.95%, and the gap is neither declaration density — the ticket's diagnosis — nor corpus
size. Almost the whole of that stage is **one selector**: `//@*` is 60% of it over TEI and 74% over
DocBook-XSL, against 4.5% and 3.1% for the `within` walk #783 left behind, which the ticket named as
the thing the gate was blind to. Since fontoxpath evaluates a descendant step over an xmldom tree
quadratically (#635), what that selector costs **per node** is flat at 1.3 to 3.2 us up to some 350
nodes and then climbs — 4.2 at 689, 5.2 at 1491, 8.7 at 2829 and 50.4 at 4853 — so five of
DocBook-XSL's 315 stylesheets are two thirds of what it spends over the whole corpus, and eleven of
TEI's 363 are half. That is a **skew** and not a density, and a corpus of one uniform size cannot
show it at any density: twelve more variables in each of the four templates read 9.18% to 10.75%,
forty more attributes read 7.39% to 9.81%, and twenty stylesheets of 393 elements — the same bulk in
fewer, larger files — read 7.87%. So one stylesheet in every forty is a **heavy** one, the body
written out again forty-eight times over under names of its own, 5207 elements and attributes where
DocBook-XSL's largest holds 8790: the stage reads 15.95% to 18.94%, which is where the real corpora
put it. Every fortieth rather than a fixed count, so a corpus of forty holds one and a corpus of 160
holds four and both carry the same fraction of them. The other three entries are re-derived by the
ratio of their dearest readings over four gate runs a side, interleaved on one machine —
`xpath-linter` 49.69%-56.08% to 44.61%-48.23%, `xpath-validator` 7.50%-11.53% to 7.23%-12.34%,
`xsl-validator` 4.05%-6.11% to 3.85%-6.62% — which is 85 to 73, 15 to 16 and 9 to 10, each keeping
the headroom it had. The stage also builds a defect now, where it built none: the sheet declares one
variable nothing references, which is 160 `unused-variable` over the large corpus and the same
principle the arming above stands on.

Two earlier spellings are recorded so nobody spends the week again. Absolute growth bars were tuned
until nothing flaked here, then failed on all six CI runners at once, `corpus-linter` reading 8.7 on
macOS where it read 7.1 here. Growth as a multiple of the median passed all six — and could neither
separate the defect it was written for nor survive a loaded runner, which is both halves of this
design's reason for being.

What a gate measured at one size cannot see is a quadratic whose constant is still small there.
`circular-import` asked whether one edge's target reaches back to its source by walking the whole
import graph, once per edge, and so cost the square of a chain of imports: 2.48, 3.39, 3.53 and 3.99
per doubling from 100 stylesheets to 1600, converging on the 4.0 a quadratic predicts, where at
forty it read a flat 1.0 to 1.6 and the per-edge cost was the whole of what the gate could see
(#769). Cycle membership is a property of the graph rather than of an edge — two files sit on one
cycle exactly when each reaches the other — so one pass of Kosaraju's answers every edge at once,
and the check is linear in them at 3.4 to 4.2 microseconds a file, flat over the same range.

What holds that is a third instrument, neither tier being able to. The per-pull-request gate cannot
grow its corpus to the size the shape shows at, since every stage lints that corpus and the nineteen
cheap ones would each pay for the size one of them needs; the nightly tier would meet the shape as a
budget overrun, a night late and over a corpus chosen for something else. So
`test/import-linter.test.js` times the one check over a chain of 200 stylesheets and again over 800,
and fails past a growth of **8** — the geometric middle of the 4.0 a single pass predicts and the
16.0 a walk-per-edge predicts, and of the two measured distributions with it, 4.34 to 4.66 over
eight runs of the test against 14.58 to 16.22 over eight more. Putting the walk back fails it three
times of three, at 15.10, 15.26 and 15.32. It costs a third of a second, timing one stage over a
chain it builds itself rather than a whole pipeline over a corpus every stage reads — which is what
lets it ask about a corpus five times the size of the one the first tier can afford.

What a window holds is sixty-four passes over the short chain and sixteen over the long one, not one
apiece, because a reading has to clear the clock's own granularity and one platform's is coarse.
Windows charges processor time in scheduler ticks of some sixteen milliseconds, where a pass over
the short chain costs a millisecond and one over the long chain four, so a single pass read `0` on
both and the growth arrived `NaN` there — and worse than a gate answering nothing, two readings of
one tick apiece would have answered 1.0 and passed with the defect in place, which is the failure a
dropped non-finite reading does not cover. Sixty-four of them make each window some sixty
milliseconds, four ticks even there, and the fine-clocked platforms gain by it too: a window of one
pass needed a whole measurement discarded in front of it, the way the speed gate does, and read the
growth 3.10 to 4.56 over ten runs even so, where a window of sixty-four is warm by its own fourth
pass and reads 4.34 to 4.66 with no warm-up at all.

The second tier is for what a corpus of our own making cannot show at all. `corpora.yml` runs
nightly, cloning DocBook-XSL, TEI and DITA-OT **at pinned commits** — a branch tip would drift under
the numbers — restoring them through `actions/cache`, writing what it found to the job summary, and
failing past a per-corpus budget so `jayqi/failed-build-issue-action` opens an issue the way
`daily.yml` does — which neither of them could do until #826, and `test/workflows.test.js` is what
holds it now. Vendoring those corpora instead is a trap: each carries its own licence, and
`reuse`, `copyrights` and `xcop` would all have to be told to look away.

That tier asserts **what it read** and not only how long it took, because a budget alone is blind to
the failure it most wants to catch. It timed `xslint … --quiet || true` at first, so a run that
linted nothing passed: point it at a path that does not exist and the exit code is *zero*, no code
distinguishing "found defects" from "died", and the whole of #758 — a walk that crashes before a
byte of XSL is read — would have stayed green under it. So the step drops `--quiet`, keeps stderr,
and compares the stylesheets `find` sees on disk against the count the run reports having processed,
which are the same number or the run did not do its job. Past that it fails on an exit code above 1,
since neither a clean run nor defects found can produce one, and then on the budget.

The budget is a **ratchet and not a licence**, which is the half that was missing for as long as the
tier has existed. Cut once when it was written and then left behind by #755, #770, #776, #777, #783
and #784, the three stood 9, 14 and 18 times what they gated by the time #785 was filed, so nothing
short of a total collapse could have failed them — #755's own quadratic cost DocBook-XSL 44 s
against a budget of 180 and would have passed it twice over. So `scripts/budget.js` judges a reading
from both sides, past the budget and further than `SLACK` (four, as in `test/scaling.test.js` and
for the same reason) under it, and the step calls it rather than comparing two numbers of its own —
which `test/budget.test.js` asserts, a ratchet nobody has to route through being one an inline
comparison quietly replaces. What a budget answers to is a measurement **on the runner**: a share
cancels a machine's speed where a wall clock carries it, so a developer machine cannot set this bar,
and the notice each run now prints is where the reading is read off. Six runs of it on the tree #784
left — one nightly, five dispatched — give 13, 14, 20, 13, 13 and 14 seconds over DocBook-XSL, 9,
10, 11, 10, 10 and 8 over TEI, and 5, 4, 5, 4, 3 and 5 over DITA-OT, so the runner disagrees with
itself about one tree by half as much again and the window has to hold a slow night as well as a
fast one. The budgets were twice the dearest of those — 40, 22 and 10 — which put each budget's own
quarter at 10, 5.5 and 2.5 seconds and left the ratchet firing at 9, 5 and 2 and under, the clock
counting in whole seconds. Those three stood below the 13, 8 and 3 their corpora had given, which is
the property a budget has to hold and not merely a fact about those numbers: `CHEAPEST` in
`test/budget.test.js` asserts it, since a budget wide enough to fire on a night that has already
happened reddens a build on a tree nobody has touched.

That ratchet is what spoke next, and it is the first of either tier's to have spoken at all.
Three changes — #812, #815 and #818 — took a quarter, a fifth and a tenth off the staged run over
the three corpora, and two nightlies went red on budgets that had stopped being bars: DocBook-XSL
at 6 seconds against 40, DITA-OT at 2 against 10 (#827). Nine runs on the tree #818 left, two
nightly and seven dispatched, give 7, 6, 8, 8, 5, 8, 7, 8 and 4 seconds over DocBook-XSL, 5, 8, 8,
6, 7, 7, 7, 7 and 7 over TEI, and 3, 2, 3, 3, 3, 3, 3, 2 and 3 over DITA-OT. Twice the dearest of
those is **16, 16 and 6**, whose quarters are 4, 4 and 1.5, so the ratchet fires **at 3, 3 and 1 and
under** against cheapest nights of 4, 5 and 2. Reverting the matrix to 40, 22 and 10 fails four rows
of `test/budget.test.js`, three of them `CHEAPEST`'s; a budget under the dearest night fails that
corpus's ceiling row alone; one tick past the new cut, DocBook-XSL at 21, fails `CHEAPEST` on its
own, and DITA-OT does at 9.

What is thin is the **clock** rather than the cut, and the ninth of those runs is where that shows.
It read DocBook-XSL at 4 seconds where the eight before it read 5 to 8, so one corpus spans a factor
of two on a tree nothing has touched — and since `SLACK` is four, a window can hold a fourfold
span at most, which leaves that observed spread filling half of it and the ratchet standing one tick
under the cheapest night rather than two. DITA-OT is the same thing at the clock's own edge: 2 to 3
seconds where `date +%s` counts in whole ones is a third to a half of the reading in quantisation
alone, so a bar cut from it is cut partly from noise. Both windows held — [4, 16] and [2, 6] — so
that cut stood on the clock the tier had, and #827 stands rescoped to the clock itself, the cut
having closed #826 alone.

`date +%s%3N` is that clock, and the first thing it settles is the spread. Six dispatched runs on
the tree #849 left give 5899, 6923, 5746, 4666, 6888 and 6859 ms over DocBook-XSL, 6732, 6454,
6463, 6287, 6381 and 5013 over TEI, and 2997, 3056, 2878, 3311, 3290 and 2830 over DITA-OT — spans
of 1.48, 1.34 and 1.17 rather than the factor of two whole seconds reported, since a true 4666
reads as 4 and a true 6923 as 6 and the grid widens the pair before anything measures it. The
margin was a grid artefact the same way: under the old 16000 a millisecond DocBook-XSL stands 1.17
above the ratchet, where 4 against a threshold of 4 says exactly none. Twice the dearest is
**13000, 13000 and 6000**, whose quarters are 3250, 3250 and 1500 against cheapest nights of 4666,
5013 and 2830 — margins of 1.44, 1.54 and 1.89, each budget standing between 1.81 and 1.93 times
its own dearest reading.

That margin is the bar the tick used to stand in for. `MARGIN` in `test/budget.test.js` asks each
budget to stay quiet on a night 1.2 times faster than the cheapest on record — the geometric middle
of the 1.00 the whole-second cut recorded and the 1.44 this one leaves — and `RESOLUTION` asks a
tick to stand under 0.013 of what its corpus costs, the middle of DITA-OT's half and its 2830th.
The row those two replace asked for one tick of margin, which a millisecond grid turns into a
question no tree can fail; and since both are written in ticks, a third row reads the workflow for
the `date +%s%3N` that makes a tick what `TICK` says it is. On master all three redden — every
corpus fails `RESOLUTION`, DocBook-XSL fails `MARGIN`, and the step spells `date +%s`.

Three questions #827 parked are answered by that table rather than by a change. A **median of
several runs** narrows nothing a 1.48 span cannot already carry inside a fourfold window, and would
cost the tier a clone a night to defend a margin that is 1.44 at its worst. **`SLACK` at four** is
a span the widest observed spread fills a third of, leaving 1.44 under and 1.88 over, so it holds
for a wall clock as it does for a share, and a bar raised on nobody's failure is a bar loosened.
And **DITA-OT** is not too small to gate: at 2830 ms a tick is one part in 2830, and its margin is
the best of the three. The corpus was never what was too small.

## `test/conformance.test.js`

Enforces naming, motives, selector hygiene — including that a selector comparing an expression's
text with a quoted literal names both quote spellings of it, since
`incorrect-use-of-boolean-constants` named `"'true'"` alone and read half the stylesheets it is
about (#549), and that none names an element by `name()`, which answers a *prefix* where a node test
answers a namespace (#784) — pack/test coverage, the `mature` freeze across all kinds, the fast/deep
split of the suite itself, and that no test writes a scratch file outside a temporary directory. A
pack gives one position per defect it expects, too: the harness walks the `positions`, so an
`amount` standing above their number is a count asserted and a place asserted nowhere — three packs
of #565's own were written that way and passed, pinning four runs' replacements while saying nothing
about where any of them stood. It also asks `splitOf` of every `xpath` selector and holds the answer
to `UNINDEXED`, the seven that a shared walk cannot serve as an axis, each listed beside the shape
that keeps it out (#784) — fourteen until #811's union phase served three of them, eleven until its
anchor phase served three more, and eight until its fourth parted the one selector spelling a union
*inside* a sweep, so neither a union nor an anchor is a reason to be on the table any longer:
`malformed-version-in-stylesheet` stays out as a **bracketed** union of attribute
paths, which is one predicate standing outside the brackets and an axis the merge cannot order —
fifteen until #556 gave `using-disable-output-escaping` an element test, which took it off the table
by making it servable rather than by anybody editing the list. A structural gate rather than a share
bar, because a bar can only notice the cost after a selector has been written the broad way: a check
whose selector becomes servable and stays on the list fails, and so does one on nobody’s list that
has stopped being served, so neither half can rot in silence. It also holds the pack harness to
being one, from both ends. Every directory holding packs is handed to it exactly once, matched
one-to-one against the `dir:` a harness call names — the gate that was missing while the harnesses
were twenty-two files, because deleting one deleted a loop and left its neighbours to notice, where
deleting one call now deletes every assertion over a directory at once: eleven of the twenty-two
could go with the coverage gate still reading 100%, `xpath-packs` and its thirty-eight declarative
checks among them. And a second copy of the harness is refused, by refusing any `.test.js` but its
own to read what a pack expects — `found.amount`, `found.positions`, `found.fixes` or `found.values`
— which together replace the one asking whether the harness owning a directory mentioned
`found.fixes` at all: a text check standing in for structure, reaching 19 of the 22 and able only to
ask whether the string appeared rather than whether it was asserted correctly (#660). A third way it
can rot is one the sweep cannot see, walking the checks rather than the table: #788 took five
selectors into code and three of them were listed here, so the entries outlived the checks they were
written for, and a test of its own holds every name on the table to `checks/xpath/`. A cross-file
selector answers to a gate beside it with no table at all: all five of them are served since #811,
and where the per-file kind has fourteen shapes a walk cannot reach, four checks of one shape each
are few enough that a fifth belongs in that shape too. An attribute axis has also stopped being a
reason to be on the table, which is the second way an entry rots — a refusal that stands while the
reason for it has gone: `malformed-version-in-stylesheet` stays out as a union of two whole paths,
not as the attribute path each half of it opens with. Selector hygiene grew a fourth question
at #491: a selector counting the elements a node holds — `count(*) = 1`, which is how a check spells
*nothing but this one instruction* — must weigh its text too, text standing beside the instruction
answering that question as much as a second element does. Two of the three selectors spelling it
were false positives on real code, `blank-nested-if` on an `xsl:if` whose text a collapse would drop
and `setting-value-of-variable-incorrectly` on a variable body concatenating a prefix onto a value;
the third is exempt on `COUNTING` because what its advice writes carries the text along, an
attribute value template holding literal text beside the expression so that
`Prefix: <xsl:value-of select="heading"/>` inlines as `class="Prefix: {heading}"`. That exemption
ratchets from both sides as the rest do: an entry whose selector has started weighing text, or
stopped counting elements, turns red.

A fifth arrived at #817, one attribute over: a selector reading `text()` to decide whether a node
holds content must read `xml:space` beside it, since that attribute decides whether a
whitespace-only node is there at all. All four that read it were wrong under `preserve` —
`blank-nested-if` and `setting-value-of-variable-incorrectly` advising a collapse that drops the
whitespace, `empty-content-in-instructions` calling an instruction empty that emits three spaces,
and `variable-or-param-with-select-and-content` silent on a blank body beside a `select`, which is
XTSE0620 and a module SaxonJ-HE 12.5 refuses to compile where xsltproc is lax. The clause names the
**nearest** declaration, `ancestor::*[@xml:space][1]`, because a nearer `default` cancels a
`preserve` above it — dropping that `[1]` passes every other test and fails only the four
`cancelled-preserve` packs written for it. `text-outside-xsl-text` is exempt on `EMITTED`: it asks
what a processor *emits* rather than what an element holds, and under a `preserve` every indentation
run is emitted text, so its answer changes too but `xsl:text` around each run is no advice at all.
Since #817 the two exemption tables answer one gate rather than two, `EXEMPTED` pairing each with
the question deciding whether its entries are still needed — the same ratchet twice over, not a
shape worth spelling out twice.

A sixth arrived at #849, and it is the one that had been wrong the longest. XSLT 3.0 writes any
attribute of an XSLT element twice over — `x`, and `_x` whose value is an attribute value template
evaluated before the module compiles — and `src/attributes.js` has read that spelling since #606
where no selector ever did. Every one of the ten testing an attribute's presence with `not(@x)`
reported a stylesheet SaxonJ-HE 12.5 loads without a word: a `_select` on an `xsl:variable` drew
`empty-variable`, a `_match` on an `xsl:template` drew `template-has-no-name-or-match` and
`mode-or-priority-without-match` together, and the check #668 adds beside them would have joined
the list had it been written the same way. Two carried a fix and so damaged the file rather than
only misreading it. `mode-or-priority-without-match` deleted a `@mode` its template was really
using, leaving that rule and the root one matching `/` at equal priority — `XTDE0540`, out of a run
whose whole promise is that a fix preserves meaning. `missing-version-in-stylesheet` wrote
`version="1.0"` beside a `_version="{'3.0'}"`; Saxon still loads that, but `versionOf` reads the
one that was written, so a sheet holding an `xsl:for-each-group` drew no
`modern-construct-in-xslt-1` before the fixer ran and one after — a check writing a wrong version
and a second check believing it.

`SUPPLIED` reads every `not(@x)` a selector spells and asks for the `not(@_x)` beside it, with
`SHADOWLESS` naming what is exempt: `xsl:version` alone, for a reason no other attribute has. It
is what makes a literal result element a stylesheet at all, so the mechanism that would read a
shadow one is not running yet, and Saxon refuses both spellings there — `xsl:_version` as
`XTSE0150` and `_xsl:version` as `SXXP0003`. That table ratchets like the rest: an entry whose
selector has gained the guard, or stopped asking, turns red. No corpus said any of this. DocBook-XSL,
TEI and DITA-OT hold no shadow attribute between them, so the nightly tier reads the same numbers
either way and the ten packs are the whole of the pin.

What that gate reads is the negated spelling and nothing else, which is a bound worth stating
rather than leaving to be found again. Asked the other way — a bare `@x` in a predicate, standing
for *the author wrote one* — the same question is open in three selectors, each measured the same
way. `variable-or-param-with-select-and-content` misses a `_select` beside content, `XTSE0620` on
Saxon and the exact fault it exists for; `mode-or-priority-without-match` misses a `_mode` on a
matchless template, `XTSE0500`, which is the positive half of the very selector fixed above; and
`modern-construct-in-xslt-1` misses an `_as` in a 1.0 sheet where an `as` fires. A fourth of that
family is closed here by accident rather than by design — `empty-variable` asks `(@as or @_as)`
because that clause stands inside a `not(...)` `SUPPLIED` can see. Two must never join them:
`unused-named-template` and `unused-variable` read the attribute's *value* and match usages
against it, where a shadow one holds an expression producing the name rather than the name. A
third group wants the value for that same reason and can only ever go quiet, never invent a
defect — the version gates of three checks, `versionOf`, and `importsOf`, whose
`hasAttribute('href')` builds no edge for a shadow href (#851).

The line cap is held from a third side since #825. A file the cap is lifted off must have its
length stated in a guide, and the number must be the one ESLint reads: `SPRAWLING`'s membership was
gated where the length beside it was not, so the one file carrying an exemption went on being
described at #748's reading of 1828 while it stood at 2386, a drift of 30% under a paragraph
promising that neither half could rot in silence. The length is asked as the cap twice, quiet at the
stated length and reporting the file one line under it, so the reading is ESLint's own in the unit
the cap is written in rather than a second count taken beside it — which would have to argue about
whether the newline a file ends with is a line of its own. Every guide is read rather than the root
alone, so a number that moves into a directory guide is judged where it went; and an exempt file
with no stated length at all fails as loudly as one whose stated length has drifted, an exemption
from a bound being bounded by nothing but the number a reader is given. A claim is a count of lines
standing within `NEARBY` characters of the file's own name, so the drift above is recorded as a
reading and not as so many lines: the gate cannot tell what a ticket once measured from what the
file stands at today, and a history spelled the other way is a stale claim it rightly fails.

## `test/predicates.test.js`

Two tables, and the second is the load-bearing one. `COMPILED` names every spelling the vocabulary
answers off the walk, so a construct that stops being served turns red rather than quietly costing
a fontoxpath call per candidate again. `REFUSED` names every spelling it does not, each beside what
puts it out of reach, and is a ratchet from the other side: an entry that *becomes* reachable fails,
so the list cannot sit there reading like a limit still in force after the limit has gone. It caught
its author — widening the vocabulary to sibling and ancestor axes, a path in a value position and
two string functions turned five `REFUSED` rows red in one run, which is the whole reason they are
rows and not a sentence.

A third gate stands beside them and its subject is the module's own header note. Relocating a
derivation into one — which is what the bar below forced here — takes it out of the reach of the
gate holding a guide's counts to the code, `DOCUMENTS` naming guides and the README and no source
file but `src/attributes.js`. So the two counts that note states of the vocabulary's reach, 28 of
38, are computed here from `checks.json` and held to it: every branch a selector splits into that
the walk serves, parted by the `predicated` a run parts with, each predicate asked once. Both
kinds are read, a corpus check's declaration and usage reaching `predicateOf` as a per-file
selector does — the `xpath` kind alone answers 26 of 35, which is no number a run ever sees, and
counting it that way is how the note came to say 33 and 24. Two sentences carry the pair in
opposite orders, so both are read and rewording either fails, the lesson `DERIVED` records one
section down.

Neither table asks whether an answer is *correct*: that is `CANDIDATES` in `test/selectors.test.js`,
which asks fontoxpath what each spelling selects over `candidates.xsl` and fails where serving
answers anything else — the oracle, 102 rows here against 32 before, and armed against the engine
before a line of the compiler existed. A row there is a question rather than a claim, so enriching
the fixture can only strengthen it; the fixture grew five variables and a non-XSLT child so that
presence, a literal sequence, a string length, a parent and `count(*)` each split the nine
candidates unevenly. One thing it cannot hold is a prefix `src/xpath.js` does not bind:
`my:thing` stands in the document for `count(*)` to see and is named in no selector, the engine
raising `XPST0081` on an unbound prefix rather than answering.

What a question cannot reach is what nobody hands it, and that is how three defects walked past 87
rows of it. Two things a table of *predicates* cannot supply: the **characters** the fixture is
written in, every name in it having stood inside the Basic Multilingual Plane where `.length` is
XPath's `string-length` by coincidence, so a shipped check went silent on a name of one astral
character and the row asking a length of one passed — a test asserts the fixture still holds such a
name, an arming being no assertion until something fails without it; and the **kind** of node a
predicate is handed, `AXIS` being one element step, so no row could reach an attribute's missing
parent or a root element's document standing in for one. `HEADED` is the answer to that second
one: ten rows carrying a head of their own, `//@*` read off the check that spells it, and
`answered` compares a **place** and no longer a name, an attribute having no `getAttribute` to
answer with at all.

## `test/guides.test.js`

The size and the shape of the guides themselves, and so the one gate whose subject is this
repository's own documentation (#821). The root guide held 198,202 characters before it, most of
them a per-module archive loaded on every turn, including every turn that never opens the module;
and the gate that read that file then — holding its counts of `ATTRIBUTES` and `PATTERNS` to the
lists in the code — said nothing at all about its size, in the file that says every convention must
be machine-enforced. What answers it is a relocation and never a summary, those derivations being
what stops a later session loosening a bar that was placed on evidence: each note moved into the
`CLAUDE.md` of the directory its module sits in, where it arrives when that directory is opened, and
the root keeps the rules, the bars, and one line per file. `LOADED` is the 150,000 characters the
harness warns past, and what arrives against it is a **chain** and not a pair: the root guide, and
the guide of every directory on the way down to a file the turn touches, each injected once. That
was measured rather than assumed — two throwaway guides planted at `src/resources/` and
`src/resources/motives/`, neither of them ever read as a file, both arrived the moment a motive
under them was opened. The first spelling of the bar weighed the root against the dearest single
guide instead, which is a whole directory short: it read 130,933 and called that 0.87 of the bar
while a turn touching `src/linters/` was loading 157,504 and over it. So the two dearest notes moved
one step further down, out of `src/CLAUDE.md` and into the top of `src/grammar.js` and
`src/syntax.js` — 24,681 characters — and the dearest chain is that same one at 148,579, which is
0.99. What answers a chain reaching the bar is that move again, a module's derivation into the
file-header note of the module itself, and never a bar widened to fit what has grown past it: a
docblock holds five lines of description since #832, so prose that has outgrown a guide does not
simply move into one instead. A `CEILING` of half the bar stood beside it until it was seen to be a
gate no tree could fail: the root stands in every chain, so the chain holding it above weighs each
other guide against the bar less what stands over it — 33,419 for `src/linters/CLAUDE.md`, where
half of the bar is 75,000 — and holds the root itself to 72,656, a number derived from the dearest
chain rather than chosen. A gate no tree can fail is removed and not kept (#750, #660). All four of
those figures — the chain, its ratio, and the two allowances — follow from three file sizes, so one
guide growing moves every one of them, and none of them turned red when one did: #811's fourth
phase added 3,421 characters to `src/CLAUDE.md` and left the chain reading 140,286 where two
documents still said 136,418, the allowances 3,868 out, and the ratio 0.94 where three places said
0.91. The bar itself was quiet throughout, as it is until 150,000, which is why this is the third
time the same class of figure has drifted. `DERIVED` in `test/guides.js` holds each of them now,
red from both sides in the way `SPRAWLING` and `UNINDEXED` are: a figure the tree disagrees with
fails, and so does a figure standing in a document the row does not name, since a claim nobody is
reading is not a claim being kept. That second half is a **set** and not an `any`, which is the
whole of it — the chain and its ratio are carried twice, `test/CLAUDE.md` saying "the dearest
chain is that same one at" where `test/guides.js` says "the dearest reads", so a gate asking
whether
*some* file still matches is satisfied by the untouched one. Rewording only the first, to say
136,418 and 0.91 again, left the figure wrong by 3,868 and the ratio by 0.03 with the suite reading
16 passing: the drift gate had stopped reading that sentence and the anchor gate was happy off the
other file. Each row therefore names every file expected to carry it and the matched set is
compared whole, so rewording either carrier fails, and so does the claim appearing in a document no
row names. Growing a guide by 4,000 characters fails all four rows at once. The asking is
`matchAll` and never `test`, a global pattern leaving `lastIndex` where it stopped and answering
`false` to the very next question about the same prose. What that leaves is 1,839 characters of
headroom, and the paragraph above stopped being advice while this change was being written: #846
grew `src/linters/CLAUDE.md` by 3,113 and the merged chain read 150,437, so the bar failed on a
tree whose two authors had each stayed under it. The prescribed relief is the one taken —
`src/predicates.js`'s derivation went into the file-header note of `src/predicates.js`, 2,507
characters out of the chain and none out of the record — which is the third note to move that way
after `src/grammar.js` and `src/syntax.js`, and the first to move because the bar said so rather
than in the change that wrote it. The index
answers to the tree from both sides, every path it names existing and every module under `src/`
being named by a row — the twenty-one linters by one of them, the `*` standing for a name and never
for a directory — and a note answers to the index and to its own directory both, so a derivation the
root has stopped pointing at turns red, and so does one standing where the reader who needs it will
never load it. `test/guides.js` is the walk itself rather than a list of the five, since a guide
left off a hand-written list would take its claims out of every gate at once, and the reading of a
claim stands beside the walk: `worded` flattening a wrapped paragraph into one line, `DOCUMENTS`
naming the guides and the README together, `NEARBY` bounding how far past a name a number may stand
and still be a claim about it. Both gates ask it, so a count relocated into a guide is judged where
it went, and so is the length a guide states of the file the line cap is lifted off, which is
`test/conformance.test.js`'s to ask beside the cap it is an exemption from. The counts came the
other way at that same sitting: `ATTRIBUTES` and `PATTERNS` are held to the lists in the code from
here now, the file that held them having reached the 1000 lines it caps every other file at (#825).

## `test/grammar-corpus.test.js`

The two gates #680 stands in front of the parser, asked of every expression the repository carries —
644 of them, from the committed stylesheets, from the ones the packs hold inline, and from the
selectors the declarative checks are themselves written in. **Round trip**: a parse's tokens join
back into the expression byte for byte, every node's span slices to its own text, and every child
nests inside its parent in order — the last of those is what slicing cannot see, since shifting a
node and its children together still slices. **Acceptance diff**: the verdict is diffed against the
engine's, asked as `compiles` and asked alone — a respelling retry sits on the engine's side of that
comparison and hides every expression fontoxpath refuses and the squeeze rescues. Forty do, and they
are #639's family exactly, a spaced axis or a `namespace::`; asking
`compiles(xpath) || compiles(squeezed(xpath))`, which is what `isValid` was until #732, cancels
every one and reports the evidence for retiring the retry as absent from the tree, when what is
absent is a comparison that can see it. So the forty are *subtracted* rather than cancelled:
`insists` in `test/strictness.js` reads the class off the token stream, `EXPLAINED` takes it out of
the diff, and what is left over is annotated one line each in `GAPS`, naming the side that accepts
and the gap it stands for, so a new one and a stale one both turn red. Subtracting a class can hide
a defect the way the retry did, in one direction, and that direction is gated: the class may only
ever excuse the grammar accepting where the engine refuses, never the engine accepting where the
grammar refuses, which would be an invented defect excused (#738). Eleven stood when #680 wrote that
list and **none** does now, which is the measure working rather than the measure going quiet: nine
were a parenthesized step (#711), one a node comparison (#724) and the last a name no NCName can
spell (#708). An empty list is an assertion, not the absence of one — every expression the
repository carries takes the same verdict from both sides, so a disagreement of either kind turns it
red — and it does not claim the two agree everywhere, the corpus reaching only what the corpus
holds, which is why the classes #708 closed that no fixture spells are pinned in
`test/grammar.test.js` instead. The corpus is gated as well, because a sweep can pass by finding
nothing: each of the three sources must still yield what it did when the gates were written, and the
class must still have forty expressions to subtract. The selectors are one expression in twelve and
held ten of the original eleven gaps — the checks are written in an idiom the stylesheets never use,
which is why a corpus of stylesheets alone (#708) agreed completely and proved little.

## `test/grammar-shapes.test.js`

The same acceptance diff as `grammar-corpus.test.js`, asked of 14112 expressions nobody wrote: every
shape a head and one or two tails spell, spaced and glued. A corpus covers only what somebody has
already written down, and every class #740 closed stood outside the repository's — so `GAPS` read
empty while the grammar refused `text() + 1` and accepted `a?b`, and this sweep parted from the
engine 1603 times on the same head. Both classes it was left with are closed by #742, and a
generated sweep covers only what its own lists spell, which is the corpus limit one level up: the
second was annotated `\? (WORDS)` over a `TAILS` naming no `+` at all, so `xs:integer+ and @b` stood
outside its own net, and widening the annotation to `[?+]` uncovered
`cast as xs:integer? instance of x` behind it. A predicate too broad to be a class is one failure
mode, since an annotation that swallows the next defect turns nothing red; too narrow is the other,
and this file was in it. What is annotated now is not a gap in the grammar at all — fontoxpath
accepts a word run against the *arity* of a named function reference, where Saxon-HE 12.5 answers
`abs#1div 2` with XPST0003 exactly as it answers `1div 2`. One engine's verdict is evidence and not
an answer, which is why a second arbiter settles it; `net.sf.saxon.s9api`'s `XPathCompiler` judges
them in well under a second, and reading its *code* rather than its exit status is what tells a
syntax error from the undeclared prefix or unknown function behind one. That cost is why the fast
half now answers in under two seconds rather than under one. The lists grew by four heads and three
tails at #753, from 8064 shapes to 14112: a kind test carrying arguments is a head now, and the item
types whose brackets hold a type are tails, so the productions that read them stand inside the net
rather than beside it. The gate on the count moved with them, since a sweep that has been narrowed
reads exactly like one that agrees.

## `test/strictness.js`

`insists(xpath)` — whether fontoxpath refuses an expression over its own strictness rather than over
anything malformed in it: a `namespace::` axis, ExprWhitespace around an axis separator,
ExprWhitespace inside a node test (#615, #639). It is the account that replaced the respelling
retry #738 deleted, and it is a test-side module because a run has no use for it — nothing in `src/`
asks what one engine insists on. Read off the token stream, which is what tells the axis of
`1-namespace::x` from the one name of `a-namespace::x`, the lexer having already decided which a `-`
is where a lookbehind would be reading characters about a question that is about tokens; the
thirteen axis kinds are borrowed from `src/tokens.js`'s `AXIS_KINDS` rather than written down a
second time. What it is not is an oracle of validity — `child ::` holds a spaced separator and is no
expression — so a gate reads it *beside* `parsed`, never instead of it, and
`test/strictness.test.js` pins that with the class it names and refuses all the same.

## `test/helpers.js`

The only door to a child process in the suite: `runXslint`/`xslintStatus`/`xslintStreams` run the
CLI, `xcopped` judges every stylesheet a directory holds, asking xcop over the directory rather than
once per file — 0.1 seconds against 25 (#687) — and rather than over a list of paths, `cmd.exe`
taking a command line of 8191 characters where 356 of these are four times that. What one run cannot
give is a verdict apiece, xcop stopping at the first stylesheet it refuses, so it asks again from
there: a refusal is recorded against the file it names and that file is renamed out of the five
extensions xcop globs, which makes a sound directory one process, a directory holding two bad files
three, and a bad file the only thing that ever fails (#694). A file no run mentioned takes the whole
of what xcop printed as its verdict rather than asserting against nothing, `cmdAvailable` answers
whether a tool is there by running it, and `walkedWith(dir, kilobytes)` runs `allFilesFrom` in a
process whose JavaScript stack is that small. That last one hands back the largest spread the stack
allows beside the walk's own answer, because a walk that survives proves nothing unless the trap was
armed and how many arguments a spread carries is V8's business — a Node that moved the number would
otherwise leave the test quietly proving nothing (#758). The kilobytes are the smallest stack worth
asking for rather than the stack: node needs some seventy to start here and more where a platform's
frames are wider, so the ask doubles until one answers and the stack that did comes back, for a
caller that has a second question to put to the same size. `xslintUnread` is the one reader here
that deliberately does not read: it leaves the pipe alone until stderr says how many defects were
found, so the run is left writing into a pipe nobody is emptying, which is the write `process.exit`
abandons (#767). What it must not do is leave that data there for somebody else to flush. It reads
in **paused** mode with a `'readable'` listener standing on it from the start and takes the data
with `read` once the stall is over, because one `process.nextTick` after a child exits `flushStdio`
resumes every readable stdio stream of it — deliberately, so the stream can reach eof — and `resume`
sets `state.flowing` to `!state.readableListening`, so a listener is what makes the paused mode
node's own rather than merely this reader's. Attaching the reader at the end of the stall instead
left that resume flowing, so wherever the run finished first the whole report was read and thrown
away: the row asking for a report narrower than the pipe lost every line of it, and the wider row
lost every line on a host whose buffer takes those 147,620 bytes whole, rultor's docker container
among them — eleven merges in a row reading `-0` on a commit six GitHub runners passed (#822).
Behind the trigger stands a fallback, since a run that never reaches the summary would otherwise
leave the pipe unread and the promise unsettled.

## `test/packs.js`

The one harness every pack directory is read through — `test/conformance.test.js` holds that
one-to-one rather than leaving it to the prose: `harness({dir, noun, run})` asserts the amount, the
position, the name, the severity and the message of every defect a pack expects, the `fixes` and
`values` it declares, and that each check the directory expects a defect from goes quiet when the
run suppresses it. It was twenty-two files of one loop with three things swapped, so an assertion
had to be written twenty-two times and one written twenty-one times failed nowhere — which is how
`import-packs` came to assert no fix while `redundant-import` attached a real deletion (#660).
Suppression is asked under a *prefix* of the check's name, `--suppress` matching by substring, so a
linter comparing the two for identity fails rather than passes. Which checks to ask it of is derived
twice and the two answers compared, because the first spelling marked a name seen whether or not the
pack was loud and so registered nothing at all for the two directories whose quiet pack comes first
— a harness that silently asks nothing reads exactly like one where everything is covered.

## `test/scaling.test.js`

The speed gate (see **Speed**): charges every stage its own processor time over a generated corpus
at 40 stylesheets and again at 160, and fails one that spends more of its own run than `SHARES`
allows it — `xpath-linter` at 46%, `xpath-validator` at 24%, `xsl-validator` at 16% since #811's
anchor phase took the dearest stage from 34.03% of the run to 29.44% and lifted the twenty-two
others by what it left the denominator, or — where it has no entry there — grew more than `GROWTH`
beside the middle stage's growth. Cost is the sharp question and growth the loose one, because #755
changed a constant and not an exponent, which is a difference the two distributions show plainly:
15.1% to 15.7% of the run against the quadratic's 26.5% to 31.9%, where in growth the fix reads 1.85
to 2.04 and the quadratic 1.66 to 2.43 — the lowest reading being the one judged, growth ranks them
backwards. What the cost is a share **of** is the whole run, the readings summed, and it was the
middle reading until #777: fourteen of the eighteen stages lie within a factor of two and keep
swapping places, so the pair landing 9th and 10th decided the denominator of every share, and #775 —
which made one of those two cheaper and touched the cross-file linter not at all — lifted every
share by about a quarter and failed the gate. Growth still divides by the median, and for the reason
cost cannot: every ordinary stage grows about as the corpus does, so a median growth is any ordinary
stage's growth, where an ordinary *cost* is a coin toss between two near-identical readings. The
corpus is the assertion as much as the bar is. It is copied from one committed
`test/resources/scaling/stylesheet.xsl`, the way every test stylesheet here lives in a file, with
the number of each file substituted into every name it holds — so no two share an expression, a
declaration or a namespace, and the memo in `src/syntax.js` cannot make the larger corpus look
cheaper than it is. That stylesheet holds a namespace nothing uses, an import, a literal result
element, one unused parameter, one pattern opening with a `//`, and a call of every shape a linter
is about, because a stage handed nothing it reads cannot be measured at all: the three per-document
linters were exactly that, 0.3 ms with a spread of 358%, until it grew namespaces and imports. How
*much* of a construct it grows is its own question, and the parameter is where that showed. A pair
in each of the four templates read fine for `parameter-linter` and took `corpus-linter` from 9.5 to
14.4 of the middle reading, past the 13 the bar stood at before #777 — every `@name` being a usage,
and three of the four cross-file checks giving `//@*`. So it is armed with the fewest attributes
that still leave the new stage a defect to build, which is one unused parameter, and against the
whole run that costs nothing a reading can see: 16.4% to 17.7% for the cross-file linter where
master reads 14.4% to 18.1% on the same machine, and 0.94% to 1.07% for the new stage. The `//`
of #586 is armed the same way and for the same reason — five patterns a file reach
`double-slash-linter` and none of them built a defect, so 0.08% to 0.11% of the run was the walk
alone and every step past it went untimed, where one leading `//` reads 0.18% to 0.19% and takes the
cross-file linter nowhere a reading can see, 6.46% to 7.10% against the 6.69% to 7.24% the unarmed
corpus gives on the same machine. A corpus that arms one stage must not disarm the bar on another —
which under the middle reading it could, one attribute per file having been enough to move a
denominator two cheap stages were swapping places at. What one sheet copied cannot arm at all is the
*skew* of a real corpus, which is where the cross-file stage really spends: `//@*` costs 1.3 to 3.2
us a node under some 350 nodes and 50.4 at 4853, so five of DocBook-XSL's 315 stylesheets are two
thirds of that selector's whole cost. Every fortieth stylesheet is a **heavy** one since #800 — the
repeatable part of the sheet written out forty-eight times over under names of its own, 5207
elements and attributes — which the sheet marks with a `<!-- repeated -->` comment of its own, since
the `fixtures` job fails a `.test.js` holding a start tag and a marker a test matches on is the
fixture's to spell either way, and the stage reads 15.95% to 18.94% where a uniform corpus of any
density reads 7% to 10% against the 13.73% TEI charges it and the 21.95% DocBook-XSL does. `SHARES`
and `SHARE` were re-derived a fourth time at #784, whose shared walk took `xpath-linter` under a
third of the run and lifted every share taken against it (see **Speed**) — and the corpus this one
built survives that, both sides having risen together: the stage reads 19.51% to 20.08% here against
the 17.3% TEI charges it and the 25.7% DocBook-XSL does. That walk did not serve `//@*` itself, an
attribute axis standing outside buckets that hold elements, so the one selector this stage is almost
all of paid #635 in full until #811 gave the walk an attribute of its own — after which the stage
reads 1.20% to 1.23% of the run here, its entry in `SHARES` is gone and `SHARE` is what it answers
to, and the heavy stylesheet #800 armed it with arms the parse and the per-file checks alone.

## `test/xcop.deep.test.js`

Writes every pack's inline XSL to one `mkdtempSync` directory — under a subdirectory named for the
pack's own, since a basename names two packs as readily as one (#693) — and runs xcop over it;
pending, never absent, where the tool does not run. `UNFORMATTED` names the packs whose fixture xcop
must refuse, by the path each stands at, and every entry is asserted rather than skipped: one whose
pack xcop accepts turns red, which is how four stale exemptions were found. Two gates need no xcop
at all and so run wherever the suite does — every entry names a pack that is there, and no two
fixtures share a path.

## `test/workflows.test.js`

Every job granted the scope its own steps write with. Both nightly tiers end in a `report-fail` job
whose only purpose is to say that they failed, and for as long as either has existed neither could:
a workflow token here is granted `read` unless the workflow says otherwise, and neither
`corpora.yml` nor `daily.yml` declared a `permissions:` block, so
`jayqi/failed-build-issue-action` authenticated as a token that cannot POST and died on
`Resource not accessible by integration` — inside a job that runs only when something has already
failed, which is the one place a failure is heard by nobody. Two nightlies went red that way in one
week and neither filed anything, the last `build failed` issue in the repository being five months
old, so a red schedule read exactly like a green one unless somebody opened the Actions tab by hand
(#826). It is the same shape as #645 and #701 one tier out: not a suite that asserts nothing,
nor a checker that rewrites what it should fail on, but a gate whose **reporter** is broken.

`permissions: issues: write` on each of those two jobs is the whole of the fix — on the job rather
than the workflow, so the `lint` and `build` jobs they depend on stay read-only — and the two
workflows that already needed write scope declare it the same way (`release.yml:9`,
`docs.yml:12`), which is why these two read as missed rather than decided. What stops it going
again is the gate: `WRITES` names each action that writes to this repository rather than reading
it, against the scope its token needs, and every job of every workflow is read for the actions its
steps run and the permissions in force over it — its own where it declares any, the workflow's
otherwise, and `write-all` granting whatever is asked. It is red from both sides, as every
exemption table here is: a job running such an action without the scope fails, and so does an entry
naming an action no job runs, so neither half can rot in silence. Removing either `permissions:`
block fails it naming that job by file and name.

What no gate covers is the write itself. Nothing in CI POSTs an issue, so the token's scope is
asserted where it is declared and not where it is used, and an action that starts needing a second
scope would break exactly as quietly as this one did.
