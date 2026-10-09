/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  recorded, matched, trimmed, counted, baselined, ledgerOf, lapsed,
} = require('../src/baseline')
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
 * Baseline fixtures that record one entry too many, and where the defect the
 * stale entry turns into stands in each: on the entry where the file spells
 * it as a write does, even under a second sheet or beside a nested one, and
 * at its head where the file or the check is spelled another way.
 * @type {Array.<{name: string, file: string, place: string}>}
 */
const LAPSES = [
  {name: 'on the line that records it', file: 'inflated.json', place: '4:5'},
  {name: 'at the head of a respaced sheet', file: 'spaced.json', place: '1:1'},
  {name: 'at the head of a respaced check', file: 'checked.json', place: '1:1'},
  {name: 'under its own sheet', file: 'paired.json', place: '6:5'},
  {name: 'under its sheet, not a nested one', file: 'nested.json', place: '6:5'},
  {name: 'at the head of a check respaced before a later sheet', file: 'bounded.json', place: '1:1'},
]

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

/**
 * The defects a run over the untouched sheet draws from the stale entries of
 * one baseline fixture.
 * @param {string} name - Baseline fixture under test/resources/baseline
 * @return {Array.<object>} - What the reporter is handed for them
 */
const lapses = function(name) {
  const {sources, reported} = run('recorded.xsl')
  const file = path.join(BASE, name)
  const content = fs.readFileSync(file, 'utf-8')
  return lapsed(
    matched(reported, sources, JSON.parse(content), BASE, every()).stale,
    file,
    content,
  )
}

describe('baseline', function() {
  it('suppresses every defect it recorded', function() {
    const {reported} = run('recorded.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh, [],
      'reported a defect the baseline recorded, so a gated tree cannot pass',
    )
  })
  it('keeps suppressing a defect whose line moved', function() {
    const {reported} = run('shifted.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh, [],
      'reported a recorded defect after lines above it were added',
    )
  })
  it('keeps suppressing a defect whose line was reindented', function() {
    const {reported} = linted(
      fs.readFileSync(path.join(BASE, 'recorded.xsl'), 'utf-8')
        .split('\n')
        .map((line) => line.replace(/^ +/, (lead) => '\t'.repeat(lead.length)))
        .join('\n'),
    )
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh, [],
      'reported a recorded defect after its line was indented with tabs',
    )
  })
  it('keeps suppressing a defect whose line was edited', function() {
    const {reported} = run('edited.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh, [],
      'reported a recorded defect after an attribute was added to its line',
    )
  })
  it('reports every defect of a check whose count rose', function() {
    const {reported} = run('grown.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh.map(
        (defect) => `${defect.name}:${defect.line}`,
      ),
      [
        'setting-value-of-variable-incorrectly:16',
        'short-names:16',
        'setting-value-of-variable-incorrectly:19',
        'short-names:19',
        'unused-variable:19',
      ],
      'did not report every defect of the checks a new variable drew again',
    )
  })
  it('reports both copies of a line recorded once', function() {
    const {reported} = run('doubled.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).fresh.map(
        (defect) => `${defect.name}:${defect.line}`,
      ),
      ['starts-with-double-slash:31', 'starts-with-double-slash:38'],
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
    const {reported} = run('recorded.xsl')
    assert.equal(
      baselined(reported, {counts: {}, base: BASE}).fresh.length,
      reported.length,
      'suppressed a defect of a file the baseline holds no entry for',
    )
  })
  it('dont call stale a file the baseline never recorded', function() {
    const {sources} = run('recorded.xsl')
    assert.deepStrictEqual(
      matched([], sources, {}, BASE, every()).stale, [],
      'called stale an entry of a file the baseline holds nothing for',
    )
  })
  it('hands back as known every defect it suppresses', function() {
    const {reported} = run('recorded.xsl')
    assert.deepStrictEqual(
      baselined(reported, {counts: baseline(), base: BASE}).known, reported,
      'did not hand back the defects it suppressed, so an editor cannot tell them apart',
    )
  })
  it('dont hand back as known a defect it reports as fresh', function() {
    const {reported} = run('grown.xsl')
    const split = baselined(reported, {counts: baseline(), base: BASE})
    assert.deepStrictEqual(
      split.known.filter((defect) => split.fresh.includes(defect)), [],
      'handed back a fresh defect among the known ones, so an editor shows it twice',
    )
  })
  it('reads a baseline file as its counts beside its directory', function() {
    assert.deepStrictEqual(
      ledgerOf(path.join(BASE, 'branched.json')),
      {counts: {'a.xsl': {'starts-with-double-slash': 1}}, base: BASE},
      'did not read the counts of a baseline file and the directory its paths resolve against',
    )
  })
  it('refuses to read a baseline file that holds line hashes', function() {
    assert.throws(
      () => ledgerOf(path.join(BASE, 'hashed.json')),
      /--baseline-write/,
      'read a baseline file of the old shape as if it held counts',
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
  it('drops the entry of a defect a prune no longer draws', function() {
    const {sources, reported} = run('repaired.xsl')
    assert.deepStrictEqual(
      Object.keys(
        trimmed(reported, sources, baseline(), BASE, every())['recorded.xsl'],
      ),
      [
        'setting-value-of-variable-incorrectly', 'short-names',
        'unused-named-template',
      ],
      'kept the entry of a defect fixed since the baseline was written',
    )
  })
  it('adds no defect a prune newly draws', function() {
    const {sources, reported} = run('grown.xsl')
    assert.deepStrictEqual(
      trimmed(reported, sources, baseline(), BASE, every()), baseline(),
      'recorded a defect added after the baseline while pruning it',
    )
  })
  it('keeps the entries of a file a prune did not read', function() {
    assert.deepStrictEqual(
      trimmed([], [], baseline(), BASE, every()), baseline(),
      'dropped the entries of a file outside the paths a prune linted',
    )
  })
  it('lowers a count a prune finds too high to what the run draws', function() {
    const {sources, reported} = run('recorded.xsl')
    const held = baseline()
    held['recorded.xsl']['short-names'] = 3
    assert.deepStrictEqual(
      trimmed(reported, sources, held, BASE, every()), baseline(),
      'did not lower a recorded count to the defects the run still draws',
    )
  })
  it('refuses a baseline that holds line hashes where counts stand', function() {
    assert.throws(
      () => counted({'recorded.xsl': {'short-names': {'4f1c0d2a9b7e3c55': 1}}}, 'old.json'),
      /--baseline-write/,
      'read a baseline of the old shape as if it held counts',
    )
  })
  it('keeps the entries of a check a prune did not run', function() {
    const {sources, reported} = run('repaired.xsl')
    assert.deepStrictEqual(
      trimmed(reported, sources, baseline(), BASE, ['short-names']), baseline(),
      'dropped the entries of checks a narrowed prune never ran',
    )
  })
  it('reports a stale entry as an error of the baseline file', function() {
    assert.deepStrictEqual(
      lapses('inflated.json').map(
        (defect) => `${path.basename(defect.file)}:${defect.severity}:${defect.name}`,
      ),
      ['inflated.json:error:short-names'],
      'did not hand the reporter the stale entry as an error of its file',
    )
  })
  it('states what a stale entry records and what the run draws', function() {
    assert.deepStrictEqual(
      lapses('inflated.json').map((defect) => defect.message),
      [
        [
          'Baseline entry recorded.xsl records 2 short-names defects,',
          'the run draws 1; drop the rest with --baseline-prune',
        ].join(' '),
      ],
      'did not tell the recorded count of a stale entry from what the run drew',
    )
  })
  LAPSES.forEach((row) => {
    it(`places a stale entry ${row.name}`, function() {
      assert.deepStrictEqual(
        lapses(row.file).map((defect) => `${defect.line}:${defect.pos}`),
        [row.place],
        'did not place the stale entry where the baseline file records it',
      )
    })
  })
})
