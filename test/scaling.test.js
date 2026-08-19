/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {STAGES} = require('../src/xslint')
const {validate: validateXsls} = require('../src/validators/xsl-validator')
const {validate: validateXpaths} = require('../src/validators/xpath-validator')

/**
 * Stylesheets in the small corpus, and how many times more the large one holds.
 * @type {number}
 */
const SMALL = 40

/**
 * How many times larger the second corpus is than the first.
 * @type {number}
 */
const STEP = 4

/**
 * What percentage of its own run each stage may spend. This is the assertion
 * the gate stands on, because the one speed regression this project has
 * actually had was a constant and not a shape: #755 left the cross-file
 * linter's exponent where it was and multiplied what it spent at every size.
 * Growth cannot see that: the fix reads 1.85 to 2.04 and the quadratic 1.66 to
 * 2.43, and since the lowest reading is the one judged, growth does not merely
 * fail to separate them — at 1.66 against 1.85 it ranks them backwards. The
 * share separates them outright: over three alternating pairs on one machine,
 * the fix read 15.10%, 15.27% and 15.69% of its run where the quadratic read
 * 29.06%, 29.98% and 30.12%, and over thirty-seven runs of the gate against
 * that quadratic the judged reading ranged 26.54% to 31.86% and every one was
 * caught.
 *
 * A share is a quotient taken inside one run, so it cancels a machine's speed
 * the way a growth ratio does, and unlike one it hardly moves when the machine
 * is busy: under a load average of eighteen this machine charged
 * `corpus-linter` 15.1% to 15.7% where idle it charges 16.1% to 17.9%. What a
 * share is *of* is the whole run, the readings summed, and that is #777: it was
 * the middle reading of the run, on the argument that fourteen of the eighteen
 * stages sit within a factor of two of each other so no one stage can move it.
 * Fourteen readings within a factor of two are fourteen that keep swapping
 * places, and the median is the mean of the 9th and 10th, so whichever pair
 * lands there sets the denominator of every share. Three runs on one idle
 * machine, nothing touched between them, read the middle at 19.27, 16.79 and
 * 27.86 ms and `corpus-linter` at 11.44, 14.73 and 10.14 of it, where it spent
 * 220.52, 247.30 and 282.54 ms and 16.43%, 17.85% and 16.06% of its run. Making
 * a *cheap* stage cheaper moved it hardest, since a cheap stage is what the
 * median is made of: #775 halved `node-set-linter`, one of the two straddling
 * it, and lifted every other share by about a quarter.
 *
 * What a sum is not is immune outright, and the residual is worth recording
 * rather than hiding: `xpath-linter` is over half the run, so an optimisation
 * of *that* would really move every other share, and the entries below would
 * want re-deriving rather than reading as regressions of stages nobody
 * touched. What
 * a sum buys is that a change to one of the fourteen *cheap* stages no longer
 * does, which is every optimisation this project had landed when #778 wrote
 * that and #775 exactly.
 *
 * #783 is the case that paragraph names, one stage over. Taking `corpus-linter`
 * from 14.96%–18.35% of the run to 5.35%–6.05% takes about a ninth out of the
 * denominator, and the three entries nobody touched rose by it in step —
 * `xpath-linter` 56.36%–56.80% to 63.77%–63.99%, `xpath-validator` 5.53%–5.64%
 * to 6.38%–6.89%, `xsl-validator` 3.70%–4.23% to 3.99%–5.00%, which is 1.13,
 * 1.17 and 1.13 where the arithmetic says 1.12. So their entries are re-derived
 * by that factor rather than left to tighten by a ninth as a side effect of a
 * stage they have nothing to do with: 75 to 85, 13 to 15, 8 to 9, each holding
 * the headroom it had. A gate made stricter by accident is not a ratchet, it is
 * the next red build nobody can explain.
 *
 * #800 moved the whole table again, and by changing the corpus rather than any
 * stage. The cross-file linter read 6.72%–9.06% of the run here where TEI
 * charges it 13.73% and DocBook-XSL 21.95%, and the gap is neither declaration
 * density — which is what that ticket blamed — nor corpus size. Almost all of
 * the stage is one selector: `//@*` is 60% of it over TEI and 74% over
 * DocBook-XSL, against 4.5% and 3.1% for the `within` walk #783 left behind.
 * fontoxpath evaluates a descendant step over an xmldom tree quadratically
 * (#635), so what that selector costs per node is flat at 1.3 to 3.2 us up to
 * some 350 nodes and then climbs — 4.2 at 689, 5.2 at 1491, 8.7 at 2829 and
 * 50.4 at 4853 — and five of DocBook-XSL's 315 stylesheets are two thirds of
 * what it spends over the whole corpus. A corpus of one uniform size cannot
 * show that at any density: twelve more variables in each of the four
 * templates read 9.18%–10.75%, forty more attributes read 7.39%–9.81%, and
 * twenty stylesheets of 393 elements — the same bulk in fewer, larger files —
 * read 7.87%. One heavy stylesheet in every forty reads 15.95%–18.94%, which
 * is where the real corpora put it. Over four gate runs a side, interleaved on
 * one machine, `xpath-linter` went 49.69%–56.08% to 44.61%–48.23%,
 * `xpath-validator` 7.50%–11.53% to 7.23%–12.34% and `xsl-validator`
 * 4.05%–6.11% to 3.85%–6.62%, so those three entries are re-derived by their
 * dearest readings — 85 to 73, 15 to 16, 9 to 10 — and keep the headroom they
 * had. What it costs is the gate's own three and a third seconds becoming six
 * and a half, of which #784 gives back a second and a half.
 *
 * #784 moved it a fourth time, and what moves with it is the stage that got
 * cheaper rather than the three it lifted. Serving a declarative axis from one
 * shared walk took `xpath-linter` from 43.84%–44.88% of the run to
 * 27.20%–31.02%, dearest of six gate runs a side interleaved on one machine, so
 * `corpus-linter` came up from 15.89%–16.73% to 19.51%–20.08%,
 * `xpath-validator` from 7.35%–7.65% to 9.39%–9.94% and `xsl-validator` from
 * 4.36%–4.51% to 4.97%–5.94%, none of the three costing a millisecond more.
 * Its own entry comes down by its own ratio, 73 to 50, where against a dearest
 * 31.02% the old one would stand at 2.35 times a reading the band allows twice.
 * The three keep theirs: 16 and 10 stand 1.61 and 1.68 times their dearest
 * readings, which is where an entry belongs, and a bar raised on nobody's
 * failure is a bar loosened.
 *
 * Two things set a ceiling. Where there is a defect to catch, it goes between
 * the two measured distributions — `corpus-linter` at 32, the geometric middle
 * of the dearest reading the index has given here, 20.08%, and the cheapest
 * the scan it replaced gives over the same corpus, 50.34%. Both edges move with
 * the denominator, so both are taken again on the tree in hand rather than
 * scaled: they read 18.94% and 45.27% before the shared walk. The defect it
 * catches is that scan: putting `src/linters/corpus-linter.js` back to its
 * pre-#783 state fails the gate three times out of three at 50.80%, 51.42% and
 * 50.96%, where the index passes it five of five. Geometric rather than
 * arithmetic because the risk is multiplicative on either side, a runner of
 * another character moving a share by as much as a half: 32 stands 1.59 times
 * the index's dearest reading and 1.57 times below the scan's cheapest.
 * Everywhere else the ceiling stands between half again and twice the dearest
 * reading, there being no second distribution to leave room for.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 50,
  'corpus-linter': 32,
  'xpath-validator': 16,
  'xsl-validator': 10,
}

/**
 * What percentage of the run any stage not named in `SHARES` may spend. The
 * nineteen of them read 0.19% to 3.27% here, taking the dearest of ten gate
 * runs over the corpus #800 gave it, and 0.35% to 1.82% on the runner that
 * reported a table before `double-slash-linter` was one of them. So this is the
 * bar a cheap stage crosses by becoming an expensive one, and crossing it earns
 * an entry above or a fix. Twice
 * what the dearest of them reads, for the same reason the entries above are: a
 * runner of another character moves a share, and a stage that has really become
 * expensive lands in the tens rather than a tenth above.
 *
 * #784 is the one optimisation so far that lifts every reading here rather than
 * none, `xpath-linter` being the dearest stage by far and every share a share
 * of the whole run: narrowing eight selectors brought the sixteen up by 1.013
 * to 1.258, median 1.122, and serving a declarative axis from one shared walk
 * brought the nineteen up by 1.217 to 1.439, median 1.334, without one of them
 * costing a millisecond more either time. The bar stays at 5 all the same,
 * because nothing crossed it and a bar raised on nobody's failure is a bar
 * loosened: the dearest of them reads 3.27%, which 5 stands 1.53 times above,
 * and the one runner table on record charges the dearest 1.82% where this
 * machine charged it 2.53%.
 * What that lift is read by is the **per-stage** ratio and not the range, whose
 * endpoints move more from noise than a denominator moves them — the low one
 * belongs to a stage costing a fifth of a millisecond over the small corpus —
 * and reading a share off one printed table rather than a distribution is how
 * the first account of this put the range at 0.24% to 2.77%.
 * @type {number}
 */
const SHARE = 5

/**
 * How many times its own reading a ceiling may stand above before it has
 * stopped being a bar. A ratchet is only one if it turns red from both sides:
 * a stage that grew past its entry fails, and so does a stage that has been
 * made so much cheaper that the entry it left behind would let the whole
 * regression back in. `SPRAWLING` in `eslint.config.mjs` is the same shape one
 * property over. Four rather than two, because a share cancels a machine's
 * speed and not its character and the runners disagree with this machine by as
 * much as a half — `corpus-linter` at 23.5% of the run where this one charges
 * 15.4%, and `xsl-validator` at 2.8% where it charges 3.3%. What is left to
 * catch is a stage made several times cheaper, which is what #783 did to the
 * cross-file entry: the index took it to a fifth of what it cost, `SLACK` said
 * so of an entry of 26 standing over a reading of 5.35%, and the entry came
 * down to 12. It stands at 32 since #784, the corpus having changed under it
 * at #800 and the denominator at #784, rather than the stage itself either
 * time.
 * @type {number}
 */
const SLACK = 4

/**
 * How many times the middle stage's growth a stage with no entry in `SHARES`
 * may grow by when the corpus grows `STEP` times. It is asked of those stages
 * alone because a stage with an entry has what it costs pinned outright, which
 * is the stronger statement, while one without is pinned only by a bar it sits
 * far below — so its shape is what is worth watching, and a cheap stage turning
 * quadratic is what this catches: it would read `STEP` itself, 4.0, where the
 * nineteen of them read 0.47 to 1.24 over four runs. Among the dearest is
 * `import-linter`, which really does hold a quadratic (#769) that forty
 * stylesheets are too few to show. Loose on purpose beyond that, because growth
 * is the noisier of the two
 * questions — the cross-file linter reads 1.71 to 1.89 across runs where its
 * share reads 15.1% to 15.7% — and a bar tight enough to catch a constant fires
 * on stages nothing touched.
 * @type {number}
 */
const GROWTH = 3.0

/**
 * How many times a disagreeing measurement is taken again before it is
 * believed, each over a corpus of its own.
 * @type {number}
 */
const ATTEMPTS = 3

/**
 * Distance between the file numbers of one attempt and the next. Expressions
 * are parsed once per distinct text and remembered against it, so a corpus that
 * repeated another's names would be answered out of that memo and read as
 * though the work had shrunk.
 * @type {number}
 */
const SPREAD = 100000

/**
 * The one stylesheet the corpus is built out of, read once. It is a committed
 * resource rather than a string spelled here, the way every test stylesheet in
 * this repository is, and it holds an expression of every shape the pipeline
 * reads: an axis, a comparison with zero, a call each linter is about, an
 * attribute value template, a predicate, an import, a namespace nothing uses,
 * and a literal result element in a namespace of its own. A stage handed
 * nothing it is about cannot be measured at all — the three per-document
 * linters sat at 0.3 ms with a spread of 358% until this corpus grew namespaces
 * and imports, and `bare-name-linter` arrived at #788 reading 0.04% of the run
 * with a growth of 2.30 to 2.63 against a bar of 3.0, which is a stage
 * reporting noise as a shape. Three constructs arm the three stages that came
 * with it: an `xsl:element` whose name is static, an `xsl:output` beside the
 * `html` the root template builds, and an `xsl:apply-templates` selecting the
 * bare name of a variable declared above it. Armed, the three read 0.16% to
 * 0.32% and grow 0.52 to 1.18. The cross-file stage was the same thing one
 * ticket later: it built no defect at all over this corpus, every variable in
 * the sheet being referenced a line or two below itself, so the one path a
 * declaration takes when nothing uses it went untimed. One top-level variable
 * nothing references arms it, which is 160 `unused-variable` over the large
 * corpus (#800).
 * @type {string}
 */
const SHEET = fs.readFileSync(
  path.join(__dirname, 'resources', 'scaling', 'stylesheet.xsl'), 'utf-8',
)

/**
 * The comment the sheet marks its repeatable part with — everything from there
 * to the closing tag, which is the root template's four callees and nothing
 * else. A heavy stylesheet is that part written out again under names of its
 * own, so one file grows without the corpus growing a second root template or
 * a second import. Where the part begins is the stylesheet's to say rather
 * than a start tag spelled here: the `fixtures` job fails any `.test.js`
 * holding one, and a marker a test matches on is a fixture detail whether or
 * not it is a whole element.
 * @type {string}
 */
const MARK = '<!-- repeated -->'

/**
 * The part of the sheet a heavy stylesheet repeats, the marker excluded so a
 * copy does not carry one of its own.
 * @type {string}
 */
const BODY = SHEET.slice(
  SHEET.indexOf(MARK) + MARK.length, SHEET.lastIndexOf('</xsl:'),
)

/**
 * Every how many stylesheets one is heavy. A corpus of forty holds one and a
 * corpus of a hundred and sixty holds four, so both carry the same fraction of
 * them and a stage's growth still answers about the corpus rather than about
 * which sizes happened to land in it.
 * @type {number}
 */
const HEAVY = 40

/**
 * How many times over a heavy stylesheet writes the body, which decides how
 * large the largest file in the corpus is. Forty-eight makes one of some five
 * thousand elements and attributes, where DocBook-XSL's largest holds 8790 and
 * TEI's some four thousand. That the corpus needs such a file at all is what
 * #800 turned up, and the reason is in `SHARES` above: what the cross-file
 * stage costs is almost all one selector, `//@*`, whose cost per node is flat
 * until a document passes some 350 of them and then climbs, so a handful of
 * very large stylesheets is where a real corpus spends that stage and a corpus
 * of one uniform size cannot show it at any density.
 * @type {number}
 */
const WEIGHT = 48

/**
 * The body written out again under names of its own, once per copy.
 * @param {number} seed - Number of the stylesheet
 * @param {number} weight - How many times the body stands in it
 * @return {string} - The copies, joined
 */
const copied = function(seed, weight) {
  const copies = []
  for (let copy = 1; copy < weight; copy++) {
    copies.push(BODY.replaceAll('SEED', `${seed}c${copy}`))
  }
  return copies.join('')
}

/**
 * One stylesheet of the corpus, every name in it carrying the number of its
 * file so no two share an expression, a declaration or a namespace — and, in a
 * heavy one, the number of the copy it stands in as well. Sharing them would
 * make the corpus cheaper the larger it grew, since an expression is parsed
 * once and remembered against its text, and that is the one direction a gate
 * against growth must not be generous in.
 * @param {number} seed - Number of the stylesheet
 * @param {number} weight - How many times the body stands in it
 * @return {string} - The XML of one stylesheet
 */
const sheet = function(seed, weight) {
  return SHEET.replace(MARK, MARK + copied(seed, weight))
    .replaceAll('PREVIOUS', String(seed - 1))
    .replaceAll('SEED', String(seed))
}

/**
 * A corpus of stylesheets numbered from one file on, each importing the one
 * before it, and every `HEAVY`th of them heavy.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many to build
 * @return {Array.<{file: string, content: string}>} - Sources to lint
 */
const corpus = function(from, files) {
  const sources = []
  for (let at = 0; at < files; at++) {
    let weight = 1
    if (at % HEAVY === 0) {
      weight = WEIGHT
    }
    sources.push({
      file: `s${from + at}.xsl`, content: sheet(from + at, weight),
    })
  }
  return sources
}

/**
 * Microseconds of processor time this process has been charged, user and system
 * together. Not the wall clock, which charges a stage for every slice the
 * scheduler hands to something else: under sixteen processes competing for ten
 * cores the wall failed seven runs of eight, naming stages nothing had touched
 * at 2.36 and 2.97 of the middle stage and reading the cross-file linter at
 * 0.78 of it — that being the unit the gate used before #777, so the numbers
 * are the old one's — which is its bar's other side and would have called #755
 * settled. The same
 * runs judged on processor time hold every reading within a tenth of what an
 * idle machine gives, because time the stage did not get is time it is not
 * charged for.
 * @return {number} - Microseconds spent on a processor
 */
const charged = function() {
  const spent = process.cpuUsage()
  return spent.user + spent.system
}

/**
 * Whether V8 is counting branches in this process, which makes it the wrong
 * process to ask about speed. `npm run coverage` runs mocha under c8, and that
 * bookkeeping does not fall evenly across the stages: it charges `xpath-linter`
 * — the one putting every declarative check through fontoxpath — 65% to 69% of
 * the run where an uninstrumented one charged it 52% to 57%. A ceiling honest
 * about one of those readings says nothing true about the other, which is the
 * whole reason to stand down, and it is not the same thing as a breach: 69% was
 * comfortably under the 75 that entry then allowed, and no ceiling here was
 * crossed at all. What does fire is the *floor*, and only sometimes. Run alone
 * under c8, `xsl-validator`'s judged reading came to 1.93%, 1.95% and 1.97%
 * against the 2.00 that `SLACK` then left an entry of 8, and the ratchet called
 * that entry stale in three runs of five; under the parallel command above it
 * read 2.14% to 2.34% and the gate passed three of three. Every reading in this
 * paragraph was taken under the denominator #783 changed, so each stands a
 * ninth below what the same run would report now, and each entry it names has
 * been re-derived above; what they are recorded for is the shape, which is that
 * an instrumented process answers about c8. So what an instrumented process
 * gives is an answer about c8 rather than about the pipeline, intermittently
 * red on a tree nobody has touched. The gate skips here and speaks in
 * `npm test` and in the `build` job over six runners instead, and the coverage
 * gate loses nothing by it: every branch this test reaches is reached by the
 * suite around it, so the 100% gate still holds with the measurement skipped.
 * @return {boolean} - Whether this process is instrumented for coverage
 */
const instrumented = function() {
  return process.env.NODE_V8_COVERAGE !== undefined
}

/**
 * How much processor time a call spends, in milliseconds, beside whatever it
 * answers.
 * @param {function(): object} fun - What to time
 * @return {{span: number, answer: object}} - Milliseconds and the answer
 */
const timed = function(fun) {
  const began = charged()
  const answer = fun()
  return {span: (charged() - began) / 1000, answer: answer}
}

/**
 * Milliseconds each stage spends over one corpus, timed directly rather than by
 * subtracting one run from another: the error of two timings compounds, and a
 * stage whose own reading is stable to three percent reads twenty that way.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many the corpus holds
 * @return {Map.<string, number>} - Milliseconds by stage
 */
const measured = function(from, files) {
  const sources = corpus(from, files)
  const spans = new Map()
  const xsls = timed(() => validateXsls(sources, []))
  spans.set('xsl-validator', xsls.span)
  const xpaths = timed(() => validateXpaths(xsls.answer.corpus, []))
  spans.set('xpath-validator', xpaths.span)
  for (const stage of STAGES) {
    let given = xpaths.answer.expressions
    if (stage.over === 'corpus') {
      given = xsls.answer.corpus
    }
    spans.set(stage.name, timed(() => stage.run(given, [])).span)
  }
  return spans
}

/**
 * The middle of a list of readings. It answers the growth question alone, where
 * the readings are ratios rather than milliseconds: every stage of ordinary
 * shape grows about as the corpus does, so their median is one stage's growth
 * whichever stage happens to sit there. The median *cost* is not that and no
 * longer decides anything (#777) — the fourteen ordinary stages keep swapping
 * places, so the pair landing 9th and 10th moved the denominator of every share
 * by as much as a half.
 * @param {Array.<number>} list - The readings
 * @return {number} - Their median
 */
const middle = function(list) {
  const sorted = Array.from(list).sort((one, two) => one - two)
  return (sorted[Math.floor((sorted.length - 1) / 2)] +
    sorted[Math.ceil((sorted.length - 1) / 2)]) / 2
}

/**
 * What percentage of its run each stage spends, and how it grew as a multiple
 * of what the middle stage's growth did. Two quotients taken inside one
 * process, which is what survives a shared machine, and both divided by
 * something the whole run supplies, which is what survives a different one: an
 * absolute threshold either flakes or is set loose enough to catch nothing.
 *
 * The cost is divided by the readings summed and the growth by their median,
 * which is not an inconsistency but the two questions being different. A stage
 * of ordinary shape grows as the corpus does, so a median growth is any
 * ordinary stage's growth; a stage of ordinary cost does not exist in the same
 * way, fourteen of them lying within a factor of two and swapping places run to
 * run, so a median cost is a coin toss between two near-identical readings and
 * dividing by it made every share depend on which way the coin fell (#777).
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {Map.<string, {share: number, growth: number}>} - Cost and growth
 */
const weighed = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  const ratios = new Map(
    Array.from(small, ([name, span]) => [name, large.get(name) / span]),
  )
  const whole = Array.from(large.values()).reduce((one, two) => one + two, 0)
  const linear = middle(Array.from(ratios.values()))
  return new Map(
    Array.from(large, ([name, span]) => [name, {
      share: 100 * span / whole,
      growth: ratios.get(name) / linear,
    }]),
  )
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * The lowest of them answers every question, since noise makes one attempt
 * disagree with the rest while a stage that has really changed reads the same
 * way in all of them. A growth that is not a finite number is no reading at
 * all and is dropped rather than judged: Windows charges processor time in
 * ticks far coarser than a cheap stage costs over the small corpus, so eight of
 * the fourteen measured `0` there and their growth came back `Infinity` or
 * `NaN`. The share is unhurt by the same clock, being taken over the corpus
 * four times larger and against the whole run rather than one reading of it:
 * with the clock quantised to 6 ms here, which is what turns those growths
 * non-finite, every entry holds within a tenth of a fine clock's answer. So
 * what a coarse clock costs is the looser of the two questions on one platform,
 * not the gate.
 * @param {string} name - Name of the stage
 * @param {Array.<{share: number, growth: number}>} readings - Per attempt
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const share = Math.min(...readings.map((one) => one.share))
  const growths = readings.map((one) => one.growth).filter(Number.isFinite)
  const named = Object.hasOwn(SHARES, name)
  let ceiling = SHARE
  if (named) {
    ceiling = SHARES[name]
  }
  let said = ''
  if (share > ceiling) {
    said = `${name} spends ${share.toFixed(2)}% of its own run, past the ` +
      `${ceiling}% that test/scaling.test.js allows it`
  } else if (!named && growths.length > 0 && Math.min(...growths) > GROWTH) {
    said = `${name} grew ${Math.min(...growths).toFixed(2)} times what the ` +
      `middle stage grew when the corpus grew ${STEP} times, so its shape has ` +
      `changed`
  } else if (named && ceiling > SLACK * share) {
    said = `${name} spends only ${share.toFixed(2)}% of its run where it is ` +
      `allowed ${ceiling}%, so the entry has stopped being a bar and wants ` +
      `tightening`
  }
  return said
}

/**
 * Every stage whose cost or growth disagrees with what its bar says, measured
 * again up to `ATTEMPTS` times while any of them does, beside the whole table
 * of readings — a gate that fails must say what it measured, or the next reader
 * has to reproduce a machine to find out.
 *
 * The first thing it does is take a whole measurement and throw it away, on the
 * one principle a warm-up has: warm the code with the work that is about to be
 * timed. A warm-up over ten stylesheets — which is what stood here — leaves the
 * two validators still cold enough that the first attempt reads them nearly
 * twice what they cost, `xsl-validator` at 3.96 to 4.38 against a ceiling of 4
 * and `xpath-validator` at 6.36 to 6.92, and the second attempt at 2.02 to 2.25
 * and 3.25 to 3.52. That is a bias and not noise, so the retry cannot answer it
 * — it was answering it, in practice, on nearly every standalone run, which is
 * a gate leaning on the mechanism meant for something else. Forty stylesheets
 * only shrink the bias, to 3.2 and 5.1. A discarded `weighed` removes it: over
 * six processes every stage holds within five percent and no attempt is ever
 * retried. It is free, too, being the retry that is no longer spent.
 * @return {{faults: Array.<string>, table: string}} - Faults and the readings
 */
const judged = function() {
  weighed(ATTEMPTS)
  const readings = new Map()
  let found = []
  let table = ''
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const weight = weighed(attempt)
    for (const [name, one] of weight) {
      readings.set(name, (readings.get(name) ?? []).concat([one]))
    }
    table = Array.from(weight, ([name, one]) =>
      `${name} ${one.share.toFixed(2)}% of its run, grew ` +
      `${one.growth.toFixed(2)}`).join(', ')
    found = Array.from(readings, ([name, list]) => fault(name, list))
      .filter((said) => said !== '')
    if (found.length === 0) {
      break
    }
  }
  return {faults: found, table: table}
}

describe('scaling', function() {
  it('holds every stage to the cost and growth its bar allows', function() {
    this.timeout(120000)
    if (instrumented()) {
      this.skip()
    }
    const judgement = judged()
    assert.deepEqual(
      judgement.faults,
      [],
      'a stage no longer costs or grows the way the bars in ' +
        `test/scaling.test.js say, over a corpus of ${SMALL} stylesheets and ` +
        `one of ${SMALL * STEP}: ${judgement.table}`,
    )
  })
  it('names in SHARES only stages the pipeline still has', function() {
    assert.deepEqual(
      Object.keys(SHARES).filter(
        (name) => !STAGES.some((stage) => stage.name === name) &&
          name !== 'xsl-validator' && name !== 'xpath-validator',
      ),
      [],
      'a stage is allowed a cost of its own by name, yet nothing of that name ' +
        'runs any more, so the entry weighs on nothing',
    )
  })
  it('measures every linter the pipeline is staged from', function() {
    assert.deepEqual(
      fs.readdirSync(path.join(__dirname, '..', 'src', 'linters'))
        .filter((file) => file.endsWith('-linter.js'))
        .map((file) => path.basename(file, '.js'))
        .filter((name) => !STAGES.some((stage) => stage.name === name)),
      [],
      'a linter reaches no stage of the pipeline, so nothing measures it',
    )
  })
})
