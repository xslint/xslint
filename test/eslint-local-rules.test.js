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

tester.run(
  'no-redundant-return-variable',
  local.rules['no-redundant-return-variable'],
  {
    valid: [
      'function direct() { return make() }',
      'function used() { const one = make(); use(one); return one }',
      'function other() { const one = make(); return another }',
      'function pair() { const one = make(), two = one; return two }',
    ],
    invalid: [
      {
        code: 'function redundant() { const one = make(); return one }',
        errors: [{messageId: 'redundant'}],
      },
      {
        code: 'function sum() { let total = 1 + 2; return total }',
        errors: [{messageId: 'redundant'}],
      },
    ],
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
