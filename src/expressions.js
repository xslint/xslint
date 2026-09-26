/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  GAP, tokenized, OPAQUE, TRIVIA, TOKENS, unquoted,
} = require('./tokens')

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

/**
 * The tokens of the one expression a value is nothing but, where its braces
 * open at the first character and close at the last, or none at all. A value
 * holding text beside its expression is no such value, and neither is one
 * holding two of them or a doubled brace, which encloses nothing.
 * @param {string} template - The attribute value
 * @return {Array.<object>} - Its solid tokens, or none
 */
const braced = function(template) {
  const found = enclosed(template)
  let carried = []
  if (found.length === 1 && found[0].offset === 1 &&
    found[0].offset + found[0].value.length === template.length - 1) {
    carried = tokenized(found[0].value)
      .filter((token) => !TRIVIA.includes(token.type))
  }
  return carried
}

/**
 * The value a shadow attribute names statically, or empty where it names none.
 * A shadow attribute is an attribute value template, so a plain value is its
 * own — `_version="2.0"` names 2.0 — and one whose braces hold a string
 * literal names what that literal holds. Anything else is a processor's answer
 * at run time, and empty is a value no name, version or href of one has.
 * @param {string} template - The attribute value
 * @return {string} - What it names, or empty where nothing static does
 */
const staticOf = function(template) {
  let value = template
  if (template.includes('{') || template.includes('}')) {
    const carried = braced(template)
    value = ''
    if (carried.length === 1 && carried[0].type === TOKENS.STRING) {
      value = unquoted(carried[0])
    }
  }
  return value
}

/**
 * What an attribute of an XSLT element says: the plain spelling where the
 * document writes one, else what its shadow names statically. XSLT 3.0 writes
 * any such attribute `_x` as readily as `x`, and `_x` holds an attribute value
 * template rather than the value — `{'yes'}` where `yes` stood — so a reader
 * asking one spelling reads half the stylesheets there are (#992).
 * @param {Element} element - The element carrying the attribute
 * @param {string} name - The attribute's name, in its plain spelling
 * @return {string} - What it says, or empty where neither spelling does
 */
const attributeOf = function(element, name) {
  return element.getAttribute(name) ||
    staticOf(element.getAttribute(`_${name}`) || '')
}

/**
 * The gap standing at either end of a value, which a processor strips from
 * an attribute holding a QName before it reads one.
 * @type {RegExp}
 */
const EDGES = new RegExp(`^${GAP}+|${GAP}+$`, 'g')

/**
 * The expanded name an attribute of an XSLT element holds, `Q{uri}local`,
 * read through `attributeOf` so either spelling counts. A prefix resolves at
 * the element, a prefix bound nowhere staying itself; an unprefixed name is
 * in no namespace, the default one applying to elements alone (#1060).
 * @param {Element} element - The element carrying the attribute
 * @param {string} name - The attribute's name, in its plain spelling
 * @return {string} - The expanded name, or empty where neither spelling says
 */
const nameOf = function(element, name) {
  const lexical = attributeOf(element, name).replace(EDGES, '')
  const colon = lexical.indexOf(':')
  let expanded = `Q{}${lexical}`
  if (lexical === '' || lexical.startsWith('Q{')) {
    expanded = lexical
  } else if (colon > 0) {
    const prefix = lexical.slice(0, colon)
    const uri = element.lookupNamespaceURI(prefix) ?? `${prefix}:`
    expanded = `Q{${uri}}${lexical.slice(colon + 1)}`
  }
  return expanded
}

module.exports = {
  attributeOf,
  enclosed,
  nameOf,
  staticOf,
}
