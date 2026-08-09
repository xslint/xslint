/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {matched} = require('../src/grammar')
const assert = require('assert')

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
 * Steps XSLT 1.0 and 2.0 refuse and this grammar still admits at 3.0. Their
 * production below the rewrite is `ChildOrAttributeAxisSpecifier`, which names
 * the two axes it is called after and the `@` abbreviating the second, so a
 * reverse axis, a `.` or a `..` spells a pattern no processor of either version
 * loads. What 3.0's own `ForwardAxisP` admits is *not* settled here, so each
 * row pins the deferral as much as the narrowing: the third column is today's
 * answer at 3.0, not a claim about the specification. Should 3.0 turn out to
 * refuse them too, these rows are where that lands, and until then an
 * over-acceptance leaves a defect unreported while refusing a pattern XSLT
 * admits would invent one against working code (#679).
 * @type {Array.<{xpath: string, name: string}>}
 */
const TRODDEN = [
  {xpath: 'ancestor::para', name: 'a reverse axis'},
  {xpath: 'self::para', name: 'the self axis'},
  {xpath: 'descendant::para', name: 'the descendant axis'},
  {xpath: 'namespace::para', name: 'the namespace axis'},
  {xpath: 'following-sibling::para', name: 'a sibling axis'},
  {xpath: 'preceding::para', name: 'a backward axis'},
  {xpath: 'parent::para', name: 'the parent axis'},
  {xpath: 'chapter//ancestor::para', name: 'a reverse axis buried in a path'},
  {xpath: 'chapter | self::para', name: 'an axis in the second branch'},
  {xpath: 'chapter/.', name: 'a context step'},
  {xpath: 'chapter/..', name: 'a parent step'},
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
  TRODDEN.forEach(({xpath, name}) => {
    it(`refuses ${name} below the rewrite`, function() {
      assert.deepEqual(
        ['1.0', '2.0', '3.0'].map((one) => matched(xpath, one).fault === ''),
        [false, false, true],
        `${xpath} is not the step 1.0 and 2.0 refuse and 3.0 still admits`,
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
