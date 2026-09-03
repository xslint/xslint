/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {reporterOf} = require('../src/reporters')
const assert = require('assert')
const path = require('path')

/**
 * Run a reporter over given defects and capture what it writes to stdout.
 * @param {function(Array.<object>): void} report - Reporter under test
 * @param {Array.<object>} defects - Defects to report
 * @return {string} - The captured output
 */
const capture = function(report, defects) {
  const lines = []
  const original = console.log
  console.log = (line) => lines.push(line)
  try {
    report(defects)
  } finally {
    console.log = original
  }
  return lines.join('\n')
}

/**
 * A defect of given severity, its file under the working directory so the
 * relative path is deterministic.
 * @param {string} severity - Defect severity
 * @return {object} - Defect
 */
const defect = function(severity) {
  return {
    name: 'short-names',
    severity: severity,
    message: 'Use a descriptive name',
    file: path.join(process.cwd(), 'sheets', 'a.xsl'),
    line: 16,
    pos: 3,
  }
}

/**
 * A defect carrying the given fix, so a report is asked about the fix alone.
 * @param {object} fix - The fix it carries
 * @return {object} - Defect
 */
const fixed = function(fix) {
  return {...defect('warning'), fix: fix}
}

describe('reporters', function() {
  it('reports a defect as a JSON object with position and message', function() {
    assert.deepStrictEqual(
      JSON.parse(capture(reporterOf('json'), [defect('warning')]))[0],
      {
        rule: 'short-names',
        severity: 'warning',
        message: 'Use a descriptive name',
        file: 'sheets/a.xsl',
        line: 16,
        column: 3,
      },
    )
  })
  it('carries the span and the replacement of a fix into the JSON report',
    function() {
      assert.deepStrictEqual(
        JSON.parse(capture(reporterOf('json'), [fixed(
          {line: 16, col: 12, value: 'count(a) = 0', replacement: 'not(a)'},
        )]))[0].fix,
        {
          line: 16,
          column: 12,
          value: 'count(a) = 0',
          replacement: 'not(a)',
          suggestion: false,
        },
      )
    })
  it('grades a suggested fix as one in the JSON report', function() {
    assert.equal(
      JSON.parse(capture(reporterOf('json'), [fixed({
        line: 16, col: 12, value: '//a', replacement: 'a', suggestion: true,
      })]))[0].fix.suggestion,
      true,
    )
  })
  it('carries no fix at all on a defect that has none', function() {
    assert.ok(
      !Object.hasOwn(
        JSON.parse(capture(reporterOf('json'), [defect('warning')]))[0], 'fix',
      ),
      'a defect nothing can fix carries a fix in the JSON report',
    )
  })
  it('reports an empty JSON array when there are no defects', function() {
    assert.deepStrictEqual(JSON.parse(capture(reporterOf('json'), [])), [])
  })
  it('names an out-of-tree file by its absolute path, not a climb', function() {
    const outside = path.join(path.parse(process.cwd()).root, 'out', 'a.xsl')
    const reported = JSON.parse(capture(
      reporterOf('json'), [{...defect('warning'), file: outside}],
    ))
    assert.equal(reported[0].file, outside.split(path.sep).join('/'))
  })
  it('reports the SARIF version', function() {
    assert.equal(
      JSON.parse(capture(reporterOf('sarif'), [defect('warning')])).version,
      '2.1.0',
    )
  })
  it('places a SARIF result at the defect location', function() {
    const log = JSON.parse(capture(reporterOf('sarif'), [defect('warning')]))
    assert.deepStrictEqual(
      log.runs[0].results[0].locations[0].physicalLocation.region,
      {startLine: 16, startColumn: 3},
    )
  })
  it('derives a SARIF rule from the defect', function() {
    const log = JSON.parse(capture(reporterOf('sarif'), [defect('warning')]))
    assert.equal(log.runs[0].tool.driver.rules[0].id, 'short-names')
  })
  it('maps an error defect to the SARIF error level', function() {
    const log = JSON.parse(capture(reporterOf('sarif'), [defect('error')]))
    assert.equal(log.runs[0].results[0].level, 'error')
  })
  it('emits a GitHub warning command at the defect location', function() {
    assert.ok(
      capture(reporterOf('github'), [defect('warning')])
        .includes('::warning file=sheets/a.xsl,line=16,col=3'),
    )
  })
  it('maps an error defect to a GitHub error command', function() {
    assert.ok(
      capture(reporterOf('github'), [defect('error')]).startsWith('::error '),
    )
  })
  it('carries the rule name as the GitHub annotation title', function() {
    assert.ok(
      capture(reporterOf('github'), [defect('warning')])
        .includes('title=short-names'),
    )
  })
})
