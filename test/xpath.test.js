/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {isValid} = require('../src/xpath')
const assert = require('assert')

/**
 * Expressions XPath 1.0 §3.7 spells with whitespace an axis name or a node
 * test may be followed by, each paired with the place that whitespace sits in.
 * @type {Array.<Array.<string>>}
 */
const SPACED = [
  ['child ::a', 'in front of an axis separator'],
  ['child:: a', 'behind an axis separator'],
  ['child  ::  a', 'on both sides of an axis separator'],
  ['a[child :: b]', 'around an axis separator inside a predicate'],
  ['descendant ::b/child ::c/parent ::d', 'around every separator of a path'],
  ['namespace :: *', 'around the separator of the namespace axis'],
  ['count(//a[parent :: b]) = 1', 'around a separator buried in a call'],
  ['parent::node ()', 'in front of the bracket of a node test'],
  ['parent::node( )', 'inside an empty node test'],
  ['parent::node ( )', 'on both sides of the bracket of an empty node test'],
  ['a/text ()[1]', 'in front of the bracket of a text test'],
  ['comment ()|child::comment ()', 'in front of every comment test'],
  ['processing-instruction (\'x\')', 'in front of the bracket of a named test'],
  ['child::namespace-node ()', 'in front of the bracket of a namespace test'],
  ['. instance of node ()', 'in front of a node test in a sequence type'],
  ['self :: node ()', 'around both a separator and the bracket after it'],
]

/**
 * Expressions no spelling of the grammar reaches, each paired with what makes
 * it broken.
 * @type {Array.<Array.<string>>}
 */
const REFUSED = [
  ['child ::', 'an axis that no node test follows'],
  ['//foo ::bar', 'a name that names no axis'],
  ['parent::node (', 'a node test that never closes'],
]

describe('xpath', function() {
  it('accepts a syntactically valid expression', function() {
    assert.ok(isValid('count(//o) = 2'))
  })
  it('rejects a syntactically invalid expression', function() {
    assert.ok(!isValid('1 +'))
  })
  it('resolves a standard namespace prefix', function() {
    assert.ok(isValid('xsl:thing'))
  })
  it('resolves a non-standard namespace prefix rather than failing', function() {
    assert.ok(isValid('zq:thing'))
  })
  SPACED.forEach(function([xpath, where]) {
    it(`accepts whitespace ${where}`, function() {
      assert.ok(
        isValid(xpath),
        `${xpath} is refused, though XPath spells whitespace ${where}`,
      )
    })
  })
  REFUSED.forEach(function([xpath, what]) {
    it(`cannot accept ${what}`, function() {
      assert.ok(
        !isValid(xpath),
        `${xpath} passes, though it carries ${what}`,
      )
    })
  })
})
