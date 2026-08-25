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
 * ever inflates a reading, so the floor of several is the honest one.
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
 * Processor time one import linting of a corpus costs.
 * @param {{corpus: Array.<{file: string, content: string, xsl: Document}>,
 *  passes: number}} chain - Parsed stylesheets, and how many passes to time
 * @return {number} - Microseconds spent on one pass
 */
const spentOn = function(chain) {
  const began = charged()
  for (let pass = 0; pass < chain.passes; pass++) {
    lintByImports(chain.corpus)
  }
  return (charged() - began) / chain.passes
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
  it('cannot cost the square of the chain it is handed', function() {
    const chains = [
      {corpus: chained(0, CHAIN), passes: PASSES},
      {corpus: chained(CHAIN, CHAIN * STEP), passes: PASSES / STEP},
    ]
    const readings = judged(chains)
    const grew = readings[1] / readings[0]
    assert.ok(
      grew < GROWTH,
      `growing ${grew.toFixed(2)} times over a chain ${STEP} times longer ` +
      `is not under ${GROWTH}`,
    )
  })
})
