/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {GAP, WHITESPACE} = require('./tokens')
const {PREFIXES} = require('./xpath')
const {parsed} = require('./grammar')
const {ASSUMED, filters} = require('./syntax')

/**
 * The answer for a selector no index can serve: an axis naming no bucket. An
 * empty list of names rather than a null, so a caller reads one shape whichever
 * way the question went, and the whole selector goes to the engine as before.
 * @type {{names: Array, tail: string}}
 */
const WHOLE = Object.freeze({names: [], tail: ''})

/**
 * What a descendant sweep looks like: `//` then either one name or a union of
 * them in brackets, then whatever is left. The name itself is weighed
 * separately, since a wildcard and a prefix nothing binds are refusals rather
 * than shapes. A gap is spelled `WHITESPACE` inside the character class and
 * `GAP` outside one, those being the same four characters written the two ways
 * a regular expression needs them.
 * @type {RegExp}
 */
const SWEEP = new RegExp(
  '^//(?:\\(' + GAP + '*([^()\\[\\]]+?)' + GAP + '*\\)' +
    '|([^()\\[\\]|/' + WHITESPACE + ']+))([^]*)$',
)

/**
 * A name an axis may yield: an NCName, or two joined by one colon. Deliberately
 * narrower than XPath's own, because what cannot be recognised here is served
 * by the engine instead — over-acceptance would hand the index a selector it
 * answers wrongly, where under-acceptance only leaves the run as it was.
 * @type {RegExp}
 */
const QUALIFIED =
  /^(?:([\p{L}_][\p{L}\p{N}\p{M}_.-]*):)?([\p{L}_][\p{L}\p{N}\p{M}_.-]*)$/u

/**
 * The top-level predicates a tail holds, or none at all where it is not a chain
 * of them — a step behind the brackets reaches past what the axis answered. A
 * quote carries its own brackets — `contains(@match, '[')` is one predicate
 * holding one bracket — so the scan reads over a literal rather than counting
 * inside it, which is the same reason `OPAQUE` exists one module over.
 * @param {string} text - What followed the axis
 * @return {Array.<string>} - What each predicate holds, outermost brackets off
 */
const predicated = function(text) {
  const parts = []
  let depth = 0
  let quote = ''
  let opened = 0
  let sound = text.length > 0
  for (let at = 0; at < text.length; at++) {
    const character = text.charAt(at)
    if (quote !== '') {
      if (character === quote) {
        quote = ''
      }
    } else if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '[') {
      if (depth === 0) {
        opened = at + 1
      }
      depth++
    } else if (character === ']') {
      depth--
      if (depth === 0) {
        parts.push(text.slice(opened, at))
      }
    } else if (depth === 0) {
      sound = false
    }
  }
  let answer = []
  if (sound && depth === 0 && quote === '') {
    answer = parts
  }
  return answer
}

/**
 * The namespace a name on the axis stands in, or an empty string where this
 * project binds no such prefix. The prefixes are the ones `src/xpath.js` binds
 * for every expression it issues, borrowed rather than written down again: the
 * index has to mean by `xsl:` exactly what the engine means by it, and a second
 * copy of that table is the shape `TRIVIA` and `OPAQUE` each have a selector
 * against. A name carrying no prefix is refused rather than read as the empty
 * namespace, no selector spelling one and a refusal costing only the run that
 * is already there.
 * @param {string} prefix - The prefix, or undefined where the name carries none
 * @return {string} - The namespace URI, or an empty string
 */
const namespaced = function(prefix) {
  let uri = ''
  if (prefix !== undefined && Object.hasOwn(PREFIXES, prefix)) {
    uri = PREFIXES[prefix]
  }
  return uri
}

/**
 * The names one axis yields, or an empty list where any of them is a shape an
 * index cannot bucket.
 * @param {string} listed - The names as the selector spells them
 * @return {Array.<{uri: string, local: string}>} - The buckets to read
 */
const bucketed = function(listed) {
  const names = []
  let sound = true
  for (const spelled of listed.split('|').map((one) => one.trim())) {
    const hit = QUALIFIED.exec(spelled)
    let uri = ''
    if (hit !== null) {
      uri = namespaced(hit[1])
    }
    if (uri === '') {
      sound = false
    } else {
      names.push({uri: uri, local: hit[2]})
    }
  }
  let answer = []
  if (sound && names.length > 0) {
    answer = names
  }
  return answer
}

/**
 * Whether the predicate filters the sequence rather than picking a position in
 * it, which is the whole of what one candidate at a time can be asked. The
 * verdict is `src/syntax.js`'s, taken off the parse and never off the text,
 * because a number wears more spellings than a digit: `[2 - 1]`, `[1.0]`, `[-
 * 1]`, `[number("2")]` and `[count(@name)]` are every bit as positional as
 * `[1]`, and a scan for a digit catches the last of them alone (#784). A
 * predicate that does not parse is refused with them, the grammar being the
 * only thing that could have said what it holds. The version is the one a
 * selector of ours is read at: it carries no `version` of its own and
 * fontoxpath answers it at 3.1, which is the case `ASSUMED` is for.
 * @param {string} text - What one predicate holds, its brackets off
 * @return {boolean} - Whether the split may serve it
 */
const filtered = function(text) {
  const {tokens, tree} = parsed(text, ASSUMED)
  return tree !== null && filters(tokens, tree)
}

/**
 * A selector split into the axis an index can answer and the tail a predicate
 * still has to. `//(xsl:variable | xsl:template)[P]` is every element of two
 * buckets filtered by `P`; the buckets come from one walk of the document that
 * every check shares, where the selector as a whole costs fontoxpath a
 * descendant traversal of its own — 50 times what the walk costs over
 * DocBook-XSL, the descendant axis over an xmldom tree being what #635 is
 * about.
 *
 * What is refused is refused on purpose. The tail is evaluated against one
 * candidate at a time, so a predicate reading the position of the sequence it
 * came from cannot be served — `//x[1]`, `//x[1][@a]` and `//x[@a][1]` alike,
 * a number picking one node out of the sequence wherever it stands among the
 * predicates — and neither can an axis naming no single bucket —
 * a wildcard, an attribute, a root-anchored path, or a prefix this project does
 * not bind. A step standing behind the tail reaches past what the axis
 * answered. Every refusal leaves the selector exactly as it was, going whole to
 * the engine, so the cost of not recognising a shape is the run that is already
 * there and the cost of recognising one wrongly would be a report that changed.
 * @param {string} xpath - The selector a declarative check is written in
 * @return {{names: Array.<{uri: string, local: string}>, tail: string}} - The
 *  buckets and the tail, or no names at all where the engine must answer
 */
const splitOf = function(xpath) {
  const hit = SWEEP.exec(xpath.trim())
  let split = WHOLE
  if (hit !== null) {
    const tail = hit[3]
    let listed = hit[1]
    if (listed === undefined) {
      listed = hit[2]
    }
    const names = bucketed(listed)
    const parts = predicated(tail)
    if (names.length > 0 && (tail === '' || parts.length > 0) &&
      parts.every((one) => filtered(one))) {
      split = {names: names, tail: tail}
    }
  }
  return split
}

module.exports = {
  splitOf,
}
