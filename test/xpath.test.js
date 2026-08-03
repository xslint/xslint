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
  ['child\t::a', 'spelled as the tab it may also be'],
  ['child\n::a', 'spelled as the newline a wrapped attribute puts there'],
  ['child :: *', 'in front of a wildcard node test'],
  ['element (*)', 'in front of the bracket of a wildcard kind test'],
  ['document-node (element(a))', 'in front of the bracket of a nested test'],
]

/**
 * Expressions whose gap is one of the characters JavaScript counts as
 * whitespace and XML's `S` production does not, each paired with the gap and
 * the place it sits in. No name may carry the character either, so the
 * expression is malformed however it is read.
 * @type {Array.<Array.<string>>}
 */
const ALIEN = [
  ['child\u00a0::alpha', 'a no-break space in front of a separator'],
  ['parent::node\u00a0()', 'a no-break space in front of a test bracket'],
  ['namespace\u00a0::x', 'a no-break space in the namespace axis'],
  ['child\u2003::alpha', 'an em space in front of a separator'],
  ['parent::node(\u000b)', 'a vertical tab inside a node test'],
]

/**
 * Expressions no spelling of the grammar reaches, each paired with what makes
 * it broken. The comments among them are the token merges a squeeze must not
 * make: `(:` and `:)` are one token each, so a gap deleted between a bracket
 * and a colon would fabricate a comment and hide the wreckage inside it.
 * @type {Array.<Array.<string>>}
 */
const REFUSED = [
  ['child ::', 'an axis that no node test follows'],
  ['//foo ::bar', 'a name that names no axis'],
  ['parent::node (', 'a node test that never closes'],
  ['a (: b :: )', 'a comment that never closes'],
  ['a ( :: b :)', 'a bracket that never closes'],
  ['a (: b namespace :: )', 'a comment the namespace axis stands in'],
  ['count(node ( :) 1 :) )', 'a colon a node test brackets'],
  ['a[text ( :) + :) ]', 'a colon a node test brackets in a predicate'],
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
  ALIEN.forEach(function([xpath, gap]) {
    it(`cannot accept ${gap}`, function() {
      assert.ok(
        !isValid(xpath),
        `${gap} passes, though XPath spells a gap with XML whitespace alone`,
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
