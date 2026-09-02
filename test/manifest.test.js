/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {GAP} = require('../src/tokens')
const {builtinModules} = require('module')
const manifest = require('../package.json')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The repository itself, one directory above this file.
 * @type {string}
 */
const ROOT = path.join(__dirname, '..')

/**
 * Every package this repository declares, of either kind. A tool a grunt
 * wrapper runs is a devDependency and a module the program loads is a
 * dependency, and both questions below are about the same one manifest.
 * @type {{[name: string]: string}}
 */
const DECLARED = {...manifest.dependencies, ...manifest.devDependencies}

/**
 * Every package declared that none of this repository's own JavaScript names,
 * each beside what it is there for. A dependency nothing imports is either a
 * command a script runs or a name a config is handed, or it is dead weight —
 * and the assertion holding this table is what keeps the sweep beside it from
 * passing by finding nothing at all.
 * @type {{[name: string]: string}}
 */
const UNIMPORTED = {
  '@stryker-mutator/core': 'the mutation runner, run as a command',
  '@stryker-mutator/mocha-runner': 'its plugin, named in the stryker config',
  'c8': 'the coverage runner, run as a command',
  'eslint-config-google': 'extended by name through eslintrc, never imported',
  'grunt': 'the task runner the Gruntfile is written for',
  'grunt-cli': 'the command that runs it',
  'grunt-eslint': 'a task the Gruntfile loads by name',
  'grunt-mocha-cli': 'a task the Gruntfile loads by name',
  'patch-package': 'the postinstall step, run as a command',
}

/**
 * Where a module is named: the argument of a `require` or of a dynamic
 * `import`, and the specifier of a static one. A `from` clause is anchored to
 * the statement opening its line, since prose names one too — a JSDoc reading
 * `Path from '--config'` is a sentence about a flag and not an import.
 * @type {RegExp}
 */
const NAMED = new RegExp(
  `(?:require|import)${GAP}*\\(${GAP}*['"]([^'"]+)['"]|` +
  `^${GAP}*(?:import|export)[^'"]*from${GAP}*['"]([^'"]+)['"]|` +
  `^${GAP}*import${GAP}+['"]([^'"]+)['"]`,
  'gm',
)

/**
 * Every JavaScript file this repository owns, `eslint.config.mjs` among them.
 * It is read here rather than off the Gruntfile's eslint target, which is the
 * list of what ESLint judges: that one file stands outside it (#789), and it
 * is the file whose two undeclared imports #855 is about.
 * @return {Array.<string>} - The paths, in no particular order
 */
const owned = function() {
  return ['src', 'test', 'scripts']
    .flatMap((dir) => allFilesFrom(path.join(ROOT, dir)))
    .concat(fs.readdirSync(ROOT).map((name) => path.join(ROOT, name)))
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
}

/**
 * The package a specifier names, which is the whole of a scoped name and the
 * first segment of any other: `eslint/config` is a subpath of `eslint`, and
 * `@eslint/js` is a package in its own right.
 * @param {string} specifier - What a require or an import was handed
 * @return {string} - The package it reaches for
 */
const packaged = function(specifier) {
  return specifier.split('/')
    .slice(0, 1 + Number(specifier.startsWith('@')))
    .join('/')
}

/**
 * Every package this repository's own JavaScript names, node's own excluded.
 * @return {Array.<string>} - The names, sorted, without repetition
 */
const imported = function() {
  const names = new Set()
  for (const file of owned()) {
    for (const found of fs.readFileSync(file, 'utf-8').matchAll(NAMED)) {
      const specifier = found[1] ?? found[2] ?? found[3]
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        names.add(packaged(specifier))
      }
    }
  }
  return [...names].filter((name) => !builtinModules.includes(name)).sort()
}

/**
 * Every tool a task wrapper the Gruntfile loads depends on and this repository
 * declares as well, spelled beside the pin that holds the two to one version.
 * A wrapper is read off the Gruntfile rather than listed here, so one added is
 * one judged (#841, #855).
 * @return {Array.<{wrapper: string, tool: string}>} - The pairs
 */
const wrapped = function() {
  return [...fs.readFileSync(path.join(ROOT, 'Gruntfile.js'), 'utf-8')
    .matchAll(new RegExp(`loadNpmTasks\\(${GAP}*'([^']+)'`, 'g'))]
    .map((call) => call[1])
    .flatMap((wrapper) => Object.keys(
      require(`${wrapper}/package.json`).dependencies ?? {},
    )
      .filter((tool) => tool in DECLARED)
      .map((tool) => ({wrapper: wrapper, tool: tool})))
}

/**
 * Every `$name` pin the manifest holds, which is how npm spells *the version
 * the root declares* for a package nested under another. A security override
 * beside one names a version outright, so the two kinds tell themselves apart
 * and neither has to be listed by hand.
 * @return {Array.<{wrapper: string, tool: string}>} - The pairs
 */
const pinned = function() {
  return Object.entries(manifest.overrides)
    .flatMap((entry) => Object.entries(entry[1])
      .filter((pin) => pin[1] === `$${pin[0]}`)
      .map((pin) => ({wrapper: entry[0], tool: pin[0]})))
}

/**
 * How a pair reads where one is reported, so two lists of them are compared
 * as one sorted sequence of sentences.
 * @param {Array.<{wrapper: string, tool: string}>} pairs - The pairs
 * @return {Array.<string>} - Each of them, spelled, in order
 */
const spelled = function(pairs) {
  return pairs.map((pair) => `${pair.wrapper} runs ${pair.tool}`).sort()
}

describe('manifest', function() {
  it('pins every tool a grunt wrapper shares with the suite, and no other',
    function() {
      assert.deepEqual(
        spelled(pinned()),
        spelled(wrapped()),
        'a grunt wrapper depends on a tool this repository declares too and ' +
          'is held to no version of it, so npm nests the wrapper a copy of ' +
          'its own and the target runs a tool nobody chose: grunt mochacli ' +
          'ran mocha 8 against a declared 11 (#841) and grunt eslint ran ' +
          'eslint 9 against a declared 10 (#855). Pin it in overrides as ' +
          '$<tool>, or drop a pin the wrapper has stopped needing',
      )
    })
  it('runs every grunt target on the tool the suite declares', function() {
    assert.deepEqual(
      wrapped()
        .filter((pair) => require.resolve(pair.tool, {
          paths: [
            path.dirname(require.resolve(`${pair.wrapper}/package.json`)),
          ],
        }) !== require.resolve(pair.tool))
        .map((pair) => `${pair.wrapper} -> ${pair.tool}`),
      [],
      'a grunt target runs a tool of its own and not the one the suite ' +
        'declares, so every rule and every timeout this repository sets is ' +
        'read by a major nobody chose',
    )
  })
  it('declares every package its own JavaScript names', function() {
    assert.deepEqual(
      imported().filter((name) => !(name in DECLARED)),
      [],
      'this repository imports a package it declares nowhere, so what ' +
        'supplies it is some dependency of a dependency that happens to be ' +
        'hoisted, and the day that one dedupes away the import fails: ' +
        'eslint.config.mjs named @eslint/js and @eslint/eslintrc, both of ' +
        'them the nested eslint 9 grunt-eslint pinned, and every rule in ' +
        'this project stood on the accident (#855)',
    )
  })
  it('names every package it declares, or says what the package is for',
    function() {
      assert.deepEqual(
        Object.keys(DECLARED)
          .filter((name) => !imported().includes(name))
          .sort(),
        Object.keys(UNIMPORTED).sort(),
        'a declared package is imported by none of this repository\'s own ' +
          'JavaScript and stands on no list saying what runs it, so it is ' +
          'either dead weight or a tool nobody has written down — and a ' +
          'sweep for imports that has gone blind reads exactly the same way',
      )
    })
})
