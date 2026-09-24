/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * What `package.json` declares, held to what a grunt wrapper runs and what
 * this repository's own JavaScript imports.
 *
 * Both halves of the suite run on one mocha, and did not until #841:
 * `grunt-mocha-cli` pins `mocha ^8.2.0`, so `npm install` nested a second
 * mocha under it — 8.4.0, from 2021 — and `grunt mochacli` ran the suite
 * there while `npm run coverage` ran it on 11. That nested tree is where
 * two of the nine advisories `npm audit` read on master stood and nowhere
 * else, `nanoid` and `minimatch`. An `overrides` entry in `package.json`
 * holds it to the `mocha` the root declares, and the first question below
 * asks it of every tool a grunt wrapper runs. The rest of that entry lifts
 * `diff` and `serialize-javascript` to the majors mocha 12 ships with —
 * every version mocha 11's own ranges admit is an advisory, and its one
 * call into each is unchanged in 12 — grunt's `js-yaml` to 4, whose
 * `safeLoad` grunt calls only in a `readYAML` nothing here calls, 3.x
 * never having been patched, and `typed-rest-client`'s exact `qs` up a
 * minor — a floor and not a pin, the range two advisories cover having
 * since reached the patch #841 first lifted it to (#870). The two majors
 * are spelled at the top level rather than under `mocha`, because npm
 * 11.12 honours a range scoped under `grunt` or `grunt-mocha-cli` and
 * drops the same range scoped under `mocha`. `daily.yml` runs `npm audit`
 * in a job of its own beside the six cells that run the suite, so an
 * advisory this project waits on upstream to patch does not take a
 * platform's test result down with it for as long as the wait lasts, and
 * six identical audits say one thing. What that job could not do was say
 * which of the two it had read: `npm audit` exits 1 on a registry 503 as
 * readily as on an advisory, so the issue it filed named neither the
 * packages nor the outage. `scripts/audit.js` judges the JSON now, and
 * `scripts/CLAUDE.md` carries that derivation (#884).
 *
 * It is that ticket one tool over, in the same file and for the same reason:
 * `grunt-eslint` 26 depends on `eslint ^9.22.0`, so npm nested a 9.39.4 under
 * it while the root declared 10, and the `lint` job — with `npm run fast` and
 * `npm test` behind it — read every rule this project sets through a major
 * nobody chose. The pin holding `grunt-mocha-cli` to the declared mocha was
 * written for mocha alone, and so was the question beside it, so eslint went
 * four majors unasked (#855).
 *
 * The second half is what that nesting was quietly supplying.
 * `eslint.config.mjs` imports `@eslint/js` and `@eslint/eslintrc`, and the
 * manifest declared neither; eslint 10 depends on neither either, so the only
 * provider in the tree was the nested 9's own, hoisted to where the config
 * resolved it. Every rule in this project stood on that accident until a
 * dependabot bump took it away: `grunt-eslint` 27 wants `eslint ^10.9.1`,
 * which dedupes against the root, and the 9 leaving took `@eslint/js` with
 * it — `Cannot find package '@eslint/js' imported from eslint.config.mjs`,
 * three jobs red on one bump and an hourly sentinel tripping over it. What
 * eslint 10 reported once it was the one running was seventeen errors of two
 * rules 9 does not have — fifteen `no-useless-assignment`, two
 * `preserve-caught-error` — every one a real dead initialiser or a rethrow
 * dropping its cause.
 *
 * Four questions of the one manifest, each red from both sides. Every tool a
 * grunt wrapper shares with the suite is pinned as `$name` in `overrides`,
 * **and no pin stands for a wrapper the Gruntfile has stopped loading** — the
 * expected side comes from `overrides` and the measured side from the
 * Gruntfile, which is what the first spelling got wrong: it read `wrapped()`
 * on both sides, so a wrapper deleted took the expectation with it and a
 * stale pin went unjudged. Each pin then has to hold: the tool resolved from
 * the wrapper's directory must be the file the root resolves to. Every bare
 * specifier this repository's own JavaScript names must be declared. And
 * every declared package must be named by that sweep or stand on
 * `UNIMPORTED` beside what runs it, a dependency nothing imports being either
 * a command some script runs or dead weight — and a sweep gone blind reads
 * exactly like a manifest with nothing left over.
 *
 * Two further questions are about the manifest's own coordinates rather than
 * about its dependencies: the npm name and the repository URL. Each is read
 * twice by a single pattern — once out of the field that declares it and once
 * out of every file this repository tracks, the generator the site is built
 * from among them — so a coordinate stated anywhere and the coordinate
 * declared are the same string or the gate is red, and a sweep gone blind
 * reads as a tree stating nothing rather than as a tree agreeing. Nothing
 * but a reader had ever compared the two, and the URI binding our own XPath
 * prefix was one owner out of date with the three fields beside it, still
 * naming what the move to the `xslint` organisation left behind. A sibling
 * never matches — `xslint-lsp` and `xslint-action` are repositories of their
 * own — which is what the alphabet closing each pattern is for. The npm
 * scope stays the personal one, decided rather than defaulted into: the
 * discoverability a rename buys is real, and so is a coordinate frozen
 * across two published integrations and an action, a deprecated alias
 * behind it, and a second name for a tool everything else already calls
 * xslint (#337).
 *
 * It is a mocha test rather than an ESLint rule because `eslint.config.mjs`
 * stands in ESLint's own `ignores` (#789), so no rule of ours can see the one
 * file whose undeclared imports this is about.
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
 * The two coordinates this repository states of itself, each beside the
 * manifest field that declares it. The dot is left out of the second
 * pattern's closing alphabet, a `.git` suffix naming the same repository.
 * @type {Array.<{what: string, pattern: RegExp, declares: string}>}
 */
const COORDINATES = [
  {
    what: 'npm coordinate',
    pattern: /@[A-Za-z0-9._-]+\/xslint(?![A-Za-z0-9._-])/g,
    declares: manifest.name,
  },
  {
    what: 'repository URL',
    pattern: /github\.com\/[A-Za-z0-9._-]+\/xslint(?![A-Za-z0-9_-])/g,
    declares: manifest.repository.url,
  },
]

/**
 * Where a module is named: the argument of a `require` or of a dynamic
 * `import`, and the specifier of a static one. A `from` clause is anchored to
 * the statement opening its line, since prose names one too — a JSDoc reading
 * `Path from '--config'` is a sentence about a flag and not an import.
 * @type {RegExp}
 */
const NAMED = new RegExp(
  [
    `(?:require|import)${GAP}*\\(${GAP}*['"]([^'"]+)['"]|`,
    `^${GAP}*(?:import|export)[^'"]*from${GAP}*['"]([^'"]+)['"]|`,
    `^${GAP}*import${GAP}+['"]([^'"]+)['"]`,
  ].join(''),
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

/**
 * Every file this repository owns, which is where it states a coordinate of
 * itself. The generated site is not, being built rather than tracked, so the
 * generator standing here in its place is what a stale install line in front
 * of a user answers to. This file is among them: a pattern whose own
 * delimiters are escaped matches nothing it scans.
 * @return {Array.<string>} - The paths, in no particular order
 */
const texts = function() {
  return ['src', 'test', 'scripts', '.github']
    .flatMap((dir) => allFilesFrom(path.join(ROOT, dir)))
    .concat(fs.readdirSync(ROOT, {withFileTypes: true})
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(ROOT, entry.name)))
}

/**
 * Every distinct coordinate a pattern finds across some contents, sorted, so
 * that what the tree states and what the manifest declares are compared by
 * the one reading rather than by two.
 * @param {RegExp} pattern - The shape a coordinate is written in
 * @param {Array.<string>} contents - The texts to look through
 * @return {Array.<string>} - The coordinates, sorted, without repetition
 */
const matched = function(pattern, contents) {
  return [...new Set(
    contents.flatMap((content) => content.match(pattern) ?? []),
  )].sort()
}

describe('manifest', function() {
  it('pins every tool a grunt wrapper shares with the suite, and no other',
    function() {
      assert.deepEqual(
        spelled(pinned()),
        spelled(wrapped()),
        [
          'a grunt wrapper depends on a tool this repository declares too and',
          'is held to no version of it, so npm nests the wrapper a copy of',
          'its own and the target runs a tool nobody chose: grunt mochacli',
          'ran mocha 8 against a declared 11 (#841) and grunt eslint ran',
          'eslint 9 against a declared 10 (#855). Pin it in overrides as',
          '$<tool>, or drop a pin the wrapper has stopped needing',
        ].join(' '),
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
      [
        'a grunt target runs a tool of its own and not the one the suite',
        'declares, so every rule and every timeout this repository sets is',
        'read by a major nobody chose',
      ].join(' '),
    )
  })
  it('declares every package its own JavaScript names', function() {
    assert.deepEqual(
      imported().filter((name) => !(name in DECLARED)),
      [],
      [
        'this repository imports a package it declares nowhere, so what',
        'supplies it is some dependency of a dependency that happens to be',
        'hoisted, and the day that one dedupes away the import fails:',
        'eslint.config.mjs named @eslint/js and @eslint/eslintrc, both of',
        'them the nested eslint 9 grunt-eslint pinned, and every rule in',
        'this project stood on the accident (#855)',
      ].join(' '),
    )
  })
  COORDINATES.forEach(function(coordinate) {
    it(`states the ${coordinate.what} the manifest declares, and no other`,
      function() {
        assert.deepEqual(
          matched(
            coordinate.pattern,
            texts().map((file) => fs.readFileSync(file, 'utf-8')),
          ),
          matched(coordinate.pattern, [coordinate.declares]),
          [
            'this repository states a coordinate of itself that its manifest',
            'declares nowhere, so a reader copies an install line or a link',
            'that leads somewhere else: the URI binding our own XPath',
            'prefix named the owner the organisation move left behind, and',
            'nothing but a reader ever compared the two — while a sweep',
            'gone blind reads as a tree stating no coordinate at all (#337)',
          ].join(' '),
        )
      })
  })
  it('names every package it declares, or says what the package is for',
    function() {
      assert.deepEqual(
        Object.keys(DECLARED)
          .filter((name) => !imported().includes(name))
          .sort(),
        Object.keys(UNIMPORTED).sort(),
        [
          'a declared package is imported by none of this repository\'s own',
          'JavaScript and stands on no list saying what runs it, so it is',
          'either dead weight or a tool nobody has written down — and a',
          'sweep for imports that has gone blind reads exactly the same way',
        ].join(' '),
      )
    })
})
