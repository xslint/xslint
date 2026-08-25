/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, OPAQUE} = require('./tokens')

/**
 * An expression with its string and comment spans blanked to spaces, so a
 * brace can be balanced without tripping over one standing inside a literal.
 * Blanking keeps every offset intact. What is left above is the brace scan,
 * which is text work by nature: an attribute value is not XPath, and where its
 * expressions begin and end is what `enclosed` is for (#557).
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
  enclosed,
}
