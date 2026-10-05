/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The speed gate: charges every stage its own processor time over a
 * generated corpus at 40 stylesheets and again at 160, and fails a stage
 * spending more of the whole run than `SHARES` or `SHARE` allows, or, with
 * no entry, growing past `GROWTH` beside the middle stage (#755, #777). Cost
 * is the sharp question, the regression this exists for having changed a
 * constant rather than an exponent. The corpus is copied from one committed
 * stylesheet with every name renumbered, so no memo flatters it, and every
 * fortieth copy is heavy for the skew a real corpus has (#800). `COST` and
 * `COSTS` ask the same of each check of a stage owning several (#811).
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {GAPS} = require('../src/tokens')
const {clocked} = require('./clock')
const {ROOT, ENTRY, ARCHITECTURE, GUIDES, chained} = require('./guides')
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
 * readings (#777, #783, #800, #784, #811, #845); `test/CLAUDE.md` holds them.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 39,
  'xpath-validator': 26,
  'xsl-validator': 18,
}

/**
 * What percentage of the run any stage not named in `SHARES` may spend. The
 * twenty-one of them read 0.69% to 4.95% here, so this is the bar a cheap
 * stage crosses by becoming an expensive one, earning an entry or a fix.
 * It comes up whenever a stage made cheaper shrinks the denominator, by the
 * ratio of the dearest reading (#784, #811, #845).
 * @type {number}
 */
const SHARE = 7

/**
 * The checks that legitimately cost more of a run than the rest, the way
 * `SHARES` names the three dear stages: an XSD regex asked of every candidate,
 * and one anchored on the root that spends everything inside a predicate that
 * descends the tree. What each reads, and what left this table once its
 * predicate compiled whole, the tickets carry (#811, #881).
 * @type {{[check: string]: number}}
 */
const COSTS = {
  'name-starts-with-numeric': 7,
  'too-many-templates': 4,
}

/**
 * What percentage of the run one check of a stage owning several may spend.
 * This one stands between two measured distributions rather than under one: a
 * check the walk stops serving reads 4.32% at its cheapest where the dearest
 * served reading is 1.84%. A check whose stage owns it alone is that stage and
 * answers to `SHARE` already (#811).
 * @type {number}
 */
const COST = 3

/**
 * The checks a sibling of their own stage rides along with. `--suppress`
 * matches by substring, so a name standing inside another cannot be left
 * running while that other is silenced, and the sweep below charges the pair to
 * one bar. It is empty since #958 renamed the one pair that clashed, and it
 * stays because the gate below is what stops a second arriving unread (#811).
 * @type {{[check: string]: string}}
 */
const SHADOWED = {}

/**
 * What fraction of the checks may read `0` before the clock has resolved none
 * of them. A quarter is the geometric middle of the two measured
 * distributions: 1 to 4 of the forty-nine read `0` here over five runs,
 * against 36 to 38 under a clock quantised to the scheduler tick Windows
 * charges processor time in (#892).
 * @type {number}
 */
const RESOLVED = 0.25

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
 * What each stage was handed comes back beside what it spent, since weighing
 * one check means running its stage again over that same input.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many the corpus holds
 * @return {{spans: Map.<string, number>, given: Map.<string, Array>}} - Both
 */
const measured = function(from, files) {
  const sources = corpus(from, files)
  const spans = new Map()
  const given = new Map()
  const xsls = timed(() => validateXsls(sources, []))
  spans.set('xsl-validator', xsls.span)
  const xpaths = timed(() => validateXpaths(xsls.answer.corpus, []))
  spans.set('xpath-validator', xpaths.span)
  for (const stage of STAGES) {
    given.set(stage.name, xpaths.answer.expressions)
    if (stage.over === 'corpus') {
      given.set(stage.name, xsls.answer.corpus)
    }
    spans.set(
      stage.name, timed(() => stage.run(given.get(stage.name), [])).span,
    )
  }
  return {spans: spans, given: given}
}

/**
 * Milliseconds one check of a stage owning several spends, each timed by
 * running that stage again over the same input under every other name it owns.
 * The filter asks what the check's own name holds rather than what it equals,
 * which drops the check itself and leaves a sibling standing inside it running,
 * that being a name no suppression can reach past (#811).
 * @param {Map.<string, Array>} given - What each stage was handed
 * @return {Map.<string, number>} - Milliseconds by check
 */
const costed = function(given) {
  const costs = new Map()
  for (const stage of STAGES.filter((one) => one.checks.length > 1)) {
    for (const check of stage.checks) {
      costs.set(check, timed(() => stage.run(
        given.get(stage.name),
        stage.checks.filter((one) => !check.includes(one)),
      )).span)
    }
  }
  return costs
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
 * What percentage of its run each stage spends, how it grew as a multiple of
 * the middle stage's growth, and what each check of a stage owning several
 * costs of that same run. Quotients taken inside one process, which is what
 * survives a shared machine, each divided by something the whole run supplies,
 * which is what survives a different one (#777, #811).
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {{stages: Map.<string, object>, checks: Map.<string, number>}} - Both
 */
const weighed = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  const ratios = new Map(
    Array.from(
      small.spans, ([name, span]) => [name, large.spans.get(name) / span],
    ),
  )
  const whole = Array.from(large.spans.values())
    .reduce((one, two) => one + two, 0)
  const linear = middle(Array.from(ratios.values()))
  return {
    stages: new Map(
      Array.from(large.spans, ([name, span]) => [name, {
        share: 100 * span / whole,
        growth: ratios.get(name) / linear,
      }]),
    ),
    checks: new Map(
      Array.from(
        costed(large.given), ([name, span]) => [name, 100 * span / whole],
      ),
    ),
  }
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * A ceiling is judged off the cheapest of them and the slack off the dearest,
 * each side asked of the reading that most favours passing. A non-finite growth
 * is no reading and is dropped: Windows charges in ticks coarser than a cheap
 * stage costs over the small corpus, which leaves the share unhurt.
 * @param {string} name - Name of the stage
 * @param {Array.<{share: number, growth: number}>} readings - Per attempt
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const cheapest = Math.min(...readings.map((one) => one.share))
  const dearest = Math.max(...readings.map((one) => one.share))
  const growths = readings.map((one) => one.growth).filter(Number.isFinite)
  const named = Object.hasOwn(SHARES, name)
  let ceiling = SHARE
  if (named) {
    ceiling = SHARES[name]
  }
  let said = ''
  if (cheapest > ceiling) {
    said = [
      `${name} spends ${cheapest.toFixed(2)}% of its own run, past the`,
      `${ceiling}% that test/scaling.test.js allows it`,
    ].join(' ')
  } else if (!named && growths.length > 0 && Math.min(...growths) > GROWTH) {
    said = [
      `${name} grew ${Math.min(...growths).toFixed(2)} times what the`,
      `middle stage grew when the corpus grew ${STEP} times, so its shape has`,
      `changed`,
    ].join(' ')
  } else if (named && ceiling > SLACK * dearest) {
    said = [
      `${name} spends at most ${dearest.toFixed(2)}% of its run where it`,
      `is allowed ${ceiling}%, so the entry has stopped being a bar and wants`,
      `tightening`,
    ].join(' ')
  }
  return said
}

/**
 * What is wrong with one check's readings, or an empty string when nothing is.
 * No growth question stands beside the share: a check is part of one stage, and
 * the stage is asked how it grew already. The two ends of the readings answer
 * the two sides here as they do for a stage, and for the same reason.
 * @param {string} name - Name of the check
 * @param {Array.<number>} readings - Its share of the run, per attempt
 * @return {string} - The fault, or an empty string
 */
const overspent = function(name, readings) {
  const cheapest = Math.min(...readings)
  const dearest = Math.max(...readings)
  const named = Object.hasOwn(COSTS, name)
  let ceiling = COST
  if (named) {
    ceiling = COSTS[name]
  }
  let said = ''
  if (cheapest > ceiling) {
    said = [
      `${name} costs ${cheapest.toFixed(2)}% of the run, past the`,
      `${ceiling}% that test/scaling.test.js allows it`,
    ].join(' ')
  } else if (named && ceiling > SLACK * dearest) {
    said = [
      `${name} costs at most ${dearest.toFixed(2)}% of the run where it`,
      `is allowed ${ceiling}%, so the entry has stopped being a bar and wants`,
      `tightening`,
    ].join(' ')
  }
  return said
}

/**
 * What one attempt measured, as the line a failing gate prints: every stage
 * with its growth beside its share, then every check answering to a bar of its
 * own, dearest first, that being the order a re-cut of `COST` reads them in.
 * @param {{stages: Map, checks: Map}} weight - One attempt's readings
 * @return {string} - The readings, joined
 */
const tabled = function(weight) {
  return Array.from(weight.stages, ([name, one]) =>
    [
      `${name} ${one.share.toFixed(2)}% of its run, grew`,
      `${one.growth.toFixed(2)}`,
    ].join(' ')).concat(
    Array.from(weight.checks).sort((one, two) => two[1] - one[1]).map(
      ([name, share]) => `${name} ${share.toFixed(2)}%`,
    ),
  ).join(', ')
}

/**
 * Whether the clock resolved what the check tier judges. A check costs a
 * fraction of a millisecond and Windows charges in ticks of some sixteen, so a
 * reading there counts tick boundaries rather than measuring the check: three
 * quarters of them come back `0` and what is left swings five times over
 * between attempts of one run (#892).
 * @param {Map.<string, Array.<number>>} costs - Each check's readings so far
 * @return {boolean} - Whether the tier has a measurement to judge
 */
const resolves = function(costs) {
  return Array.from(costs.values()).filter(
    (readings) => Math.max(...readings) === 0,
  ).length < RESOLVED * costs.size
}

/**
 * Every stage whose cost or growth, and every check whose cost, disagrees with
 * what its bar says, measured again up to `ATTEMPTS` times while any of them
 * does, beside the whole table of readings — a gate that fails must say what it
 * measured. The first measurement is thrown away, on the one principle a
 * warm-up has: warm the code with the work about to be timed.
 * @return {{stages: Array, checks: Array, resolved: boolean, table: string}} -
 *   Each tier's faults, whether the clock resolved the checks, and the readings
 */
const judged = function() {
  weighed(ATTEMPTS)
  const readings = new Map()
  const costs = new Map()
  let stages = []
  let checks = []
  let resolved = true
  let table = ''
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const weight = weighed(attempt)
    for (const [name, one] of weight.stages) {
      readings.set(name, (readings.get(name) ?? []).concat([one]))
    }
    for (const [name, share] of weight.checks) {
      costs.set(name, (costs.get(name) ?? []).concat([share]))
    }
    table = tabled(weight)
    stages = Array.from(readings, ([name, list]) => fault(name, list))
      .filter((said) => said !== '')
    checks = Array.from(costs, ([name, list]) => overspent(name, list))
      .filter((said) => said !== '')
    resolved = resolves(costs)
    if (stages.length === 0 && (checks.length === 0 || !resolved)) {
      break
    }
  }
  return {
    stages: stages, checks: checks, resolved: resolved, table: table,
  }
}

/**
 * The one measurement both tiers read, taken on the first ask and remembered.
 * A stage answers to its bar under a clock that cannot resolve a check, so the
 * two are an `it` apiece and only the second stands down — sharing this, a
 * corpus of its own paying for the building and the discarded warm-up twice.
 * @type {?object}
 */
let taken = null

/**
 * What `judged` answered, measured once however many tiers ask for it.
 * @return {object} - Each tier's faults, the clock's verdict, and the readings
 */
const settled = function() {
  if (taken === null) {
    taken = judged()
  }
  return taken
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
  {SHARE: `${SHARE}%`, GROWTH: GROWTH.toFixed(1), COST: `${COST}%`},
  Object.fromEntries(
    Object.keys(SHARES).map((name) => [name, `${SHARES[name]}%`]),
  ),
  Object.fromEntries(
    Object.keys(COSTS).map((name) => [name, `${COSTS[name]}%`]),
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
 * first, because a bar is prose and prose wraps, so a name and its number may
 * stand either side of a line ending.
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
  it('holds every stage to the bar it answers to', function() {
    this.timeout(120000)
    if (instrumented()) {
      this.skip()
    }
    const judgement = settled()
    assert.deepEqual(
      judgement.stages,
      [],
      [
        'a stage no longer costs or grows the way the bars in',
        `test/scaling.test.js say, over a corpus of ${SMALL} stylesheets and`,
        `one of ${SMALL * STEP}: ${judgement.table}`,
      ].join(' '),
    )
  })
  it('holds every check to the bar it answers to', function() {
    this.timeout(120000)
    if (instrumented()) {
      this.skip()
    }
    const judgement = settled()
    if (!judgement.resolved) {
      this.skip()
    }
    assert.deepEqual(
      judgement.checks,
      [],
      [
        'a check no longer costs the way the bars in test/scaling.test.js say,',
        `over a corpus of ${SMALL * STEP} stylesheets: ${judgement.table}`,
      ].join(' '),
    )
  })
  it('reads a clock too coarse for a check as no measurement', function() {
    assert.deepEqual(
      [4, 36].map((zeros) => resolves(new Map(
        Array.from({length: 49}, (blank, at) => [`${at}`, [Number(at >= zeros)]]),
      ))),
      [true, false],
      [
        'the check tier no longer stands down under the tick Windows charges',
        'processor time in, where 36 of its 49 readings come back zero, or no',
        'longer judges the 4 of 49 a fine clock leaves',
      ].join(' '),
    )
  })
  it('names in SHARES only stages the pipeline still has', function() {
    assert.deepEqual(
      Object.keys(SHARES).filter(
        (name) => !STAGES.some((stage) => stage.name === name) &&
          name !== 'xsl-validator' && name !== 'xpath-validator',
      ),
      [],
      [
        'a stage is allowed a cost of its own by name, yet nothing of that name',
        'runs any more, so the entry weighs on nothing',
      ].join(' '),
    )
  })
  it('names in COSTS only checks the pipeline still runs', function() {
    assert.deepEqual(
      Object.keys(COSTS).filter(
        (name) => !STAGES.some((stage) => stage.checks.includes(name)),
      ),
      [],
      [
        'a check is allowed a cost of its own by name, yet no stage owns one',
        'of that name any more, so the entry weighs on nothing',
      ].join(' '),
    )
  })
  it('names in SHADOWED every check a sibling rides along with', function() {
    assert.deepEqual(
      Object.fromEntries(
        STAGES.flatMap((stage) => stage.checks.map((check) => [
          check,
          stage.checks.filter(
            (one) => one !== check && check.includes(one),
          ).join(' '),
        ])).filter((pair) => pair[1] !== ''),
      ),
      SHADOWED,
      [
        'a check name stands inside another of its own stage, so the sweep',
        'above cannot run the one without the other and charges the pair to',
        'a single bar without saying so',
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
  it('holds every bar a guide quotes to the table it stands in', function() {
    assert.deepEqual(
      GUIDES.concat([ARCHITECTURE]).flatMap(misquoted),
      [],
      [
        'a guide quotes a bar at a number the tables above no longer hold, and',
        'the prose is the half a session reads before it touches either one,',
        'so a share left behind by the re-derivation that moved it is a bar',
        'loosened by nobody',
      ].join(' '),
    )
  })
  it('states every bar of those tables in the guide read first', function() {
    const prose = chained(ENTRY)
      .map((one) => fs.readFileSync(path.join(ROOT, one), 'utf-8'))
      .join(' ').split(GAPS).join(' ')
    assert.deepEqual(
      Object.keys(QUOTED).filter(
        (name) => !new RegExp(`\`${name}\` at ${shaped(QUOTED[name])}`)
          .test(prose),
      ),
      [],
      [
        'a bar stands in no guide every turn loads, so the gate above holds it',
        'to nothing and a session meets it for the first time in the file',
        'that sets it',
      ].join(' '),
    )
  })
})
