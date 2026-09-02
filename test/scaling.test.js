/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The speed gate (see **Speed**): charges every stage its own processor
 * time over a generated corpus at 40 stylesheets and again at 160, and
 * fails one that spends more of its own run than `SHARES` allows it —
 * `xpath-linter` at 42%, `xpath-validator` at 26%, `xsl-validator` at 18%
 * since #811's descendant phase took the dearest stage from 27.18% of the
 * run to 24.82% and #845 took the version off a climb and put it on the
 * record, lifting the two validators' shares against a run a twelfth
 * cheaper, or — where it has no entry there — grew more than `GROWTH`
 * beside the middle stage's growth. Cost is the sharp question and growth
 * the loose one, because #755 changed a constant and not an exponent, which
 * is a difference the two distributions show plainly: 15.1% to 15.7% of the
 * run against the quadratic's 26.5% to 31.9%, where in growth the fix reads
 * 1.85 to 2.04 and the quadratic 1.66 to 2.43 — the lowest reading being
 * the one judged, growth ranks them backwards. What the cost is a share
 * **of** is the whole run, the readings summed, and it was the middle
 * reading until #777: fourteen of the eighteen stages lie within a factor
 * of two and keep swapping places, so the pair landing 9th and 10th decided
 * the denominator of every share, and #775 — which made one of those two
 * cheaper and touched the cross-file linter not at all — lifted every share
 * by about a quarter and failed the gate. Growth still divides by the
 * median, and for the reason cost cannot: every ordinary stage grows about
 * as the corpus does, so a median growth is any ordinary stage's growth,
 * where an ordinary *cost* is a coin toss between two near-identical
 * readings. The corpus is the assertion as much as the bar is. It is copied
 * from one committed `test/resources/scaling/stylesheet.xsl`, the way every
 * test stylesheet here lives in a file, with the number of each file
 * substituted into every name it holds — so no two share an expression, a
 * declaration or a namespace, and the memo in `src/syntax.js` cannot make
 * the larger corpus look cheaper than it is. That stylesheet holds a
 * namespace nothing uses, an import, a literal result element, one unused
 * parameter, one pattern opening with a `//`, and a call of every shape a
 * linter is about, because a stage handed nothing it reads cannot be
 * measured at all: the three per-document linters were exactly that, 0.3 ms
 * with a spread of 358%, until it grew namespaces and imports. How *much*
 * of a construct it grows is its own question, and the parameter is where
 * that showed. A pair in each of the four templates read fine for
 * `parameter-linter` and took `corpus-linter` from 9.5 to 14.4 of the
 * middle reading, past the 13 the bar stood at before #777 — every `@name`
 * being a usage, and three of the four cross-file checks giving `//@*`. So
 * it is armed with the fewest attributes that still leave the new stage a
 * defect to build, which is one unused parameter, and against the whole run
 * that costs nothing a reading can see: 16.4% to 17.7% for the cross-file
 * linter where master reads 14.4% to 18.1% on the same machine, and 0.94%
 * to 1.07% for the new stage. The `//` of #586 is armed the same way and
 * for the same reason — five patterns a file reach `double-slash-linter`
 * and none of them built a defect, so 0.08% to 0.11% of the run was the
 * walk alone and every step past it went untimed, where one leading `//`
 * reads 0.18% to 0.19% and takes the cross-file linter nowhere a reading
 * can see, 6.46% to 7.10% against the 6.69% to 7.24% the unarmed corpus
 * gives on the same machine. A corpus that arms one stage must not disarm
 * the bar on another — which under the middle reading it could, one
 * attribute per file having been enough to move a denominator two cheap
 * stages were swapping places at. What one sheet copied cannot arm at all
 * is the *skew* of a real corpus, which is where the cross-file stage
 * really spends: `//@*` costs 1.3 to 3.2 us a node under some 350 nodes and
 * 50.4 at 4853, so five of DocBook-XSL's 315 stylesheets are two thirds of
 * that selector's whole cost. Every fortieth stylesheet is a **heavy** one
 * since #800 — the repeatable part of the sheet written out forty-eight
 * times over under names of its own, 5207 elements and attributes — which
 * the sheet marks with a `<!-- repeated -->` comment of its own, since the
 * `fixtures` job fails a `.test.js` holding a start tag and a marker a test
 * matches on is the fixture's to spell either way, and the stage reads
 * 15.95% to 18.94% where a uniform corpus of any density reads 7% to 10%
 * against the 13.73% TEI charges it and the 21.95% DocBook-XSL does.
 * `SHARES` and `SHARE` were re-derived a fourth time at #784, whose shared
 * walk took `xpath-linter` under a third of the run and lifted every share
 * taken against it (see **Speed**) — and the corpus this one built survives
 * that, both sides having risen together: the stage reads 19.51% to 20.08%
 * here against the 17.3% TEI charges it and the 25.7% DocBook-XSL does.
 * That walk did not serve `//@*` itself, an attribute axis standing outside
 * buckets that hold elements, so the one selector this stage is almost all
 * of paid #635 in full until #811 gave the walk an attribute of its own —
 * after which the stage reads 1.20% to 1.23% of the run here, its entry in
 * `SHARES` is gone and `SHARE` is what it answers to, and the heavy
 * stylesheet #800 armed it with arms the parse and the per-file checks
 * alone.
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
 * readings (#777, #783, #800, #784, #811, #845); `test/CLAUDE.md` holds them.
 * @type {{[stage: string]: number}}
 */
const SHARES = {
  'xpath-linter': 42,
  'xpath-validator': 26,
  'xsl-validator': 18,
}

/**
 * What percentage of the run any stage not named in `SHARES` may spend. The
 * twenty-one of them read 0.42% to 4.31% here, so this is the bar a cheap
 * stage crosses by becoming an expensive one, earning an entry or a fix.
 * It comes up whenever a stage made cheaper shrinks the denominator, by the
 * ratio of the dearest reading (#784, #811, #845).
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
