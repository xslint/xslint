/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {GAPS} = require('../src/tokens')
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
 * What percentage of its own run each stage may spend. A share and not a
 * growth is the assertion, #755's regression having been a constant growth
 * ranks backwards. A share is of the whole run, so a stage made cheaper lifts
 * every other entry and the table is re-derived by the ratio of the dearest
 * readings (#777, #783, #800, #784, #811); `test/CLAUDE.md` holds them.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 42,
  'xpath-validator': 24,
  'xsl-validator': 16,
}

/**
 * What percentage of the run any stage not named in `SHARES` may spend. The
 * twenty of them read 0.37% to 4.27% here, so this is the bar a cheap stage
 * crosses by becoming an expensive one, and crossing it earns an entry above
 * or a fix. It comes up whenever a stage made cheaper shrinks the denominator,
 * by the ratio of the dearest reading and never of the range (#784, #811).
 * @type {number}
 */
const SHARE = 7

/**
 * How many times its own reading a ceiling may stand above before it has
 * stopped being a bar. A ratchet turns red from both sides: a stage that grew
 * past its entry fails, and so does one made so much cheaper that the entry it
 * left behind would let the whole regression back in. Four rather than two, a
 * share cancelling a machine's speed and not its character.
 * @type {number}
 */
const SLACK = 4

/**
 * How many times the middle stage's growth a stage with no entry in `SHARES`
 * may grow by when the corpus grows `STEP` times. Asked of those alone, an
 * entry pinning what a stage costs outright being the stronger statement. A
 * quadratic reads `STEP` itself where the twenty read 0.70 to 1.19; one whose
 * constant is still small here is #769's question instead.
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
 * Microseconds of processor time this process has been charged, user and
 * system together. Not the wall clock, which charges a stage for every slice
 * the scheduler hands to something else: under sixteen processes over ten
 * cores the wall failed seven runs of eight and read the cross-file linter at
 * 0.78 of the middle stage, which would have called #755 settled.
 * @return {number} - Microseconds spent on a processor
 */
const charged = function() {
  const spent = process.cpuUsage()
  return spent.user + spent.system
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
 * The middle of a list of readings. It answers the growth question alone,
 * where the readings are ratios rather than milliseconds: every stage of
 * ordinary shape grows about as the corpus does, so their median is one
 * stage's growth whichever stage sits there. The median *cost* decides nothing
 * since #777, fourteen ordinary stages having kept swapping places.
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
 * of the middle stage's growth. Two quotients taken inside one process, which
 * is what survives a shared machine, each divided by something the whole run
 * supplies, which is what survives a different one. The cost is divided by the
 * readings summed and the growth by their median (#777).
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
 * The lowest of them answers every question, noise making one attempt disagree
 * where a real change reads the same way in all. A non-finite growth is no
 * reading and is dropped: Windows charges processor time in ticks coarser than
 * a cheap stage costs over the small corpus. The share is unhurt.
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
 * of readings — a gate that fails must say what it measured. The first
 * measurement is thrown away, on the one principle a warm-up has: warm the
 * code with the work about to be timed.
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

/**
 * Every bar of this file as a guide must spell it, the number carrying the
 * unit it is quoted in: a share is a percentage of a run and a growth a
 * multiple of the middle stage's. The tables above are re-derived whenever a
 * stage made cheaper moves the denominator, while the prose saying what they
 * hold stands in another file, so the two drift unwatched (#821).
 * @type {{[name: string]: string}}
 */
const QUOTED = Object.assign(
  {SHARE: `${SHARE}%`, GROWTH: GROWTH.toFixed(1)},
  Object.fromEntries(
    Object.keys(SHARES).map((name) => [name, `${SHARES[name]}%`]),
  ),
)

/**
 * How a bar of one unit is written, as the pattern matching every number a
 * guide may have put where that bar belongs: a share to the whole percent and a
 * growth to the tenth. Neither shape reaches the other's, which is what keeps a
 * measurement quoted beside a bar from being read as one.
 * @param {string} bar - What the bar must be quoted as
 * @return {string} - Pattern for a number quoted in the same unit
 */
const shaped = function(bar) {
  let pattern = '(\\d+\\.\\d+)'
  if (bar.endsWith('%')) {
    pattern = '(\\d+%)'
  }
  return pattern
}

/**
 * Every bar a guide quotes at a number this file does not hold. A gap collapses
 * first, because a bar is prose and prose wraps: the root guide spells one of
 * them across a line ending.
 * @param {string} guide - Path of the guide from the repository root
 * @return {Array.<string>} - One line per bar quoted wrongly
 */
const misquoted = function(guide) {
  const prose = fs.readFileSync(path.join(ROOT, guide), 'utf-8')
    .split(GAPS).join(' ')
  return Object.keys(QUOTED).flatMap(
    (name) => Array.from(
      prose.matchAll(new RegExp(`\`${name}\` at ${shaped(QUOTED[name])}`, 'g')),
    )
      .filter((found) => found[1] !== QUOTED[name])
      .map(
        (found) => `${guide} quotes \`${name}\` at ${found[1]}, not ${
          QUOTED[name]}`,
      ),
  )
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
  it('holds every bar a guide quotes to the table it stands in', function() {
    assert.deepEqual(
      GUIDES.flatMap(misquoted),
      [],
      'a guide quotes a bar at a number the tables above no longer hold, and ' +
        'the prose is the half a session reads before it touches either one, ' +
        'so a share left behind by the re-derivation that moved it is a bar ' +
        'loosened by nobody',
    )
  })
  it('states every bar of those tables in the guide read first', function() {
    const prose = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8')
      .split(GAPS).join(' ')
    assert.deepEqual(
      Object.keys(QUOTED).filter(
        (name) => !new RegExp(`\`${name}\` at ${shaped(QUOTED[name])}`)
          .test(prose),
      ),
      [],
      'a bar stands in no guide every turn loads, so the gate above holds it ' +
        'to nothing and a session meets it for the first time in the file ' +
        'that sets it',
    )
  })
})
