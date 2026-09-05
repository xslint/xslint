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
    name: 'reads the stable tier from the config file',
    content: 'stable: true\n',
    field: 'stable',
    expected: true,
  },
  {
    name: 'ignores a non-boolean stable',
    content: 'stable: 3\n',
    field: 'stable',
    expected: null,
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
]

describe('config', function() {
  it('returns empty defaults when there is no file', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-cfg-'))
    const config = configFrom(undefined, dir)
    fs.rmSync(dir, {recursive: true, force: true})
    assert.deepStrictEqual(config, {
      rules: {},
      exclude: [],
      maxWarnings: null,
      logLevel: null,
      quiet: null,
      stable: null,
      base: dir,
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
