/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS} = require('./tokens')

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
    if (token.type === TOKENS.STRING || token.type === TOKENS.COMMENT) {
      for (let at = token.start; at < token.start + token.value.length; at++) {
        chars[at] = ' '
      }
    }
  }
  return chars.join('')
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
  for (let at = open; at < expression.length; at++) {
    if (expression[at] === '(') {
      depth++
    } else if (expression[at] === ')') {
      depth--
      if (depth === 0) {
        return at
      }
    }
  }
  return -1
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
  for (let at = 0; at < blanked.length; at++) {
    if (blanked[at] === '{') {
      depth++
    } else if (blanked[at] === '}') {
      if (depth === 0) {
        return from + at
      }
      depth--
    }
  }
  return -1
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
}
