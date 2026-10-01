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
