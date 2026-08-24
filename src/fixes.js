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
 * The text a raw span decodes to, walked the way `src/fixer.js` walks it, so a
 * value taken from the source is the value read back there. A named entity
 * decodes to its character and a line ending to the `\n` a parser makes of it,
 * letting the span of a wrapped attribute match. A numeric or unknown entity
 * decodes to nothing either walk expresses, so the fix is declined.
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
 * Arithmetic over the name answered this until #681 — `columnNumber` less the
 * name's length — which lands on the first letter only where the source spells
 * `name="value"` exactly: every gap XML allows moves the delimiter while the
 * name stays put, so `xmlns:dead = "urn:dead"` was reported two columns off.
 * @param {Node} attribute - The attribute node
 * @param {string} content - Raw source text of the file it stands in
 * @return {{line: number, pos: number}} - Where its name begins
 */
const standsAt = function(attribute, content) {
  return placeAt(content, named(attribute, content))
}

/**
 * A fix that deletes an attribute, its span read from the source rather than
 * rebuilt as ` name="value"`, which declined every other spelling (#594).
 * xmldom reports one at its delimiter, so the quote is whichever stands there
 * and the walk back over the `=` and the name crosses any gap. It reaches one
 * gap further than {@link standsAt}, or two attributes would close up.
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

/**
 * Whether nothing but gap stands across the span. Two questions are that one:
 * whether an element owns the line it stands on, asked of the text in front of
 * it, and whether it holds anything at all, asked of the text between its tags.
 * @param {string} content - Raw source text
 * @param {number} from - Zero-based offset to read from
 * @param {number} to - Zero-based offset to stop at
 * @return {boolean} - True when every character of the span is XML `S`
 */
const gapped = function(content, from, to) {
  return Array.from(content.slice(from, to)).every(
    (one) => WHITESPACE.includes(one),
  )
}

/**
 * How each delimiter is spelled where it stands inside the value it opens.
 * @type {{[quote: string]: string}}
 */
const REFERENCES = {'"': '&quot;', '\'': '&apos;'}

/**
 * The two characters an attribute value may be delimited by, which is what a
 * walk over a tag steps across and the same list {@link escaped} spells one
 * with — asked here as keys rather than written down a second time.
 * @type {Array.<string>}
 */
const QUOTES = Object.keys(REFERENCES)

/**
 * The offset just past the `>` that closes the tag opening at `at`. A `>` is
 * legal inside an attribute value — XML forbids only `<` and the delimiter
 * there — so the walk steps over each quoted value whole rather than stopping
 * at the first bracket it meets, and the quote it steps over is whichever one
 * opened the value.
 * @param {string} content - Raw source text
 * @param {number} at - Zero-based offset of the tag's `<`
 * @return {number} - Offset just past the tag's `>`
 */
const tagged = function(content, at) {
  let raw = at
  while (content[raw] !== '>') {
    let next = raw + 1
    if (QUOTES.includes(content[raw])) {
      next = content.indexOf(content[raw], raw + 1) + 1
    }
    raw = next
  }
  return raw + 1
}

/**
 * The span a cut of the element takes: the whole line where the element owns
 * it, the element alone where it does not. Owning it means nothing but gap on
 * either side, indentation in front and a line ending behind, and then the
 * line goes with it. One condition rather than two, the indentation of a
 * shared line belonging to the line and not to the element.
 * @param {string} content - Raw source text
 * @param {number} at - Zero-based offset of the element's `<`
 * @param {number} past - Zero-based offset just past the element
 * @return {{from: number, to: number}} - The span the cut takes
 */
const lined = function(content, at, past) {
  let raw = past
  while (WHITESPACE.includes(content[raw]) && content[raw] !== '\n' &&
    content[raw] !== '\r') {
    raw += 1
  }
  const start = at - placeAt(content, at).pos + 1
  let span = {from: at, to: past}
  if ((content[raw] === '\n' || content[raw] === '\r') &&
    gapped(content, start, at)) {
    span = {from: start, to: character(content, raw)[1]}
  }
  return span
}

/**
 * A fix that deletes a whole element, taking the line it stands on where it
 * owns one, which is {@link lined}'s question. Offsets come from the source:
 * the element opens at the `<` xmldom reports and the tag closes at the first
 * `>` outside an attribute value. The long spelling ends at its end tag's `>`,
 * found only where the source between the two tags is gap (#793).
 * @param {Element} element - The element to delete
 * @param {string} content - Raw source text of the file it stands in
 * @return {({line: number, col: number, value: string,
 *  replacement: string}|undefined)} - The fix, or nothing where the element
 *  holds more than gap
 */
const excision = function(element, content) {
  const at = offsetAt(content, element.lineNumber, element.columnNumber)
  const opened = tagged(content, at)
  let past = opened
  if (content[opened - 2] !== '/') {
    const closing = content.indexOf('</', opened)
    past = 0
    if (gapped(content, opened, closing)) {
      past = tagged(content, closing)
    }
  }
  let cut
  if (past > 0) {
    const {from, to} = lined(content, at, past)
    const where = placeAt(content, from)
    cut = {
      line: where.line,
      col: where.pos,
      value: decoded(content, from, to),
      replacement: '',
    }
  }
  return cut
}

/**
 * The text as a value delimited by the given quote may hold it, the three
 * characters XML forbids there written as references: an `&`, which would open
 * a reference of its own, a `<`, and the delimiter. The `&` goes first or it
 * would escape the two behind it. A `>` is left bare, XML allowing one:
 * encoding cannot recover what the author wrote as a reference.
 * @param {string} text - The decoded text to write
 * @param {string} quote - The delimiter the value stands in
 * @return {string} - The text as that value may spell it
 */
const escaped = function(text, quote) {
  return text
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split(quote).join(REFERENCES[quote])
}

/**
 * A fix that replaces an attribute's value alone, leaving the name, the gaps
 * round the `=` and the delimiter as they stand: the value opens one character
 * past the delimiter xmldom reports. Rebuilding the whole attribute as
 * `name="value"` assumed all three, so the fixer announced a fix and then
 * declined it (#718). The delimiter is read, a fix carrying decoded text.
 * @param {Node} attribute - The attribute whose value is rewritten
 * @param {string} replacement - The decoded value to write in its place
 * @param {string} content - Raw source text of the file it stands in
 * @return {{line: number, col: number, value: string, replacement: string}} -
 *  The fix
 */
const substitution = function(attribute, replacement, content) {
  return {
    line: attribute.lineNumber,
    col: attribute.columnNumber + 1,
    value: attribute.value,
    replacement: escaped(
      replacement,
      content[offsetAt(content, attribute.lineNumber, attribute.columnNumber)],
    ),
  }
}

module.exports = {
  deletion,
  excision,
  standsAt,
  substitution,
}
