/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  lint, fixed, settingsOf, stylesheetsOf, sourceOf, baselined, ledgerOf,
  PRESETS,
} = require('../src/xslint')
const fs = require('fs')
const os = require('os')
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
 * What a run writes to standard error, the logger having no sink to hand a
 * test: a warning is the whole of what a run says of a directive it judged
 * unused, or of a choice naming no check.
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

/**
 * The runs that leave out the check a live directive covers, each over a
 * stylesheet whose directive a full run finds a defect under: the fixture,
 * the options narrowing the run, and what narrows it. A check the run never
 * ran draws no defect for the directive to cover, so its silence says
 * nothing about whether the directive is stale (#1049).
 * @type {Array.<Array>}
 */
const SKIPPED = [
  ['directives/used.xsl', {only: ['not-using-output']}, 'a choice'],
  ['directives/used.xsl', {suppress: ['short-names']}, 'a suppression'],
  ['directives/disable-file.xsl', {only: ['output']}, 'a file-wide choice'],
  ['directives/bare.xsl', {only: ['not-using-output']}, 'a bare choice'],
  ['directives/bare.xsl', {suppress: ['short-names']}, 'a bare suppression'],
]

/**
 * What a run over one stylesheet reports under each way of saying which
 * checks it runs: the options, the checks left in the report, and the way.
 * The preset is where a run starts, `recommended` when it names none; a
 * choice replaces it, a re-grade adds the check it names to it, and a
 * suppression outranks all three (#1094).
 * @type {Array.<Array>}
 */
const PRESETED = [
  [{}, ['unused-function'], 'no preset named'],
  [{preset: 'recommended'}, ['unused-function'], 'the recommended preset'],
  [
    {preset: 'all'}, ['unused-function', 'short-names', 'unused-variable'],
    'the whole catalog',
  ],
  [{only: ['short']}, ['short-names'], 'a choice outside the preset'],
  [
    {overrides: {'short-names': 'error'}}, ['unused-function', 'short-names'],
    'a re-grade outside the preset',
  ],
  [
    {overrides: {'unused-function': 'warning'}}, ['unused-function'],
    'a re-grade inside the preset',
  ],
  [
    {overrides: {'unused-variable': 'warning'}},
    ['unused-function', 'unused-variable'], 'a dead variable re-graded',
  ],
  [
    {overrides: {'short-names': 'error'}, suppress: ['short']},
    ['unused-function'], 'a re-graded check suppressed',
  ],
  [{suppress: ['unused']}, [], 'a suppression inside the preset'],
  [
    {preset: 'all', suppress: ['unused']}, ['short-names'],
    'a suppression over the whole catalog',
  ],
]

/**
 * What each import check reports over two stylesheets it alone fires on, named
 * with a leading `./`: a pure cycle for `circular-import`, a repeated import
 * with no cycle for `redundant-import`. Each row is the check, the sources it
 * lints, the files its defects name, and the fault. A defect names the file as
 * its caller spelled it, or `lint` finds no directives for it (#1115).
 * @type {Array.<Array>}
 */
const SPELLED = [
  [
    'circular-import',
    ['cycles/looping.xsl', 'cycles/looped.xsl'],
    ['./cycles/looped.xsl', './cycles/looping.xsl'],
    'a cycle',
  ],
  [
    'redundant-import',
    ['repeats/repeating.xsl', 'repeats/repeated.xsl'],
    ['./repeats/repeating.xsl'],
    'a repeated import',
  ],
]

/**
 * A project directory holding one committed configuration as its
 * `.xslint.yml`, written under a temporary directory of its own so that no
 * walk over the working tree meets it.
 * @param {string} name - Fixture path under test/resources
 * @return {string} - The directory the configuration stands in
 */
const configured = function(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-settings-'))
  fs.copyFileSync(
    path.resolve(__dirname, 'resources', name), path.join(dir, '.xslint.yml'),
  )
  return dir
}

/**
 * A project directory holding the one configuration named and a copy of a
 * committed stylesheet at every path given, for a walk to find.
 * @param {string} config - Configuration fixture path under test/resources
 * @param {Array.<string>} names - Paths under the directory to copy it to
 * @return {string} - Absolute path of the directory
 */
const planted = function(config, names) {
  const dir = configured(config)
  names.forEach((name) => {
    fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true})
    fs.copyFileSync(
      path.resolve(__dirname, 'resources', 'presets', 'a-short-name-beside-dead-code.xsl'),
      path.join(dir, name),
    )
  })
  return dir
}

/**
 * What a run over one stylesheet reports under the settings a configuration
 * and the flags beside it make: the configuration, the flags, each defect as
 * its check and severity, and the way. An exact name in `rules` adds its
 * check to the preset while a glob re-grades only what already runs, `off`
 * suppresses, and a flag outranks the file, as the command line does (#1128).
 * @type {Array.<Array>}
 */
const SETTLED = [
  [
    'presets/regraded.yml', {},
    ['unused-function warning', 'short-names error'], 'the file alone',
  ],
  [
    'presets/regraded.yml', {preset: 'all'},
    ['unused-function warning', 'short-names error', 'unused-variable error'],
    'a preset flag over the file',
  ],
  [
    'presets/regraded.yml', {only: ['unused']},
    ['unused-function warning', 'unused-variable error'],
    'a choice flag over the file',
  ],
  [
    'presets/regraded.yml', {suppress: ['short']},
    ['unused-function warning'], 'a suppression flag beside the file',
  ],
  [
    'presets/disabled.yml', {},
    ['unused-function warning', 'short-names warning'],
    'a check the file turns off under the preset it names',
  ],
]

describe('lint (programmatic API)', function() {
  PRESETED.forEach(([options, expected, what]) => {
    it(`reports what ${what} runs`, function() {
      assert.deepEqual(
        lint(
          [source('presets/a-short-name-beside-dead-code.xsl')], options,
        ).map((defect) => defect.name),
        expected,
        [
          `cannot report anything but ${expected.join(', ') || 'nothing'}`,
          `under ${what}, the preset being where a run starts and the other`,
          'options narrowing or widening it',
        ].join(' '),
      )
    })
  })
  SETTLED.forEach(([config, flags, expected, what]) => {
    it(`reports what the settings of ${what} run`, function() {
      assert.deepEqual(
        lint(
          [source('presets/a-short-name-beside-dead-code.xsl')],
          settingsOf(configured(config), flags),
        ).map((defect) => `${defect.name} ${defect.severity}`),
        expected,
        [
          `cannot report anything but ${expected.join(', ') || 'nothing'}`,
          `under ${what}, the settings being what the command line hands lint`,
        ].join(' '),
      )
    })
  })
  it('names the configuration file the settings were read from', function() {
    const dir = configured('presets/regraded.yml')
    assert.equal(
      settingsOf(dir).file, path.join(dir, '.xslint.yml'),
      'did not name the configuration file the settings came from',
    )
  })
  it('answers the directory the exclusions resolve against', function() {
    const dir = configured('presets/regraded.yml')
    fs.mkdirSync(path.join(dir, 'deep', 'er'), {recursive: true})
    assert.equal(
      settingsOf(path.join(dir, 'deep', 'er')).base, dir,
      'did not answer the directory of the configuration as the one its globs resolve against',
    )
  })
  it('excludes a file the configuration excludes', function() {
    const dir = configured('presets/regraded.yml')
    assert.ok(
      settingsOf(dir).excluded(path.join(dir, 'vendor', 'kept.xsl')),
      'did not exclude a stylesheet under a directory the exclusions name',
    )
  })
  it('keeps a file the configuration does not exclude', function() {
    const dir = configured('presets/regraded.yml')
    assert.ok(
      !settingsOf(dir).excluded(path.join(dir, 'own', 'kept.xsl')),
      'excluded a stylesheet under a directory no exclusion names',
    )
  })
  it('answers the baseline the configuration names, beside it', function() {
    const dir = configured('presets/baselined.yml')
    assert.equal(
      settingsOf(dir).baseline, path.join(dir, 'build', 'xslint-baseline.json'),
      'did not answer the baseline file the configuration names, resolved against its directory',
    )
  })
  it('answers the baseline a flag names over the configuration', function() {
    const dir = configured('presets/baselined.yml')
    assert.equal(
      settingsOf(dir, {baseline: path.join(dir, 'own.json')}).baseline,
      path.join(dir, 'own.json'),
      'did not let the baseline a caller names outrank the one the configuration names',
    )
  })
  it('resolves a relative baseline flag against the directory it starts in', function() {
    const dir = configured('presets/baselined.yml')
    assert.equal(
      settingsOf(dir, {baseline: 'own-7q.json'}).baseline,
      path.join(dir, 'own-7q.json'),
      'resolved a relative baseline flag against the process, where a relative config flag resolves against the directory',
    )
  })
  it('answers no baseline where none is named', function() {
    assert.equal(
      settingsOf(configured('presets/regraded.yml')).baseline, undefined,
      'answered a baseline although neither the configuration nor the caller names one',
    )
  })
  it('suppresses a defect the baseline of the settings records', function() {
    const dir = configured('presets/baselined.yml')
    fs.mkdirSync(path.join(dir, 'build'))
    fs.copyFileSync(
      path.resolve(__dirname, 'resources', 'baseline', 'branched.json'),
      path.join(dir, 'build', 'xslint-baseline.json'),
    )
    assert.deepEqual(
      baselined(
        [{file: path.join(dir, 'build', 'a.xsl'), name: 'starts-with-double-slash'}],
        ledgerOf(settingsOf(dir).baseline),
      ).fresh,
      [],
      'reported a defect the baseline of the configuration records, which the command line hides',
    )
  })
  it('answers the problems a troubled configuration holds', function() {
    assert.deepEqual(
      settingsOf(configured('presets/troubled.yml')).problems,
      [
        `Unknown key 'bogus' in .xslint.yml`,
        [
          `Invalid severity 'loud' for rule 'short-names' in .xslint.yml,`,
          'use one of off, warning, error',
        ].join(' '),
        `Value of 'exclude' in .xslint.yml must be a list of strings, ignoring it`,
        `Rule 'no-such-rule' in configuration does not exist`,
      ],
      'did not hand back every problem the configuration holds, in the order the command line prints them',
    )
  })
  it('writes nothing while reading a troubled configuration', function() {
    assert.deepEqual(
      noted(() => settingsOf(configured('presets/troubled.yml'))),
      [],
      'wrote a problem of the configuration where no caller can read it back',
    )
  })
  it('refuses a preset that does not exist', function() {
    assert.throws(
      () => lint(
        [source('presets/a-short-name-beside-dead-code.xsl')],
        {preset: 'fastidious'},
      ),
      /Preset 'fastidious' does not exist/,
      'ran over a preset naming no check list, which reads as a clean report',
    )
  })
  it('runs every check a linter module declares', function() {
    assert.deepEqual(
      fs.readdirSync(path.join(__dirname, '..', 'src', 'linters'))
        .filter((file) => file.endsWith('-linter.js'))
        .flatMap((file) => require(path.join('..', 'src', 'linters', file)).names)
        .filter((name) => !PRESETS.all.includes(name)),
      [],
      'a linter module declares a check that no run reaches',
    )
  })
  it('returns defects for in-memory sources', function() {
    const defects = lint([source('stylesheets/xsl-with-some-violations.xsl')], {preset: 'all'})
    assert.ok(defects.some((defect) => defect.name === 'short-names'))
  })
  it('finds nothing wrong with a clean stylesheet', function() {
    assert.deepEqual(
      lint([source('stylesheets/xsl-with-no-violations.xsl')], {preset: 'all'}),
      [],
    )
  })
  it('honors a suppression', function() {
    assert.ok(
      !lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {suppress: ['short-names'], preset: 'all'},
      ).some((defect) => defect.name === 'short-names'),
    )
  })
  NARROWED.forEach(([sheet, only, suppress, expected, what]) => {
    it(`reports only what is chosen for ${what}`, function() {
      assert.deepEqual(
        lint([source(sheet)], {only: only, suppress: suppress, preset: 'all'})
          .map((defect) => defect.name),
        expected,
        [
          `cannot report anything but ${expected.join(', ') || 'nothing'}`,
          `for ${what}, a narrowed run leaving out every check it names not`,
        ].join(' '),
      )
    })
  })
  it('refuses a chosen substring naming no check', function() {
    assert.throws(
      () => lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {only: ['short', 'qwerty'], preset: 'all'},
      ),
      /Chosen substring 'qwerty' names no check, fix or drop it$/,
      'ran over a choice naming no check, which reads as a clean report',
    )
  })
  it('refuses an empty chosen substring, which a stray comma leaves', function() {
    assert.throws(
      () => lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {only: ['short-names', ''], preset: 'all'},
      ),
      /Chosen substring '' names no check, fix or drop it$/,
      'ran over an empty choice, which widens the run to the whole catalog',
    )
  })
  it('refuses a configured choice naming no check before it lints', function() {
    assert.throws(
      () => settingsOf(configured('presets/mischosen.yml')),
      /Chosen substring 'qwerty' names no check, fix or drop it$/,
      'settled on a configured choice naming no check, which lint then refuses',
    )
  })
  it('refuses a suppressed substring naming no check', function() {
    assert.throws(
      () => lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {suppress: ['short', 'qwerty'], preset: 'all'},
      ),
      /Suppressed substring 'qwerty' names no check, fix or drop it$/,
      'ran over a suppression naming no check, which reads as a clean report',
    )
  })
  it('re-grades a severity through overrides', function() {
    assert.equal(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {overrides: {'short-names': 'error'}, preset: 'all'},
      ).find((defect) => defect.name === 'short-names').severity,
      'error',
    )
  })
  SKIPPED.forEach(([sheet, options, what]) => {
    it(`leaves a directive called used under ${what}`, function() {
      assert.deepEqual(
        noted(() => lint([source(sheet)], {...options, preset: 'all'}))
          .filter((line) => line.includes('Unused xslint-disable')),
        [],
        [
          `cannot call a directive unused under ${what}, the run having`,
          'never looked for the defect it covers',
        ].join(' '),
      )
    })
  })
  it('calls a directive unused where the run ran what it names', function() {
    assert.match(
      noted(() => lint(
        [source('directives/unused.xsl')], {only: ['short-names'], preset: 'all'},
      )).join(' '),
      /Unused xslint-disable directive at directives\/unused\.xsl:8/,
      [
        'cannot keep quiet about a stale directive under a narrowed run',
        'that ran the one check it names',
      ].join(' '),
    )
  })
  it('exposes the fix engine for callers to apply', function() {
    const sources = [source('stylesheets/xsl-with-no-violations.xsl')]
    assert.equal(fixed(sources, lint(sources, {preset: 'all'})).contents.size, 0)
  })
  it('draws one defect on the refused axis and the refused comparison',
    function() {
      assert.deepEqual(
        lint([source('refused/refused-expressions.xsl')], {preset: 'all'})
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
      lint([source('refused/refused-expressions.xsl')], {preset: 'all'})
        .filter((defect) => [13, 14].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
  it('offers no declarative fix on a refused pattern or expression', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')], {preset: 'all'})
        .filter((defect) => [8, 9].includes(defect.line) && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  UNREADABLE.forEach((sheet) => {
    it(`says nothing but the refusal about the pattern of ${sheet}`, function() {
      assert.deepEqual(
        lint([source(sheet)], {preset: 'all'})
          .filter((defect) => defect.line === 8)
          .map((defect) => defect.name),
        ['invalid-xpath-expression'],
      )
    })
  })
  REFUSALS.forEach(([line, check, what]) => {
    it(`names the refusal of ${what} for what it is`, function() {
      assert.deepEqual(
        lint([source('refused/newer-than-the-declared-version.xsl')], {preset: 'all'})
          .filter((defect) => defect.line === line)
          .map((defect) => defect.name),
        [check],
        [
          `cannot report ${what} as anything but ${check}, the version in`,
          'force being what parts a stylesheet breaking a promise it made',
          'from one holding a fault no version of the language admits',
        ].join(' '),
      )
    })
  })
  it('withholds the declarative fix beside a refused text value template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')], {preset: 'all'})
        .filter((defect) => defect.name === 'text-outside-xsl-text')
        .map((defect) => Boolean(defect.fix)),
      [false],
    )
  })
  it('keeps the code-based fix beside a refused text value template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')], {preset: 'all'})
        .filter((defect) => defect.line === 14 && defect.fix)
        .map((defect) => defect.name),
      ['starts-with-double-slash'],
    )
  })
  it('reports a malformed expression in every attribute that holds one', function() {
    assert.deepEqual(
      lint([source('refused/unvalidated-expression-attributes.xsl')], {preset: 'all'})
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
      ].flatMap((sheet) => lint([source(sheet)], {preset: 'all'})
        .filter((defect) => defect.name === 'starts-with-double-slash')
        .map((defect) => Boolean(defect.fix.suggestion))),
      [true, true, false, true, true, true, true, true],
    )
  })
  it('safely fixes every pattern but a match in an XSLT 1.0 sheet', function() {
    assert.deepEqual(
      lint([source('fix/starts-with-double-slash-in-xslt-1.xsl')], {preset: 'all'})
        .filter((defect) => defect.name === 'starts-with-double-slash')
        .map((defect) => Boolean(defect.fix.suggestion)),
      [false, true, false, false],
    )
  })
  it('offers no fix on a pattern that is only a valid expression', function() {
    assert.deepEqual(
      lint([source('refused/refused-pattern-that-parses-as-an-expression.xsl')], {preset: 'all'})
        .filter((defect) => defect.line === 8 && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  it('keeps the fix on the pattern beside one no XSLT grammar reads', function() {
    assert.deepEqual(
      lint([source('refused/refused-pattern-that-parses-as-an-expression.xsl')], {preset: 'all'})
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
      ], {preset: 'all'}).map((defect) => defect.file)
      assert.ok(
        reported.lastIndexOf('fix/starts-with-double-slash.xsl') <
          reported.indexOf('refused/refused-expressions.xsl'),
        'the defects of two files stand interleaved rather than grouped',
      )
    })
  it('orders the defects of one file by the line each stands on', function() {
    assert.deepEqual(
      lint([source('stylesheets/xsl-with-some-violations.xsl')], {preset: 'all'})
        .map((defect) => defect.line),
      [16, 16, 31, 45],
    )
  })
  it('orders two defects on one line by the column each stands at', function() {
    assert.deepEqual(
      lint([source('fix/starts-with-double-slash-outside-a-template.xsl')], {preset: 'all'})
        .filter((defect) => defect.line === 10)
        .map((defect) => defect.pos),
      [58, 88],
    )
  })
  it('orders two defects at one place by the check that found them', function() {
    assert.deepEqual(
      lint([source('fix/variable-or-param-with-select-spelled-oddly.xsl')], {preset: 'all'})
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
      lint([source('refused/refused-by-a-declarative-fix.xsl')], {preset: 'all'})
        .filter((defect) => [11, 12].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
  it('counts no column of the first line in a byte order mark', function() {
    assert.deepEqual(
      lint([source('fix/a-mark-no-column-counts-in.xsl')], {preset: 'all'})
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
      }], {preset: 'all'})
        .filter((defect) => defect.name === 'scans-whole-document')
        .map((defect) => defect.line),
      [15],
      [
        'cannot read the //alpha an external parameter entity declares, so',
        'the expression holding it reaches no check at all (#1010)',
      ].join(' '),
    )
  })
  it('says which file holds the expressions it cannot read', function() {
    assert.match(
      noted(() => lint([source('entities/behind-a-parameter-entity.xsl')], {preset: 'all'}))
        .join(' '),
      /1 expression.*entities\/behind-a-parameter-entity\.xsl/,
      [
        'dropped an expression holding an entity nobody declared without a',
        'word at the default level, naming neither the count nor the file',
      ].join(' '),
    )
  })
  BROUGHT.forEach(([sheet, subsets, line, kind]) => {
    it(`places a run behind ${kind} entity where the file spells it`, function() {
      assert.deepEqual(
        lint([{...source(sheet), subsets: subsets}], {preset: 'all'})
          .filter((defect) => defect.name === 'redundant-whitespace')
          .map((defect) => [defect.line, defect.pos, defect.fix]),
        [[line, 33, undefined]],
        [
          `walked a run behind ${kind} entity as far into the raw text as`,
          'the replacement is wide, or anchored a fix on a value no line spells',
        ].join(' '),
      )
    })
  })
  it('offers no fix on an element whose attribute an entity wrote', function() {
    assert.deepEqual(
      lint([source('entities/a-constant-behind-an-entity.xsl')], {preset: 'all'})
        .filter((defect) => defect.name === 'incorrect-use-of-boolean-constants')
        .map((defect) => [defect.line, defect.fix]),
      [[12, undefined]],
      [
        'offered a substitution of a test its file spells as a reference,',
        'anchored on text no line of the file holds',
      ].join(' '),
    )
  })
  it('reports an import naming no file where its caller read the disk',
    function() {
      assert.deepEqual(
        lint([{
          ...source('hrefs/importing.xsl'),
          absent: new Set(['modules/vanished-7q.xsl', 'lost-w4.xsl']),
        }])
          .filter((defect) => defect.name === 'broken-href')
          .map((defect) => defect.line),
        [8, 15],
        [
          'cannot report the xsl:import and the xsl:include whose href the',
          'caller found no file behind (#209)',
        ].join(' '),
      )
    })
  it('reports an import naming no file on the path its caller spelled',
    function() {
      assert.deepEqual(
        lint([{
          ...source('hrefs/importing.xsl'),
          file: 'hrefs/./importing.xsl',
          absent: new Set(['lost-w4.xsl']),
        }])
          .filter((defect) => defect.name === 'broken-href')
          .map((defect) => defect.file),
        ['hrefs/./importing.xsl'],
        [
          'cannot report a missing module on the file as its caller spelled',
          'it, a normalized path matching no source it was handed (#209)',
        ].join(' '),
      )
    })
  SPELLED.forEach(([check, names, files, fault]) => {
    it(`reports ${fault} on the path its caller spelled`, function() {
      assert.deepEqual(
        lint(
          names.map((name) => ({...source(name), file: `./${name}`})),
          {preset: 'all'},
        )
          .filter((defect) => defect.name === check)
          .map((defect) => defect.file)
          .sort(),
        files,
        [
          `cannot report ${fault} on the file as its caller spelled it, a`,
          'normalized path matching no source it was handed (#1115)',
        ].join(' '),
      )
    })
  })
  it('stays quiet about an href where nobody read the disk',
    function() {
      assert.deepEqual(
        lint([source('hrefs/importing.xsl')])
          .filter((defect) => defect.name === 'broken-href'),
        [],
        [
          'reported an href as naming no file though nothing handed the run',
          'an answer about the disk, which lint never reads itself',
        ].join(' '),
      )
    })
})

describe('stylesheetsOf and sourceOf (programmatic API)', function() {
  it('finds a stylesheet spelled with either suffix', function() {
    const dir = planted('presets/regraded.yml', ['one.xsl', 'two.xslt', 'three.xml'])
    assert.deepEqual(
      stylesheetsOf([dir], settingsOf(dir)).stylesheets.sort(),
      [path.join(dir, 'one.xsl'), path.join(dir, 'two.xslt')],
      'did not find the stylesheets the command line reads, by both suffixes a stylesheet wears',
    )
  })
  it('leaves out a directory the project ignores', function() {
    const dir = planted('presets/regraded.yml', ['shut/buried.xsl', 'own/kept.xsl'])
    fs.writeFileSync(path.join(dir, '.gitignore'), 'shut/\n')
    assert.deepEqual(
      stylesheetsOf([dir], settingsOf(dir)).stylesheets,
      [path.join(dir, 'own', 'kept.xsl')],
      'found a stylesheet under a directory the project .gitignore names',
    )
  })
  it('leaves out a directory the configuration excludes', function() {
    const dir = planted('presets/regraded.yml', ['vendor/kept.xsl', 'own/kept.xsl'])
    assert.deepEqual(
      stylesheetsOf([dir], settingsOf(dir)).stylesheets,
      [path.join(dir, 'own', 'kept.xsl')],
      'found a stylesheet under a directory the exclusions of the configuration name',
    )
  })
  it('answers the problems of the paths it was handed', function() {
    const dir = planted('presets/regraded.yml', ['own/kept.xsl', 'notes.txt'])
    assert.deepEqual(
      stylesheetsOf(
        [path.join(dir, 'gone-8k'), path.join(dir, 'notes.txt'), dir],
        settingsOf(dir),
      ).problems,
      [
        `File or directory ${path.join(dir, 'gone-8k')} does not exist`,
        `File ${path.join(dir, 'notes.txt')} was not read, a stylesheet being named .xsl or .xslt`,
        `Exclusion 'vendor/**' in configuration excluded nothing`,
      ],
      'did not hand back every warning of the discovery, in the order the command line prints them',
    )
  })
  it('writes nothing while finding stylesheets', function() {
    const dir = planted('presets/regraded.yml', ['own/kept.xsl'])
    assert.deepEqual(
      noted(() => stylesheetsOf([path.join(dir, 'gone-3v'), dir], settingsOf(dir))),
      [],
      'wrote a warning of the discovery where no caller can read it back',
    )
  })
  it('names the hrefs no file stands behind beside the content given', function() {
    assert.deepEqual(
      [
        ...sourceOf(
          path.resolve(__dirname, 'resources', 'hrefs', 'unsaved.xsl'),
          source('hrefs/importing.xsl').content,
        ).absent,
      ].sort(),
      ['lost-w4.xsl', 'modules', 'modules/vanished-7q.xsl'],
      'did not name the hrefs the content writes that nothing beside the file stands behind',
    )
  })
  it('reads the parameter entities the content given declares', function() {
    assert.deepEqual(
      [
        ...sourceOf(
          path.resolve(__dirname, 'resources', 'entities', 'unsaved.xsl'),
          source('entities/behind-a-parameter-entity.xsl').content,
        ).subsets.keys(),
      ],
      ['shared.ent'],
      'did not read the parameter entity file the content names beside the file',
    )
  })
})
