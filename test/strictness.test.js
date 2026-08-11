/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {insists} = require('./strictness')
const {compiles} = require('../src/xpath')
const {parsed} = require('../src/grammar')
const assert = require('assert')

/**
 * Expressions XPath 1.0 §3.7 spells with whitespace an axis name or a node test
 * may be followed by, each paired with the place that whitespace sits in. Every
 * one is XPath the specification spells, and the engine reads all but one of
 * them glued: it takes `processing-instruction( 'x' )` as it stands. Which is
 * why the rows below claim that the class *names* each of these rather than
 * that the engine refuses each of them — a class is the shape a gap stands in,
 * not a list of what one engine happens to object to.
 * @type {Array.<Array.<string>>}
 */
const SPACED = [
  ['element( a )', 'inside the brackets of a kind test'],
  ['element(a )', 'in front of the bracket a kind test closes'],
  ['attribute( a )', 'inside the brackets of an attribute test'],
  ['element( * )', 'around the wildcard a kind test brackets'],
  ['element(* )', 'in front of the bracket a wildcard test closes'],
  ['attribute( * )', 'around the wildcard an attribute test brackets'],
  ['element( ä )', 'around a name no ASCII letter spells'],
  ['element( a. )', 'behind a dot a name ends with'],
  ['element( a- )', 'behind a hyphen a name ends with'],
  ['processing-instruction( \'x\' )', 'behind the quote a literal ends with'],
  ['document-node( element( a ) )', 'inside the brackets of a nested test'],
  ['. instance of empty-sequence ()', 'in front of a sequence type\'s bracket'],
  ['. instance of item ()', 'in front of an item type\'s bracket'],
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
  ['document-node (element(a))', 'in front of the bracket of a nested test'],
]

/**
 * Expressions carrying the axis XPath 3.0 dropped, which 1.0 and 2.0 define and
 * the engine has no parse for at all, so the gap it stands beside is beside the
 * point. The `-` ones earn their place twice: a `-` continues a name a letter
 * started and subtracts everywhere else, and the axis behind one opens a step,
 * which is what {@link NAMED} is the other half of.
 * @type {Array.<Array.<string>>}
 */
const DROPPED = [
  ['namespace::x', 'standing on its own'],
  ['count(namespace::*)', 'buried in a call'],
  ['1-namespace::x', 'behind a minus that subtracts from a number'],
  ['count(a)-namespace::x', 'behind a minus that subtracts from a call'],
  ['\'s\'-namespace::x', 'behind a minus that subtracts from a string'],
  ['a -namespace::x', 'behind a minus a gap stands in front of'],
  ['-namespace::x', 'behind a minus that is unary'],
  ['1-child ::a', 'behind a minus, in front of a spaced axis'],
  ['count(a)-parent ::b', 'behind a minus subtracting from a call'],
]

/**
 * Expressions whose gap is one of the characters JavaScript counts as
 * whitespace and XML's `S` production does not, each paired with the gap and
 * the place it sits in. ExprWhitespace is those four characters, so a gap
 * spelled with any other is not the engine being strict about anything: no
 * processor reads these, and neither does the lexer, which kinds the character
 * as the nothing it is.
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
 * Expressions whose `-` continues a name rather than subtracting, each paired
 * with the name it continues. No axis opens inside a name, so nothing here is a
 * `namespace::` the engine cannot parse, and telling these from {@link DROPPED}
 * is why the question is asked of the tokens: the lexer has already decided
 * which of the two a `-` is, where a lookbehind would be reading characters
 * about a question that is about tokens.
 * @type {Array.<Array.<string>>}
 */
const NAMED = [
  ['a-namespace::x', 'a-namespace'],
  ['a-child::x', 'a-child'],
]

/**
 * Expressions the engine reads as they stand, gap and all, each paired with
 * what the gap stands between. XPath 2.0 lets ExprWhitespace stand between any
 * two tokens and fontoxpath mostly agrees; it is only a node test and an axis
 * separator it insists on reading glued, so a name that merely looks like one
 * must not be counted — `my:element (a)` is a call, XPath reserving an
 * unprefixed name alone.
 * @type {Array.<Array.<string>>}
 */
const TIGHT = [
  ['count (a)', 'a call and the bracket it opens with'],
  ['my:element (a)', 'a prefixed name and the bracket behind it'],
  ['f(a )', 'an argument and the bracket that closes around it'],
  ['a[b = \'x \']', 'nothing, standing inside a literal'],
  ['1 (: c :) + 2', 'nothing, being a comment between two operands'],
  ['child::a', 'nothing at all'],
]

/**
 * Expressions holding one of those gaps and malformed all the same, each paired
 * with what is wrong. The class names which side of a disagreement the engine
 * stands on and why; it is no oracle of validity, and reading it as one would
 * excuse the very expressions a report exists to name.
 * @type {Array.<Array.<string>>}
 */
const BROKEN = [
  ['child ::', 'an axis that no node test follows'],
  ['parent::node (', 'a node test that never closes'],
  ['count(node ( :) 1 :) )', 'a colon a node test brackets'],
  ['a[text ( :) + :) ]', 'a colon a node test brackets in a predicate'],
]

describe('strictness', function() {
  SPACED.forEach(function([xpath, where]) {
    it(`names the gap ${where}`, function() {
      assert.ok(
        insists(xpath),
        `${xpath} is not accounted for, though XPath spells whitespace ${where}`,
      )
    })
  })
  DROPPED.forEach(function([xpath, where]) {
    it(`names the namespace axis ${where}`, function() {
      assert.ok(
        insists(xpath),
        `${xpath} is not accounted for, though the engine has no such axis`,
      )
    })
  })
  ALIEN.forEach(function([xpath, gap]) {
    it(`cannot name ${gap}`, function() {
      assert.ok(
        !insists(xpath),
        `${gap} is excused, though XPath spells a gap with XML whitespace alone`,
      )
    })
  })
  NAMED.forEach(function([xpath, name]) {
    it(`reads no axis inside the name ${name}`, function() {
      assert.ok(
        !insists(xpath),
        `${xpath} is excused, though ${name} is one name and names no axis`,
      )
    })
  })
  TIGHT.forEach(function([xpath, between]) {
    it(`cannot name a gap between ${between}`, function() {
      assert.ok(
        !insists(xpath),
        `${xpath} is excused, though the engine reads it as it stands`,
      )
    })
  })
  BROKEN.forEach(function([xpath, what]) {
    it(`names the gap of ${what} and excuses nothing`, function() {
      assert.deepEqual(
        [insists(xpath), parsed(xpath, '3.0').fault === ''],
        [true, false],
        `${xpath} carries ${what}, so it is no valid expression`,
      )
    })
  })
  it('cannot read the engine as gluing what it takes as it stands', function() {
    assert.deepEqual(
      TIGHT.filter(([xpath]) => !compiles(xpath))
        .map(([xpath, between]) => `${xpath} (${between})`),
      [],
      'the engine refuses one of these, so it says nothing about a gap the ' +
        'engine allows and the class must leave alone',
    )
  })
  it('cannot name a spelling that is not XPath at all', function() {
    assert.deepEqual(
      SPACED.concat(DROPPED)
        .filter(([xpath]) => parsed(xpath, '3.0').fault !== '')
        .map(([xpath, where]) => `${xpath} (${where})`),
      [],
      'the class holds a spelling our own grammar refuses, so subtracting it ' +
        'from a diff would hide a defect rather than account for the engine',
    )
  })
})
