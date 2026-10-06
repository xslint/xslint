/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {configFrom} = require('../src/config')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Cases where a `.xslint.yml` of the given content, read from its own
 * directory, resolves one config field to an expected value.
 * @type {Array.<{name: string, content: string, field: string, expected: *}>}
 */
const CASES = [
  {
    name: 'reads the log level from the config file',
    content: 'log-level: debug\n',
    field: 'logLevel',
    expected: 'debug',
  },
  {
    name: 'parses the exclude globs into a list',
    content: 'exclude:\n  - "a/**"\n  - "b/**"\n',
    field: 'exclude',
    expected: ['a/**', 'b/**'],
  },
  {
    name: 'drops a rule graded to an unknown severity',
    content: 'rules:\n  short-names: bogus\n',
    field: 'rules',
    expected: {},
  },
  {
    name: 'ignores a non-numeric max-warnings',
    content: 'max-warnings: abc\n',
    field: 'maxWarnings',
    expected: null,
  },
  {
    name: 'ignores a non-boolean quiet',
    content: 'quiet: 3\n',
    field: 'quiet',
    expected: null,
  },
  {
    name: 'parses the chosen checks into a list',
    content: 'only:\n  - short\n  - unused-variable\n',
    field: 'only',
    expected: ['short', 'unused-variable'],
  },
  {
    name: 'reads the preset a run starts from',
    content: 'preset: all\n',
    field: 'preset',
    expected: 'all',
  },
  {
    name: 'reads the baseline a run compares against',
    content: 'baseline: build/xslint-baseline.json\n',
    field: 'baseline',
    expected: 'build/xslint-baseline.json',
  },
  {
    name: 'ignores a baseline that is not a string',
    content: 'baseline: 42\n',
    field: 'baseline',
    expected: null,
  },
  {
    name: 'ignores a preset that is not a string',
    content: 'preset:\n  - all\n',
    field: 'preset',
    expected: null,
  },
  {
    name: 'ignores an only that is not a list',
    content: 'only: short-names\n',
    field: 'only',
    expected: [],
  },
  {
    name: 'reads nothing off the retired stable tier',
    content: 'stable: true\n',
    field: 'stable',
    expected: undefined,
  },
  {
    name: 'ignores a log-level that is not a string',
    content: 'log-level: 5\n',
    field: 'logLevel',
    expected: null,
  },
  {
    name: 'ignores an exclude that is not a list',
    content: 'exclude: nope\n',
    field: 'exclude',
    expected: [],
  },
  {
    name: 'answers an unknown key as a problem',
    content: 'bogus: 1\n',
    field: 'problems',
    expected: [`Unknown key 'bogus' in .xslint.yml`],
  },
  {
    name: 'answers a rule graded to an unknown severity as a problem',
    content: 'rules:\n  short-names: loud\n',
    field: 'problems',
    expected: [
      [
        `Invalid severity 'loud' for rule 'short-names' in .xslint.yml,`,
        'use one of off, warning, error',
      ].join(' '),
    ],
  },
  {
    name: 'answers a mistyped value as a problem',
    content: 'quiet: 3\n',
    field: 'problems',
    expected: [`Value of 'quiet' in .xslint.yml must be a boolean, ignoring it`],
  },
]

describe('config', function() {
  it('returns empty defaults when there is no file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    const config = configFrom(undefined, dir)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.deepStrictEqual(config, {
      rules: {},
      exclude: [],
      only: [],
      preset: null,
      maxWarnings: null,
      logLevel: null,
      quiet: null,
      baseline: null,
      problems: [],
      base: dir,
      file: undefined,
    })
  })
  it('reads the rules from a file named explicitly', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    const file = path.join(dir, 'custom.yml')
    fs.writeFileSync(file, 'rules:\n  short-names: off\n')
    const config = configFrom(file)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(config.rules['short-names'], 'off')
  })
  it('finds the nearest config walking up from a directory', function() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    fs.writeFileSync(path.join(root, '.xslint.yml'), 'max-warnings: 5\n')
    const nested = path.join(root, 'a', 'b')
    fs.mkdirSync(nested, {recursive: true})
    const config = configFrom(undefined, nested)
    fs.rmSync(root, {recursive: true, force: true})
    assert.equal(config.maxWarnings, 5)
  })
  it('names the file it found walking up from a directory', function() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    fs.writeFileSync(path.join(root, '.xslint.yml'), 'max-warnings: 7\n')
    const nested = path.join(root, 'c', 'd')
    fs.mkdirSync(nested, {recursive: true})
    assert.equal(
      configFrom(undefined, nested).file, path.join(root, '.xslint.yml'),
      'did not name the configuration file it read, which a caller publishing its problems needs',
    )
  })
  it('resolves the base to the directory of the config file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    const file = path.join(dir, '.xslint.yml')
    fs.writeFileSync(file, 'exclude:\n  - "x"\n')
    const config = configFrom(file)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.equal(config.base, dir)
  })
  CASES.forEach(({name, content, field, expected}) => {
    it(name, function() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
      fs.writeFileSync(path.join(dir, '.xslint.yml'), content)
      const config = configFrom(undefined, dir)
      fs.rmSync(dir, {recursive: true, force: true})
      assert.deepStrictEqual(config[field], expected)
    })
  })
})
