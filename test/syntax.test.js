/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed} = require('../src/grammar')
const {LOOSE, tight} = require('../src/syntax')
const assert = require('assert')

/**
 * One expression of every kind the expression grammar builds, at the version
 * that has them all. A rewrite substituting a node's text into a comparison
 * needs to know how tightly that node binds, and `LOOSE` answers it from a
 * list; these are what hold the list to the grammar rather than to the comment
 * beside it, since the ladder is what decides and the ladder can move.
 * @type {Array.<{kind: string, xpath: string}>}
 */
const SHAPES = [
  {kind: 'sequence', xpath: 'a, b'},
  {kind: 'for', xpath: 'for $va in a return $va'},
  {kind: 'let', xpath: 'let $va := a return $va'},
  {kind: 'some', xpath: 'some $va in a satisfies $va'},
  {kind: 'every', xpath: 'every $va in a satisfies $va'},
  {kind: 'conditional', xpath: 'if (a) then b else c'},
  {kind: 'or', xpath: 'a or b'},
  {kind: 'and', xpath: 'a and b'},
  {kind: 'comparison', xpath: 'a = b'},
  {kind: 'value-comparison', xpath: 'a eq b'},
  {kind: 'node-comparison', xpath: 'a is b'},
  {kind: 'concat', xpath: 'a || b'},
  {kind: 'range', xpath: 'a to b'},
  {kind: 'sum', xpath: 'a + b'},
  {kind: 'product', xpath: 'a * b'},
  {kind: 'idiv', xpath: 'a idiv b'},
  {kind: 'union', xpath: 'a | b'},
  {kind: 'intersect', xpath: 'a intersect b'},
  {kind: 'except', xpath: 'a except b'},
  {kind: 'instance', xpath: 'a instance of xs:integer'},
  {kind: 'treat', xpath: 'a treat as xs:integer'},
  {kind: 'castable', xpath: 'a castable as xs:integer'},
  {kind: 'cast', xpath: 'a cast as xs:integer'},
  {kind: 'arrow', xpath: 'a => abs()'},
  {kind: 'unary', xpath: '- a'},
  {kind: 'simple-map', xpath: 'a ! b'},
  {kind: 'path', xpath: 'a/b'},
  {kind: 'step', xpath: '@a'},
  {kind: 'parenthesized', xpath: '(a)'},
  {kind: 'literal', xpath: '1'},
  {kind: 'variable', xpath: '$va'},
  {kind: 'call', xpath: 'abs(a)'},
  {kind: 'context', xpath: '.'},
  {kind: 'map', xpath: 'map{a:1}'},
  {kind: 'array', xpath: '[1]'},
  {kind: 'reference', xpath: 'abs#1'},
]

/**
 * Whether the expression really does carry over whole into an operand of a
 * general comparison: `<xpath> = ''` parses, comes back a comparison, and its
 * near operand is the expression as it stood rather than some part of it that
 * bound tighter than the rest.
 * @param {string} xpath - The expression to substitute
 * @return {boolean} - True when it stands there unchanged
 */
const carries = function(xpath) {
  const grown = parsed(`${xpath} = ''`, '3.0')
  let stands = false
  if (grown.tree !== null && grown.tree.kind === 'comparison') {
    const near = grown.tree.children[0]
    stands = grown.tokens.slice(near.from, near.to)
      .map((token) => token.value).join('') === xpath
  }
  return stands
}

describe('syntax', function() {
  SHAPES.forEach(({kind, xpath}) => {
    it(`reads "${xpath}" as a ${kind}`, function() {
      assert.equal(
        parsed(xpath, '3.0').tree.kind, kind,
        `The kind of "${xpath}" is not ${kind} any more`,
      )
    })
  })
  SHAPES.forEach(({kind, xpath}) => {
    it(`agrees with the ladder about a ${kind}`, function() {
      assert.equal(
        tight(parsed(xpath, '3.0').tree), carries(xpath),
        `A ${kind} does not bind the way LOOSE says it does`,
      )
    })
  })
  it('cannot name a loose kind no shape stands for', function() {
    assert.deepEqual(
      LOOSE.filter((kind) => !SHAPES.some((shape) => shape.kind === kind)), [],
      'A kind on the loose list has no expression holding it to the grammar',
    )
  })
})
