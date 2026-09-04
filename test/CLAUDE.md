# `test/` — the suite's instruments

What each instrument of the suite measures, and the evidence every bar in it stands on.
The bars themselves, and the rules for placing one, are in the root `CLAUDE.md`; this file
is the derivation under each. A bar re-derived without its reading recorded here is a bar
nobody can check. A note that outgrew the chain stands at the top of its own file instead,
so an instrument the root index names with no section here carries its own (#844).

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

The tenth move is #811's bracket phase, and its subject is the one selector the fourth phase could
not part: `malformed-version-in-stylesheet` spells a union of two attribute paths *inside* a bracket
its predicate stands outside of, which is neither a sweep to part nor an axis the merge could order.
`(A | B)Q` is `AQ | BQ`, so distributing the tail leaves two selectors the walk already serves, and
`ranked` in `src/tree.js` numbers a document's attributes for the merge to order them by, `named`
ranking elements alone. The check goes from 200 ms to 17 over DocBook-XSL, 181 to 14 over TEI and 87
to 24 over DITA-OT, lowest of three interleaved rounds a side of processor time, which is 8.9%,
14.2% and 10.7% off `xpath-linter` and 4.1%, 3.7% and 3.7% off the staged run, the report
byte-identical at 3,624, 5,514 and 1,192 defects; no other check's split changed. Over the gate's
own corpus the stage reads 28.48% where it read 30.42%, dearest of six gate runs a side, so its
entry comes down by its own ratio, 42 to 39, and the other two stay, `xpath-validator` reading 1.04
of what it read and `xsl-validator` 1.00, which leaves 26 and 18 at 1.59 and 1.34 of their dearest
readings; `SHARE` stays at 7, the dearest cheap stage having moved by 1.01. By the ratio and not by
the band, since this machine reads 30.42% where #845 read 24.82% on the same code: a ratio leaves
every runner the margin it had where an absolute re-cut moves an entry by a quarter on nobody's
change.

The ninth move is #811's descendant phase, and it is the first where the walk **gathers** rather
than follows: a subtree is no chain of links to climb, so `below` in `src/predicates.js` pushes its
way down one, and `.//X` — the whole of what two checks are written in — stops costing a fontoxpath
descendant traversal per candidate. `oversized-template` goes from 231 ms to 17 over DocBook-XSL,
202 to 14 over TEI and 137 to 17 over DITA-OT, `function-complexity` from 11 to 3, 31 to 3 and 13 to
4, lowest of three interleaved rounds a side of processor time, which is 11%, 11% and 13% off
`xpath-linter` and 4.7%, 3.9% and 4.7% off the staged run, the report byte-identical at 3,624, 5,514
and 1,192 defects. Over the gate's own corpus the stage reads 24.82% where it read 27.18%, dearest
of ten gate runs a side, so its entry comes down by its own ratio, 46 to 42. The other two stay,
`xpath-validator` reading 1.00 of what it read and `xsl-validator` 1.04, which leaves 24 and 16 at
1.09 and 1.52 of their dearest readings; `SHARE` stays at 7 for the reason it has stayed there
before, the dearest cheap stage having moved by 1.03. Ten rounds rather than five because one round
a side came out disturbed — a single stage eating a fifth of its run, and on both sides — and each
is kept rather than dropped, since dropping a reading a machine has actually given is how a bar
comes to stand on the runs that flattered it.

The eighth move is #845, and it is the first to make nearly every stage cheaper at once rather than
one of them. `versionOf` climbs to the root and remembers nothing, and `parseOf` asked it in front
of the parse memo #689 put there, so the memo saved the parse and never the walk: every `gathered`,
`textOf`, `calls` and `isValid` the expression tier issued paid a fresh climb, 950,645 of them over
DocBook-XSL. The version is a property of where an expression stands, so `expressionsOf` — already
climbing that far to answer the 3.0 `expand-text` gate — hangs it on the record, and the thirteen
expression linters and the parse read it off there. The staged run goes from 4644 ms to 4291 over
DocBook-XSL, 4719 to 4257 over TEI and 2397 to 2247 over DITA-OT, lowest of three interleaved rounds
a side of processor time, which is 7.6%, 9.8% and 6.2%, with the report byte-identical on all three
at 3624, 5514 and 1192 defects. Six stages halve — `name-linter` 0.53 of what it cost, `translate`
0.27, `node-set` 0.40, `predicate-position` 0.32 — and none of the three that answer to `SHARES`
does, so it is the **denominator** that moves and their shares rise on it: dearest of six gate runs
a side, `xpath-linter` 23.55% to 28.89%, `xpath-validator` 14.67% to 16.07% and `xsl-validator`
9.93% to 11.08%. That leaves entries of 24 and 16 at 1.49 and 1.44 times their own readings where
the band allows no closer than half again, so each is re-derived by its own ratio, 24 to 26 and 16
to 18, and `xpath-linter` keeps its 46 at 1.59, inside the band. `SHARE` stays at 7 for the reason
it has stayed there before: the dearest cheap stage moved by 1.03 alone, 5.17% to 5.32%, so its own
ratio re-derives 7 to 7.2 — and its standing at 1.32 rather than half again is not this change's
doing, master reading 1.35 before it. A bar raised on nobody's failure is a bar loosened.

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
its own, and which end of them answers depends on the side asking. A ceiling reads the *lowest*,
noise inflating a measurement rather than deflating it. The slack clause reads the *dearest*, one
cheap attempt being no evidence that a bar has stopped being one — read off the floor instead it had
the retry working against it, a further attempt only ever lowering a minimum, and a Windows runner
whose processor time comes in ticks coarser than a single check costs read
`name-starts-with-numeric` at 1.63% where this machine reads 4.03%, calling an entry drawn from the
dearest reading loose (#811). And the stages are read from `STAGES`, derived in `src/xslint.js` from
the two linter lists, so a linter cannot be wired into the pipeline and left outside what measures
it — one test asserts exactly that over the `src/linters/` directory, and another that no name in
`SHARES` has stopped being a stage.

`SHARES` names the three stages that legitimately cost more of a run than the rest: `xpath-linter`
at 39%, `xpath-validator` at 26%, `xsl-validator` at 18%. Every other stage answers to one bar,
`SHARE` at 7%, which the twenty-one of them sit below at 0.69% to 4.95% — so a cheap stage that
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
against a `GROWTH` bar of 3.0 and the 4.0 a stage that had gone quadratic would read. #877 leaves 18
where it stands: an attribute value walked beside every text node cost `xsl-validator` 1.09 of what
it did, dearest reading 12.40% against 11.35% over ten runs of the master it was measured on. Every
attribute joined those runs once the scan stopped borrowing `walked`'s sequence, and none of the
readings moved — a pass of its own replaces that traversal rather than adding to it, the dearest of
nine attempts reading 14.90%. What the entry is a multiple of the dearest reading is 1.21 there,
where it was 1.26 over the five runs after the merge, #872 having made `xpath-linter` a twelfth
cheaper and so lifted every other share without one of them costing a millisecond more, and 1.45
before that. All three stand under the band, which is the tight side of a ceiling and the safe one.

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
the tree #849 left spanned 1.48, 1.34 and 1.17 over DocBook-XSL, TEI and DITA-OT rather than the
factor of two whole seconds reported, since a true 4666 reads as 4 and a true 6923 as 6 and the
grid widens the pair before anything measures it. Twice the dearest of those readings gave
**13000, 13000 and 6000**, margins of 1.44, 1.54 and 1.89 under cheapest nights of 4666, 5013
and 2830.

Serving outgrew that cut. #811 took DocBook-XSL from 5899 to 6923 ms down to 4191 to 5459, and
DITA-OT from 2830 to 3311 down to 1936 to 2636, so a budget cut at twice the old dearest stands
over four times the new cheapest, and the ratchet fired on DITA-OT at 1424 against 6000 — the
first time the loose side of it caught anything in production. Six runs dispatched on the tree #872
left, and the night one merge behind it, give dearest readings of 5459, 5656 and 2636 against
cheapest ones of 3296, 2846 and 1424. Each budget is the geometric middle of the window its own two
ends leave — half again to twice the dearest, capped where `SLACK` times the cheapest over `MARGIN`
cuts in — which is **9500, 9000 and 4500**, at 1.74, 1.59 and 1.71 times their dearest and leaving
margins of 1.39, 1.26 and 1.27. The cap is what binds for TEI and DITA-OT rather than twice the
dearest — TEI's window closes at 9487 and not 11312, DITA-OT's at 4747 and not 5272 — and only
DocBook-XSL's spread leaves it slack.

That margin is the bar the tick used to stand in for. `MARGIN` in `test/budget.test.js` asks each
budget to stay quiet on a night 1.2 times faster than the cheapest on record — the geometric middle
of the 1.00 the whole-second cut recorded and the 1.44 the cut beside it left — and `RESOLUTION`
asks a tick to stand under 0.019 of what its corpus costs, the middle of DITA-OT's half and its
1424th. The row those two replace asked for one tick of margin, which a millisecond grid turns into
a question no tree can fail; and since both are written in ticks, a third row reads the workflow
for the `date +%s%3N` that makes a tick what `TICK` says it is. On the tree #827 found, all three
redden — every corpus fails `RESOLUTION`, DocBook-XSL fails `MARGIN`, and the step spells
`date +%s`.

Three questions #827 parked are answered by that table rather than by a change. A **median of
several runs** narrows nothing a fourfold window cannot already carry, and would cost the tier a
clone a night to defend a margin that is 1.26 at its worst. **`SLACK` at four** is a span the
widest observed spread fills half of, leaving 1.26 under and 1.59 over at their worst, so it holds
for a wall clock as it does for a share, and a bar raised on nobody's failure is a bar loosened.
And **DITA-OT** is not too small to gate: at 1424 ms a tick is one part in 1424, and its margin is
no worse than TEI's. The corpus was never what was too small.

## Snapshots

Both tiers above are about cost, and nothing was about the answer: the nightly timed a run and
counted the stylesheets it read, printed what it drew into the step summary, and no assertion ever
looked at that. So a check whose reach changed over a real stylesheet changed it in silence, which
is the gap #638 is about. Two things stand on that silence in this tree. Nine checks carried
`mature: true`, a flag whose whole claim was that nothing about them had moved, and the tree could
not have shown otherwise (#637, #865). And #811's evidence is an identity — swapping one module
leaves all three reports byte-identical — established by taking the reports by hand at review time
and rechecked by nothing since.

A snapshot is `test/resources/corpora/<name>.txt`, one line per defect: the file relative to the
corpus root, the line, the column, the check, and where the defect is fixable the tier and the
replacement. The relative path is what keeps the runner's own checkout directory out of the file.
The replacement is there because half of what a run says is in it — 1909 of DocBook-XSL's 3753
lines, 3504 of TEI's 5514 and 457 of DITA-OT's 1194 carry one as this lands — so a fixer that
began writing something else while its detections held would move nothing a detection-only record
could see, and `--fix` is the one thing here that edits a user's files. No count is quoted as a
bar: the file **is** the expectation, exactly, so a figure repeated here would rot at the first
intended change. What makes any of it a gate rather than a flake is that `lint` now hands its
defects back in one total order, derived in `src/CLAUDE.md`.

The step runs two judges and owns the combining itself. Under `set -e` the first non-zero exit ends
the step, so a snapshot diff chained in front of `scripts/budget.js` would abort before the budget
was asked and a slowed night would hide behind a changed report; a command on the left of `||` is
exempt from errexit, so each judge sets `judged` and the step exits on that. The timed run renders
json now rather than text, which is where the summary's defect count comes from — the run's own log
line, `wc -l` over a pretty-printed array meaning nothing.

Four things pin the wiring, since a gate nobody has seen red is a gate nobody has. `yamllint` reads
the workflow clean; 45 tests across `snapshot`, `budget` and `workflows` hold the matrix, the script
and the step to each other — 39 of them in this process and 6 in the two deep halves, which run each
script the way the shell does, since the exit code is the whole of what arms either judge and a
verdict returned to nobody leaves the tier as unable to fail as #785 found it; the step's own shell,
replayed over a real DITA-OT clone at its pinned commit, reads `linted=190`, `found=1194` and
`judged=0`; and the same replay over a *mutated* copy of this tree exits 1 with an annotation naming
a detection that had gone and the replacements that had been rewritten, ending `, and 33 more` —
`SHOWN` being ten, gains before losses, since a report that has moved wholesale must say so in one
screen rather than in ten thousand lines.

`_typos.toml` excludes that directory, and the entry is the one exemption in this guide with **no
both-sides ratchet**. Every word in a snapshot is somebody else's: a replacement quotes the
corpora's own stylesheets, 13 readings of which the tool calls misspellings, and nothing here can
fix one, the corpora standing at pinned commits. An entry that had stopped being needed therefore
cannot redden, because the only thing that would say so is those stylesheets changing their prose,
which happens when a commit is repinned and not otherwise. What is machine-enforced instead is the
exclusion's **scope**: `test/snapshot.test.js` reads the directory and refuses any file in it but a
snapshot the nightly matrix names, so nothing hand-written can ever come to sit behind it.

The open question #638 left — whether a small committed corpus should carry the same diff per pull
request — is answered no. What a snapshot is worth comes from its corpus being code nobody wrote
for these checks, and a stylesheet committed here would assert what the packs already assert, one
step further from the check that draws it. The packs are that tier: `found.fixes` has pinned every
replacement since #607, and it fails in the fast half rather than by morning.

## `test/conformance.test.js`

Enforces naming, motives, selector hygiene — including that a selector comparing an expression's
text with a quoted literal names both quote spellings of it, since
`incorrect-use-of-boolean-constants` named `"'true'"` alone and read half the stylesheets it is
about (#549), and that none names an element by `name()`, which answers a *prefix* where a node test
answers a namespace (#784) — pack/test coverage, the retirement of `mature` across all kinds, the
fast/deep split of the suite itself, and that no test writes a scratch file outside a temporary
directory. That `mature` gate is a refusal rather than a floor, and became one at #865: what stood
there asked its four questions behind an `if (check.mature !== true) continue` and so skipped all
sixty-eight checks, reporting as passing while asserting nothing — #645's and #607's own shape,
inside the file written to catch it. A key nothing carries is a key nothing refuses either, so the
questions could be re-armed by writing it back; what the gate asks now is that no check of any kind
carries it. A
pack gives one position per defect it expects, too: the harness walks the `positions`, so an
`amount` standing above their number is a count asserted and a place asserted nowhere — three packs
of #565's own were written that way and passed, pinning four runs' replacements while saying nothing
about where any of them stood. It also asks `splitOf` of every `xpath` selector and holds the answer
to `UNINDEXED`, the five selectors a shared walk cannot serve as an axis, each listed beside the
shape that keeps it out (#784) — fourteen until #811's union phase served three of them, eleven
until its anchor phase served three more, eight until its fourth parted the one selector spelling a
union *inside* a sweep, and six until its fifth served a **named** attribute axis and distributed
the bracket of `malformed-version-in-stylesheet`, whose two arms open on `//@version` and
`//@xsl:version` and needed both halves in one change: so no union of any spelling, no anchor and
no attribute is a reason to be on the table any longer. Fifteen was the count before #556 gave
`using-disable-output-escaping` an element test, which took it off the table by making it servable
rather than by anybody editing the list. A structural gate rather than a share
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
and where the per-file kind keeps a table of five, four checks of one shape each are few enough that
a fifth belongs in that shape too. An attribute axis has also stopped being a
reason to be on the table, which is the second way an entry rots — a refusal that stands while the
reason for it has gone: `malformed-version-in-stylesheet` outlived half of its own, the walk having
answered `//@*` since the phase that made the cross-file stage cheap while the two *named* attribute
paths its bracketed union opens with went on costing a sweep apiece — and it came off the table only
when #811's sixth phase served those and parted the bracket around them. Selector hygiene grew a
fourth question at #491: a selector counting the elements a node holds — `count(*) = 1`, which is
how a check spells *nothing but this one instruction* — must weigh its text too, text standing
beside the instruction answering that question as much as a second element does. Two of the three
selectors spelling it were false positives on real code, `blank-nested-if` on an `xsl:if` whose text
a collapse would drop and `setting-value-of-variable-incorrectly` on a variable body concatenating a
prefix onto a value; the third is exempt on `COUNTING` because what its advice writes carries the
text along, an attribute value template holding literal text beside the expression so that
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

## `test/guides.test.js`

Its derivation stands at the top of `test/guides.test.js` itself, the dearest note this guide held:
the root indexing one more script left this chain past the bar, and a note moves one directory
further down rather than a bar being widened to fit it (#821, #884).

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

## `test/packs.js`

Its derivation stands at the top of `test/packs.js` itself, the fourteenth note to stand at the top
of its own module and the second of the two this chain moved to make room for the snapshot tier
above (#821, #638).

## `test/xcop.deep.test.js`

Writes every pack's inline XSL to one `mkdtempSync` directory — under a subdirectory named for the
pack's own, since a basename names two packs as readily as one (#693) — and runs xcop over it;
pending, never absent, where the tool does not run. `UNFORMATTED` names the packs whose fixture xcop
must refuse, by the path each stands at, and every entry is asserted rather than skipped: one whose
pack xcop accepts turns red, which is how four stale exemptions were found. Two gates need no xcop
at all and so run wherever the suite does — every entry names a pack that is there, and no two
fixtures share a path.

## `test/manifest.test.js`

Its derivation stands at the top of `test/manifest.test.js` itself, the thirteenth note to stand at
the top of its own module and the first of the two this chain moved to make room for the snapshot
tier above (#821, #638).
