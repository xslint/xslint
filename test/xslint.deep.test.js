/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  runXslint, xslintStatus, xslintStreams, xslintUnread, repository,
} = require('./helpers')
const {SUFFIXES, excluded, pruned} = require('../src/xslint')
const assert = require('assert')
const version = require('../src/version')
const path = require('path')
const fs = require('fs')
const os = require('os')

/**
 * The two sizes of report a piped run is asked for. Twenty copies of the
 * scaling sheet stand past what a pipe takes, so the run is left writing into
 * a full one, which is #767's shape; two fit wherever they are read, so the
 * run is over before the reader looks and node's own flush throws the report
 * away (#822). How wide a pipe the host gives decides which a run meets.
 * @type {Array.<{name: string, piped: number}>}
 */
const PIPES = [
  {
    name: 'should write a report wider than the pipe nobody reads',
    piped: 20,
  },
  {
    name: 'should write a report narrower than the pipe nobody reads',
    piped: 2,
  },
]

/**
 * The check a defect line ends with, in the parentheses the text reporter puts
 * it in.
 * @type {RegExp}
 */
const NAMED = /\(([a-z0-9-]+)\)\r?$/

/**
 * The names a stylesheet is read under, spelled here rather than taken from
 * the code: a table derived from `SUFFIXES` loses a row when the list loses a
 * suffix, so the one mutation these rows exist to catch left them green by
 * taking one of them away. The gate below holds the two together.
 * @type {Array.<string>}
 */
const SPELLINGS = ['.xsl', '.xslt']

/**
 * The stylesheet both spellings of a name are given, and the checks it draws.
 * A suffix discovery does not know reads as a clean file rather than as one
 * nothing looked at, so these same bytes drew four defects under one name and
 * none at all under the other (#924).
 * @type {{file: string, drawn: Array.<string>}}
 */
const SPELLED = {
  file: 'test/resources/stylesheets/xsl-with-some-violations.xsl',
  drawn: [
    'setting-value-of-variable-incorrectly',
    'short-names',
    'starts-with-double-slash',
    'unused-named-template',
  ],
}

/**
 * The checks a report names, one per defect it printed, in the order it
 * printed them.
 * @param {string} printed - What a run printed
 * @return {Array.<string>} - The check names
 */
const drawn = function(printed) {
  return printed.split('\n')
    .map((line) => NAMED.exec(line))
    .filter((found) => found !== null)
    .map((found) => found[1])
}

/**
 * What a pattern covers, and so what the walk may leave unopened. One reaching
 * every file under a directory is safe to skip; one naming the directory alone
 * excludes a path no walk hands back, and a negated one excludes what stands
 * anywhere else, so skipping on either drops the stylesheets under it from a
 * report that keeps them (#923).
 * @type {Array.<{pattern: string, dir: string, prunes: boolean}>}
 */
const PRUNING = [
  {pattern: 'shut/**', dir: 'shut', prunes: true},
  {pattern: '**/shut/**', dir: 'shut', prunes: true},
  {pattern: '**/shut/**', dir: 'over/shut', prunes: true},
  {pattern: '**/shut/**', dir: '.hidden/shut', prunes: true},
  {pattern: '{shut,barred}/**', dir: 'barred', prunes: true},
  {pattern: 'shut/**', dir: 'open', prunes: false},
  {pattern: '**/shut', dir: 'shut', prunes: false},
  {pattern: 'shut', dir: 'shut', prunes: false},
  {pattern: 'shut/**/*.xsl', dir: 'shut', prunes: false},
  {pattern: '!shut/**', dir: 'shut/deeper', prunes: false},
  {pattern: '!shut/**', dir: 'open', prunes: false},
]

/**
 * Where a stylesheet may stand inside a directory the walk is about to skip.
 * Every one has to be excluded already for skipping to be sound, a prune
 * being an optimisation over what the report holds and never a second opinion
 * about it. One opens with a dot, which a wildcard passes over unless told
 * not to.
 * @type {Array.<string>}
 */
const COVERED = [
  'sheet.xsl', 'under/sheet.xsl', 'under/deeper/sheet.xsl',
  '.hidden/sheet.xsl',
]

/**
 * A stylesheet nothing about its content matters in, for a run whose subject
 * is which files were read.
 * @type {string}
 */
const CLEAN = 'test/resources/excluded/sheet.xsl'

describe('xslint', function() {
  it('should print its own version', function() {
    const stdout = runXslint(['--version'])
    assert.equal(version.what + '\n', stdout)
  })
  it('should print help screen', function() {
    const stdout = runXslint(['--help'])
    assert.ok(stdout.includes('Usage: xslint'))
    assert.ok(stdout.includes(version.what))
    assert.ok(stdout.includes(version.when))
  })
  it('should set log level', function() {
    const stdout = runXslint(['src', '--log-level=debug'])
    assert.ok(stdout.includes('Log level set to \'debug\''))
  })
  it('should print some violations in xsl file', function() {
    const stdout = runXslint(['test/resources/stylesheets/xsl-with-some-violations.xsl'])
    const expected = [
      'Processed files: 1',
      '(16:3) A variable is assigned via a nested xsl:value-of instead of the select attribute. Use select syntax instead. (setting-value-of-variable-incorrectly)',
      '(16:3) A variable, function, or template has a single-character name. Use a descriptive name that reveals intent. (short-names)',
      '(31:24) A pattern alternative starts with //, which is redundant since every XSLT pattern already matches at any depth, and it lowers the rule\'s default priority from 0.5 to that of the step alone. Remove the leading // and give the rule an explicit priority if it must keep ranking as it does. (starts-with-double-slash)',
      '(45:3) A named template is never invoked via xsl:call-template. Remove it or call it. (unused-named-template)',
    ]
    expected.forEach((str) => assert.ok(stdout.includes(str)))
  })
  it('should print less violations in xsl file', function() {
    const stdout = runXslint([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--suppress=empty-content-in-instructions',
      '--suppress=starts-with-double-slash',
    ])
    assert.ok(stdout.includes('Processed files: 1'))
    const absented = [
      'empty-content-in-instructions',
      'starts-with-double-slash',
    ]
    absented.forEach((str) => assert.ok(!stdout.includes(str)))
  })
  it('should print no violations in xsl file', function() {
    const stdout = runXslint(['test/resources/stylesheets/xsl-with-no-violations.xsl']);
    ['Processed files: 1', 'No defects found'].forEach((expected) => assert.ok(stdout.includes(expected)))
  })
  it('should test all files', function() {
    const stdout = runXslint([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      'test/resources/stylesheets/xsl-with-no-violations.xsl',
    ])
    const expected = [
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      'test/resources/stylesheets/xsl-with-no-violations.xsl',
    ]
    expected.forEach((str) => assert.ok(stdout.includes(str.split(path.sep).join('/'))))
    assert.ok(stdout.includes('Processed files: 2'))
  })
  it('should test all directories', function() {
    const stdout = runXslint([
      'test/resources/stylesheets',
      'test/resources/templates',
    ])
    const expected = [
      'test/resources/stylesheets',
      'test/resources/templates',
    ]
    expected.forEach((str) => assert.ok(stdout.includes(`${path.resolve(process.cwd(), str)}`)))
    assert.ok(stdout.includes('Processed files: 4'))
  })
  it('should test all files and directories', function() {
    const stdout = runXslint([
      'test/resources/stylesheets',
      'test/resources/templates/xsl-with-no-violations.xsl',
      'test/resources/reports',
      'test/resources/templates/xsl-with-some-violations.xsl',
    ])
    const expected = [
      'test/resources/stylesheets',
      'test/resources/templates/xsl-with-some-violations.xsl',
      'test/resources/reports',
      'test/resources/templates/xsl-with-no-violations.xsl',
    ]
    expected.forEach((str) => assert.ok(stdout.includes(`${str.replace(/\\/g, '/')}`)))
    assert.ok(stdout.includes('Processed files: 6'))
  })
  it('should test default directory', function() {
    const stdout = runXslint([])
    assert.ok(stdout.includes('Directories and files to process: .'))
    assert.ok(/Processed files: [1-9]\d*/.test(stdout))
  })
  it('should test empty suppress', function() {
    const stdout = runXslint([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--suppress=',
    ])
    const expected = [
      'Processed files: 1',
      '(16:3) A variable is assigned via a nested xsl:value-of instead of the select attribute. Use select syntax instead. (setting-value-of-variable-incorrectly)',
      '(16:3) A variable, function, or template has a single-character name. Use a descriptive name that reveals intent. (short-names)',
      '(31:24) A pattern alternative starts with //, which is redundant since every XSLT pattern already matches at any depth, and it lowers the rule\'s default priority from 0.5 to that of the step alone. Remove the leading // and give the rule an explicit priority if it must keep ranking as it does. (starts-with-double-slash)',
      '(45:3) A named template is never invoked via xsl:call-template. Remove it or call it. (unused-named-template)',
    ]
    assert.ok(stdout.includes('Empty suppress is incorrect. Delete this "--suppress" or use another one.'))
    expected.forEach((str) => assert.ok(stdout.includes(str)))
  })
  it('should test incorrect suppress', function() {
    const suppress = 'qwerty'
    const stdout = runXslint([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--suppress=${suppress}`,
    ])
    assert.ok(stdout.includes(`Check with substring '${suppress}' does not exist. Delete this '--suppress' or use another one.`))
  })
  it('should silence the bad-suppress warning under a raised log level', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--suppress=qwerty',
      '--log-level=error',
    ])
    assert.ok(!streams.stderr.includes('does not exist'))
  })
  it('should test non-existing directory', function() {
    const dir = 'non-existing-directory'
    const stdout = runXslint([dir])
    assert.ok(stdout.includes(`File or directory ${path.resolve(process.cwd(), dir)} does not exist`))
  })
  it('should test non-existing file', function() {
    const file = 'non-existing-file.xsl'
    const stdout = runXslint([file])
    assert.ok(stdout.includes(`File or directory ${path.resolve(process.cwd(), file)} does not exist`))
  })
  it('should test non-existing file and directory', function() {
    const file = 'non-existing-file.xsl'
    const dir = 'non-existing-directory'
    const stdout = runXslint([file, dir])
    assert.ok(stdout.includes(`File or directory ${path.resolve(process.cwd(), file)} does not exist`))
    assert.ok(stdout.includes(`File or directory ${path.resolve(process.cwd(), dir)} does not exist`))
  })
  SPELLINGS.forEach((suffix) => {
    it(`should read a stylesheet named ${suffix}`, function() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
      const file = path.join(dir, `named${suffix}`)
      fs.copyFileSync(SPELLED.file, file)
      const printed = runXslint([file])
      fs.rmSync(dir, {recursive: true, force: true})
      assert.deepEqual(
        drawn(printed),
        SPELLED.drawn,
        `xslint drew nothing over a stylesheet named ${suffix}, so the same ` +
          'bytes read as four defects under one name and as a clean file ' +
          'under the other (#924)',
      )
    })
  })
  it('should read every suffix the discovery admits', function() {
    assert.deepEqual(
      SUFFIXES,
      SPELLINGS,
      'discovery reads a suffix no row above names, or has stopped reading ' +
        'one they do, so the rows asserting a stylesheet is found under its ' +
        'own name are judging a list the code no longer holds (#924)',
    )
  })
  it('should warn about a named file no suffix admits', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const file = path.join(dir, 'named.txt')
    fs.copyFileSync(SPELLED.file, file)
    const printed = runXslint([file])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(
      printed.includes(`File ${file} was not read`),
      'a stylesheet named on the command line under a suffix nothing reads ' +
        'is skipped without a word, so the run says "No defects found" and ' +
        'leaves with a zero (#924)',
    )
  })
  it('should stay quiet about a file a walk stepped over', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    fs.copyFileSync(SPELLED.file, path.join(dir, 'named.txt'))
    const printed = runXslint([dir])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(
      !printed.includes('was not read'),
      'a directory walk complains about every file that is not a ' +
        'stylesheet, so a run over a repository buries its report under one ' +
        'warning per file nobody asked it to read (#924)',
    )
  })
  it('should lint the parseable stylesheets and report the malformed ones', function() {
    const stdout = runXslint(['test/resources/malformed']);
    [
      'Processed files: 2',
      'bad.xsl(1:1)',
      'malformed-stylesheet',
      'good.xsl',
      'invalid-xpath-expression',
    ].forEach((str) => assert.ok(stdout.includes(str)))
  })
  it('should exit zero when only warnings are found', function() {
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
    ])
    assert.equal(status, 0)
  })
  it('should exit one when warnings exceed the budget', function() {
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--max-warnings=0',
    ])
    assert.equal(status, 1)
  })
  it('should exit zero when warnings stay within the budget', function() {
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--max-warnings=10',
    ])
    assert.equal(status, 0)
  })
  it('should exit one when an error is found', function() {
    const status = xslintStatus([
      'test/resources/malformed/bad.xsl',
      '--max-warnings=100',
    ])
    assert.equal(status, 1)
  })
  it('should print defects to stdout', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
    ])
    assert.ok(streams.stdout.includes('short-names'))
  })
  it('should print progress logs to stderr', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
    ])
    assert.ok(streams.stderr.includes('Processed files: 1'))
  })
  it('should keep progress logs out of stdout', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
    ])
    assert.ok(!streams.stdout.includes('Processed files'))
  })
  it('should suppress informational logs when quiet', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--quiet',
    ])
    assert.ok(!streams.stderr.includes('Processed files'))
  })
  it('should disable a rule named off in the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'rules:\n  short-names: off\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(!streams.stdout.includes('short-names'))
  })
  it('should fail when the config promotes a warning to an error', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'rules:\n  short-names: error\n')
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(status, 1)
  })
  it('should skip files matched by a config exclude glob', function() {
    const streams = xslintStreams([
      'test/resources/excluded',
      '--config=test/resources/excluded/.xslint.yml',
    ])
    assert.ok(streams.stderr.includes('Processed files: 0'))
  })
  PRUNING.forEach(({pattern, dir, prunes}) => {
    it(`should answer ${prunes} to leaving ${dir} unopened under ${pattern}`,
      function() {
        const base = path.resolve(os.tmpdir(), 'yard')
        assert.equal(
          pruned(path.join(base, dir), [pattern], base),
          prunes,
          `the walk reads ${pattern} as covering ${dir} or as leaving it ` +
            'open, against what the row says, and which of the two decides ' +
            'whether an exclusion costs the whole walk or nothing (#923)',
        )
      })
  })
  it('should never leave unopened a directory holding a file it reports',
    function() {
      const base = path.resolve(os.tmpdir(), 'yard')
      assert.deepEqual(
        PRUNING
          .filter(({pattern, dir}) => pruned(
            path.join(base, dir), [pattern], base,
          ))
          .filter(({pattern, dir}) => COVERED.some((name) => !excluded(
            path.join(base, dir, name), [pattern], base,
          )))
          .map(({pattern, dir}) => `${pattern} over ${dir}`),
        [],
        'a pattern the walk skips a directory on leaves a stylesheet under ' +
          'it in the report, so the run would answer with fewer defects than ' +
          'the same configuration read as a filter (#923)',
      )
    })
  it('should never open a directory the config excludes', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const shut = path.join(dir, 'shut')
    fs.mkdirSync(shut)
    fs.copyFileSync(CLEAN, path.join(shut, 'buried.xsl'))
    fs.copyFileSync(CLEAN, path.join(dir, 'kept.xsl'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'exclude:\n  - "shut/**"\n')
    fs.chmodSync(shut, 0o000)
    let opens = true
    try {
      fs.readdirSync(shut)
    } catch {
      opens = false
    }
    if (opens) {
      fs.chmodSync(shut, 0o755)
      fs.rmSync(dir, {recursive: true, force: true})
      this.skip()
    }
    const streams = xslintStreams([dir, `--config=${cfg}`])
    fs.chmodSync(shut, 0o755)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(
      streams.stderr.includes('Processed files: 1'),
      'the run opened a directory every pattern of its configuration ' +
        'covers, which is the whole of what an exclusion used to cost: this ' +
        'one cannot be read at all, so reaching it is the failure (#923)',
    )
  })
  it('should never open a directory the project ignores', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const shut = path.join(dir, 'shut')
    fs.mkdirSync(shut)
    fs.copyFileSync(CLEAN, path.join(shut, 'buried.xsl'))
    fs.copyFileSync(CLEAN, path.join(dir, 'kept.xsl'))
    fs.writeFileSync(path.join(dir, '.gitignore'), 'shut/\n')
    fs.chmodSync(shut, 0o000)
    let opens = true
    try {
      fs.readdirSync(shut)
    } catch {
      opens = false
    }
    if (opens) {
      fs.chmodSync(shut, 0o755)
      fs.rmSync(dir, {recursive: true, force: true})
      this.skip()
    }
    const streams = xslintStreams([dir])
    fs.chmodSync(shut, 0o755)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(
      streams.stderr.includes('Processed files: 1'),
      'the run opened a directory the project itself does not track, which ' +
        'is what reported a checkout of 123 stylesheets as 5031: this one ' +
        'cannot be read at all, so reaching it is the failure (#929)',
    )
  })
  it('should leave out a stylesheet the project ignores by name', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    fs.copyFileSync(CLEAN, path.join(dir, 'kept.xsl'))
    fs.copyFileSync(CLEAN, path.join(dir, 'sheet.gen.xsl'))
    fs.writeFileSync(path.join(dir, '.gitignore'), '*.gen.xsl\n')
    const streams = xslintStreams([dir])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(
      streams.stderr.includes('Processed files: 1'),
      'a stylesheet the project ignores by name stands under no ignored ' +
        'directory, so nothing the walk leaves unopened answers for it and ' +
        'the run reports a generated file as source (#929)',
    )
  })
  it('should read a directory named outright though the project ignores it',
    function() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
      const shut = path.join(dir, 'shut')
      fs.mkdirSync(shut)
      fs.copyFileSync(CLEAN, path.join(shut, 'buried.xsl'))
      fs.writeFileSync(path.join(dir, '.gitignore'), 'shut/\n')
      const made = repository(dir, ['.gitignore'])
      let streams = {stderr: ''}
      if (made) {
        streams = xslintStreams([shut])
      }
      fs.rmSync(dir, {recursive: true, force: true})
      if (!made) {
        this.skip()
      }
      assert.ok(
        streams.stderr.includes('Processed files: 1'),
        'a path named on the command line is what the run was asked for, ' +
          'so reading the ignore files above it into a refusal answers a ' +
          'question nobody put (#929)',
      )
    })
  it('should read a stylesheet the index holds though a rule names it',
    function() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
      fs.mkdirSync(path.join(dir, 'reports'))
      fs.copyFileSync(CLEAN, path.join(dir, 'kept.xsl'))
      fs.copyFileSync(CLEAN, path.join(dir, 'reports', 'tracked.xsl'))
      fs.copyFileSync(CLEAN, path.join(dir, 'reports', 'stray.xsl'))
      fs.writeFileSync(path.join(dir, '.gitignore'), 'reports/\n')
      const made = repository(dir, ['reports/tracked.xsl'])
      let streams = {stderr: ''}
      if (made) {
        streams = xslintStreams([dir])
      }
      fs.rmSync(dir, {recursive: true, force: true})
      if (!made) {
        this.skip()
      }
      assert.ok(
        streams.stderr.includes('Processed files: 2'),
        'git keeps a stylesheet its index holds whatever a rule says of it, ' +
          'and this repository tracks two under a `reports/` line: reading ' +
          'the rules alone reported 159 files where 161 stand (#929)',
      )
    })
  it('should apply max-warnings from the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'max-warnings: 0\n')
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(status, 1)
  })
  it('should let a command-line max-warnings override the config', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'max-warnings: 0\n')
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
      '--max-warnings=100',
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(status, 0)
  })
  it('should disable a family of rules by glob in the config', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'rules:\n  "unused-*": off\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(!streams.stdout.includes('unused-named-template'))
  })
  it('should warn about an unknown key in the config', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'excludes:\n  - "x"\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(streams.stderr.includes('Unknown key \'excludes\''))
  })
  it('should warn about an unknown rule in the config', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'rules:\n  no-such-rule: error\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(streams.stderr.includes(
      'Rule \'no-such-rule\' in configuration does not exist',
    ))
  })
  it('should keep stdout clean when it fails to read the config', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-no-violations.xsl',
      `--config=${dir}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(streams.stdout, '')
  })
  it('should read the log level from the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'log-level: debug\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(streams.stderr.includes('Log level set to \'debug\''))
  })
  it('should read quiet from the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'quiet: true\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(!streams.stderr.includes('Processed files'))
  })
  it('should keep a settled check with --stable', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--stable',
    ])
    assert.ok(streams.stdout.includes('short-names'))
  })
  it('should read the stable tier from the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const cfg = path.join(dir, '.xslint.yml')
    fs.writeFileSync(cfg, 'stable: true\n')
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      `--config=${cfg}`,
    ])
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(streams.stdout.includes('short-names'))
  })
  it('should suppress a defect with an inline disable-next-line', function() {
    const streams = xslintStreams(['test/resources/directives/used.xsl'])
    assert.ok(!streams.stdout.includes('short-names'))
  })
  it('should leave other defects when a disable-next-line is targeted', function() {
    const streams = xslintStreams(['test/resources/directives/targeted.xsl'])
    assert.ok(streams.stdout.includes('not-using-output'))
  })
  it('should suppress a defect standing in a wrapped attribute value', function() {
    const streams = xslintStreams(['test/resources/directives/wrapped.xsl'])
    assert.ok(!streams.stdout.includes('using-namespace-axis'))
  })
  it('should not call the directive over a wrapped value unused', function() {
    const streams = xslintStreams(['test/resources/directives/wrapped.xsl'])
    assert.ok(!streams.stderr.includes('Unused xslint-disable'))
  })
  it('should suppress a defect in a value whose start tag wraps too', function() {
    const streams = xslintStreams(['test/resources/directives/wrapped-tag.xsl'])
    assert.ok(!streams.stdout.includes('using-namespace-axis'))
  })
  it('should not call the directive over a wrapped tag unused', function() {
    const streams = xslintStreams(['test/resources/directives/wrapped-tag.xsl'])
    assert.ok(!streams.stderr.includes('Unused xslint-disable'))
  })
  it('should suppress across the file with an inline disable-file', function() {
    const streams = xslintStreams(['test/resources/directives/disable-file.xsl'])
    assert.ok(!streams.stdout.includes('short-names'))
  })
  it('should warn about an unknown rule in a disable directive', function() {
    const streams = xslintStreams(
      ['test/resources/directives/unknown-rule.xsl'],
    )
    assert.ok(streams.stderr.includes('Rule \'bogus-rule\' in an xslint-disable'))
  })
  it('should warn about an unused inline directive', function() {
    const streams = xslintStreams(['test/resources/directives/unused.xsl'])
    assert.ok(streams.stderr.includes('Unused xslint-disable directive'))
  })
  it('should not warn when an inline directive is used', function() {
    const streams = xslintStreams(['test/resources/directives/used.xsl'])
    assert.ok(!streams.stderr.includes('Unused xslint-disable directive'))
  })
  it('should print defects as a JSON array with --format json', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--format=json',
    ])
    assert.ok(
      JSON.parse(streams.stdout).some((defect) => defect.rule === 'short-names'),
    )
  })
  it('should print a SARIF 2.1.0 log with --format sarif', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--format=sarif',
    ])
    assert.equal(JSON.parse(streams.stdout).version, '2.1.0')
  })
  it('should print GitHub workflow commands with --format github', function() {
    const streams = xslintStreams([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--format=github',
    ])
    assert.ok(/::(warning|error) file=/.test(streams.stdout))
  })
  PIPES.forEach((row) => {
    it(row.name, async function() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
      const sheet = fs.readFileSync(
        path.resolve('test/resources/scaling/stylesheet.xsl'), 'utf-8',
      )
      for (let at = 0; at < row.piped; at++) {
        fs.writeFileSync(
          path.join(dir, `sheet-${at}.xsl`),
          sheet
            .replaceAll('PREVIOUS', String(at - 1))
            .replaceAll('SEED', String(at)),
        )
      }
      const said = await xslintUnread([dir, '--max-warnings=0'], 250)
      fs.rmSync(dir, {recursive: true, force: true})
      assert.equal(
        said.report.split('\n').filter((line) => line !== '').length,
        Number(said.log.match(/Defects found: (\d+)/)[1]),
        'a report cannot lose the lines the run counted, whoever is reading',
      )
    })
  })
  it('should reject an unknown --format value', function() {
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--format=bogus',
    ])
    assert.notEqual(status, 0)
  })
})
