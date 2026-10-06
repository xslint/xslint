/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {recorded, matched} = require('../src/baseline')
const {lint, settingsOf, sourceOf, ranOf} = require('../src/xslint')
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
 * The checks a run over every check in the catalog runs.
 * @return {Array.<string>} - Their names
 */
const every = function() {
  return ranOf(settingsOf(BASE, {preset: 'all'}))
}

/**
 * One text linted under the name of the sheet the baseline was recorded
 * from, as a later run reads the same file after somebody edited it.
 * @param {string} content - What the sheet holds now
 * @return {{sources: Array.<object>, reported: Array.<object>}} - The run
 */
const linted = function(content) {
  const sources = [sourceOf(path.join(BASE, 'recorded.xsl'), content)]
  return {
    sources: sources,
    reported: lint(sources, settingsOf(BASE, {preset: 'all'})),
  }
}

/**
 * One fixture linted under the name of the sheet the baseline was recorded
 * from.
 * @param {string} name - Fixture under test/resources/baseline
 * @return {{sources: Array.<object>, reported: Array.<object>}} - The run
 */
const run = function(name) {
  return linted(fs.readFileSync(path.join(BASE, name), 'utf-8'))
}

/**
 * The baseline a run over the untouched sheet writes.
 * @return {object} - What `--baseline-write` stores
 */
const baseline = function() {
  const {sources, reported} = run('recorded.xsl')
  return recorded(reported, sources, BASE, every(), {})
}

describe('baseline', function() {
  it('suppresses every defect it recorded', function() {
    const {sources, reported} = run('recorded.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh, [],
      'reported a defect the baseline recorded, so a gated tree cannot pass',
    )
  })
  it('keeps suppressing a defect whose line moved', function() {
    const {sources, reported} = run('shifted.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh, [],
      'reported a recorded defect after lines above it were added',
    )
  })
  it('keeps suppressing a defect whose line was reindented', function() {
    const {sources, reported} = linted(
      fs.readFileSync(path.join(BASE, 'recorded.xsl'), 'utf-8')
        .split('\n')
        .map((line) => line.replace(/^ +/, (lead) => '\t'.repeat(lead.length)))
        .join('\n'),
    )
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh, [],
      'reported a recorded defect after its line was indented with tabs',
    )
  })
  it('reads a sheet whose lines end in a bare carriage return', function() {
    const {sources, reported} = linted(
      fs.readFileSync(path.join(BASE, 'recorded.xsl'), 'utf-8')
        .replaceAll('\n', '\r'),
    )
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh, [],
      'did not match the defects of a sheet ending its lines in CR alone',
    )
  })
  it('reports the defects a new line draws', function() {
    const {sources, reported} = run('grown.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh.map(
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
  it('reports a copy of a recorded line beyond its count', function() {
    const {sources, reported} = run('doubled.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).fresh.map(
        (defect) => `${defect.name}:${defect.line}`,
      ),
      ['starts-with-double-slash:38'],
      'did not report a second copy of a line the baseline recorded once',
    )
  })
  it('names a recorded defect the run no longer draws as stale', function() {
    const {sources, reported} = run('repaired.xsl')
    assert.deepStrictEqual(
      matched(reported, sources, baseline(), BASE, every()).stale.map(
        (entry) => `${entry.file}:${entry.name}:${entry.count}`,
      ),
      ['recorded.xsl:starts-with-double-slash:1'],
      'did not call stale the entry of a defect fixed since the baseline',
    )
  })
  it('dont call stale a check the run did not run', function() {
    const {sources} = run('recorded.xsl')
    assert.deepStrictEqual(
      matched([], sources, baseline(), BASE, ['short-names']).stale.map(
        (entry) => entry.name,
      ),
      ['short-names'],
      'called stale the entries of checks a narrowed run never ran',
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
      matched(reported, sources, {}, BASE, every()).fresh.length,
      reported.length,
      'suppressed a defect of a file the baseline holds no entry for',
    )
  })
  it('dont call stale a file the run did not read', function() {
    assert.deepStrictEqual(
      matched([], [], baseline(), BASE, every()).stale, [],
      'called stale the entries of a file outside the paths linted',
    )
  })
  it('keeps the entries of a file a rewrite did not read', function() {
    assert.deepStrictEqual(
      recorded([], [], BASE, every(), baseline()), baseline(),
      'dropped the entries of a file outside the paths a rewrite linted',
    )
  })
  it('keeps the entries of a check a rewrite did not run', function() {
    const {sources} = run('recorded.xsl')
    assert.deepStrictEqual(
      Object.keys(
        recorded([], sources, BASE, ['short-names'], baseline())['recorded.xsl'],
      ),
      [
        'setting-value-of-variable-incorrectly', 'starts-with-double-slash',
        'unused-named-template',
      ],
      'dropped the entries of checks a narrowed rewrite never ran',
    )
  })
})
