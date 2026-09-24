/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lint, fixed} = require('../src/xslint')
const fs = require('fs')
const path = require('path')
const assert = require('assert')

/**
 * Content of a committed stylesheet, read as an in-memory source.
 * @param {string} name - Fixture path under test/resources
 * @return {{file: string, content: string}} - A source for the linter
 */
const source = function(name) {
  return {
    file: name,
    content: fs.readFileSync(path.resolve(__dirname, 'resources', name), 'utf-8'),
  }
}

/**
 * A nursery of one, standing for the marks the tree carries none of: what the
 * tier does with a member is asked of the gate rather than of whichever check
 * an open issue reports wrong today, so an empty nursery — the release bar,
 * and where #851 leaves this one — is a tier still held to what it promises
 * rather than a mechanism nothing exercises (#581, #851).
 * @type {Map.<string, string>}
 */
const NURSED = new Map([['short-names', '#911, a check reported wrong']])

/**
 * What a run writes to standard error, the logger having no sink to hand a
 * test: a warning is what the tier says of a check a glob graded, and the
 * whole of what says the grade vouched for nothing.
 * @param {function(): void} run - What to do while the stream is held
 * @return {Array.<string>} - The lines it wrote
 */
const noted = function(run) {
  const original = console.error
  const lines = []
  console.error = (...args) => lines.push(args.join(' '))
  try {
    run()
  } finally {
    console.error = original
  }
  return lines
}

/**
 * The two fixtures whose eighth line holds a pattern the grammar refuses: one
 * whose text no grammar reads at all, one that reads as a fine expression and
 * as no pattern. Neither draws a word about its `//` any more — the checks that
 * had one to say are staged over the expressions the validator kept, so the
 * refusal is the only defect the fault draws (#586, #750).
 * @type {Array.<string>}
 */
const UNREADABLE = [
  'refused/refused-by-a-declarative-fix.xsl',
  'refused/refused-pattern-that-parses-as-an-expression.xsl',
]

/**
 * Which of the validator's two refusals each line of one fixture draws. What
 * parts them is whether a version later than the one in force admits the
 * expression, so the fixture nests a `version` on three of its templates and
 * asks the question at 1.0, 2.0 and 3.0 at once — a fault every version
 * refuses being the text's own wherever it stands (#925).
 * @type {Array.<Array>}
 */
const REFUSALS = [
  [7, 'syntax-newer-than-xslt-version', 'a parenthesized pattern step at 2.0'],
  [10, 'syntax-newer-than-xslt-version', 'a self axis pattern at 2.0'],
  [14, 'syntax-newer-than-xslt-version', 'a cast under a 1.0 template'],
  [15, 'invalid-xpath-expression', 'a fault no version admits at 1.0'],
  [18, 'invalid-xpath-expression', 'a fault no version admits at 3.0'],
  [20, 'invalid-xpath-expression', 'a pattern axis no version admits'],
]

/**
 * What a run narrowed to some checks reports: the fixture, the substrings
 * `only` names, the ones `suppress` names, and the checks left in the report.
 * A suppression outranks a choice, so a check both name stays quiet, and a
 * chosen check whose name holds an unchosen one is reported still (#1030).
 * @type {Array.<Array>}
 */
const NARROWED = [
  [
    'stylesheets/xsl-with-some-violations.xsl', ['short-names'], [],
    ['short-names'], 'one check named whole',
  ],
  [
    'stylesheets/xsl-with-some-violations.xsl', ['short', 'unused'], [],
    ['short-names', 'unused-named-template'], 'two checks named by substring',
  ],
  [
    'stylesheets/xsl-with-some-violations.xsl', ['short', 'unused'],
    ['short-names'], ['unused-named-template'],
    'a chosen check the run also suppresses',
  ],
  [
    'stylesheets/xsl-with-some-violations.xsl', ['short-names'],
    ['short-names'], [], 'the one chosen check suppressed',
  ],
  [
    'stylesheets/xsl-with-some-violations.xsl', ['short-names'],
    ['unused'], ['short-names'], 'a suppression outside the choice',
  ],
  [
    'chosen/a-dead-function.xsl',
    ['unused-function-template-parameter'], [],
    ['unused-function-template-parameter'],
    'a chosen name holding an unchosen one',
  ],
  [
    'chosen/a-dead-function.xsl', ['unused-function'],
    ['template-parameter'], ['unused-function'],
    'a suppression parting two names one substring chose',
  ],
]

/**
 * The stylesheets holding a spaced run behind a reference to an entity of
 * forty characters, declared inline and behind a parameter entity, with the
 * line of the attribute carrying it. Walked forty characters through the raw
 * text, the run lands on the literal a line below, and its fix rewrote that.
 * @type {Array.<Array>}
 */
const BROUGHT = [
  ['fix/an-entity-before-a-spaced-run.xsl', new Map(), 12, 'an internal'],
  [
    'entities/an-entity-before-a-spaced-run.xsl',
    new Map([[
      'long.ent',
      fs.readFileSync(
        path.resolve(__dirname, 'resources', 'entities', 'long.ent'), 'utf-8'),
    ]]),
    13, 'an external parameter',
  ],
]

describe('lint (programmatic API)', function() {
  it('returns defects for in-memory sources', function() {
    const defects = lint([source('stylesheets/xsl-with-some-violations.xsl')])
    assert.ok(defects.some((defect) => defect.name === 'short-names'))
  })
  it('finds nothing wrong with a clean stylesheet', function() {
    assert.deepEqual(
      lint([source('stylesheets/xsl-with-no-violations.xsl')]),
      [],
    )
  })
  it('honors a suppression', function() {
    assert.ok(
      !lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {suppress: ['short-names']},
      ).some((defect) => defect.name === 'short-names'),
    )
  })
  NARROWED.forEach(([sheet, only, suppress, expected, what]) => {
    it(`reports only what is chosen for ${what}`, function() {
      assert.deepEqual(
        lint([source(sheet)], {only: only, suppress: suppress})
          .map((defect) => defect.name),
        expected,
        `cannot report anything but ${expected.join(', ') || 'nothing'} ` +
          `for ${what}, a narrowed run leaving out every check it names not`,
      )
    })
  })
  it('warns about a chosen substring naming no check', function() {
    assert.match(
      noted(() => lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {only: ['qwerty']},
      )).join(' '),
      /qwerty/,
      'cannot keep quiet about a choice naming no check, where a typo would ' +
        'otherwise narrow the run to nothing and read as a clean report',
    )
  })
  it('re-grades a severity through overrides', function() {
    assert.equal(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {overrides: {'short-names': 'error'}},
      ).find((defect) => defect.name === 'short-names').severity,
      'error',
    )
  })
  it('withholds every nursery check under the stable tier', function() {
    assert.ok(
      !lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {stable: true, nursery: NURSED},
      ).some((defect) => defect.name === 'short-names'),
      'cannot withhold a check the nursery marks, where the tier reports ' +
        'only what no open issue says is wrong about code a processor accepts',
    )
  })
  it('keeps every check where no stable tier is asked for', function() {
    assert.deepEqual(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {nursery: NURSED},
      ).map((defect) => defect.name),
      [
        'setting-value-of-variable-incorrectly',
        'short-names',
        'starts-with-double-slash',
        'unused-named-template',
      ],
    )
  })
  it('reports the same under the stable tier as the tree stands', function() {
    assert.deepEqual(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {stable: true},
      ).map((defect) => defect.name),
      [
        'setting-value-of-variable-incorrectly',
        'short-names',
        'starts-with-double-slash',
        'unused-named-template',
      ],
    )
  })
  it('reports every check of a stylesheet no nursery name holds', function() {
    assert.deepEqual(
      lint(
        [source('fix/variable-or-param-with-select-spelled-oddly.xsl')],
        {stable: true, nursery: NURSED},
      ).map((defect) => defect.name),
      [
        'not-using-output',
        'unused-function-template-parameter',
        'variable-or-param-with-select-and-content',
      ].concat(
        Array(5).fill([
          'unused-variable',
          'variable-or-param-with-select-and-content',
        ]).flat(),
      ),
    )
  })
  it('re-admits a nursery check a configuration grades by name', function() {
    assert.ok(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {stable: true, nursery: NURSED, overrides: {'short-names': 'error'}},
      ).some((defect) => defect.name === 'short-names'),
      'cannot re-admit a nursery check the configuration grades outright, ' +
        'where a grade written against the name is the user asking for it',
    )
  })
  it('withholds a nursery check the caller grades without naming', function() {
    assert.ok(
      !lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {
          stable: true, nursery: NURSED, admitted: [],
          overrides: {'short-names': 'error'},
        },
      ).some((defect) => defect.name === 'short-names'),
      'cannot withhold a nursery check a grade reached through a glob, ' +
        'where the pattern names no check and vouches for none',
    )
  })
  it('says which check a glob graded the tier withholds anyway', function() {
    assert.match(
      noted(() => lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {
          stable: true, nursery: NURSED, admitted: [],
          overrides: {'short-names': 'error'},
        },
      )).join(' '),
      /short-names.*#911/,
      'cannot name the check a glob graded and the tier withheld anyway, ' +
        'beside the issue its mark stands on, so a grade that vouched for ' +
        'nothing reads as a grade that took effect',
    )
  })
  it('leaves a directive over a withheld check called used', function() {
    assert.deepEqual(
      noted(() => lint(
        [source('directives/used.xsl')],
        {stable: true, nursery: NURSED},
      )).filter((line) => line.includes('Unused xslint-disable')),
      [],
      'cannot call a directive unused where the tier withheld the defect it ' +
        'covers, the author having written it against a check that fires',
    )
  })
  it('exposes the fix engine for callers to apply', function() {
    const sources = [source('stylesheets/xsl-with-no-violations.xsl')]
    assert.equal(fixed(sources, lint(sources)).contents.size, 0)
  })
  it('draws one defect on the refused axis and the refused comparison',
    function() {
      assert.deepEqual(
        lint([source('refused/refused-expressions.xsl')])
          .filter((defect) => [9, 10].includes(defect.line))
          .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
        [
          'invalid-xpath-expression at 9:34',
          'invalid-xpath-expression at 10:36',
        ],
      )
    })
  it('keeps the fix on the two valid axes beside the refused ones', function() {
    assert.deepEqual(
      lint([source('refused/refused-expressions.xsl')])
        .filter((defect) => [13, 14].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
  it('offers no declarative fix on a refused pattern or expression', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => [8, 9].includes(defect.line) && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  UNREADABLE.forEach((sheet) => {
    it(`says nothing but the refusal about the pattern of ${sheet}`, function() {
      assert.deepEqual(
        lint([source(sheet)])
          .filter((defect) => defect.line === 8)
          .map((defect) => defect.name),
        ['invalid-xpath-expression'],
      )
    })
  })
  REFUSALS.forEach(([line, check, what]) => {
    it(`names the refusal of ${what} for what it is`, function() {
      assert.deepEqual(
        lint([source('refused/newer-than-the-declared-version.xsl')])
          .filter((defect) => defect.line === line)
          .map((defect) => defect.name),
        [check],
        `cannot report ${what} as anything but ${check}, the version in ` +
          'force being what parts a stylesheet breaking a promise it made ' +
          'from one holding a fault no version of the language admits',
      )
    })
  })
  it('withholds the declarative fix beside a refused text value template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => defect.name === 'text-outside-xsl-text')
        .map((defect) => Boolean(defect.fix)),
      [false],
    )
  })
  it('keeps the code-based fix beside a refused text value template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => defect.line === 14 && defect.fix)
        .map((defect) => defect.name),
      ['starts-with-double-slash'],
    )
  })
  it('reports a malformed expression in every attribute that holds one', function() {
    assert.deepEqual(
      lint([source('refused/unvalidated-expression-attributes.xsl')])
        .filter((defect) => defect.name === 'invalid-xpath-expression')
        .map((defect) => `${defect.line}:${defect.pos}`),
      ['9:45', '11:43', '14:45'],
    )
  })
  it('suggests dropping a match, and safely fixes only a key on 2.0+', function() {
    assert.deepEqual(
      [
        'fix/starts-with-double-slash.xsl',
        'fix/starts-with-double-slash-outside-a-template.xsl',
      ].flatMap((sheet) => lint([source(sheet)])
        .filter((defect) => defect.name === 'starts-with-double-slash')
        .map((defect) => Boolean(defect.fix.suggestion))),
      [true, true, false, true, true, true, true, true],
    )
  })
  it('safely fixes every pattern but a match in an XSLT 1.0 sheet', function() {
    assert.deepEqual(
      lint([source('fix/starts-with-double-slash-in-xslt-1.xsl')])
        .filter((defect) => defect.name === 'starts-with-double-slash')
        .map((defect) => Boolean(defect.fix.suggestion)),
      [false, true, false, false],
    )
  })
  it('offers no fix on a pattern that is only a valid expression', function() {
    assert.deepEqual(
      lint([source('refused/refused-pattern-that-parses-as-an-expression.xsl')])
        .filter((defect) => defect.line === 8 && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  it('keeps the fix on the pattern beside one no XSLT grammar reads', function() {
    assert.deepEqual(
      lint([source('refused/refused-pattern-that-parses-as-an-expression.xsl')])
        .filter((defect) => defect.line === 11)
        .map((defect) => Boolean(defect.fix)),
      [true],
    )
  })
  it('groups the report by file rather than interleaving two of them',
    function() {
      const reported = lint([
        source('refused/refused-expressions.xsl'),
        source('fix/starts-with-double-slash.xsl'),
      ]).map((defect) => defect.file)
      assert.ok(
        reported.lastIndexOf('fix/starts-with-double-slash.xsl') <
          reported.indexOf('refused/refused-expressions.xsl'),
        'the defects of two files stand interleaved rather than grouped',
      )
    })
  it('orders the defects of one file by the line each stands on', function() {
    assert.deepEqual(
      lint([source('stylesheets/xsl-with-some-violations.xsl')])
        .map((defect) => defect.line),
      [16, 16, 31, 45],
    )
  })
  it('orders two defects on one line by the column each stands at', function() {
    assert.deepEqual(
      lint([source('fix/starts-with-double-slash-outside-a-template.xsl')])
        .filter((defect) => defect.line === 10)
        .map((defect) => defect.pos),
      [58, 88],
    )
  })
  it('orders two defects at one place by the check that found them', function() {
    assert.deepEqual(
      lint([source('fix/variable-or-param-with-select-spelled-oddly.xsl')])
        .filter((defect) => defect.line === 8)
        .map((defect) => defect.name),
      [
        'unused-function-template-parameter',
        'variable-or-param-with-select-and-content',
      ],
    )
  })
  it('keeps both fixes on the valid template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => [11, 12].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
  it('counts no column of the first line in a byte order mark', function() {
    assert.deepEqual(
      lint([source('fix/a-mark-no-column-counts-in.xsl')])
        .filter((defect) => defect.line === 1)
        .map((defect) => defect.fix.col),
      [103],
    )
  })
  it('reads an expression a parameter entity brings from beside it', function() {
    assert.deepEqual(
      lint([{
        ...source('entities/behind-a-parameter-entity.xsl'),
        subsets: new Map([[
          'shared.ent',
          fs.readFileSync(
            path.resolve(__dirname, 'resources', 'entities', 'shared.ent'),
            'utf-8',
          ),
        ]]),
      }])
        .filter((defect) => defect.name === 'scans-whole-document')
        .map((defect) => defect.line),
      [15],
      'cannot read the //alpha an external parameter entity declares, so ' +
        'the expression holding it reaches no check at all (#1010)',
    )
  })
  it('says which file holds the expressions it cannot read', function() {
    assert.match(
      noted(() => lint([source('entities/behind-a-parameter-entity.xsl')]))
        .join(' '),
      /1 expression.*entities\/behind-a-parameter-entity\.xsl/,
      'dropped an expression holding an entity nobody declared without a ' +
        'word at the default level, naming neither the count nor the file',
    )
  })
  BROUGHT.forEach(([sheet, subsets, line, kind]) => {
    it(`places a run behind ${kind} entity where the file spells it`, function() {
      assert.deepEqual(
        lint([{...source(sheet), subsets: subsets}])
          .filter((defect) => defect.name === 'redundant-whitespace')
          .map((defect) => [defect.line, defect.pos, defect.fix]),
        [[line, 33, undefined]],
        `walked a run behind ${kind} entity as far into the raw text as ` +
          'the replacement is wide, or anchored a fix on a value no line spells',
      )
    })
  })
  it('offers no fix on an element whose attribute an entity wrote', function() {
    assert.deepEqual(
      lint([source('entities/a-constant-behind-an-entity.xsl')])
        .filter((defect) => defect.name === 'incorrect-use-of-boolean-constants')
        .map((defect) => [defect.line, defect.fix]),
      [[12, undefined]],
      'offered a substitution of a test its file spells as a reference, ' +
        'anchored on text no line of the file holds',
    )
  })
})
