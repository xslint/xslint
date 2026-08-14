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
 * rather than hiding: `xpath-linter` is over half the run, 52.1% to 57.0% here,
 * so an optimisation *there* really would move every other share, and the
 * entries below would want re-deriving rather than reading as regressions of
 * stages nobody touched. What a sum buys is that a change to one of the
 * fourteen *cheap* stages no longer does, which is every optimisation this
 * project has landed so far and #775 exactly.
 *
 * Two things set a ceiling. Where there is a defect to catch, it goes between
 * the two measured distributions — `corpus-linter` at 26, a tenth above the
 * dearest reading the fix has given on any runner, 23.5%, and a *fortieth*
 * below the cheapest the quadratic has given here, 26.54%. That band is narrow,
 * and it is narrow because this is the entry a runner disagrees about most: the
 * four that have reported a table charged the fix 14.4%, 19.1%, 22.0% and 23.5%
 * of the run where this machine charges 15.4%, so a ceiling drawn halfway
 * between the two distributions *here* would fail the fix on macOS. The bar
 * therefore sits at the top of the band rather than in the middle of it, and
 * deliberately: the fix's upper edge is four single readings from four machines
 * where the quadratic's lower edge is thirty-seven from one, so the headroom is
 * spent on the side the evidence is thinner and the catching side leans on 37
 * of 37 instead. The band is also as wide as this corpus can make it, #755
 * having doubled the cross-file linter's cost over forty stylesheets where it
 * multiplied it by 3.4 over DocBook-XSL, which is the second tier's question
 * rather than this one's. Everywhere else the ceiling stands between half again
 * and twice the dearest reading, there being no second distribution to leave
 * room for.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 75,
  'corpus-linter': 26,
  'xpath-validator': 13,
  'xsl-validator': 8,
}

/**
 * What percentage of the run any stage not named in `SHARES` may spend. The
 * fourteen of them read 0.42% to 2.15% here and 0.35% to 1.82% on the runner
 * that reported a table, so this is the bar a cheap stage crosses by becoming
 * an expensive one, and crossing it earns an entry above or a fix. More than
 * twice what the dearest of them reads, for the same reason the entries above
 * are: a runner of another character moves a share, and a stage that has
 * really become expensive lands in the tens rather than a tenth above.
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
 * catch is a stage made several times cheaper, which is what #755's remainder
 * will do to the cross-file entry.
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
 * fourteen of them read 0.52 to 1.70. The highest is `import-linter`, which
 * really does hold a quadratic (#769) that forty stylesheets are too few to
 * show. Loose on purpose beyond that, because growth is the noisier of the two
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
 * and imports.
 * @type {string}
 */
const SHEET = fs.readFileSync(
  path.join(__dirname, 'resources', 'scaling', 'stylesheet.xsl'), 'utf-8',
)

/**
 * One stylesheet of the corpus, every name in it carrying the number of its
 * file so no two share an expression, a declaration or a namespace. Sharing
 * them would make the corpus cheaper the larger it grew, since an expression is
 * parsed once and remembered against its text, and that is the one direction a
 * gate against growth must not be generous in.
 * @param {number} seed - Number of the stylesheet
 * @return {string} - The XML of one stylesheet
 */
const sheet = function(seed) {
  return SHEET
    .replaceAll('PREVIOUS', String(seed - 1))
    .replaceAll('SEED', String(seed))
}

/**
 * A corpus of stylesheets numbered from one file on, each importing the one
 * before it.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many to build
 * @return {Array.<{file: string, content: string}>} - Sources to lint
 */
const corpus = function(from, files) {
  const sources = []
  for (let at = 0; at < files; at++) {
    sources.push({file: `s${from + at}.xsl`, content: sheet(from + at)})
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
 * — the one putting every declarative check through fontoxpath — 66% of the run
 * where an uninstrumented one charges it 52% to 54%, and what it takes from
 * every other share it takes from `xsl-validator` too, which reads 1.85% to
 * 1.96% over three runs, under the floor `SLACK` sets for an entry of 8. So the
 * gate would fail from both sides at once, on a tree nobody had touched. A
 * ceiling wide enough for both would say nothing true about either, so the gate
 * stands down here and speaks in `npm test` and in the `build` job over six
 * runners instead. The coverage gate loses nothing by it: every branch this
 * test reaches is reached by the suite around it, so the 100% gate still holds
 * with the measurement skipped.
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
