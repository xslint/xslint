/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The same acceptance diff as `grammar-corpus.test.js`, asked of 14112
 * expressions nobody wrote: every shape a head and one or two tails spell,
 * spaced and glued. A corpus covers only what somebody has already written
 * down, and every class #740 closed stood outside the repository's — so
 * `GAPS` read empty while the grammar refused `text() + 1` and accepted
 * `a?b`, and this sweep parted from the engine 1603 times on the same head.
 * Both classes it was left with are closed by #742, and a generated sweep
 * covers only what its own lists spell, which is the corpus limit one level
 * up: the second was annotated `\? (WORDS)` over a `TAILS` naming no `+` at
 * all, so `xs:integer+ and @b` stood outside its own net, and widening the
 * annotation to `[?+]` uncovered `cast as xs:integer? instance of x` behind
 * it. A predicate too broad to be a class is one failure mode, since an
 * annotation that swallows the next defect turns nothing red; too narrow is
 * the other, and this file was in it. What is annotated now is not a gap in
 * the grammar at all — fontoxpath accepts a word run against the *arity* of
 * a named function reference, where Saxon-HE 12.5 answers `abs#1div 2` with
 * XPST0003 exactly as it answers `1div 2`. One engine's verdict is evidence
 * and not an answer, which is why a second arbiter settles it;
 * `net.sf.saxon.s9api`'s `XPathCompiler` judges them in well under a
 * second, and reading its *code* rather than its exit status is what tells
 * a syntax error from the undeclared prefix or unknown function behind one.
 * That cost is why the fast half now answers in under two seconds rather
 * than under one. The lists grew by four heads and three tails at #753,
 * from 8064 shapes to 14112: a kind test carrying arguments is a head now,
 * and the item types whose brackets hold a type are tails, so the
 * productions that read them stand inside the net rather than beside it.
 * The gate on the count moved with them, since a sweep that has been
 * narrowed reads exactly like one that agrees.
 */

const {parsed} = require('../src/grammar')
const {compiles} = require('../src/xpath')
const assert = require('assert')

/**
 * What an expression may open with: one of each shape the grammar forks on, a
 * primary and an axis step alike, since which stands at the front is what
 * `StepExpr ::= PostfixExpr | AxisStep` turns on and what `a?b` and `@a(1)`
 * were let through by (#740). Four are a kind test carrying arguments, whose
 * brackets #753 counted rather than read.
 * @type {Array.<string>}
 */
const HEADS = [
  'a', '@a', 'text()', 'element(x)', '$v', '1', '"s"', '(a)', 'f(1)',
  'map{"k":1}', '[1]', '.', '//a', 'abs#1', 'processing-instruction(a)',
  'element(a, xs:string)', 'attribute(*, xs:string)',
  'document-node(element(a))',
]

/**
 * What may follow one: an operator of every level of the ladder, each postfix,
 * and each of the four expressions taking a type on their right, spelled with
 * the item type, the parenthesized one, all three occurrence indicators and
 * the kind test that part the three type productions. Three hold a type in
 * their own brackets, a function test reaching past its closing one (#753).
 * @type {Array.<string>}
 */
const TAILS = [
  '+ 1', '* 2', '- 1', 'div 2', '| b', 'and b', '= 1', 'to 3', '! b', '=> f()',
  '[1]', '(1)', '?k', '/b', 'instance of xs:integer',
  'instance of (xs:integer)', 'instance of item()*', 'instance of xs:integer+',
  'cast as xs:integer', 'cast as xs:integer?', 'cast as node()',
  'castable as xs:integer', 'treat as node()', 'treat as (node())',
  'instance of map(xs:string, xs:integer)', 'instance of array(xs:integer*)',
  'instance of function(node()) as node()',
]

/**
 * Every head, every head with one tail behind it — spaced and glued — and
 * every head with two. Eight thousand expressions and half a second, which is
 * why this sweep stands beside `test/grammar-corpus.test.js`: that one reads
 * what the repository holds, and every class #740 closed was outside it. Two
 * tails, because that is where an interaction shows.
 * @type {Array.<string>}
 */
const SHAPES = Array.from(new Set(HEADS.concat(
  HEADS.flatMap((head) => TAILS.flatMap((tail) => [
    `${head} ${tail}`, `${head}${tail}`,
  ].concat(TAILS.map((next) => `${head} ${tail} ${next}`)))),
)))

/**
 * The words XPath spells an operator with, which is what the one remaining
 * disagreement is about — whether a word standing somewhere is one.
 * @type {Array.<string>}
 */
const WORDS = [
  'and', 'cast', 'castable', 'div', 'eq', 'except', 'ge', 'gt', 'idiv',
  'instance', 'intersect', 'is', 'le', 'lt', 'mod', 'ne', 'or', 'to', 'treat',
  'union',
].join('|')

/**
 * The classes the sweep still parts on, each naming the side that accepts and
 * the gap it stands for, as `GAPS` in `test/grammar-corpus.test.js` does. What
 * is left is no gap in the grammar: fontoxpath accepts a word run against a
 * named function reference's arity where Saxon-HE 12.5 refuses it, an arity
 * being an `IntegerLiteral` (#742, #717, #708).
 * @type {Array.<{accepts: string, gap: string, holds: RegExp}>}
 */
const KNOWN = [
  {
    accepts: 'engine',
    gap: 'a word operator run against the arity of a function reference',
    holds: new RegExp(`#[0-9]+(${WORDS})\\b`),
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
 * `KNOWN` writes one. The engine is asked as `compiles` and nothing stands
 * between: no shape generated here spells a gap the engine's own strictness
 * objects to, so the class `test/grammar-corpus.test.js` subtracts by name has
 * nothing to subtract from this sweep.
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
      SHAPES.length >= 14000,
      `the sweep generates ${SHAPES.length} shapes, fewer than the 14000 that ` +
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
