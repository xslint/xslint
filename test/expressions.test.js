/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {enclosed, lone} = require('../src/expressions')
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

/**
 * The text between a call's brackets, paired with whether exactly one argument
 * stands there. A comma nested inside a call, a predicate or a map constructor
 * separates nothing at this level; one inside a literal never arrives, the text
 * reaching `lone` already blanked.
 * @type {Array.<{name: string, inner: string, alone: boolean}>}
 */
const ARGUMENTS = [
  {name: 'counts a plain argument', inner: 'x', alone: true},
  {name: 'counts a path as one argument', inner: 'a/b/c', alone: true},
  {name: 'counts an argument a gap pads', inner: ' x ', alone: true},
  {name: 'counts nothing where nothing stands', inner: '', alone: false},
  {name: 'counts nothing in a bracket holding a gap', inner: '  ', alone: false},
  {name: 'counts two arguments as more than one', inner: 'a, b', alone: false},
  {name: 'counts three arguments as more than one', inner: 'a,b,c', alone: false},
  {
    name: 'counts a comma inside a nested call as no separator',
    inner: 'concat(@a, @b)',
    alone: true,
  },
  {
    name: 'counts a comma inside a predicate as no separator',
    inner: 'a[substring(@x, 2) = "y"]',
    alone: true,
  },
  {
    name: 'counts a comma inside a map constructor as no separator',
    inner: 'map{"a": 1, "b": 2}',
    alone: true,
  },
  {
    name: 'counts a separator standing past a nested call',
    inner: 'concat(@a, @b), @c',
    alone: false,
  },
  {
    name: 'counts a separator standing in front of a nested call',
    inner: '@c, concat(@a, @b)',
    alone: false,
  },
  {
    name: 'counts a literal as the one argument it is',
    inner: `'abc'`,
    alone: true,
  },
  {
    name: 'counts an empty literal as an argument all the same',
    inner: `''`,
    alone: true,
  },
  {
    name: 'counts a comma inside a literal as no separator',
    inner: `'a, b'`,
    alone: true,
  },
  {
    name: 'counts nothing in a bracket holding only a comment',
    inner: '(: why :)',
    alone: false,
  },
  {
    name: 'counts a literal standing behind a comment',
    inner: `(: why :) 'a'`,
    alone: true,
  },
  {
    name: 'counts a comma inside a comment as no separator',
    inner: 'concat(@a) (: , :)',
    alone: true,
  },
]

/**
 * Where `lone` is narrower than XPath is, pinned so that closing the gap turns
 * these red and a new one does too — the way `GAPS` pins the grammar's own
 * disagreements in `test/grammar-corpus.test.js`. A binding clause puts its
 * commas at bracket depth zero inside *one* argument, so they read as
 * separators and the three checks fall silent on a construct that was reported
 * and fixed correctly before. The real rule is that a comma in front of
 * `return` or `satisfies` binds while one behind it separates — two arguments
 * really do stand in `f(for $x in a return $x, b)` — which a bracket count
 * cannot tell apart and a
 * grammar can, so it waits for the tree rather than for more counting (#644,
 * Phase 4). The direction is the safe one: a report withheld, never a bad fix.
 * @type {Array.<string>}
 */
const BINDINGS = [
  'for $x in a, $y in b return $x',
  'let $x := a, $y := b return $x',
  'some $x in a, $y in b satisfies $x',
  'every $x in a, $y in b satisfies $x',
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
  ARGUMENTS.forEach(({name, inner, alone}) => {
    it(name, function() {
      assert.equal(
        lone(inner),
        alone,
        `cannot count the arguments standing in "${inner}"`,
      )
    })
  })
  it('reads a binding clause as more than one argument, narrowly', function() {
    assert.deepEqual(
      BINDINGS.filter((one) => lone(one)),
      [],
      'a binding clause is no longer miscounted, so these rows have earned ' +
        'their place in ARGUMENTS and this gap is closed',
    )
  })
})
