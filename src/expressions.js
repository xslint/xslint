/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `enclosed` — the expressions an attribute value template holds in its
 * braces, beside what an attribute names statically and says in either
 * spelling. `masked`, which blanks every kind `OPAQUE` names, is private to
 * it: the checks that once scanned above it are on the tree since #557 and
 * #577, and the brace scan stays text work because an attribute value is not
 * XPath, so where its expressions begin and end is a question about the
 * value. Arity is asked of the parse, never by counting commas or blanking
 * literals, which reported `count()` and `not(not())` with a safe fix that
 * wrote an expression no processor parses (#576).
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
 * The values a shadow attribute names statically: its own where it holds no
 * brace — `_version="2.0"` names 2.0 — what a string literal alone in its
 * braces holds, and none where the run supplies it, a value unknown being no
 * empty one: `_href="{$base}"` names a module, `_href="{''}"` none.
 * @param {string} template - The attribute value
 * @return {Array.<string>} - What it names, or nothing
 */
const statics = function(template) {
  let named = [template]
  if (template.includes('{') || template.includes('}')) {
    const carried = braced(template)
    named = []
    if (carried.length === 1 && carried[0].type === TOKENS.STRING) {
      named = [unquoted(carried[0])]
    }
  }
  return named
}

/**
 * The value a shadow attribute names statically, or empty where it names none,
 * which a name, a version or an href of one never is.
 * @param {string} template - The attribute value
 * @return {string} - What it names, or empty where nothing static does
 */
const staticOf = function(template) {
  return statics(template)[0] ?? ''
}

/**
 * What an attribute of an XSLT element says: what its shadow `_x` names
 * statically where the document writes one, else the plain spelling, and
 * nothing where neither says anything static. XSLT ignores any `x` beside a
 * shadow, as Saxon does (#1114), and one taking a run-time value for an
 * empty one reads `_name="{$n}"` as naming nothing (#992, #997).
 * @param {Element} element - The element carrying the attribute
 * @param {string} name - The attribute's name, in its plain spelling
 * @return {Array.<string>} - What it says, or nothing
 */
const saidOf = function(element, name) {
  const shadow = `_${name}`
  let said = []
  if (element.hasAttribute(shadow)) {
    said = statics(element.getAttribute(shadow))
  } else if (element.hasAttribute(name)) {
    said = [element.getAttribute(name)]
  }
  return said
}

/**
 * What an attribute of an XSLT element says, `saidOf` read as one string and
 * empty where neither spelling says anything static (#992).
 * @param {Element} element - The element carrying the attribute
 * @param {string} name - The attribute's name, in its plain spelling
 * @return {string} - What it says, or empty where the one read says nothing
 */
const attributeOf = function(element, name) {
  return saidOf(element, name)[0] ?? ''
}

/**
 * The gap standing at either end of a value, which a processor strips from
 * an attribute holding a QName before it reads one.
 * @type {RegExp}
 */
const EDGES = new RegExp(`^${GAP}+|${GAP}+$`, 'g')

/**
 * The expanded name a lexical QName spells at an element, `Q{uri}local`. A
 * prefix resolves there, a prefix bound nowhere staying itself; an unprefixed
 * name is in no namespace, the default one applying to elements alone, and a
 * name spelling its namespace inline is its own expansion (#1060).
 * @param {Element} element - The element the name is read at
 * @param {string} lexical - The name as written, its edges trimmed
 * @return {string} - The expanded name, or empty where the name is
 */
const expandedOf = function(element, lexical) {
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

/**
 * The expanded name an attribute of an XSLT element holds, read through
 * `attributeOf` so either spelling counts, and expanded at that element.
 * @param {Element} element - The element carrying the attribute
 * @param {string} name - The attribute's name, in its plain spelling
 * @return {string} - The expanded name, or empty where neither spelling says
 */
const nameOf = function(element, name) {
  return expandedOf(element, attributeOf(element, name).replace(EDGES, ''))
}

module.exports = {
  attributeOf,
  enclosed,
  expandedOf,
  nameOf,
  saidOf,
  staticOf,
}
