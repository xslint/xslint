/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  runXslint, xslintStatus, xslintStreams, xslintUnread,
} = require('./helpers')
const assert = require('assert')
const version = require('../src/version')
const path = require('path')
const fs = require('fs')
const os = require('os')

/**
 * How many stylesheets the piped run is given. Each copy of the scaling sheet
 * draws some thirty-six defects and eight kilobytes of report, so twenty of
 * them come to more than twice what a pipe holds before it stops taking any —
 * which is what leaves the run writing into a pipe that is already full.
 * @type {number}
 */
const PIPED = 20

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
  it('should write the whole report into a pipe nobody reads', async function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-'))
    const sheet = fs.readFileSync(
      path.resolve('test/resources/scaling/stylesheet.xsl'), 'utf-8',
    )
    for (let at = 0; at < PIPED; at++) {
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
  it('should reject an unknown --format value', function() {
    const status = xslintStatus([
      'test/resources/stylesheets/xsl-with-some-violations.xsl',
      '--format=bogus',
    ])
    assert.notEqual(status, 0)
  })
})
