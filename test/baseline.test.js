/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {recorded, matched} = require('../src/baseline')
const {lint, settingsOf, sourceOf} = require('../src/xslint')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

/**
 * Directory the baseline fixtures live in, which also stands as the one a
 * baseline file is written to, so every path it records is relative to it.
 * @type {string}
 */
const BASE = path.resolve(__dirname, 'resources', 'baseline')

/**
 * One fixture linted under the name of the sheet the baseline was recorded
 * from, as a later run reads the same file after somebody edited it.
 * @param {string} name - Fixture under test/resources/baseline
 * @return {{sources: Array.<object>, reported: Array.<object>}} - The run
 */
const run = function(name) {
  const sources = [
    sourceOf(
      path.join(BASE, 'recorded.xsl'),
      fs.readFileSync(path.join(BASE, name), 'utf-8'),
    ),
  ]
  return {
    sources: sources,
    reported: lint(sources, settingsOf(BASE, {preset: 'all'})),
  }
}

/**
 * The baseline a run over the untouched sheet writes.
 * @return {object} - What `--baseline-write` stores
 */
const baseline = function() {
  const {sources, reported} = run('recorded.xsl')
  return recorded(reported, sources, BASE)
}

describe('baseline', function() {
  it('suppresses every defect it recorded', function() {
    const {sources, reported} = run('recorded.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE).fresh, [],
      'reported a defect the baseline recorded, so a gated tree cannot pass',
    )
  })
  it('keeps suppressing a defect whose line moved', function() {
    const {sources, reported} = run('shifted.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE).fresh, [],
      'reported a recorded defect after lines above it were added',
    )
  })
  it('reports the defects a new line draws', function() {
    const {sources, reported} = run('grown.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE).fresh.map(
        (defect) => `${defect.name}:${defect.line}`,
      ),
      [
        'setting-value-of-variable-incorrectly:19',
        'short-names:19',
        'unused-variable:19',
      ],
      'did not report the defects of a variable added after the baseline',
    )
  })
  it('names a recorded defect the run no longer draws as stale', function() {
    const {sources, reported} = run('repaired.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE).stale.map(
        (entry) => `${entry.file}:${entry.name}:${entry.count}`,
      ),
      ['recorded.xsl:starts-with-double-slash:1'],
      'did not call stale the entry of a defect fixed since the baseline',
    )
  })
  it('records each path relative to its own directory', function() {
    assert.deepStrictEqual(
      Object.keys(baseline()), ['recorded.xsl'],
      'did not record the path relative to the baseline file',
    )
  })
  it('reports every defect of a file it never recorded', function() {
    const {sources, reported} = run('recorded.xsl')
    assert.equal(
      matched(reported, sources, {}, BASE).fresh.length, reported.length,
      'suppressed a defect of a file the baseline holds no entry for',
    )
  })
  it('dont call stale a file the run did not read', function() {
    assert.deepStrictEqual(
      matched([], [], baseline(), BASE).stale, [],
      'called stale the entries of a file outside the paths linted',
    )
  })
})
