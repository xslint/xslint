/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByImports} = require('../src/linters/import-linter')
const {STEP, grown} = require('./chains')
const {harness} = require('./packs')
const assert = require('assert')

/*
 * `capped` in `test/clock.js` is why a window here is charged the smaller of
 * two clocks. `process.cpuUsage` sums every thread the process has, and
 * Windows charges each one it finds running at an interrupt a whole tick, so
 * the long chain's window drew a phantom on the numerator of the growth alone:
 * 16.80 on `windows-2022` at `b9a201a`, green on a re-run, the signature of a
 * verdict belonging to the clock (#892). No thread spends more processor time
 * than the wall its window spanned, so the wall is the cap, inert on an honest
 * clock while the walk-per-edge defect still fails it three times of three
 * (#906).
 */

/**
 * Stylesheets in the short chain. Two hundred, since a quadratic whose
 * constant is still small is invisible at forty, where the per-edge cost
 * dominates, and this check read a flat 1.0 to 1.6 there while it cost the
 * square of the chain (#769).
 * @type {number}
 */
const CHAIN = 200

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
 * How many times more a pass over the long chain may cost than one over the
 * short. The bar stands at the geometric middle of two measured distributions:
 * a cycle check walking the whole graph per edge costs the square of a chain
 * and reads 14.58 to 16.22 over eight runs, where one answering every edge in
 * a single pass reads 4.34 to 4.66 over eight more.
 * @type {number}
 */
const GROWTH = 8

describe('import-linter', function() {
  harness({
    dir: 'import-packs',
    noun: 'import defects',
    run: (corpus, off) => lintByImports(corpus, off),
  })
  it('cannot cost the square of the chain it is handed', function() {
    const readings = grown(lintByImports, CHAIN, PASSES)
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
