/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {kinds} = require('./resources/checks.json')
const {offsetAt, placeAt, skip} = require('./source')
const {written} = require('./fixes')

/**
 * The tier a fix lands in when a plain `--fix` applies it: deterministic and
 * semantics-preserving.
 * @type {string}
 */
const SAFE = 'safe'

/**
 * The tier a fix lands in when only `--fix-suggestions` applies it: it changes
 * behaviour, or is one correction of several the check would accept.
 * @type {string}
 */
const SUGGESTION = 'suggestion'

/**
 * The two tiers a fix can land in, which is the whole vocabulary a check's
 * `fix:` is spelled from — here and nowhere else, three consumers reading it:
 * the grading in `src/xslint.js`, the badge the docs site renders, and the
 * gate in `test/tiers.test.js` (#899).
 * @type {Array.<string>}
 */
const TIERS = [SAFE, SUGGESTION]

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
 * the line endings of an attribute value, so the two texts drift apart. The
 * walk starts where the node opens, steps over the markup in front of its
 * value, and skips as many decoded characters as the offset counts (#628).
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
 * column are walked against the raw text from where the node opens, the parsed
 * value answering neither. The fix is anchored there too, and `from` is the
 * line the holding element opens on, nothing inside a start tag being
 * silenceable from within it. Omit `fix` for report-only (#648, #750).
 * @param {string} check - Check name
 * @param {{severity: string, message: string}} meta - The check metadata
 * @param {{file: string, content: string}} source - The file the node sits
 *  in, with its raw text, where the line breaks a parser normalised away are
 *  still visible
 * @param {{node: Node, start: number, expression: string, pattern: boolean}}
 *  found - The expression the defect stands in: its node, where it starts in
 *  that node's value, its own text, and whether it is a pattern
 * @param {number} offset - Offset of the defect within the expression
 * @param {?{value: string, replacement: string, suggestion?: boolean}} [fix] -
 *  The fix, or undefined for a report-only defect; its replacement is spelled
 *  the way the node holding it spells text, by {@link written}
 * @return {object} - Defect
 */
const defect = function(
  check, meta, source, found, offset, fix = undefined,
) {
  const {node} = found
  const {line, pos} = placeAt(source.content, rawly(source, found, offset))
  let anchored = {}
  if (fix !== undefined) {
    anchored = {
      fix: {
        line: line,
        col: pos,
        ...fix,
        replacement: written(fix.replacement, node, source.content),
      },
    }
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
  SAFE,
  SUGGESTION,
  TIERS,
  metaOf,
  suppressed,
  defect,
  rawly,
}
