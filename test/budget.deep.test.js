/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {ranScript} = require('./helpers')
const assert = require('assert')

/**
 * What the nightly step reads off the script it hands a reading to: a status,
 * which is the whole of what arms the gate, and a line for whoever opens the
 * run. Both halves are spelled here rather than in the fast test beside this
 * one, neither existing until a shell runs the file — a verdict returning the
 * right sentence to nobody leaves the tier unable to fail (#785).
 * @type {Array.<{name: string, args: Array.<string>, code: number,
 *  said: string}>}
 */
const RUNS = [
  {
    name: 'fails the run whose corpus passed its budget',
    args: ['docbook', '41000', '40000'], code: 1,
    said: '::error::linting docbook took 41000ms, past its 40000ms budget\n',
  },
  {
    name: 'fails the run whose budget has stopped being a bar',
    args: ['tei', '4000', '40000'], code: 1,
    said: '::error::linting tei took 4000ms where its budget allows 40000ms, ' +
      'which is over 4 times the run: the budget has stopped being a bar ' +
      'and wants re-cutting from a measurement\n',
  },
  {
    name: 'passes the run standing inside its budget in silence',
    args: ['ditaot', '20000', '40000'], code: 0, said: '',
  },
]

describe('budget', function() {
  RUNS.forEach((row) => {
    it(row.name, function() {
      assert.deepEqual(
        ranScript('scripts/budget.js', row.args),
        {code: row.code, said: row.said},
        'the nightly tier cannot read off scripts/budget.js what a corpus ' +
          'cost it and whether to fail',
      )
    })
  })
})
