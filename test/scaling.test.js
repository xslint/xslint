/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The speed gate: charges every stage its own processor time over a
 * generated corpus at 40 stylesheets and again at 160, and fails a stage
 * growing past `GROWTH` beside the middle stage, which is a stage turning
 * quadratic. What a stage costs outright is the nightly `corpora` job's to
 * judge, a share of the run having read differently on every runner (#1186).
 * The corpus is copied from one committed stylesheet with every name
 * renumbered, so no memo flatters it, and every fortieth copy is heavy for the
 * skew a real corpus has (#800).
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {GAPS} = require('../src/tokens')
const {clocked} = require('./clock')
const {ROOT, GUIDES} = require('./guides')
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
 * How many times the middle stage's growth any stage may grow by when the
 * corpus grows `STEP` times: the geometric middle of the dearest ordinary
 * reading and the cheapest of a stage made quadratic (#1186). One whose
 * constant is still small here is #769's question instead.
 * @type {number}
 */
const GROWTH = 1.9

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
 * The one stylesheet the corpus is built out of, read once. A committed
 * resource rather than a string spelled here, holding an expression of every
 * shape the pipeline reads, since a stage handed nothing it is about cannot be
 * measured: three per-document linters sat at 0.3 ms until it grew namespaces
 * and imports, and the cross-file stage needed a dead variable (#788, #800).
 * @type {string}
 */
const SHEET = fs.readFileSync(
  path.join(__dirname, 'resources', 'scaling', 'stylesheet.xsl'), 'utf-8',
)

/**
 * The comment the sheet marks its repeatable part with — everything from there
 * to the closing tag, which is the root template's four callees and nothing
 * else. A heavy stylesheet is that part written out again under names of its
 * own. Where the part begins is the stylesheet's to say rather than a start
 * tag spelled here, the `fixtures` job failing any `.test.js` holding one.
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
 * thousand elements and attributes, where DocBook-XSL's largest holds 8790.
 * That the corpus needs such a file at all is #800's: `//@*` costs flat per
 * node until a document passes some 350 of them and then climbs.
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
 * make the corpus cheaper the larger it grew, an expression being parsed once
 * and remembered against its text.
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
 * Whether V8 is counting branches in this process, which makes it the wrong
 * process to ask about speed. c8's bookkeeping falls unevenly across the
 * stages — it charges `xpath-linter` 65% to 69% of a run an uninstrumented one
 * charges 52% to 57% — so what it answers about is c8, intermittently red on a
 * tree nobody has touched. The gate skips here and speaks in `npm test`.
 * @return {boolean} - Whether this process is instrumented for coverage
 */
const instrumented = function() {
  return process.env.NODE_V8_COVERAGE !== undefined
}

/**
 * How much processor time a call spends, in milliseconds, beside whatever it
 * answers, charged as `test/clock.js` charges a window.
 * @param {function(): object} fun - What to time
 * @return {{span: number, answer: object}} - Milliseconds and the answer
 */
const timed = function(fun) {
  const reading = clocked(fun)
  return {span: reading.span / 1000, answer: reading.answer}
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
 * The middle of a list of readings, which are ratios rather than milliseconds:
 * every stage of ordinary shape grows about as the corpus does, so their median
 * is one stage's growth whichever stage sits there.
 * @param {Array.<number>} list - The readings
 * @return {number} - Their median
 */
const middle = function(list) {
  const sorted = Array.from(list).sort((one, two) => one - two)
  return (sorted[Math.floor((sorted.length - 1) / 2)] +
    sorted[Math.ceil((sorted.length - 1) / 2)]) / 2
}

/**
 * How each stage grew, as a multiple of the middle stage's growth: a quotient
 * taken inside one process, which survives a shared machine, divided by one the
 * whole run supplies, which survives a different one (#777).
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {Map.<string, number>} - Growth by stage
 */
const weighed = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  const ratios = new Map(
    Array.from(small, ([name, span]) => [name, large.get(name) / span]),
  )
  const linear = middle(Array.from(ratios.values()))
  return new Map(
    Array.from(ratios, ([name, ratio]) => [name, ratio / linear]),
  )
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * The cheapest growth is judged, the reading that most favours passing. A
 * non-finite growth is no reading and is dropped: Windows charges in ticks
 * coarser than a cheap stage costs over the small corpus.
 * @param {string} name - Name of the stage
 * @param {Array.<number>} readings - Its growth, per attempt
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const growths = readings.filter(Number.isFinite)
  let said = ''
  if (growths.length > 0 && Math.min(...growths) > GROWTH) {
    said = [
      `${name} grew ${Math.min(...growths).toFixed(2)} times what the`,
      `middle stage grew when the corpus grew ${STEP} times, so its shape has`,
      `changed`,
    ].join(' ')
  }
  return said
}

/**
 * Every stage whose growth disagrees with `GROWTH`, measured again up to
 * `ATTEMPTS` times while any of them does, beside the last attempt's readings —
 * a gate that fails must say what it measured. The first measurement is thrown
 * away, on the one principle a warm-up has: warm the code with the work about
 * to be timed.
 * @return {{faults: Array.<string>, table: string}} - Faults and readings
 */
const judged = function() {
  weighed(ATTEMPTS)
  const readings = new Map()
  let faults = []
  let table = ''
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const growths = weighed(attempt)
    for (const [name, growth] of growths) {
      readings.set(name, (readings.get(name) ?? []).concat([growth]))
    }
    table = Array.from(
      growths, ([name, growth]) => `${name} grew ${growth.toFixed(2)}`,
    ).join(', ')
    faults = Array.from(readings, ([name, list]) => fault(name, list))
      .filter((said) => said !== '')
    if (faults.length === 0) {
      break
    }
  }
  return {faults: faults, table: table}
}

/**
 * Every guide quoting `GROWTH` at a number this file does not hold. A gap
 * collapses first, because a bar is prose and prose wraps across a line
 * ending; the guides name the bar and quote none, and this holds a quote that
 * creeps back (#821, #1168).
 * @param {string} guide - Path of the guide from the repository root
 * @return {Array.<string>} - One line per quote standing wrongly
 */
const misquoted = function(guide) {
  return Array.from(
    fs.readFileSync(path.join(ROOT, guide), 'utf-8').split(GAPS).join(' ')
      .matchAll(/`GROWTH` at (\d+\.\d+)/g),
  )
    .filter((found) => found[1] !== GROWTH.toFixed(1))
    .map(
      (found) => `${guide} quotes \`GROWTH\` at ${found[1]}, not ${
        GROWTH.toFixed(1)}`,
    )
}
describe('scaling', function() {
  it('holds every stage to the growth it answers to', function() {
    this.timeout(120000)
    if (instrumented()) {
      this.skip()
    }
    const judgement = judged()
    assert.deepEqual(
      judgement.faults,
      [],
      [
        'a stage no longer grows the way GROWTH in test/scaling.test.js says,',
        `over a corpus of ${SMALL} stylesheets and one of ${SMALL * STEP}:`,
        judgement.table,
      ].join(' '),
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
  it('holds every guide quoting GROWTH to the number it stands at', function() {
    assert.deepEqual(
      GUIDES.flatMap(misquoted),
      [],
      [
        'a guide quotes GROWTH at a number this file no longer holds, and the',
        'prose is the half a session reads before it touches the bar',
      ].join(' '),
    )
  })
})
