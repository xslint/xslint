/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  tokenized, TOKENS, TRIVIA, AXIS_KINDS, GAPS,
} = require('../src/tokens')

/**
 * The names a node test is spelled with: the four NodeTypes of XPath 1.0, the
 * kind tests 2.0 added, and the one 3.0 added. It is the name in front of a
 * bracket that decides whether the gap inside it is refused, because it is only
 * a node test the engine reads glued — `count (a)` is a call and compiles, and
 * so does `my:element (a)`, a prefixed name being no test at all.
 * @type {Array.<string>}
 */
const TESTS = [
  'node', 'text', 'comment', 'processing-instruction',
  'document-node', 'element', 'attribute', 'schema-element',
  'schema-attribute', 'namespace-node', 'item', 'empty-sequence',
]

/**
 * What stands before the first token, so the scan below asks the same questions
 * of it as of every other position and needs no first-token branch.
 * @type {{type: string, value: string}}
 */
const NOTHING = {type: TOKENS.OTHER, value: ''}

/**
 * Whether an axis specifier carries a gap in front of its `::`. The lexer takes
 * the whole of `child ::` as one token, a separator being what settles what may
 * follow it, so a gap on that side is read off the token's own value where one
 * behind it is a trivia token like any other.
 * @param {{type: string, value: string}} token - A token
 * @return {boolean} - True when it is an axis holding a gap
 */
const spaced = function(token) {
  return AXIS_KINDS.includes(token.type) && GAPS.test(token.value)
}

/**
 * Whether fontoxpath refuses the expression over its own strictness rather than
 * over anything malformed in it. Three things make it up, and every one of them
 * is XPath the specification spells and the engine will not read:
 *
 * - the `namespace::` axis, which XPath 3.0 dropped and 1.0 and 2.0 define, so
 *   an engine that is only 3.1 has no parse for it at all (#615);
 * - ExprWhitespace around an axis separator, which XPath 1.0 §3.7 lets stand on
 *   either side of `::` (#615);
 * - ExprWhitespace inside a node test, between its name and the bracket it
 *   opens with or anywhere the brackets hold (#639).
 *
 * It is asked of the token stream rather than of the characters, which is what
 * lets it tell the axis of `1-namespace::x` from the one name of
 * `a-namespace::x`: a `-` continues a name a letter started and subtracts
 * everywhere else, and the lexer has already decided which, where a lookbehind
 * would be reading characters about a question that is about tokens.
 *
 * What it does not answer is whether the expression is valid, and it must not
 * be read that way: `child ::` names an axis no node test follows and holds a
 * spaced separator all the same. It says which side of a disagreement the
 * engine stands on and why, so a gate over a corpus can subtract the engine's
 * own strictness from a diff and annotate whatever is left.
 *
 * Naming a spelling too many is therefore cheap and missing one is not, but
 * only in one direction, and the gate that reads this holds that direction:
 * what may be excused is the grammar accepting where the engine refuses, never
 * the engine accepting where the grammar refuses. The second is an
 * under-acceptance — a defect invented against working code — and no account of
 * the engine's strictness can explain one away.
 *
 * Nothing in `src/` calls this and nothing should: a run asks `parsed` and
 * `matched`, which judge against the specification. It exists because the
 * acceptance diff does, and it goes when that does — `compiles` and this retire
 * together, on the day the grammar is trusted well enough that a second opinion
 * from an XPath 3.1 engine is not worth the asking. That day is not today: the
 * diff is what turned up #711, #724, #740 and #742, and the classes it cannot
 * see are what turned up #736, #746, #752 and #753.
 * @param {string} xpath - Xpath expression
 * @return {boolean} - True when the engine's own strictness is what refuses it
 */
const insists = function(xpath) {
  const brackets = []
  let strict = false
  let last = NOTHING
  let solid = NOTHING
  for (const token of tokenized(xpath)) {
    if (token.type === TOKENS.NAMESPACE || spaced(token)) {
      strict = true
    }
    if (TRIVIA.includes(token.type) && (
      AXIS_KINDS.includes(solid.type) || brackets[brackets.length - 1]
    )) {
      strict = true
    }
    if (token.type === TOKENS.LPAREN) {
      if (TRIVIA.includes(last.type) && TESTS.includes(solid.value)) {
        strict = true
      }
      brackets.push(TESTS.includes(solid.value))
    }
    if (token.type === TOKENS.RPAREN) {
      brackets.pop()
    }
    last = token
    if (!TRIVIA.includes(token.type)) {
      solid = token
    }
  }
  return strict
}

module.exports = {
  insists,
}
