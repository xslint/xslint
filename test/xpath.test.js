/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {isValid, squeezed} = require('../src/xpath')
const {tokenized, TOKENS} = require('../src/tokens')
const assert = require('assert')

/**
 * Expressions XPath 1.0 §3.7 spells with whitespace an axis name or a node
 * test may be followed by, each paired with the place that whitespace sits in.
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
 * Expressions whose axis stands behind a `-`, each paired with what the `-`
 * subtracts from. A `-` continues a name a letter started and is the operator
 * everywhere else, so the axis behind one opens a step and must be respelled
 * like any other. The pair below them is the name the same characters spell
 * when a letter does start the run.
 * @type {Array.<Array.<string>>}
 */
const OPERATED = [
  ['1-namespace::x', 'a number'],
  ['count(a)-namespace::x', 'a call'],
  ['\'s\'-namespace::x', 'a string'],
  ['a -namespace::x', 'a name a gap stands behind'],
  ['-namespace::x', 'nothing, being unary'],
  ['1-child ::a', 'a number, in front of a spaced axis'],
  ['count(a)-parent ::b', 'a call, in front of a spaced axis'],
]

/**
 * Expressions whose `-` continues a name rather than subtracting, each paired
 * with the name it continues. No axis opens inside a name, so none of these is
 * respelled and the engine's refusal stands.
 * @type {Array.<Array.<string>>}
 */
const NAMED = [
  ['a-namespace::x', 'a-namespace'],
  ['a-child::x', 'a-child'],
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
  ['a (: b : )', 'a comment one colon away from closing'],
  ['a (: b :: )', 'a comment that never closes'],
  ['a ( :: b :)', 'a bracket that never closes'],
  ['a (: b namespace :: )', 'a comment the namespace axis stands in'],
  ['count(node ( :) 1 :) )', 'a colon a node test brackets'],
  ['a[text ( :) + :) ]', 'a colon a node test brackets in a predicate'],
]

/**
 * The kinds an expression is made of, in order, with the gaps dropped and the
 * namespace axis answering as the axis it becomes. Rewriting `namespace::` to
 * `child::` is the one retyping a squeeze does on purpose, the engine having no
 * parse for the axis 3.0 dropped, so it is normalised away and every other
 * change of kind is an accident.
 *
 * Kinds rather than only the comment and string among them, because a squeeze
 * does not have to fabricate a delimiter to do harm. One that merged two names
 * across a gap would leave every delimiter where it stood and still hand the
 * engine something else to read — `a b` as `ab`, `child a` as `childa`, each of
 * which compiles — and the whole of that class is invisible to a property that
 * watches the delimiters alone.
 * @param {string} xpath - Xpath expression
 * @return {string} - The kinds, joined
 */
const kinds = function(xpath) {
  return tokenized(xpath)
    .filter((token) => token.type !== TOKENS.WHITESPACE)
    .map((token) => {
      let kind = token.type
      if (kind === TOKENS.NAMESPACE) {
        kind = TOKENS.CHILD
      }
      return kind
    })
    .join(' | ')
}

/**
 * Every piece the fabrications #641 reported are spelled from: the brackets a
 * comment delimiter is half of, the colon that is its other half, the separator
 * a step carries, a gap, the names a squeeze opens on, and the quote a literal
 * opens with.
 *
 * `namespace` earns its place twice over. It is the axis the retry was built
 * for in the first place, the one the engine has no parse for at all, and it is
 * the only atom that makes the normalisation in `kinds` fire — without it no
 * swept expression holds the token, so the line reading `namespace::` as the
 * `child::` it becomes would be decoration rather than a claim, and the oldest
 * of the three squeezes would be swept no times at all.
 * @type {Array.<string>}
 */
const ATOMS = [
  '(', ')', ':', '::', ' ', 'a', 'child', 'node', '*', '\'', 'namespace',
]

/**
 * Every sequence of exactly that many atoms.
 * @param {number} depth - How many atoms each sequence holds
 * @return {Array.<string>} - The sequences
 */
const grown = function(depth) {
  let sequences = ['']
  for (let step = 0; step < depth; step++) {
    sequences = sequences.flatMap((one) => ATOMS.map((atom) => one + atom))
  }
  return sequences
}

/**
 * Every sequence of up to four atoms, which is sixteen thousand expressions and
 * a moment to sweep. Four is where the reach is: the shortest fabrication the
 * report names is `( ::`, three atoms, and against the retry as it stood when
 * #641 was filed a fourth atom takes the offenders from two to fifty — enough
 * margin that a squeeze which started merging again is caught by the general
 * case rather than by whichever example somebody thought to add.
 *
 * A fifth atom is not swept, which is worth a sentence rather than a silence.
 * It used to break on eight of the hundred and sixty thousand, every one of
 * them a pair of axes like `child:: child::` or `namespace ::child::`, where
 * the lexer opened a second axis behind a separator that admits a node test and
 * nothing else — a defect in the lexer rather than anything the retry does, so
 * sweeping deeper would have pinned it inside a test about the respelling.
 * #709 closed it and all eight now sweep clean.
 *
 * What keeps the fifth atom out is cost rather than a defect: it is a hundred
 * and sixty thousand expressions against fourteen thousand, three quarters of a
 * second against a twentieth, and it would double the half of the suite meant
 * to answer inside one. Four already carries the proof, and the family a fifth
 * atom reached is the one family that can no longer arise.
 * @type {Array.<string>}
 */
const SWEPT = [1, 2, 3, 4].flatMap((depth) => grown(depth))

/**
 * One expression per squeeze, each paired with the gap that squeeze closes.
 * The sweep proves the retry changes no kind, which is worth nothing about a
 * squeeze it never reaches, and the atoms it reaches with are a list somebody
 * may shorten: `namespace` was missing until review noticed the normalisation
 * beside it could not fire, and the count of respelled expressions stayed
 * healthy throughout, so nothing here said so.
 *
 * A row is spelled out rather than derived, because what a squeeze matches is
 * `src/xpath.js`'s to say and a second copy of it here is the drift #664 is
 * about. Each must be a sequence the sweep generates and one the retry
 * rewrites, which is what pins the atoms: `node (a` holds the only atom that
 * exercises a node test, `(a )` the only one that exercises a closing bracket,
 * and no token kind tells either of them from an ordinary name.
 * @type {Array.<Array.<string>>}
 */
const REWRITTEN = [
  ['namespace::a', 'the axis the engine has no parse for'],
  ['child ::a', 'an axis spaced from its separator'],
  ['node (a', 'a node test spaced from its bracket'],
  ['(a )', 'a gap in front of the bracket it closes'],
]

/**
 * The kinds the sweep must be able to see, as opposed to rewrite. A merge that
 * spelled one of them out of a gap is the harm #641 reported, so a sweep that
 * cannot hold either in the first place would answer about nothing. They are
 * read as raw token types rather than through `kinds`, since that normalises a
 * kind away and a guard asking a normalised stream whether a kind is reachable
 * would be answering about its own arithmetic.
 * @type {Array.<string>}
 */
const SEEN = [TOKENS.COMMENT, TOKENS.STRING]

describe('xpath', function() {
  it('cannot change the kinds an expression is made of', function() {
    assert.deepEqual(
      SWEPT.filter((one) => kinds(one) !== kinds(squeezed(one))),
      [],
      'a respelling retyped a token, so the engine reads something else',
    )
  })
  it('cannot answer from a sweep no respelling reaches', function() {
    assert.notDeepEqual(
      SWEPT.filter((one) => squeezed(one) !== one),
      [],
      'nothing swept is respelled, so it says nothing about respelling',
    )
  })
  it('cannot leave a squeeze nothing in the sweep to rewrite', function() {
    assert.deepEqual(
      REWRITTEN.filter(
        ([one]) => !SWEPT.includes(one) || squeezed(one) === one,
      ).map(([one, gap]) => `${one} (${gap})`),
      [],
      'a squeeze has no expression in the sweep, so it is swept no times',
    )
  })
  it('cannot leave the sweep blind to a kind it answers about', function() {
    assert.deepEqual(
      SEEN.filter((kind) => !SWEPT.some(
        (one) => tokenized(one).some((token) => token.type === kind),
      )),
      [],
      'no expression swept holds a kind the sweep claims to speak for',
    )
  })
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
  OPERATED.forEach(function([xpath, from]) {
    it(`accepts an axis behind a minus that subtracts from ${from}`, function() {
      assert.ok(
        isValid(xpath),
        `${xpath} is refused, though its minus subtracts from ${from}`,
      )
    })
  })
  NAMED.forEach(function([xpath, name]) {
    it(`reads no axis inside the name ${name}`, function() {
      assert.ok(
        !isValid(xpath),
        `${xpath} passes, though ${name} is one name and names no axis`,
      )
    })
  })
})
