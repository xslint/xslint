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
 * A wider step separates the two shapes further apart than a cheaper one does —
 * a stage that grows with its input reads 4 where one that grows with the
 * square of it reads 16 — and the room between them is what a noisy machine is
 * paid for out of.
 * @type {number}
 */
const SMALL = 40

/**
 * How many times larger the second corpus is than the first.
 * @type {number}
 */
const STEP = 4

/**
 * How far above the middle of its own run a stage may read. Not a ratio but a
 * multiple of one: `STEP` is what a stage growing with its input should read,
 * and it does not, because a ratio cancels a machine's speed and not its
 * character — the same stage measured here at 7.1 read 8.7 on a macOS runner
 * and the bar it passed at home failed on every runner CI has. What travels is
 * a stage's standing among the seventeen others timed in the same process: they
 * grow linearly, so their middle is what linear costs on that machine at that
 * moment, and a machine that inflates one inflates them all.
 * @type {number}
 */
const LINEAR = 1.35

/**
 * Stages that grow faster than their input, each with the ceiling it may not
 * cross and the ticket that will retire the entry. A ratchet, not a licence:
 * the entry holds the defect where it stands so a second one cannot hide behind
 * it, and the ticket is what removes it. `corpus-linter` is the one entry:
 * it matches every declaration against every usage, and #755 made that 2.6
 * times cheaper without retiring the product. `import-linter` walks the whole
 * graph once per edge and so costs the square of a chain of imports (#769), yet
 * is not here — at this corpus the per-edge cost still dominates and it reads
 * 4.0, which is what a gate of one size cannot see and the scheduled run over
 * real projects is for.
 * @type {{[stage: string]: {ceiling: number, issue: number}}}
 */
const SUPERLINEAR = {
  'corpus-linter': {floor: LINEAR, ceiling: 2.0, issue: 755},
  'import-linter': {floor: 0, ceiling: 1.8, issue: 769},
}

/**
 * How many times a disagreeing measurement is taken again before it is
 * believed. Noise moves a ratio in both directions — an interrupted small
 * measurement reads low, an interrupted large one reads high — and it moves a
 * different one each time, where a stage that has really changed shape reads
 * the same way in every attempt.
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
 * what it costs warm, which puts every ratio of that attempt below what it
 * should be — a bias, not noise, and one no retry corrects because it is the
 * measurement that is wrong rather than the machine. Small on purpose: it has
 * only to run every path once, and a warm-up the size of the corpus itself
 * measurably widened the spread instead of narrowing it, leaving the heap in a
 * state the first measured pass then collects.
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
 * How long a call takes, in milliseconds, beside whatever it answers.
 * @param {function(): object} fun - What to time
 * @return {{span: number, answer: object}} - Milliseconds and the answer
 */
const timed = function(fun) {
  const began = process.hrtime.bigint()
  const answer = fun()
  return {span: Number(process.hrtime.bigint() - began) / 1e6, answer: answer}
}

/**
 * Milliseconds each stage spends over one corpus, timed directly rather than by
 * subtracting one run from another: the error of two timings compounds, and a
 * stage whose own ratio is stable to three percent reads twenty that way.
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
 * The middle of a list of readings, which is what linear growth costs on this
 * machine in this run: sixteen of the eighteen stages grow with their input, so
 * the median is theirs and a stage that has changed shape cannot move it.
 * @param {Array.<number>} list - The readings
 * @return {number} - Their median
 */
const middle = function(list) {
  const sorted = Array.from(list).sort((one, two) => one - two)
  return (sorted[Math.floor((sorted.length - 1) / 2)] +
    sorted[Math.ceil((sorted.length - 1) / 2)]) / 2
}

/**
 * How each stage grew when the corpus grew `STEP` times, as a multiple of what
 * the run's middle stage grew. The quotient of two measurements taken in one
 * process is what survives a shared machine, and dividing by the middle is what
 * survives a different machine: an absolute threshold either flakes or is set
 * loose enough to catch nothing.
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {Map.<string, {ratio: number, relative: number}>} - Growth by stage
 */
const grown = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  const ratios = new Map(
    Array.from(small, ([name, span]) => [name, large.get(name) / span]),
  )
  const centre = middle(Array.from(ratios.values()))
  return new Map(
    Array.from(ratios, ([name, ratio]) => [
      name, {ratio: ratio, relative: ratio / centre},
    ]),
  )
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * The lowest reading answers whether a stage grew too fast and the highest
 * whether it stopped, since noise makes one attempt disagree with the rest
 * while a stage that has changed shape reads the same way in all of them.
 * @param {string} name - Name of the stage
 * @param {Array.<number>} readings - Its multiple of the middle, per attempt
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const low = Math.min(...readings)
  const high = Math.max(...readings)
  const known = SUPERLINEAR[name]
  let said = ''
  if (!known && low > LINEAR) {
    said = `${name} grew ${low.toFixed(2)} times what the middle stage of its ` +
      `own run grew, where ${LINEAR} is the most a stage that grows with its ` +
      `input reads`
  } else if (known && low > known.ceiling) {
    said = `${name} grew ${low.toFixed(2)} times the middle, past the ` +
      `${known.ceiling} that #${known.issue} holds it at, so it is worse than ` +
      `the ticket says`
  } else if (known && known.floor > 0 && high <= known.floor) {
    said = `${name} grew only ${high.toFixed(2)} times the middle, so ` +
      `#${known.issue} looks settled and the entry exempting it is stale`
  }
  return said
}

/**
 * Every stage whose growth disagrees with what its bar says, measured again up
 * to `ATTEMPTS` times while any of them does, beside the whole table of
 * readings — a gate that fails must say what it measured, or the next reader
 * has to reproduce a machine to find out.
 * @return {{faults: Array.<string>, table: string}} - Faults and the readings
 */
const judged = function() {
  measured(ATTEMPTS * SPREAD, WARMUP)
  const readings = new Map()
  let found = []
  let table = ''
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const grew = grown(attempt)
    for (const [name, one] of grew) {
      readings.set(name, (readings.get(name) ?? []).concat([one.relative]))
    }
    table = Array.from(grew, ([name, one]) =>
      `${name} ${one.ratio.toFixed(2)}x (${one.relative.toFixed(2)} of the ` +
      `middle)`).join(', ')
    found = Array.from(readings, ([name, list]) => fault(name, list))
      .filter((said) => said !== '')
    if (found.length === 0) {
      break
    }
  }
  return {faults: found, table: table}
}

describe('scaling', function() {
  it('holds every stage to the growth its bar allows', function() {
    this.timeout(120000)
    const judgement = judged()
    assert.deepEqual(
      judgement.faults,
      [],
      'a stage no longer grows the way the bar in test/scaling.test.js says, ' +
        `over a corpus of ${SMALL} stylesheets and one of ${SMALL * STEP}: ` +
        judgement.table,
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
