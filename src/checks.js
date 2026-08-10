/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {isValid} = require('./xpath')
const {kinds} = require('./resources/checks.json')
const {offsetAt, placeAt, skip} = require('./source')

/**
 * Defect metadata of a formatting check.
 * @param {string} check - Check name
 * @return {{severity: string, message: string}} - The metadata
 */
const metaOf = function(check) {
  return kinds.format[check]
}

/**
 * Whether a check is suppressed — a suppression matches it as a substring.
 * @param {string} check - Check name
 * @param {Array.<string>} suppressions - Suppressed checks
 * @return {boolean} - True when suppressed
 */
const suppressed = function(check, suppressions) {
  return suppressions.some((sup) => check.includes(sup))
}

/**
 * The markup a node's `columnNumber` sits on before its value begins: an
 * attribute opens on its quote, a CDATA section on its `<![CDATA[` marker, and
 * every other kind on the value itself.
 * @type {{[nodeType: number]: number}}
 */
const LEAD = {2: 1, 4: '<![CDATA['.length}

/**
 * Where an offset inside an expression truly stands in the raw source. The
 * parsed value cannot answer it: a parser decodes the entities and normalises
 * the line endings of an attribute value, so the two texts drift apart by
 * however much of that the value holds. The walk starts where the node opens,
 * steps over whatever markup stands in front of its value, and skips as many
 * decoded characters as the offset counts.
 *
 * A linter needs this as much as a defect does — a check reasoning over a
 * parsed expression cannot see the line ending it was given a space for, so
 * anything it decides about whitespace has to be settled against the source
 * here rather than against the value in its hand (#628).
 * @param {{file: string, content: string}} source - The file the node sits in
 * @param {{node: Node, start: number}} found - The expression, as
 *  `src/attributes.js` yields it
 * @param {number} offset - Offset of the point within the expression
 * @return {number} - The raw offset into `source.content`
 */
const rawly = function(source, found, offset) {
  return skip(
    source.content,
    offsetAt(
      source.content, found.node.lineNumber, found.node.columnNumber,
    ) + (LEAD[found.node.nodeType] || 0),
    found.start + offset,
  )
}

/**
 * A defect at an offset inside an attribute, text, or CDATA node. Its line and
 * column are where it truly stands in the source, which is not something the
 * parsed value can answer on its own: an attribute value arrives with its line
 * breaks normalised to spaces and its entities decoded, so the offset is walked
 * against the raw text from where the node opens. The fix, when given as
 * `{value, replacement, suggestion?}`, is anchored at that same place, which is
 * all the fixer needs to find it. It also carries `from`, the line the element
 * holding the value opens on, because nothing inside a start tag can be
 * silenced from within it — no comment fits there — so a directive has to reach
 * the whole way down from above the element. Omit `fix` for report-only.
 *
 * The expression arrives whole — the node carrying it, where it starts inside
 * that node's value, and its text — as `src/attributes.js` yields it, rather
 * than as a node and a string a caller pairs up itself. Two things came of the
 * old shape (#648): the word `expression` named the node in one module and the
 * text in another, so one call had to spell both from one identifier, and every
 * caller added `start` to its own offset, nine chances to forget an addition
 * that belongs here. A mismatched pair reported at the wrong place and lost its
 * fix in silence, because a node read as text is valid XPath to nobody.
 * @param {string} check - Check name
 * @param {{severity: string, message: string}} meta - The check metadata
 * @param {{file: string, content: string}} source - The file the node sits
 *  in, with its raw text, which is the only place the line breaks a parser
 *  normalised away are still visible
 * @param {{node: Node, start: number, expression: string}} found - The
 *  expression the defect stands in: its attribute, text or CDATA node, where it
 *  starts in that node's value, and its own text, which decides whether a fix
 *  may be offered at all
 * @param {number} offset - Offset of the defect within the expression
 * @param {?{value: string, replacement: string, suggestion?: boolean}} [fix] -
 *  The fix, or undefined for a report-only defect
 * @return {object} - Defect
 */
const defect = function(
  check, meta, source, found, offset, fix = undefined,
) {
  const {node} = found
  const {line, pos} = placeAt(source.content, rawly(source, found, offset))
  let anchored = {}
  if (fix !== undefined && isValid(found)) {
    anchored = {fix: {line: line, col: pos, ...fix}}
  }
  return {
    name: check,
    severity: meta.severity,
    message: meta.message,
    file: source.file,
    line: line,
    from: (node.ownerElement || node.parentNode).lineNumber,
    pos: pos,
    ...anchored,
  }
}

module.exports = {
  metaOf,
  suppressed,
  defect,
  rawly,
}
