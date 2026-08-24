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
 * Whether fontoxpath refuses the expression over its own strictness rather
 * than over anything malformed in it: a `namespace::` axis, ExprWhitespace
 * around an axis separator, and ExprWhitespace inside a node test (#615,
 * #639). It is no oracle of validity, and what may be excused is only the
 * grammar accepting where the engine refuses.
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
