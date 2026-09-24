/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByImports} = require('../src/linters/import-linter')
const {xml} = require('../src/helpers')
const {harness} = require('./packs')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

/*
 * `capped` is why a window here is charged the smaller of two clocks.
 * `process.cpuUsage` sums every thread the process has, and Windows charges
 * each one it finds running at an interrupt a whole tick of some 15,625
 * microseconds — so a concurrent marker that ran a fraction of a millisecond
 * is charged a tick, and a window of sixty milliseconds is charged four of
 * them for every thread that woke inside it. The long chain allocates four
 * times as much per pass and is the one whose window provokes that marker, so
 * the phantom lands on the numerator of the growth rather than on both sides
 * of it, and the floor over three attempts does not reach what is systematic
 * on one side. That read 16.80 on `build (windows-2022, 20)` at `b9a201a`,
 * inside the distribution a walk-per-edge defect reads at, on a tree the same
 * runner had passed hours before under its own pull request; re-run at that
 * very commit the job came back green, which is the signature #892 named one
 * gate over — a verdict belonging to the clock and not to the tree.
 *
 * No single thread can spend more processor time than the wall its window
 * spanned, so the wall is the cap, and the reason a processor clock was chosen
 * survives it: a descheduled process is charged less than its wall, and the
 * smaller of the two is the processor's again. What the threads cost is
 * measurable where no tick hides it, a window of this test reading 1.95 times
 * its own wall here against 0.99 under `--predictable`, which leaves V8 one
 * thread to compile and collect on. Charging the smaller reads 4.23 to 4.46
 * over eight runs where the raw clock reads 4.34 to 4.66, so it is inert on a
 * clock that was honest; against one charging a tick per thread per interrupt
 * it reads 4.26 to 4.87 where the raw one reads 16.00 to 18.29; and the
 * walk-per-edge defect still fails it three times of three, at 14.75, 14.78
 * and 15.10 (#906).
 */

/**
 * Stylesheets in the short chain. Two hundred rather than the forty
 * `test/scaling.test.js` builds: a quadratic whose constant is still small is
 * invisible at the size where the per-edge cost dominates, and this check read
 * a flat 1.0 to 1.6 there while it cost the square of the chain (#769).
 * @type {number}
 */
const CHAIN = 200

/**
 * How many times longer the long chain is than the short one.
 * @type {number}
 */
const STEP = 4

/**
 * How many times over the check runs inside one timed window, over the short
 * chain — a quarter as often over the long one, so both come out the same size
 * while the check is linear in the edges. A window has to clear the clock's
 * granularity: Windows charges in ticks of some sixteen milliseconds, where a
 * single pass read `0` on both chains and the growth arrived `NaN`.
 * @type {number}
 */
const PASSES = 64

/**
 * How many times each chain is timed, the lowest reading answering. Noise only
 * ever inflates a reading, so the floor of several is the honest one — of the
 * noise it reaches, the note above naming the inflation it does not.
 * @type {number}
 */
const ATTEMPTS = 3

/**
 * How many times more a pass over the long chain may cost than one over the
 * short. The bar stands at the geometric middle of two measured distributions:
 * a cycle check walking the whole graph per edge costs the square of a chain
 * and reads 14.58 to 16.22 over eight runs, where one answering every edge in
 * a single pass reads 4.34 to 4.66 over eight more.
 * @type {number}
 */
const GROWTH = 8


/**
 * The one stylesheet the chain is built out of, read once. It is a committed
 * resource rather than a string spelled here, the way every test stylesheet in
 * this repository is.
 * @type {string}
 */
const SHEET = fs.readFileSync(
  path.join(__dirname, 'resources', 'imports', 'stylesheet.xsl'), 'utf-8',
)

/**
 * A chain of stylesheets numbered from one file on, each importing the one
 * before it. The first one's import resolves to a file the corpus does not
 * hold, so it is external and yields no edge, which is what leaves the chain
 * open rather than closed into a cycle.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many to build
 * @return {Array.<{file: string, content: string, xsl: Document}>} - Corpus
 */
const chained = function(from, files) {
  const corpus = []
  for (let at = 0; at < files; at++) {
    const content = SHEET
      .replaceAll('PREVIOUS', String(from + at - 1))
      .replaceAll('SEED', String(from + at))
    corpus.push({
      file: `s${from + at}.xsl`,
      content: content,
      xsl: xml.parsedFromString(content),
    })
  }
  return corpus
}

/**
 * Processor time spent so far, in microseconds. The wall clock charges the
 * check for every slice the scheduler hands to something else, which is what
 * made the wall-clock spelling of `test/scaling.test.js` unusable on a busy
 * machine.
 * @return {number} - Microseconds of processor time
 */
const charged = function() {
  const spent = process.cpuUsage()
  return spent.user + spent.system
}

/**
 * Wall time spent so far, in microseconds, off the monotonic clock rather than
 * a calendar one a machine may set back under a running window.
 * @return {number} - Microseconds since a point this process fixed
 */
const spanned = function() {
  return Number(process.hrtime.bigint() / 1000n)
}

/**
 * What one window may be charged: the processor time the clock summed over it,
 * or the wall time it spanned, whichever a single thread could have spent. The
 * note at the top of this file says whose the difference is (#906).
 * @param {number} cpu - Microseconds of processor time the clock summed
 * @param {number} wall - Microseconds of wall time the window spanned
 * @return {number} - What one thread can have spent in the window
 */
const capped = function(cpu, wall) {
  return Math.min(cpu, wall)
}

/**
 * Processor time one import linting of a corpus costs.
 * @param {{corpus: Array.<{file: string, content: string, xsl: Document}>,
 *  passes: number}} chain - Parsed stylesheets, and how many passes to time
 * @return {number} - Microseconds spent on one pass
 */
const spentOn = function(chain) {
  const began = {cpu: charged(), wall: spanned()}
  for (let pass = 0; pass < chain.passes; pass++) {
    lintByImports(chain.corpus)
  }
  return capped(charged() - began.cpu, spanned() - began.wall) / chain.passes
}

/**
 * The lowest reading each corpus gives over `ATTEMPTS` rounds, the rounds
 * interleaved so the two meet the same machine rather than one of them meeting
 * it first.
 * @param {Array.<{corpus: Array.<{file: string, content: string,
 *  xsl: Document}>, passes: number}>} chains - The chains to time
 * @return {Array.<number>} - Microseconds a pass, one reading per chain
 */
const judged = function(chains) {
  const low = chains.map(() => Infinity)
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    chains.forEach((chain, at) => {
      low[at] = Math.min(low[at], spentOn(chain))
    })
  }
  return low
}

describe('import-linter', function() {
  harness({
    dir: 'import-packs',
    noun: 'import defects',
    run: (corpus, off) => lintByImports(corpus, off),
  })
  it('charges no window what one thread cannot have spent in it', function() {
    assert.deepEqual(
      [capped(136600, 70100), capped(46200, 46300)],
      [70100, 46200],
      [
        'a window whose processor clock summed the threads Windows charges a',
        'whole tick apiece is no longer charged the wall it spanned, or one',
        'a single thread could have spent is no longer charged what it read',
      ].join(' '),
    )
  })
  it('cannot cost the square of the chain it is handed', function() {
    const chains = [
      {corpus: chained(0, CHAIN), passes: PASSES},
      {corpus: chained(CHAIN, CHAIN * STEP), passes: PASSES / STEP},
    ]
    const readings = judged(chains)
    const grew = readings[1] / readings[0]
    assert.ok(
      grew < GROWTH,
      [
        `growing ${grew.toFixed(2)} times over a chain ${STEP} times longer`,
        `is not under ${GROWTH}, at ${(readings[0] / 1000).toFixed(2)} and`,
        `${(readings[1] / 1000).toFixed(2)} milliseconds a pass`,
      ].join(' '),
    )
  })
})
