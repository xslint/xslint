/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {matched} = require('../src/grammar')
const assert = require('assert')

/**
 * The XSLT versions every row is asked of.
 * @type {Array.<string>}
 */
const VERSIONS = ['1.0', '2.0', '3.0']

/**
 * Patterns XSLT admits, each with the kind its tree comes out rooted at. A
 * pattern is a union of paths, so a lone branch stays a `branch` and only a
 * real union is a `pattern`.
 * @type {Array.<{xpath: string, kind: string}>}
 */
const ACCEPTS = [
  {xpath: 'para', kind: 'branch'},
  {xpath: '*', kind: 'branch'},
  {xpath: '/', kind: 'branch'},
  {xpath: '/para', kind: 'branch'},
  {xpath: '/chapter/para', kind: 'branch'},
  {xpath: '//para', kind: 'branch'},
  {xpath: 'chapter/para', kind: 'branch'},
  {xpath: 'chapter//para', kind: 'branch'},
  {xpath: '@id', kind: 'branch'},
  {xpath: 'child::para', kind: 'branch'},
  {xpath: 'attribute::id', kind: 'branch'},
  {xpath: 'text()', kind: 'branch'},
  {xpath: 'node()', kind: 'branch'},
  {xpath: 'processing-instruction("x")', kind: 'branch'},
  {xpath: 'xsl:template', kind: 'branch'},
  {xpath: 'a:*', kind: 'branch'},
  {xpath: 'para[1]', kind: 'branch'},
  {xpath: 'para[@class = "note"]', kind: 'branch'},
  {xpath: 'chapter//para[position() = 1][@id]', kind: 'branch'},
  {xpath: 'id("intro")', kind: 'branch'},
  {xpath: 'key("k", "v")', kind: 'branch'},
  {xpath: 'id("intro")/para', kind: 'branch'},
  {xpath: 'key("k", "v")//para', kind: 'branch'},
  {xpath: 'para | note', kind: 'pattern'},
  {xpath: 'a | b | c', kind: 'pattern'},
  {xpath: '/ | //para', kind: 'pattern'},
  {xpath: 'para|note', kind: 'pattern'},
  {xpath: 'para union note', kind: 'pattern'},
  {xpath: '(self::node())', kind: 'branch'},
  {xpath: '(a | b)/c', kind: 'branch'},
  {xpath: 'a/(b | c)', kind: 'branch'},
  {xpath: 'a//(b | c)[1]', kind: 'branch'},
  {xpath: '(a)', kind: 'branch'},
  {xpath: '(a[1])/b', kind: 'branch'},
  {xpath: '(a | b)[1]', kind: 'branch'},
  {xpath: 'b/.', kind: 'branch'},
  {xpath: '/.', kind: 'branch'},
  {xpath: '//.', kind: 'branch'},
  {xpath: '/(a | b)', kind: 'branch'},
  {xpath: 'a intersect b', kind: 'crossing'},
  {xpath: 'a except b', kind: 'crossing'},
  {xpath: 'a except b except c', kind: 'crossing'},
  {xpath: 'a intersect b | c', kind: 'pattern'},
  {xpath: '$para', kind: 'branch'},
  {xpath: '$para/note', kind: 'branch'},
  {xpath: 'doc("u.xml")/a', kind: 'branch'},
  {xpath: 'root()/a', kind: 'branch'},
  {xpath: 'root()//a', kind: 'branch'},
  {xpath: 'element-with-id("x")', kind: 'branch'},
  {xpath: '.', kind: 'branch'},
  {xpath: '.[@x]', kind: 'branch'},
  {xpath: '  para  ', kind: 'branch'},
  {xpath: '(: why :) para', kind: 'branch'},
]

/**
 * Pattern productions XSLT 3.0 introduced, when it rewrote the pattern grammar
 * around the expression one. A gate is a lower bound, so each row proves both
 * halves: admitted where it belongs, refused where the version does not have
 * it. Reading a 3.0 pattern under 1.0 would report a stylesheet as valid that
 * no processor loads.
 * @type {Array.<{xpath: string, floor: string, below: string}>}
 */
const GATED = [
  {xpath: 'a intersect b', floor: '3.0', below: '2.0'},
  {xpath: 'a except b', floor: '3.0', below: '2.0'},
  {xpath: 'para union note', floor: '3.0', below: '2.0'},
  {xpath: '$para', floor: '3.0', below: '2.0'},
  {xpath: '$para/note', floor: '3.0', below: '2.0'},
  {xpath: 'doc("u.xml")/a', floor: '3.0', below: '2.0'},
  {xpath: 'root()/a', floor: '3.0', below: '2.0'},
  {xpath: 'element-with-id("x")', floor: '3.0', below: '2.0'},
  {xpath: '(self::node())', floor: '3.0', below: '2.0'},
  {xpath: '(a | b)/c', floor: '3.0', below: '2.0'},
  {xpath: 'a/(b | c)', floor: '3.0', below: '2.0'},
  {xpath: '.', floor: '3.0', below: '2.0'},
  {xpath: '.[@x]', floor: '3.0', below: '2.0'},
]

/**
 * Steps a pattern may not spell, each naming the versions that do admit it. A
 * pattern is matched by walking *up* from a node rather than evaluated
 * forwards, so an axis such a walk cannot answer is a static error and not an
 * empty match. The four reverse axes, `following`, `following-sibling` and
 * `preceding-sibling` are refused everywhere, and `..` with them; `self`,
 * `descendant`, `descendant-or-self` and `namespace` are 3.0's `ForwardAxisP`
 * widening the `ChildOrAttributeAxisSpecifier` of 1.0 and 2.0, and `.` spells a
 * step from 3.0 alone.
 *
 * Two arbiters were needed and neither would have done on its own. SaxonJ-HE
 * settles what 3.0 refuses — 12.5 and 13.0 agree, XTSE0340 — but it applies its
 * own 3.0 pattern syntax whatever the stylesheet declares, admitting `self::a`
 * and `.` at `version="1.0"` where the older grammar has neither, so it cannot
 * say what an earlier version refuses. xsltproc answers that half by being 1.0
 * only. A processor shows that a construct is admitted somewhere; only a
 * version-aware one shows that a version refuses it.
 * @type {Array.<{xpath: string, name: string, admits: Array.<string>}>}
 */
const TRODDEN = [
  {xpath: 'ancestor::para', name: 'a reverse axis', admits: []},
  {xpath: 'ancestor-or-self::para', name: 'a reverse axis with self',
    admits: []},
  {xpath: 'following::para', name: 'a forward axis no walk answers',
    admits: []},
  {xpath: 'following-sibling::para', name: 'a following sibling', admits: []},
  {xpath: 'preceding::para', name: 'a backward axis', admits: []},
  {xpath: 'preceding-sibling::para', name: 'a preceding sibling', admits: []},
  {xpath: 'parent::para', name: 'the parent axis', admits: []},
  {xpath: 'chapter//ancestor::para', name: 'a reverse axis buried in a path',
    admits: []},
  {xpath: 'chapter | ancestor::para', name: 'a reverse axis in a branch',
    admits: []},
  {xpath: 'chapter/..', name: 'a parent step', admits: []},
  {xpath: '..', name: 'a parent step standing alone', admits: []},
  {xpath: 'self::para', name: 'the self axis', admits: ['3.0']},
  {xpath: 'descendant::para', name: 'the descendant axis', admits: ['3.0']},
  {xpath: 'descendant-or-self::para', name: 'descendant or self',
    admits: ['3.0']},
  {xpath: 'namespace::para', name: 'the namespace axis', admits: ['3.0']},
  {xpath: 'chapter | self::para', name: 'a widened axis in a branch',
    admits: ['3.0']},
  {xpath: 'chapter/.', name: 'a context step', admits: ['3.0']},
]

/**
 * Text that is a fine XPath expression and no pattern, because of *where* it
 * stands rather than what it is. A bracket holds a `Pattern`, not whatever an
 * expression may hold, and `.` is the whole of `PredicatePattern` rather than a
 * branch of a union or the step a path opens with — though it is a step once a
 * separator stands in front of it, so `b/.` and `//.` are patterns while
 * `(.)` and `a | .` are not.
 *
 * Every row was arbitrated against SaxonJ-HE 13.0 at 3.0 and xsltproc at 1.0,
 * and the neighbours in {@link ACCEPTS} with it: taking a bracket to hold a
 * pattern is worth nothing if it stops holding `(a | b)/c`.
 * @type {Array.<{name: string, xpath: string}>}
 */
const MISPLACED = [
  {name: 'a sum in a bracket', xpath: '(1 + 1)/a'},
  {name: 'a comparison in a bracket', xpath: '(a = b)/c'},
  {name: 'a literal in a bracket', xpath: '("s")/a'},
  {name: 'a sequence in a bracket', xpath: '(a, b)/c'},
  {name: 'a context item in a bracket', xpath: '(.)'},
  {name: 'a bracketed context item opening a path', xpath: '(.)/a'},
  {name: 'a bracketed context item behind a step', xpath: 'a/(.)'},
  {name: 'a context item as the second branch', xpath: 'a | .'},
  {name: 'a context item as the first branch', xpath: '. | a'},
  {name: 'a context item as either branch', xpath: '. | .'},
  {name: 'a filtered context item in a union', xpath: '.[@x] | a'},
  {name: 'a sum buried in a bracketed branch', xpath: 'a/(b | 1 + 1)'},
]

/**
 * Text the pattern grammar refuses, with the offset the complaint points at.
 * Three of them are perfectly good *expressions*, which is the whole reason a
 * pattern needs a grammar of its own rather than a second reading of the
 * expression one.
 * @type {Array.<{name: string, xpath: string, at: number}>}
 */
const REFUSES = [
  {name: 'a predicate that never closes', xpath: 'foo[', at: 4},
  {name: 'a bracket that never closes', xpath: 'id("intro"', at: 10},
  {name: 'a step that names no test', xpath: 'chapter/', at: 8},
  {name: 'a union with nothing behind it', xpath: 'para |', at: 6},
  {name: 'a sum, which is no pattern at all', xpath: '1 + 1', at: 0},
  {name: 'a comparison, which selects nothing', xpath: '@a = "b"', at: 3},
  {name: 'a call that anchors nothing', xpath: 'concat("a")', at: 6},
  {name: 'a sequence, which is no pattern', xpath: 'a, b', at: 1},
  {name: 'a descent that reaches no step', xpath: '//', at: 2},
  {name: 'a descent that reaches no step in a union', xpath: '// | a', at: 3},
  {name: 'nothing at all', xpath: '', at: 0},
  {name: 'nothing but a gap', xpath: ' ', at: 1},
]

describe('patterns', function() {
  ACCEPTS.forEach(({xpath, kind}) => {
    it(`reads ${JSON.stringify(xpath)} as a ${kind}`, function() {
      assert.equal(matched(xpath, '3.0').tree.kind, kind)
    })
  })
  REFUSES.forEach(({name, xpath, at}) => {
    it(`refuses ${name}`, function() {
      assert.deepEqual(
        [matched(xpath, '3.0').fault === '', matched(xpath, '3.0').at],
        [false, at],
        `${xpath} was not refused where it goes wrong`,
      )
    })
  })
  GATED.forEach(({xpath, floor, below}) => {
    it(`admits ${JSON.stringify(xpath)} only from ${floor}`, function() {
      assert.deepEqual(
        [matched(xpath, floor).fault === '', matched(xpath, below).fault === ''],
        [true, false],
        `${xpath} is not gated at ${floor}`,
      )
    })
  })
  MISPLACED.forEach(({name, xpath}) => {
    it(`refuses ${name} at every version`, function() {
      assert.deepEqual(
        VERSIONS.filter((one) => matched(xpath, one).fault === ''),
        [],
        `${xpath} is a pattern in some version, and it is one in none`,
      )
    })
  })
  TRODDEN.forEach(({xpath, name, admits}) => {
    it(`admits ${name} in ${admits.length} of three versions`, function() {
      assert.deepEqual(
        VERSIONS.filter((one) => matched(xpath, one).fault === ''),
        admits,
        `${xpath} is not the step only ${admits} admits`,
      )
    })
  })
  it('carries every token, trivia and all, back to the caller', function() {
    const pattern = '  para (: why :) | note  '
    assert.equal(
      matched(pattern, '3.0').tokens.map((token) => token.value).join(''),
      pattern,
      'the token stream does not reproduce the pattern it came from',
    )
  })
  it('spans a branch over its own text', function() {
    const answer = matched('para | note', '3.0')
    assert.equal(
      answer.tokens
        .slice(answer.tree.children[1].from, answer.tree.children[1].to)
        .map((token) => token.value).join(''),
      'note',
      'a branch span does not slice back to the branch',
    )
  })
  it('cannot swallow a bug as a refusal', function() {
    assert.throws(
      () => matched(undefined, '3.0'),
      'an error that is not a refusal was reported as one',
    )
  })
})
