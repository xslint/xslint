/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {ESLint, Linter} = require('eslint')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The repository itself, and the directory holding the modules a run reads.
 * @type {string}
 */
const ROOT = path.resolve(__dirname, '..')

/**
 * Directory holding those modules.
 * @type {string}
 */
const SOURCES = path.join(ROOT, 'src')

/**
 * The source files a process may be started in, which is the whole of what
 * the spawn ban exempts. A ratchet both ways: a source file the ban fails to
 * reach turns red, and so does an entry whose file starts nothing (#929).
 * @type {Array.<string>}
 */
const SPAWNING = ['src/gitignore.js']

/**
 * The configuration as it stands.
 * @return {Promise.<Array>} - Every block of eslint.config.mjs, in order
 */
const configured = async function() {
  return (await import('../eslint.config.mjs')).default
}

/**
 * The spawn ban as the configuration spells it, read off the configuration
 * rather than written down a second time, so a selector respelled is still
 * the one this gate asks about.
 * @param {Array} config - eslint.config.mjs as it stands
 * @return {object} - The entry banning a child process, or nothing
 */
const spawning = function(config) {
  return config
    .flatMap((entry) => entry.rules?.['no-restricted-syntax'] ?? [])
    .filter((one) => String(one.selector).includes('child_process'))
    .pop()
}

/**
 * Whether a selector reports a file, asked of the rule itself rather than of
 * the text, so an exemption answers to what the ban actually reads.
 * @param {string} named - Path of the file from the repository root
 * @param {object} ban - The restricted-syntax entry to judge it by
 * @return {boolean} - TRUE when the selector reports the file
 */
const restricts = function(named, ban) {
  return new Linter()
    .verify(
      fs.readFileSync(path.resolve(ROOT, named), 'utf-8'),
      {rules: {'no-restricted-syntax': ['error', ban]}},
    )
    .some((one) => one.ruleId === 'no-restricted-syntax')
}

describe('eslint-config', function() {
  it('bans starting a process anywhere in the sources', async function() {
    assert.ok(
      spawning(await configured()),
      [
        'nothing in eslint.config.mjs bans starting a child process, so the',
        'next one to ask git about a path spends a fork per entry and says',
        'nothing at all where git is absent (#929)',
      ].join(' '),
    )
  })
  it('holds every source file to that ban but the one that starts one',
    async function() {
      const ban = spawning(await configured())
      const eslint = new ESLint({cwd: ROOT})
      const exempt = SPAWNING.map((named) => path.resolve(ROOT, named))
      const loose = []
      for (const file of allFilesFrom(SOURCES)) {
        if (file.endsWith('.js') && !exempt.includes(file)) {
          const rules = (await eslint.calculateConfigForFile(file)).rules
          if (
            !(rules['no-restricted-syntax'] ?? [])
              .some((one) => one.selector === ban.selector)
          ) {
            loose.push(path.relative(ROOT, file))
          }
        }
      }
      assert.deepEqual(
        loose,
        [],
        [
          'a source file falls outside the spawn ban, so the next git call',
          'written there is reported by nothing — which is what a whole',
          'block ignoring one file does to every selector that block',
          'carries (#929)',
        ].join(' '),
      )
    })
  it('exempts from it no file that starts no process', async function() {
    const ban = spawning(await configured())
    assert.deepEqual(
      SPAWNING.filter((named) => !restricts(named, ban)),
      [],
      [
        'a file exempted from the spawn ban starts no process, so the',
        'exemption in eslint.config.mjs stands over nothing and the next',
        'file to take that name inherits it (#929)',
      ].join(' '),
    )
  })
})
