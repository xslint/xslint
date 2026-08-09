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
 * The offset an attribute's own spelling begins at, which is where its name
 * stands rather than where xmldom reports it. The parser hands back the
 * opening delimiter of the value, so the walk goes backwards from there:
 * across the gap in front of the quote, over the `=`, across the gap in front
 * of that, and then over the name itself.
 * @param {Node} attribute - The attribute node
 * @param {string} content - Raw source text of the file it stands in
 * @return {number} - Zero-based offset of the name's first character
 */
const named = function(attribute, content) {
  return opens(
    content,
    opens(
      content,
      offsetAt(content, attribute.lineNumber, attribute.columnNumber),
    ) - 1,
  ) - attribute.name.length
}

/**
 * Where an attribute stands, in the line and column a defect is reported in.
 *
 * Arithmetic over the name answered this until #681 — `columnNumber` less the
 * name's length less one — which lands on the first letter only where the
 * source spells the attribute `name="value"` exactly. Every gap the spelling
 * is allowed moves the delimiter while the name stays put, so
 * `xmlns:dead = "urn:dead"` was reported two columns right of itself and a
 * declaration standing on its own line six. That is the invention #594 removed
 * from {@link deletion} one layer down, left behind in the defect beside it:
 * the fix cut the right characters while the report pointed elsewhere, and the
 * two disagreed about where one attribute was.
 * @param {Node} attribute - The attribute node
 * @param {string} content - Raw source text of the file it stands in
 * @return {{line: number, pos: number}} - Where its name begins
 */
const standsAt = function(attribute, content) {
  return placeAt(content, named(attribute, content))
}

/**
 * A fix that deletes an attribute, leading gap and all. The span is read from
 * the source rather than rebuilt from the attribute. xmldom reports an
 * attribute at its opening delimiter, so the delimiter is whichever quote
 * stands there and the value ends where that same quote returns — XML forbids
 * it inside — while the walk backwards over the `=` and the name crosses gaps
 * of any width, a line ending among them. It reaches one gap further back than
 * {@link standsAt} does, because a deletion that left the gap in front of the
 * name behind would close two attributes up against each other.
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
  const start = opens(content, named(attribute, content))
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
  standsAt,
}
