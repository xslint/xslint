/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {enclosed} = require('../src/expressions')
const assert = require('assert')

/**
 * Attribute values paired with the expressions their braces enclose, each
 * expected as `[offset, expression]`.
 * @type {Array.<{name: string, value: string,
 *  found: Array.<[number, string]>}>}
 */
const TEMPLATES = [
  {
    name: 'encloses a whole value written as one expression',
    value: '{count(item) = 0}',
    found: [[1, 'count(item) = 0']],
  },
  {
    name: 'encloses three expressions among literal text',
    value: 'a{$x}b{$y}c{$z}',
    found: [[2, '$x'], [7, '$y'], [12, '$z']],
  },
  {
    name: 'keeps a brace inside a string literal out of an expression',
    value: 'x{concat("}", $y)}z',
    found: [[2, 'concat("}", $y)']],
  },
  {
    name: 'balances the braces a map constructor opens',
    value: '{map{"a": 1}("a")}',
    found: [[1, 'map{"a": 1}("a")']],
  },
  {
    name: 'reads a doubled brace as an escaped one',
    value: '{{count(item) = 0}}',
    found: [],
  },
  {
    name: 'encloses an expression standing after an escaped brace',
    value: '{{literal}} {$x}',
    found: [[13, '$x']],
  },
  {
    name: 'encloses nothing when a brace never closes',
    value: 'a{count(item) = 0',
    found: [],
  },
  {
    name: 'encloses nothing in a value carrying no brace',
    value: 'plain output text',
    found: [],
  },
]

describe('expressions', function() {
  TEMPLATES.forEach(({name, value, found}) => {
    it(name, function() {
      assert.deepEqual(
        enclosed(value).map(
          (expression) => [expression.offset, expression.value],
        ),
        found,
        `cannot enclose the expressions of "${value}"`,
      )
    })
  })
})
