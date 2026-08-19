/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed} = require('../src/grammar')
const {
  FILTERS, LOOSE, STEPPED, WORDED, filters, parseOf, stepped, stringOf, tight,
} = require('../src/syntax')
const {WORDS} = require('../src/tokens')
const {expressionsOf} = require('../src/attributes')
const {xml} = require('../src/helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

/**
 * One expression of every kind the expression grammar builds, at the version
 * that has them all. A rewrite substituting a node's text into a comparison,
 * or into the place a call stood in, needs to know how tightly that node
 * binds, and `LOOSE` and `STEPPED` answer from the two ends of one ladder;
 * these are what hold both lists to the grammar rather than to the comments
 * beside them, since the ladder is what decides and the ladder can move.
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
  {kind: 'union', xpath: 'a | b'},
  {kind: 'intersect', xpath: 'a intersect b'},
  {kind: 'instance', xpath: 'a instance of xs:integer'},
  {kind: 'treat', xpath: 'a treat as xs:integer'},
  {kind: 'castable', xpath: 'a castable as xs:integer'},
  {kind: 'cast', xpath: 'a cast as xs:integer'},
  {kind: 'arrow', xpath: 'a => abs()'},
  {kind: 'unary', xpath: '- a'},
  {kind: 'simple-map', xpath: 'a ! b'},
  {kind: 'path', xpath: 'a/b'},
  {kind: 'step', xpath: '@a'},
  {kind: 'filter', xpath: '$va[1]'},
  {kind: 'apply', xpath: '$va(1)'},
  {kind: 'lookup', xpath: '$va?ka'},
  {kind: 'parenthesized', xpath: '(a)'},
  {kind: 'literal', xpath: '1'},
  {kind: 'variable', xpath: '$va'},
  {kind: 'call', xpath: 'abs(a)'},
  {kind: 'context', xpath: '.'},
  {kind: 'map', xpath: 'map{a:1}'},
  {kind: 'array', xpath: '[1]'},
  {kind: 'reference', xpath: 'abs#1'},
  {kind: 'inline', xpath: 'function($va) { $va }'},
]

/**
 * A stylesheet whose every expression is one literal, so a record for each
 * spelling comes from the derivation a check reads rather than from a node
 * built by hand.
 * @type {Document}
 */
const LITERALS = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'syntax', 'literals.xsl'), 'utf-8',
  ),
)

/**
 * Each literal spelling paired with the string XPath reads it as, or null where
 * the expression holds no string at all. Either delimiter spells one string, a
 * doubled delimiter inside spells one character of it, and the other quote
 * needs no escaping at all — so the text between the quotes is not the answer
 * and `textOf` is not this question. A number is a `literal` node of the same
 * kind with only its token telling the two apart, and a step is not a literal.
 * @type {Array.<{xpath: string, holds: ?string}>}
 */
const STRINGS = [
  {xpath: `'plain'`, holds: 'plain'},
  {xpath: `"plain"`, holds: 'plain'},
  {xpath: `'it''s'`, holds: `it's`},
  {xpath: `"say ""hi"""`, holds: `say "hi"`},
  {xpath: `''`, holds: ''},
  {xpath: `"it's"`, holds: `it's`},
  {xpath: '42', holds: null},
  {xpath: '@a', holds: null},
  {xpath: '/', holds: null},
]

/**
 * The record the fixture carries for that expression, which is how a check
 * meets it.
 * @param {string} xpath - The expression as the stylesheet spells it
 * @return {{node: Node, start: number, expression: string,
 *  pattern: boolean}} - Its record
 */
const held = function(xpath) {
  return expressionsOf(LITERALS)
    .find((found) => found.expression === xpath)
}

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

/**
 * Whether the expression really does carry over whole into a step of a path:
 * `b/<xpath>` parses, comes back a path, and its far step is the expression as
 * it stood rather than the tail of it that binds tightly enough to stand there.
 * @param {string} xpath - The expression to substitute
 * @return {boolean} - True when it stands there unchanged
 */
const follows = function(xpath) {
  const grown = parsed(`b/${xpath}`, '3.0')
  let stands = false
  if (grown.tree !== null && grown.tree.kind === 'path') {
    const far = grown.tree.children[grown.tree.children.length - 1]
    stands = grown.tokens.slice(far.from, far.to)
      .map((token) => token.value).join('') === xpath
  }
  return stands
}

/**
 * What each expression answers when asked whether it can stand as a predicate
 * one candidate at a time is handed, which is what a check served from a shared
 * walk needs (#784). The kinds are swept from `SHAPES` above; these are the
 * pairs a kind cannot settle on its own — a `call` judged by the name it holds,
 * and the spellings a number wears beyond the digit a scan would look for.
 * @type {Array.<{xpath: string, filters: boolean}>}
 */
const FILTERED = [
  {xpath: 'not(@a)', filters: true},
  {xpath: 'contains(@a, "b")', filters: true},
  {xpath: 'count(@a)', filters: false},
  {xpath: 'number("2")', filters: false},
  {xpath: 'position()', filters: false},
  {xpath: 'last()', filters: false},
  {xpath: '@a = position()', filters: false},
  {xpath: 'not(@a = last())', filters: false},
  {xpath: 'Q{http://www.w3.org/2005/xpath-functions}not(@a)', filters: false},
  {xpath: '1', filters: false},
  {xpath: '1.0', filters: false},
  {xpath: '2 - 1', filters: false},
  {xpath: '- 1', filters: false},
  {xpath: '(@a)', filters: false},
  {xpath: '@a', filters: true},
  {xpath: 'a/b', filters: true},
  {xpath: 'a | b', filters: true},
  {xpath: '@a and @b', filters: true},
  {xpath: 'some $va in a satisfies $va', filters: true},
]

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
  SHAPES.forEach(({kind, xpath}) => {
    it(`agrees with the ladder about a ${kind} as a step`, function() {
      assert.equal(
        stepped(parsed(xpath, '3.0').tree), follows(xpath),
        `A ${kind} does not stand where STEPPED says it stands`,
      )
    })
  })
  FILTERED.forEach(({xpath, filters: sound}) => {
    it(`reads "${xpath}" as ${sound} for a predicate`, function() {
      const {tokens, tree} = parsed(xpath, '3.0')
      assert.equal(
        filters(tokens, tree), sound,
        `Whether "${xpath}" filters rather than picks a position has moved`,
      )
    })
  })
  it('cannot name a filtering kind no shape stands for', function() {
    assert.deepEqual(
      FILTERS.filter((kind) => !SHAPES.some((shape) => shape.kind === kind)),
      [],
      'A kind on the filtering list has no expression holding it to the grammar',
    )
  })
  it('cannot name a step kind no shape stands for', function() {
    assert.deepEqual(
      STEPPED.filter((kind) => !SHAPES.some((shape) => shape.kind === kind)),
      [],
      'A kind on the step list has no expression holding it to the grammar',
    )
  })
  Object.entries(WORDED).forEach(([symbol, word]) => {
    it(`pairs "${symbol}" with "${word}"`, function() {
      assert.deepEqual(
        [
          parsed(`a ${symbol} b`, '3.0').tree.kind,
          parsed(`a ${word} b`, '3.0').tree.kind,
        ],
        ['comparison', 'value-comparison'],
        `"${symbol}" and "${word}" are not one question spelled two ways`,
      )
    })
  })
  STRINGS.forEach(({xpath, holds}) => {
    it(`reads what ${xpath} holds`, function() {
      assert.equal(
        stringOf(held(xpath), parseOf(held(xpath)).tree), holds,
        `${xpath} does not hold what XPath reads in it`,
      )
    })
  })
  it('cannot leave a spelling the fixture carries out of the table', function() {
    assert.deepEqual(
      expressionsOf(LITERALS)
        .map((found) => found.expression)
        .filter((xpath) => !STRINGS.some((one) => one.xpath === xpath)),
      [],
      'The literals fixture carries a spelling no row asks about, so what ' +
        'the helper answers for it is asserted nowhere',
    )
  })
  it('cannot leave a word comparison out of the pairing', function() {
    assert.deepEqual(
      WORDS.filter(
        (word) => parsed(`a ${word} b`, '3.0').tree?.kind ===
          'value-comparison',
      ).filter((word) => !Object.values(WORDED).includes(word)),
      [],
      'A word the grammar reads as a value comparison has no symbol paired ' +
        'with it, so every check reading that table is blind to it',
    )
  })
})
