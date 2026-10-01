/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {RuleTester} = require('eslint')
const path = require('path')
const local = require('../eslint-local-rules')

const tester = new RuleTester({
  languageOptions: {ecmaVersion: 2022, sourceType: 'commonjs'},
})

const caller = path.join(__dirname, 'resources', 'eslint', 'caller.js')

/**
 * The tag a puzzle is written under, assembled rather than spelled, since pdd
 * reads every file of this repository and a literal marker in a docblock is a
 * puzzle to it — one this fixture would then be failed for, having neither the
 * twenty words nor the estimate a real one carries (#832).
 * @type {string}
 */
const marker = `@${'todo'}`

/**
 * The licence header every source file opens with, which a top note follows.
 */
const SPDX = [
  '/*',
  ' * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov',
  ` * ${['SPDX', 'License', 'Identifier'].join('-')}: MIT`,
  ' */',
].join('\n')

/**
 * As many lines of a block comment's prose as asked, each closed by a break.
 * @param {number} count - How many lines
 * @return {string} - The lines
 */
const lines = function(count) {
  return [...Array(count).keys()].map((index) => ` * Line ${index + 7}.\n`).join('')
}

tester.run(
  'no-redundant-return-variable',
  local.rules['no-redundant-return-variable'],
  {
    valid: [
      'function direct() { return make() }',
      'function used() { const one = make(); use(one); return one }',
      'function other() { const one = make(); return another }',
      'function pair() { const one = make(), two = one; return two }',
      'function twice() { const one = make(); other = one; use(one) }',
      'function inner() { const one = make(); other = one.field }',
      'function later() { const one = make(); use(); other = one }',
      'function grown() { const one = make(); other += one }',
      'function loose() { let one = make(); other = one }',
      'function bare() { const one = make(); one }',
      'for (const one of list) { other = one }',
      'function itself() { const one = () => one; other = one }',
      'function nested() { const one = make(); const two = wrap(one) }',
      'const one = make(); module.exports = one; module.exports.one = one',
      'function keyed() { const one = make(); registry[slot()] = one }',
      'function called() { const one = make(); slot().field = one }',
      'function after() { const one = make(); const two = slot(), three = one }',
      'const one = function() {}; module.exports = one',
      'const one = () => 1; registry.field = one',
      'const one = class {}; module.exports = one',
      'const one = make(); module.exports = one',
      'function before() { const one = reset(); registry.field = one }',
      'const one = class Named { static { make() } }; module.exports = one',
      'function both() { const one = make(), two = stuff(); other = one }',
      'function split() { const {one} = make(); other = one }',
      'function empty() { let one; registry.field = one }',
    ],
    invalid: [
      ['redundant', 'function redundant() { const one = make(); return one }'],
      ['redundant', 'function sum() { let total = 1 + 2; return total }'],
      ['carried', 'function moved() { const one = make(); other = one }'],
      ['carried', 'function bound() { const one = make(); const two = one }'],
      ['carried', 'function among() { const one = make(); let two, three = one }'],
      ['carried', 'switch (key) { case 1: const one = make(); other = one }'],
      ['carried', 'class A { static { const one = make(); other = one } }'],
      ['carried', 'const one = function named() {}; module.exports = one'],
      ['carried', 'const one = function a() {}; registry.field.inner = one'],
      ['carried', 'const one = function named() {}; registry[slot()] = one'],
      ['carried', 'const one = function named() {}; slot().field = one'],
    ].map(([messageId, code]) => ({code, errors: [{messageId}]})),
  },
)

tester.run(
  'no-missing-arguments',
  local.rules['no-missing-arguments'],
  {
    valid: [
      'const pair = function(one, two) { return one + two }; pair(1, 2)',
      'const pair = function(one, two = 2) { return one + two }; pair(1)',
      'const pair = function(one, ...rest) { return rest }; pair(1)',
      'const pair = function(one, two) { return two }; pair(...list)',
      'function pair(one, two) { return two } pair(1, 2)',
      'const pair = (one, two) => one + two; pair(1, 2)',
      'const pair = 42; pair(1)',
      'const use = function(fun) { return fun(1) }; use(Math.abs)',
      'const use = function(box) { return box.of(1) }; use(Math)',
      'unknown(1)',
      `const {join} = require('path'); join('one')`,
      {
        code: `const {quartet} = require('./arities'); quartet(1, 2, 3, 4)`,
        filename: caller,
      },
      {
        code: `const {padded} = require('./arities'); padded(1)`,
        filename: caller,
      },
      {
        code: `const {heap} = require('./arities'); heap(1)`,
        filename: caller,
      },
      {
        code: `const {quartet} = require('./nowhere'); quartet(1)`,
        filename: caller,
      },
      {
        code: `const {quartet} = require('./arities'); const shade = function() { const quartet = function(one) { return one }; return quartet(1) }; shade()`,
        filename: caller,
      },
    ],
    invalid: [
      {
        code: 'const pair = function(one, two) { return two }; pair(1)',
        errors: [{messageId: 'missing'}],
      },
      {
        code: 'function pair(one, two) { return two } pair(1)',
        errors: [{messageId: 'missing'}],
      },
      {
        code: 'const pair = (one, two) => one + two; pair()',
        errors: [{messageId: 'missing'}],
      },
      {
        code: `const {quartet} = require('./arities'); quartet(1, 2)`,
        filename: caller,
        errors: [{messageId: 'missing'}],
      },
      {
        code: `const whole = require('./arities'); whole.quartet(1)`,
        filename: caller,
        errors: [{messageId: 'missing'}],
      },
      {
        code: `const {padded} = require('./arities'); padded()`,
        filename: caller,
        errors: [{messageId: 'missing'}],
      },
    ],
  },
)

tester.run(
  'no-orphan-docblock',
  local.rules['no-orphan-docblock'],
  {
    valid: [
      '/** One. */\nconst one = 1',
      '/** One. */\nconst one = 1\n/** Two. */\nconst two = 2',
      '/* Plain. */\n/* Also plain. */\nconst one = 1',
      '/*\n * A licence header, over two lines.\n */\n/** One. */\nconst one = 1',
      '/** One. */\n// a line comment\nconst one = 1',
      '/** Only one. */\nconst one = 1\n// trailing',
      'const one = 1',
    ],
    invalid: [
      {
        code: '/** Orphan. */\n/** Real. */\nconst one = 1',
        errors: [{messageId: 'orphan'}],
      },
      {
        code: '/** One. */\nconst one = 1\n/** Orphan. */\n/** Real. */\nconst two = 2',
        errors: [{messageId: 'orphan'}],
      },
      {
        code: '/** First. */\n/** Second. */\n/** Real. */\nconst one = 1',
        errors: [{messageId: 'orphan'}, {messageId: 'orphan'}],
      },
    ],
  },
)

tester.run(
  'no-multiple-returns',
  local.rules['no-multiple-returns'],
  {
    valid: [
      'function once() { return make() }',
      'function never() { make() }',
      'const brief = (one, two) => one + two',
      'function branched() { let pick; if (one()) { pick = 1 } else { pick = 2 } return pick }',
      'function nested() { const inner = function() { return 1 }; return inner }',
      'function callback() { return list.map(function(item) { return item }) }',
      'function arrows() { return list.map((item) => { return item }) }',
      'const shorthand = {method() { return 1 }, other() { return 2 }}',
      'class Holder { one() { return 1 } two() { return 2 } }',
      'return 1',
    ],
    invalid: [
      {
        code: 'function twice() { if (one()) { return 1 } return 2 }',
        errors: [{messageId: 'multiple'}],
      },
      {
        code: 'function thrice() { if (one()) { return 1 } if (two()) { return 2 } return 3 }',
        errors: [{messageId: 'multiple'}, {messageId: 'multiple'}],
      },
      {
        code: 'const picked = (one) => { if (one) { return 1 } return 2 }',
        errors: [{messageId: 'multiple'}],
      },
      {
        code: 'function bare() { if (one()) { return } return 2 }',
        errors: [{messageId: 'multiple'}],
      },
      {
        code: 'function outer() { const inner = function() { if (one()) { return 1 } return 2 }; return inner }',
        errors: [{messageId: 'multiple'}],
      },
      {
        code: 'function guarded() { for (const one of many()) { if (one) { return one } } return null }',
        errors: [{messageId: 'multiple'}],
      },
    ],
  },
)

tester.run(
  'no-sprawling-docblock',
  local.rules['no-sprawling-docblock'],
  {
    valid: [
      'const one = 1',
      '/** One line. */\nconst one = 1',
      '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n */\nconst one = 1',
      '/**\n * One.\n *\n * Two.\n *\n * Three.\n *\n * Four.\n *\n * Five.\n */\nconst one = 1',
      '/**\n * **One** in bold.\n */\nconst one = 1',
      '/**\n * @param {object} one - Thing\n * @return {boolean} - Verdict\n */\nfunction pair(one) {}',
      '/**\n * One.\n * @param {object} one - A description that\n *  wraps onto a second line and then\n *  onto a third\n */\nfunction pair(one) {}',
      '/*\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n */\nconst one = 1',
      '// One.\n// Two.\n// Three.\n// Four.\n// Five.\n// Six.\nconst one = 1',
      {
        code: '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n * Seven.\n */\nconst one = 1',
        options: [{description: 8}],
      },
      `${SPDX}\n/*\n${lines(10)} */\nconst one = 1`,
      `${SPDX}\n/*\n${lines(5)} *\n${lines(5)} */\nconst one = 1`,
      `const one = 1\n/*\n${lines(12)} */\nconst two = 2`,
      `const one = require('./one')\nconst two = 2\n${'// Line.\n'.repeat(12)}const three = 3`,
      `${SPDX}\n/*\n${lines(10)} */`,
      `#!/usr/bin/env node\n${SPDX}\n/*\n${lines(10)} */\nconst one = 1`,
      `${SPDX}\n/* eslint-disable no-console */\n/*\n${lines(9)} */\nconst one = 1`,
      `${SPDX}\n/*\n${lines(10)} */\n/**\n * One.\n */\nconst one = 1`,
      `${SPDX}\n/*\n${lines(9)} */\n/**\n * One.\n */\n// eslint-disable-next-line no-console\nconsole.log(1)`,
      `${SPDX}\n/*\n${lines(10)} */\n/**\n * One.\n * Two.\n */\nconst fs = require('fs')\nconst one = 1`,
      `${SPDX}\n/* eslint-disable no-console -- The console is output. */\n/*\n${lines(9)} */\nconsole.log(1)`,
      `${SPDX}\n/*\n${lines(8)} */\nconst alpha = require('./alpha') // reads the stylesheets\nconst beta = require('./beta') // reads the stylesheets\nconst gamma = require('./gamma') // reads the stylesheets\nconst one = 1`,
      `${SPDX}\n/*\n${lines(8)} */\nconst {\n  alpha, // the first\n  beta, // the second\n  gamma, // the third\n} = require('./x')\nconst one = 1`,
      {
        code: `${SPDX}\n/*\n${lines(10)} */\n/**\n * One.\n * Two.\n */\nimport {join} from 'path'\nexport const one = join('a')`,
        languageOptions: {sourceType: 'module'},
      },
      {
        code: `${SPDX}\n/*\n${lines(8)} */\nimport alpha from './alpha.js' // reads the stylesheets\nimport {beta} from './beta.js' // reads the stylesheets\nimport * as gamma from './gamma.js' // reads the stylesheets\nexport const one = [alpha, beta, gamma]`,
        languageOptions: {sourceType: 'module'},
      },
      `// ${['SPDX', 'FileCopyrightText'].join('-')}: Copyright (c) 2025-2026 Max Trunnikov\n// ${['SPDX', 'License', 'Identifier'].join('-')}: MIT\n/*\n${lines(10)} */\nconst one = 1`,
      {
        code: `${SPDX}\n/*\n${lines(12)} */\nconst one = 1`,
        options: [{top: 12}],
      },
      {
        code: '/**\n * One.\n * @param {object} one - A description that\n *  wraps once\n */\nfunction pair(one) {}',
        options: [{tag: 2}],
      },
    ],
    invalid: [
      {
        code: '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n */\nconst one = 1',
        errors: [{messageId: 'sprawling', line: 7}],
      },
      {
        code: `${SPDX}\n/*\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 16, data: {max: 10, spent: 11}}],
      },
      {
        code: `/*\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 12, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n/*\n${lines(4)} */\n/*\n${lines(7)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 18, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\nconst one = require('./one')\n/*\n${lines(11)} */\nconst two = 2`,
        errors: [{messageId: 'noted', line: 17, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'// Line.\n'.repeat(11)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX.slice(0, -4)}\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 14, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX.split('\n').slice(0, 2).join('\n')}\n${` * ${['SPDX', 'FileCopyrightText'].join('-')}: why the walk is paid once\n`.repeat(40)}${SPDX.split('\n').slice(2).join('\n')}\nconst one = 1`,
        errors: [{messageId: 'noted', line: 13, data: {max: 10, spent: 40}}],
      },
      {
        code: `${SPDX}\n'use strict'\n/*\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 17, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n/**\n * One.\n * Two.\n */\n/*\n${lines(10)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 18, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* eslint-local-rules.js holds what this reads.\n${lines(10)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n// eslint-config-google says so.\n${'// Line.\n'.repeat(10)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n/* eslint-disable no-console -- The console is output.\n${lines(11)} */\nconsole.log(1)`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* eslint-disable no-console\u00A0--\u00A0The console is output.\n${lines(11)} */\nconsole.log(1)`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* exported\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* global\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* globals\n${lines(11)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 12}}],
      },
      {
        code: `${SPDX}\n/* eslint-disable no-console */\n/*\n${lines(10)} */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 16, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n/*\n${lines(10)} */\n/**\n * One.\n */\n// eslint-disable-next-line no-console\nconsole.log(1)`,
        errors: [{messageId: 'noted', line: 20, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'/* exported the walk is paid once for every stylesheet */\n'.repeat(11)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'/* exported a derivation line that answers why */\n'.repeat(40)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 40}}],
      },
      {
        code: `${SPDX}\n${['no-debugger', 'no-alert', 'no-eval', 'no-with', 'no-proto', 'no-caller', 'no-iterator', 'no-octal', 'no-new-func', 'no-script-url', 'no-void'].map((rule) => `/* eslint ${rule}: "error" -- why the walk is paid once */\n`).join('')}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'// SPDX-Note: the walk is paid once for every stylesheet it reads.\n'.repeat(11)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n/*\n${lines(9)} * ${['SPDX', 'FileCopyrightText'].join('-')}: the walk is paid once\n * ${['SPDX', 'License', 'Identifier'].join('-')}: MIT\n */\nconst one = 1`,
        errors: [{messageId: 'noted', line: 16, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'\'use strict\' // a derivation line that answers why\n'.repeat(40)}const one = 1`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 40}}],
      },
      {
        code: `${SPDX}\n${`/**\n${lines(5)} */\n'use strict'\n`.repeat(8)}const one = 1`,
        errors: [{messageId: 'noted', line: 22, data: {max: 10, spent: 40}}],
      },
      {
        code: `${SPDX}\n${'// eslint-disable-next-line no-console -- the console is output\n'.repeat(11)}console.log(1)`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${'/* global alpha -- bound by the page that loads this */\n'.repeat(11)}const one = alpha`,
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 11}}],
      },
      {
        code: `${SPDX}\n${['fs', 'path', 'os', 'url', 'util', 'events', 'stream', 'crypto', 'http', 'https', 'net', 'tls', 'zlib'].map((name) => `import '${name}' // a derivation line that answers why\n`).join('')}export const one = 1`,
        languageOptions: {sourceType: 'module'},
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 13}}],
      },
      {
        code: `${SPDX}\n${['fs', 'path', 'os', 'url', 'util', 'events', 'stream', 'crypto', 'http', 'https', 'net', 'tls', 'zlib'].map((name) => `/**\n${lines(3)} */\nimport '${name}'\n`).join('')}export const one = 1`,
        languageOptions: {sourceType: 'module'},
        errors: [{messageId: 'noted', line: 25, data: {max: 10, spent: 39}}],
      },
      {
        code: `${SPDX}\n${Array.from(Array(13).keys(), (index) => `import './version.js?${index}' // a derivation line that answers why\n`).join('')}export const one = 1`,
        languageOptions: {sourceType: 'module'},
        errors: [{messageId: 'noted', line: 15, data: {max: 10, spent: 13}}],
      },
      {
        code: `${SPDX}\n/*\n${lines(4)} */`,
        options: [{top: 3}],
        errors: [{messageId: 'noted', line: 9, data: {max: 3, spent: 4}}],
      },
      {
        code: '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n */\nconst one = 1\n/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n */\nconst two = 2',
        errors: [
          {messageId: 'sprawling', line: 7},
          {messageId: 'sprawling', line: 16},
        ],
      },
      {
        code: '/**\n * One.\n * Two.\n * Three.\n */\nconst one = 1',
        options: [{description: 2}],
        errors: [{messageId: 'sprawling', line: 4}],
      },
      {
        code: '/**\n * One.\n * @param {object} one - A description that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n */\nfunction pair(one) {}',
        errors: [{messageId: 'wordy', line: 6}],
      },
      {
        code: '/**\n * One.\n * @param {object} one - A description that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n * @return {boolean} - A verdict that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n */\nfunction pair(one) {}',
        errors: [
          {messageId: 'wordy', line: 6},
          {messageId: 'wordy', line: 10},
        ],
      },
      {
        code: '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * Six.\n * @param {object} one - A description that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n */\nfunction pair(one) {}',
        errors: [
          {messageId: 'sprawling', line: 7},
          {messageId: 'wordy', line: 11},
        ],
      },
      {
        code: '/**\n * One.\n * Two.\n * Three.\n * Four.\n * Five.\n * @select is prose naming an attribute rather\n *  than a tag opening an entry, and it wraps\n *  onto a third line\n */\nconst one = 1',
        errors: [{messageId: 'sprawling', line: 7}],
      },
      {
        code: '/**\n * One.\n * Two.\n * @name0 is prose.\n * Four.\n * Five.\n * @name1 is prose.\n * Seven.\n * Eight.\n * @name2 is prose.\n * Ten.\n */\nconst one = 1',
        errors: [{messageId: 'sprawling', line: 7}],
      },
      {
        code: `/**\n * One.\n * @type {{one: number, two: string, three: boolean}} - A shape\n *  that wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n * ${marker} A note that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n * @throws {Error} - A failure that\n *  wraps onto a second line and then\n *  onto a third and then\n *  onto a fourth\n */\nconst one = 1`,
        errors: [
          {messageId: 'wordy', line: 6},
          {messageId: 'wordy', line: 10},
          {messageId: 'wordy', line: 14},
        ],
      },
    ],
  },
)

tester.run(
  'no-wrapped-concatenation',
  local.rules['no-wrapped-concatenation'],
  {
    valid: [
      `const one = 'alpha' + beta`,
      'const one = `alpha ${beta}` + gamma + \'delta\'',
      'const one = [\n  \'alpha\',\n  `beta ${gamma}`,\n].join(\' \')',
      'const one = first +\n  second',
      'const one = 1 +\n  2',
      'let one = \'\'\none +=\n  \'alpha\'',
      'const one = use(\n  \'alpha\',\n  beta,\n) + \'gamma\'',
    ],
    invalid: [
      {
        code: 'const one = \'alpha \' +\n  \'beta\'',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'const one = `alpha ${beta} ` +\n  `gamma`',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'const one = first +\n  \'-\' + second',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'const one = \'alpha\' + first + second +\n  third',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'const one = \'alpha\'\n  + \'beta\'\n  + \'gamma\'',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'const one = \'alpha\' + (\n  first +\n  second\n)',
        errors: [{messageId: 'wrapped', line: 1}],
      },
      {
        code: 'use(\'alpha \' +\n  \'beta\', \'gamma \' +\n  \'delta\')',
        errors: [
          {messageId: 'wrapped', line: 1},
          {messageId: 'wrapped', line: 2},
        ],
      },
    ],
  },
)
