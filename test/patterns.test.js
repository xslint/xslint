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
  {xpath: '(self::node())', kind: 'branch'},
  {xpath: '(a | b)/c', kind: 'branch'},
  {xpath: '  para  ', kind: 'branch'},
  {xpath: '(: why :) para', kind: 'branch'},
]

/**
 * Text the pattern grammar refuses, with the offset the complaint points at.
 * Two of them are perfectly good *expressions*, which is the whole reason a
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
  {name: 'a variable, which matches no node', xpath: '$para', at: 0},
  {name: 'nothing at all', xpath: '', at: 0},
  {name: 'nothing but a gap', xpath: ' ', at: 1},
]

describe('patterns', function() {
  ACCEPTS.forEach(({xpath, kind}) => {
    it(`reads ${JSON.stringify(xpath)} as a ${kind}`, function() {
      assert.equal(matched(xpath, '2.0').tree.kind, kind)
    })
  })
  REFUSES.forEach(({name, xpath, at}) => {
    it(`refuses ${name}`, function() {
      assert.deepEqual(
        [matched(xpath, '2.0').fault === '', matched(xpath, '2.0').at],
        [false, at],
        `${xpath} was not refused where it goes wrong`,
      )
    })
  })
  it('carries every token, trivia and all, back to the caller', function() {
    const pattern = '  para (: why :) | note  '
    assert.equal(
      matched(pattern, '2.0').tokens.map((token) => token.value).join(''),
      pattern,
      'the token stream does not reproduce the pattern it came from',
    )
  })
  it('spans a branch over its own text', function() {
    const answer = matched('para | note', '2.0')
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
      () => matched(undefined, '2.0'),
      'an error that is not a refusal was reported as one',
    )
  })
})
