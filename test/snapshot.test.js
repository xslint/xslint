/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lined, verdict, SHOWN} = require('../scripts/snapshot')
const {kinds} = require('../src/resources/checks.json')
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
    name: 'reports a run repeating a line its snapshot holds once',
    expected: ['a.xsl:1:1 short-names'],
    reading: ['a.xsl:1:1 short-names', 'a.xsl:1:1 short-names'],
    said: 'linting docbook no longer draws what its snapshot holds, 2 ' +
      'defects against 1, so regenerate it once the change is meant: ' +
      'nothing but the order the lines stand in, or how often one repeats',
  },
  {
    name: 'reports a run drawing the same lines in another order',
    expected: ['a.xsl:1:1 short-names', 'b.xsl:2:2 long-names'],
    reading: ['b.xsl:2:2 long-names', 'a.xsl:1:1 short-names'],
    said: 'linting docbook no longer draws what its snapshot holds, 2 ' +
      'defects against 2, so regenerate it once the change is meant: ' +
      'nothing but the order the lines stand in, or how often one repeats',
  },
]

/**
 * How every check is graded, as a run reads it: the severity `checks.json`
 * holds against the name, whichever of the four kinds carries the entry.
 * @type {Map.<string, string>}
 */
const GRADED = new Map(
  Object.values(kinds).flatMap(
    (checks) => Object.entries(checks).map(
      ([name, one]) => [name, one.severity],
    ),
  ),
)

/**
 * The checks the corpora draw at `error`, each beside the fault that leaves
 * the module unloadable: an error stops a build, so one fires over
 * DocBook-XSL, TEI or DITA-OT only where a processor refuses the file as well
 * (#499, #876).
 * @type {{[key: string]: string}}
 */
const REFUSED = {
  'malformed-stylesheet':
    'not well-formed XML, so no parser reaches a tree through it',
  'mode-or-priority-without-match':
    'XTSE0500, a mode or a priority on a template with nothing to match',
  'duplicate-param-name':
    'XTSE0580, two parameters of one template sharing a name',
  'function-use-in-xslt-1':
    'an xsl:function in a sheet whose declared version has none, which a ' +
      'conformant processor of that version rejects',
  'modern-construct-in-xslt-1':
    'a 2.0 instruction in a sheet declared 1.0, where forwards-compatible ' +
      'processing is off and the same refusal follows',
}

/**
 * The checks one snapshot draws at anything but `warning`, each once. A name
 * the grading does not know counts as one of them rather than being dropped,
 * so a line this parse misreads fails the gate instead of leaving a hole in
 * it.
 * @param {string} corpus - Name of the corpus, as the matrix spells it
 * @return {Array.<string>} - The names it draws
 */
const erring = function(corpus) {
  return Array.from(
    new Set(
      fs.readFileSync(path.join(SNAPSHOTS, `${corpus}.txt`), 'utf-8')
        .split('\n').filter((line) => line.length > 0)
        .map((line) => line.split(' ')[1])
        .filter((name) => GRADED.get(name) !== 'warning'),
    ),
  )
}

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
  it('grades an error only where a processor refuses the file too', function() {
    assert.deepEqual(
      Array.from(
        new Set(CORPORA.flatMap((one) => erring(one.name))),
      ).sort(),
      Object.keys(REFUSED).sort(),
      'the error-graded checks the corpora draw are not the ones REFUSED ' +
        'names, so either a build stops over a stylesheet no processor ' +
        'faults or an entry has outlived what justified it',
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
