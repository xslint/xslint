/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {ranScript} = require('./helpers')
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * The defects of a report the script is handed, standing where a corpus of two
 * stylesheets would put them, one of them carrying a fix.
 * @param {string} root - Directory standing in for the corpus
 * @return {Array.<object>} - The report as `--format json` emits it
 */
const reported = function(root) {
  return [
    {rule: 'short-names', file: path.join(root, 'a.xsl'), line: 3, column: 7},
    {
      rule: 'count-compared-to-zero',
      file: path.join(root, 'b.xsl'),
      line: 9,
      column: 5,
      fix: {
        line: 9,
        column: 20,
        value: 'count(a) = 0',
        replacement: 'not(a)',
        suggestion: false,
      },
    },
  ]
}

/**
 * The lines that report renders to, in the order a snapshot holds them.
 * @type {Array.<string>}
 */
const DREW = [
  'a.xsl:3:7 short-names',
  'b.xsl:9:5 count-compared-to-zero fix "not(a)"',
]

/**
 * A corpus of its own, holding the report a run drew and the snapshot that run
 * is judged against, under a temporary directory rather than in the tree — and
 * named for a corpus, the verdict reading which one it is off that name.
 * @param {string} held - What the snapshot file holds
 * @return {object} - Where the corpus, the report and the snapshot stand
 */
const seeded = function(held) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-'))
  const report = path.join(root, 'report.json')
  const snapshot = path.join(root, 'docbook.txt')
  fs.writeFileSync(report, JSON.stringify(reported(root)))
  fs.writeFileSync(snapshot, held)
  return {root: root, report: report, snapshot: snapshot}
}

/**
 * What the nightly step reads off the script it hands a report to: a status,
 * which is the whole of what arms the gate, and a line for whoever opens the
 * run. Neither exists until a shell runs the file, so a verdict returning the
 * right sentence to nobody leaves the tier unable to fail (#785).
 * @type {Array.<{name: string, held: string, code: number, said: string}>}
 */
const RUNS = [
  {
    name: 'fails the run drawing a defect its snapshot does not hold',
    held: `${DREW[0]}\n`,
    code: 1,
    said: '::error::linting docbook no longer draws what its snapshot holds, ' +
      '2 defects against 1, so regenerate it once the change is meant: ' +
      `+${DREW[1]}\n`,
  },
  {
    name: 'passes the run drawing exactly what its snapshot holds, in silence',
    held: `${DREW.join('\n')}\n`,
    code: 0,
    said: '',
  },
]

describe('snapshot', function() {
  RUNS.forEach((row) => {
    it(row.name, function() {
      const seed = seeded(row.held)
      assert.deepEqual(
        ranScript(
          'scripts/snapshot.js', [seed.root, seed.report, seed.snapshot],
        ),
        {code: row.code, said: row.said},
        'the nightly tier cannot read off scripts/snapshot.js what a corpus ' +
          'has stopped drawing, or whether to fail on it',
      )
    })
  })
  it('writes the snapshot of what a corpus draws when asked to', function() {
    const seed = seeded('')
    ranScript(
      'scripts/snapshot.js',
      [seed.root, seed.report, seed.snapshot, '--write'],
    )
    assert.equal(
      fs.readFileSync(seed.snapshot, 'utf-8'),
      `${DREW.join('\n')}\n`,
      'a snapshot cannot be regenerated from a report, so a change that is ' +
        'meant leaves the gate red with nothing to commit',
    )
  })
})
