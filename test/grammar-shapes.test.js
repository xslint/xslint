/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed} = require('../src/grammar')
const {compiles} = require('../src/xpath')
const assert = require('assert')

/**
 * What an expression may open with: one of each shape the grammar forks on, a
 * primary and an axis step alike, since which of the two stands at the front is
 * the decision `StepExpr ::= PostfixExpr | AxisStep` turns on and the one
 * `a?b` and `@a(1)` were let through by (#740).
 * @type {Array.<string>}
 */
const HEADS = [
  'a', '@a', 'text()', 'element(x)', '$v', '1', '"s"', '(a)', 'f(1)',
  'map{"k":1}', '[1]', '.', '//a', 'abs#1',
]

/**
 * What may follow one: an operator of every level of the ladder, each postfix,
 * and each of the four expressions that take a type on their right, spelled
 * with the item type, the parenthesized item type, all three occurrence
 * indicators and the kind test that tell the three type productions apart.
 * @type {Array.<string>}
 */
const TAILS = [
  '+ 1', '* 2', '- 1', 'div 2', '| b', 'and b', '= 1', 'to 3', '! b', '=> f()',
  '[1]', '(1)', '?k', '/b', 'instance of xs:integer',
  'instance of (xs:integer)', 'instance of item()*', 'instance of xs:integer+',
  'cast as xs:integer', 'cast as xs:integer?', 'cast as node()',
  'castable as xs:integer', 'treat as node()', 'treat as (node())',
]

/**
 * Every head, every head with one tail behind it — spaced and glued — and every
 * head with two. Eight thousand expressions and half a second, which is the
 * whole reason this sweep exists beside `test/grammar-corpus.test.js` rather
 * than inside it: that one reads what the repository happens to hold, and every
 * class #740 closed was outside it, so it reported perfect agreement while the
 * grammar refused `text() + 1` and accepted `a?b`. A corpus can only ever cover
 * what somebody has already written down.
 *
 * Two tails rather than one because that is where an interaction shows. A type
 * production reads correctly until something stands behind what it read, which
 * is how `a instance of xs:integer ! b` came back a map over a sequence type.
 * @type {Array.<string>}
 */
const SHAPES = Array.from(new Set(HEADS.concat(
  HEADS.flatMap((head) => TAILS.flatMap((tail) => [
    `${head} ${tail}`, `${head}${tail}`,
  ].concat(TAILS.map((next) => `${head} ${tail} ${next}`)))),
)))

/**
 * The words XPath spells an operator with, which is what both remaining
 * disagreements are about — whether a word standing somewhere is one.
 * @type {Array.<string>}
 */
const WORDS = [
  'and', 'cast', 'castable', 'div', 'eq', 'except', 'ge', 'gt', 'idiv',
  'instance', 'intersect', 'is', 'le', 'lt', 'mod', 'ne', 'or', 'to', 'treat',
  'union',
].join('|')

/**
 * The classes the sweep still parts on, each naming the side that accepts and
 * the gap it stands for, the way `GAPS` in `test/grammar-corpus.test.js` names
 * one. They are a class rather than a list because a hundred and twenty-four
 * shapes carry them and one cause is underneath both: `operates` in
 * `src/tokens.js` decides whether a word is an operator from the last solid
 * token alone, where XPath settles it from what the parser is in the middle of
 * reading. So a word behind the indicator a type ends with arrives a name, and
 * a word glued to `1` arrives an operator, and neither is what a processor
 * reads. Filed as #742.
 *
 * The `*` of `item()*` escapes for a reason that is no part of the cause: a `*`
 * already ends a value, being how the wildcard of `a/*` is spelled, so the word
 * behind one is read rightly by accident. Which is why the annotation names the
 * indicator rather than the character — spelled `?` alone, it left the `+` half
 * of its own class both unswept and unaccounted, and `xs:integer+ and @b` is as
 * ordinary a thing to write as `xs:integer?` is.
 *
 * A predicate rather than the shapes themselves, because the shapes are an
 * accident of what this file happens to generate and the class is not. It is
 * spelled tightly all the same — an annotation broad enough to swallow the next
 * defect of a different cause is worse than no annotation, since it turns
 * nothing red.
 * @type {Array.<{accepts: string, gap: string, holds: RegExp}>}
 */
const KNOWN = [
  {
    accepts: 'grammar',
    gap: 'a word operator glued to the numeric literal in front of it (#742)',
    holds: new RegExp(`[0-9](${WORDS})\\b`),
  },
  {
    accepts: 'engine',
    gap: 'a word operator behind the indicator a type ends with (#742)',
    holds: new RegExp(`[?+] (${WORDS})\\b`),
  },
]

/**
 * How a disagreement reads on one line, as an annotation is written.
 * @param {string} accepts - The side that accepts, `grammar` or `engine`
 * @param {string} xpath - The expression they part over
 * @return {string} - The line
 */
const noted = function(accepts, xpath) {
  return `${accepts} accepts ${JSON.stringify(xpath)}`
}

/**
 * Every shape the grammar and the engine judge differently, written the way
 * `KNOWN` writes one. The engine is asked as `compiles`, never through the
 * respelling retry beside it, for the reason `test/grammar-corpus.test.js`
 * gives: the retry sits on the engine's side of the question and hides what it
 * rescues. Nothing generated here spells a gap the retry would touch.
 * @type {Array.<string>}
 */
const PARTED = SHAPES
  .filter((one) => (parsed(one, '3.0').fault === '') !== compiles(one))
  .map((one) => {
    let side = 'engine'
    if (parsed(one, '3.0').fault === '') {
      side = 'grammar'
    }
    return noted(side, one)
  })
  .sort()

/**
 * The same disagreements as `KNOWN` accounts for, expanded to the shapes each
 * class actually covers, so membership and direction are one comparison rather
 * than two.
 * @type {Array.<string>}
 */
const ACCOUNTED = KNOWN
  .flatMap(({accepts, holds}) => SHAPES
    .filter((one) => holds.test(one))
    .map((one) => noted(accepts, one)))
  .filter((line) => PARTED.includes(line))
  .sort()

describe('grammar over generated shapes', function() {
  it('cannot answer having swept fewer shapes than it was written for', () => {
    assert.ok(
      SHAPES.length >= 8000,
      `the sweep generates ${SHAPES.length} shapes, fewer than the 8000 that ` +
        'stood here when this gate was written, so it is answering about a ' +
        'space somebody has narrowed',
    )
  })
  KNOWN.forEach(({accepts, gap, holds}) => {
    it(`cannot annotate ${gap} having nothing to annotate`, function() {
      assert.ok(
        PARTED.some((line) => holds.test(line) && line.startsWith(accepts)),
        `nothing swept is ${gap}, so the annotation is stale and the class it ` +
          'names is either fixed or out of reach of this sweep',
      )
    })
  })
  it('cannot part from the engine anywhere it is not annotated', function() {
    assert.deepEqual(
      PARTED,
      ACCOUNTED,
      'the grammar and the engine part company on a shape nothing accounts for',
    )
  })
})
