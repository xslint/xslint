/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByOutput} = require('../src/linters/output-linter')
const {STEP, grown} = require('./chains')
const {harness} = require('./packs')
const assert = require('assert')

/**
 * Stylesheets in the short chain. A hundred rather than forty, where the walk
 * per file still hid under the parse and the stage read a growth of 3.11 on
 * one runner and passed on the next, and rather than the two hundred
 * `test/import-linter.test.js` builds, over which the cube took a long chain
 * past a second a pass (#1141).
 * @type {number}
 */
const CHAIN = 100

/**
 * How many times over the check runs inside one timed window, over the short
 * chain, and a quarter as often over the long one. A pass costs some 0.4 ms
 * here, so 192 make a window of some 75, four of the sixteen-millisecond
 * ticks Windows charges in, where 64 made one tick and a half.
 * @type {number}
 */
const PASSES = 192

/**
 * How many times more a pass over the long chain may cost than one over the
 * short. The bar stands at the geometric middle of two measured distributions:
 * a walk per file over indexed edges costs the square of a chain and reads
 * 12.19 to 12.75 over eight runs, where one walk back and one forward reads
 * 4.07 to 4.26 over eight more; the walk scanning every edge read some 50.
 * @type {number}
 */
const GROWTH = 7

describe('output-linter', function() {
  harness({
    dir: 'output-packs',
    noun: 'missing serializations',
    run: (corpus, off) => lintByOutput(corpus, off),
  })
  it('cannot walk the chain it is handed once for every file', function() {
    const readings = grown(lintByOutput, CHAIN, PASSES)
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
