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
 * What each stage costs beside the middle stage of its own run, and the most it
 * may cost. This is the assertion the gate stands on, because the one speed
 * regression this project has actually had was a constant and not a shape: #755
 * left the cross-file linter's exponent where it was, 1.46 against 1.57 over
 * this corpus, and doubled what it spent at every size. Growth cannot see that
 * — the quadratic reads 1.93 to 2.26 and the fix 1.80 to 2.31, one distribution
 * — while the share reads 19.3 to 19.6 against 9.3 to 10.1, with nothing
 * between them. A share is a quotient taken inside one run, so it cancels a
 * machine's speed the way a growth ratio does, and unlike one it hardly moves
 * when the machine is busy: sixteen processes fighting over ten cores read the
 * cross-file linter at 8.3 to 8.8 where an idle machine reads 9.3 to 10.1.
 * Each ceiling stands about four tenths above what its stage reads, so a stage
 * that has grown has to be looked at whether it grew by a constant or by an
 * exponent.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 45,
  'corpus-linter': 14,
  'xpath-validator': 5.2,
  'xsl-validator': 3.1,
}

/**
 * What any stage not named in `SHARES` may cost beside the middle stage. The
 * fourteen of them read 0.12 to 1.17, so this is the bar a cheap stage crosses
 * by becoming an expensive one, and crossing it earns an entry above or a fix.
 * @type {number}
 */
const SHARE = 2.0

/**
 * How many times its own reading a ceiling may stand above before it has
 * stopped being a bar. A ratchet is only one if it turns red from both sides:
 * a stage that grew past its entry fails, and so does a stage that has been
 * made so much cheaper that the entry it left behind would let the whole
 * regression back in. `SPRAWLING` in `eslint.config.mjs` is the same shape one
 * property over. Two and a half rather than two, because a machine of another
 * character reads a stage a third cheaper without anybody having touched it.
 * @type {number}
 */
const SLACK = 2.5

/**
 * How many times the middle stage's growth a stage with no entry in `SHARES`
 * may grow by when the corpus grows `STEP` times. It is asked of those stages
 * alone because a stage with an entry has what it costs pinned outright, which
 * is the stronger statement, while one without is pinned only by a bar it sits
 * far below — so its shape is what is worth watching, and a cheap stage turning
 * quadratic is what this catches: it would read `STEP` itself, 4.0, where the
 * fourteen of them read 0.29 to 1.58 idle and under load together. Loose on
 * purpose beyond that, because growth is the noisier of the two questions —
 * the cross-file linter reads 1.55 to 2.31 across runs where its share reads
 * 8.3 to 10.1 — and a bar tight enough to catch a constant fires on stages
 * nothing touched.
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
 * Stylesheets in the corpus a first, discarded measurement is taken over.
 * Without it the first stage of the first attempt is timed cold and reads half
 * what it costs warm, which is a bias and not noise, and one no retry corrects.
 * Small on purpose: it has only to run every path once, and a warm-up the size
 * of the corpus itself measurably widened the spread instead of narrowing it,
 * leaving the heap in a state the first measured pass then collects.
 * @type {number}
 */
const WARMUP = 10

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
 * at 2.36 and 2.97 times the middle and reading the cross-file linter at 0.78,
 * which is its bar's other side and would have called #755 settled. The same
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
 * — the one putting every declarative check through fontoxpath — 53 to 56 times
 * the middle stage where an uninstrumented run charges it 30. A ceiling wide
 * enough for both would say nothing true about either, so the gate stands down
 * here and speaks in `npm test` and in the `build` job over six runners
 * instead. The coverage gate loses nothing by it: every branch this test
 * reaches is reached by the suite around it, so 100% of 1399 branches still
 * holds with the measurement skipped.
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
 * The middle of a list of readings, which is what one stage of ordinary cost
 * reads on this machine in this run: fourteen of the eighteen stages sit within
 * a factor of two of each other, so the median is theirs and no one stage can
 * move it.
 * @param {Array.<number>} list - The readings
 * @return {number} - Their median
 */
const middle = function(list) {
  const sorted = Array.from(list).sort((one, two) => one - two)
  return (sorted[Math.floor((sorted.length - 1) / 2)] +
    sorted[Math.ceil((sorted.length - 1) / 2)]) / 2
}

/**
 * What each stage costs and how it grew, both as multiples of what the middle
 * stage of the same run did. Two quotients taken inside one process, which is
 * what survives a shared machine, and both divided by the middle, which is what
 * survives a different one: an absolute threshold either flakes or is set loose
 * enough to catch nothing.
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {Map.<string, {share: number, growth: number}>} - Cost and growth
 */
const weighed = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  const ratios = new Map(
    Array.from(small, ([name, span]) => [name, large.get(name) / span]),
  )
  const centre = middle(Array.from(large.values()))
  const linear = middle(Array.from(ratios.values()))
  return new Map(
    Array.from(large, ([name, span]) => [name, {
      share: span / centre,
      growth: ratios.get(name) / linear,
    }]),
  )
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * The lowest of them answers every question, since noise makes one attempt
 * disagree with the rest while a stage that has really changed reads the same
 * way in all of them.
 * @param {string} name - Name of the stage
 * @param {Array.<{share: number, growth: number}>} readings - Per attempt
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const share = Math.min(...readings.map((one) => one.share))
  const growth = Math.min(...readings.map((one) => one.growth))
  const named = Object.hasOwn(SHARES, name)
  let ceiling = SHARE
  if (named) {
    ceiling = SHARES[name]
  }
  let said = ''
  if (share > ceiling) {
    said = `${name} costs ${share.toFixed(2)} times what the middle stage of ` +
      `its own run costs, past the ${ceiling} that test/scaling.test.js ` +
      `allows it`
  } else if (!named && growth > GROWTH) {
    said = `${name} grew ${growth.toFixed(2)} times what the middle stage ` +
      `grew when the corpus grew ${STEP} times, so its shape has changed`
  } else if (named && ceiling > SLACK * share) {
    said = `${name} costs only ${share.toFixed(2)} times the middle where it ` +
      `is allowed ${ceiling}, so the entry has stopped being a bar and wants ` +
      `tightening`
  }
  return said
}

/**
 * Every stage whose cost or growth disagrees with what its bar says, measured
 * again up to `ATTEMPTS` times while any of them does, beside the whole table
 * of readings — a gate that fails must say what it measured, or the next reader
 * has to reproduce a machine to find out.
 * @return {{faults: Array.<string>, table: string}} - Faults and the readings
 */
const judged = function() {
  measured(ATTEMPTS * SPREAD, WARMUP)
  const readings = new Map()
  let found = []
  let table = ''
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const weight = weighed(attempt)
    for (const [name, one] of weight) {
      readings.set(name, (readings.get(name) ?? []).concat([one]))
    }
    table = Array.from(weight, ([name, one]) =>
      `${name} ${one.share.toFixed(2)} of the middle, grew ` +
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
