/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, OPAQUE, TRIVIA, TOKENS} = require('./tokens')

/**
 * An expression with its string and comment spans blanked to spaces, so a call
 * can be found and its parentheses balanced without tripping over text inside a
 * literal. Blanking keeps every offset intact.
 * @param {string} expression - The attribute value
 * @return {string} - The value with literals blanked
 */
const masked = function(expression) {
  const chars = Array.from(expression)
  for (const token of tokenized(expression)) {
    if (OPAQUE.includes(token.type)) {
      for (let at = token.start; at < token.start + token.value.length; at++) {
        chars[at] = ' '
      }
    }
  }
  return chars.join('')
}

/**
 * The brackets a nested construct opens with and the ones it closes with, kept
 * in step so a depth is one count rather than three.
 * @type {{opens: Array.<string>, shuts: Array.<string>}}
 */
const NESTED = {
  opens: [TOKENS.LPAREN, TOKENS.LBRACKET, TOKENS.LBRACE],
  shuts: [TOKENS.RPAREN, TOKENS.RBRACKET, TOKENS.RBRACE],
}

/**
 * Whether exactly one argument stands between a call's brackets. `fn:count`,
 * `fn:not` and `fn:boolean` each take one in every XSLT version, so a call
 * spelling none or several is not the construct the checks scanning for them
 * name, and the text between its brackets is no argument to rewrite: `count()`
 * became `empty()` and `not(not())` the empty string, one expression no
 * processor loads turned into another (#576).
 *
 * It reads the tokens rather than the characters, and so takes the expression
 * as written rather than blanked. Both halves need that. A comma is a separator
 * only as `TOKENS.COMMA`, so one inside a literal or a comment is a kind of its
 * own and divides nothing, where a character walk needed the text masked first;
 * and a bracket holding only a literal is not an empty bracket, where masking
 * turns `count('abc')` into a gap and the emptiness test cannot tell an absent
 * argument from a blanked one. So a bracket is empty when nothing but `TRIVIA`
 * stands in it, which separates `()` and `( (: c :) )` from `('')`.
 * @param {string} inner - The bracketed text, as the source spells it
 * @return {boolean} - Whether one argument stands there
 */
const lone = function(inner) {
  const tokens = tokenized(inner)
  let depth = 0
  let alone = tokens.some((token) => !TRIVIA.includes(token.type))
  for (const token of tokens) {
    if (NESTED.opens.includes(token.type)) {
      depth++
    } else if (NESTED.shuts.includes(token.type)) {
      depth--
    } else if (depth === 0 && token.type === TOKENS.COMMA) {
      alone = false
    }
  }
  return alone
}

/**
 * Offset of the `)` that closes the `(` at `open` in a literal-free expression,
 * or -1 when it is unbalanced.
 * @param {string} expression - Expression with literals already blanked
 * @param {number} open - Offset of the opening `(`
 * @return {number} - Offset of the matching `)`, or -1
 */
const closes = function(expression, open) {
  let depth = 0
  let shut = -1
  for (let at = open; at < expression.length && shut < 0; at++) {
    if (expression[at] === '(') {
      depth++
    } else if (expression[at] === ')') {
      depth--
      if (depth === 0) {
        shut = at
      }
    }
  }
  return shut
}

/**
 * Offset of the `}` that closes the expression enclosed from `from`, or -1 when
 * it never closes. String and comment spans are blanked before the scan, so a
 * brace inside a literal ends nothing, and a brace the expression opens itself
 * — a map or array constructor — is balanced, so only an unmatched `}` closes
 * it.
 * @param {string} template - The attribute value
 * @param {number} from - Offset of the first character of the expression
 * @return {number} - Offset of the closing `}`, or -1
 */
const closing = function(template, from) {
  const blanked = masked(template.slice(from))
  let depth = 0
  let shut = -1
  for (let at = 0; at < blanked.length && shut < 0; at++) {
    if (blanked[at] === '{') {
      depth++
    } else if (blanked[at] === '}') {
      if (depth === 0) {
        shut = from + at
      } else {
        depth--
      }
    }
  }
  return shut
}

/**
 * The expressions an attribute value template encloses in braces, each carrying
 * the offset it starts at inside the value and its own text. A doubled brace is
 * an escaped brace and encloses nothing; a brace that never closes ends the
 * scan, since the value is then output text to its end.
 * @param {string} template - The attribute value
 * @return {Array.<{offset: number, value: string}>} - The expressions found
 */
const enclosed = function(template) {
  const found = []
  let at = 0
  while (at < template.length) {
    if (template[at] === '{' && template[at + 1] === '{') {
      at += 2
    } else if (template[at] === '{') {
      const close = closing(template, at + 1)
      if (close < 0) {
        break
      }
      found.push({offset: at + 1, value: template.slice(at + 1, close)})
      at = close + 1
    } else {
      at++
    }
  }
  return found
}

module.exports = {
  masked,
  closes,
  enclosed,
  lone,
}
