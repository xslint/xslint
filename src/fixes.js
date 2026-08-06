/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {WHITESPACE} = require('./tokens')
const {character, offsetAt, placeAt} = require('./source')

/**
 * The offset at which the run of gap characters ending at `at` opens, so a walk
 * backwards over an attribute's spelling steps across whatever XML `S` stands
 * between its parts instead of the single space one spelling of it has.
 * @param {string} content - Raw source text
 * @param {number} at - Zero-based offset just past the run
 * @return {number} - Offset of the run's first character, or `at` where the
 *  character in front of it is not a gap
 */
const opens = function(content, at) {
  let raw = at
  while (raw > 0 && WHITESPACE.includes(content[raw - 1])) {
    raw -= 1
  }
  return raw
}

/**
 * The text a raw span decodes to, walked the way `src/fixer.js` walks it to
 * verify a fix — so a value taken from the source is the value the fixer reads
 * back there. A named entity decodes to its character and a line ending to the
 * `\n` a parser makes of it, which is what lets the span of a wrapped attribute
 * match. A numeric or unknown entity decodes to nothing either walk can
 * express, so the value it yields matches no source and the fix is declined
 * rather than applied across text nobody read.
 * @param {string} content - Raw source text
 * @param {number} from - Zero-based offset to read from
 * @param {number} to - Zero-based offset to stop at
 * @return {string} - The decoded text of the span
 */
const decoded = function(content, from, to) {
  let text = ''
  let raw = from
  while (raw < to) {
    const [char, next] = character(content, raw)
    text += char
    raw = next
  }
  return text
}

/**
 * A fix that deletes an attribute, leading gap and all. The span is read from
 * the source rather than rebuilt from the attribute. xmldom reports an
 * attribute at its opening delimiter, so the delimiter is whichever quote
 * stands there and the value ends where that same quote returns — XML forbids
 * it inside — while the walk backwards over the `=` and the name crosses gaps
 * of any width, a line ending among them.
 *
 * Rebuilding the text as ` name="value"` assumed one spelling of three separate
 * things, and `src/fixer.js` applies a fix only where the source decodes to its
 * `value`, so it declined every other spelling: a single-quoted delimiter — the
 * ordinary choice where the XPath itself holds double quotes — a gap around the
 * `=`, a wider gap in front of the name, and an attribute standing on its own
 * line. Each was announced as fixable, then refused for a reason having nothing
 * to do with the stylesheet (#594).
 * @param {Node} attribute - The attribute node to delete
 * @param {string} content - Raw source text of the file it stands in
 * @return {{line: number, col: number, value: string, replacement: string}} -
 *  The fix
 */
const deletion = function(attribute, content) {
  const quote = offsetAt(content, attribute.lineNumber, attribute.columnNumber)
  const start = opens(
    content,
    opens(content, opens(content, quote) - 1) - attribute.name.length,
  )
  const where = placeAt(content, start)
  return {
    line: where.line,
    col: where.pos,
    value: decoded(
      content, start, content.indexOf(content[quote], quote + 1) + 1,
    ),
    replacement: '',
  }
}

module.exports = {
  deletion,
}
