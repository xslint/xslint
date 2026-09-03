/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lined, verdict, SHOWN} = require('../scripts/snapshot')
const {yaml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The nightly workflow, read as data: it names the corpora, and a snapshot
 * stands or does not stand beside each of the names it gives.
 * @type {string}
 */
const WORKFLOW = path.resolve(
  __dirname, '..', '.github', 'workflows', 'corpora.yml',
)

/**
 * Every corpus the nightly tier lints, off that matrix.
 * @type {Array.<{name: string}>}
 */
const CORPORA = yaml.parsedFromFile(WORKFLOW).jobs.lint.strategy.matrix.include

/**
 * Where the committed snapshots stand, one per corpus, named for it.
 * @type {string}
 */
const SNAPSHOTS = path.resolve(__dirname, 'resources', 'corpora')

/**
 * What one defect of a JSON report becomes, one row per thing a line has to
 * carry: where it stands, what found it, and the fix it holds at whichever
 * tier. A replacement is written as a JSON string so that no text a corpus
 * carries can put a second line where one defect stands.
 * @type {Array.<{name: string, root: string, reported: object, said: string}>}
 */
const LINES = [
  {
    name: 'places a defect at the file, line and column it stands at',
    root: 'corpus',
    reported: {
      rule: 'short-names', file: 'corpus/xsl/html/chunk.xsl',
      line: 16, column: 3,
    },
    said: 'xsl/html/chunk.xsl:16:3 short-names',
  },
  {
    name: 'carries the replacement of a safe fix',
    root: 'corpus',
    reported: {
      rule: 'count-compared-to-zero', file: 'corpus/a.xsl', line: 9, column: 5,
      fix: {
        line: 9, col: 20, value: 'count(a) = 0', replacement: 'not(a)',
        suggestion: false,
      },
    },
    said: 'a.xsl:9:5 count-compared-to-zero fix "not(a)"',
  },
  {
    name: 'grades the replacement of a suggested fix as a suggestion',
    root: 'corpus',
    reported: {
      rule: 'starts-with-double-slash', file: 'corpus/a.xsl',
      line: 4, column: 7,
      fix: {
        line: 4, col: 18, value: '//para', replacement: 'para',
        suggestion: true,
      },
    },
    said: 'a.xsl:4:7 starts-with-double-slash suggestion "para"',
  },
  {
    name: 'keeps a replacement holding a line ending on the one line',
    root: 'corpus',
    reported: {
      rule: 'redundant-import', file: 'corpus/a.xsl', line: 2, column: 3,
      fix: {line: 2, col: 3, replacement: '\n'},
    },
    said: 'a.xsl:2:3 redundant-import fix "\\n"',
  },
  {
    name: 'names a file outside the working directory against the corpus root',
    root: path.join(path.sep, 'corpora', 'tei'),
    reported: {
      rule: 'short-names',
      file: path.join(path.sep, 'corpora', 'tei', 'xml', 'tei.xsl'),
      line: 1, column: 1,
    },
    said: 'xml/tei.xsl:1:1 short-names',
  },
]

/**
 * What a verdict has to say about a reading, one row per way a report can
 * differ from what a snapshot holds. The message is pinned rather than merely
 * its presence, a gate that fails having to say what changed and not only that
 * something did.
 * @type {Array.<{name: string, expected: Array.<string>,
 *  reading: Array.<string>, said: string}>}
 */
const CASES = [
  {
    name: 'says nothing about a run drawing exactly what the snapshot holds',
    expected: ['a.xsl:1:1 short-names', 'b.xsl:2:2 long-names'],
    reading: ['a.xsl:1:1 short-names', 'b.xsl:2:2 long-names'],
    said: '',
  },
  {
    name: 'reports a defect the run draws and the snapshot does not',
    expected: ['a.xsl:1:1 short-names'],
    reading: ['a.xsl:1:1 short-names', 'b.xsl:2:2 long-names'],
    said: 'linting docbook no longer draws what its snapshot holds, 2 ' +
      'defects against 1, so regenerate it once the change is meant: ' +
      '+b.xsl:2:2 long-names',
  },
  {
    name: 'reports a defect the snapshot holds and the run no longer draws',
    expected: ['a.xsl:1:1 short-names', 'b.xsl:2:2 long-names'],
    reading: ['a.xsl:1:1 short-names'],
    said: 'linting docbook no longer draws what its snapshot holds, 1 ' +
      'defect against 2, so regenerate it once the change is meant: ' +
      '-b.xsl:2:2 long-names',
  },
  {
    name: 'reports a fix whose replacement has changed under it',
    expected: ['a.xsl:1:1 count-compared-to-zero fix "not(a)"'],
    reading: ['a.xsl:1:1 count-compared-to-zero fix "empty(a)"'],
    said: 'linting docbook no longer draws what its snapshot holds, 1 ' +
      'defect against 1, so regenerate it once the change is meant: ' +
      '+a.xsl:1:1 count-compared-to-zero fix "empty(a)", ' +
      '-a.xsl:1:1 count-compared-to-zero fix "not(a)"',
  },
  {
    name: 'reports a difference standing in nothing but a repeated line',
    expected: ['a.xsl:1:1 short-names'],
    reading: ['a.xsl:1:1 short-names', 'a.xsl:1:1 short-names'],
    said: 'linting docbook no longer draws what its snapshot holds, 2 ' +
      'defects against 1, so regenerate it once the change is meant: ' +
      'nothing but how often a line repeats',
  },
]

describe('snapshot', function() {
  LINES.forEach((row) => {
    it(row.name, function() {
      assert.deepEqual(
        lined(row.root, [row.reported]),
        [row.said],
        'a snapshot line does not say where a defect stands, what found it, ' +
          'or what its fix would write',
      )
    })
  })
  CASES.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        verdict('docbook', row.expected, row.reading),
        row.said,
        'a snapshot verdict does not say what a corpus has stopped drawing, ' +
          'or says it of a run that drew exactly what was committed',
      )
    })
  })
  it('bounds what a verdict names and counts the rest', function() {
    assert.ok(
      verdict(
        'tei', [], Array.from(
          {length: SHOWN + 2}, (whole, at) => `a.xsl:${at}:1 short-names`,
        ),
      ).endsWith(`a.xsl:${SHOWN - 1}:1 short-names, and 2 more`),
      'a verdict names every difference it found, so a check whose scope ' +
        'widened writes an annotation nobody can read',
    )
  })
  CORPORA.forEach((one) => {
    it(`holds a committed snapshot of what ${one.name} draws`, function() {
      assert.ok(
        fs.existsSync(path.join(SNAPSHOTS, `${one.name}.txt`)),
        'a corpus the nightly tier lints has no committed snapshot, so ' +
          'nothing notices when a check changes what it reports over it',
      )
    })
  })
  it('gives every committed snapshot a corpus that draws it', function() {
    assert.deepEqual(
      fs.readdirSync(SNAPSHOTS).filter(
        (name) => !CORPORA.some((one) => `${one.name}.txt` === name),
      ),
      [],
      'a snapshot stands under test/resources/corpora that no corpus of the ' +
        'nightly tier is read against, so nothing regenerates it',
    )
  })
  it('diffs each corpus through the script the workflow calls', function() {
    assert.ok(
      fs.readFileSync(WORKFLOW, 'utf-8').includes('node scripts/snapshot.js'),
      'the nightly step judges what a corpus drew on its own rather than ' +
        'through scripts/snapshot.js, so the diff it holds is bypassed',
    )
  })
})
