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
 * either side — indentation in front, spelled in spaces, in tabs, or in any
 * width of either, and a line ending behind — and then the line goes with the
 * element rather than staying behind blank. Where anything else stands on that
 * line, a sibling written beside it, both ends stay where the element does and
 * the line survives holding whatever was already there. One condition rather
 * than two, because the indentation of a shared line belongs to the line and
 * not to the element cut out of it. A line ending is read through
 * {@link character}, so a CRLF goes as the one character a parser makes of it
 * rather than half of it.
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
 * owns one — which is {@link lined}'s question rather than this one's. Every
 * offset is read from the source: the element opens where xmldom reports it, at
 * its `<`, and the tag closes at the first `>` standing outside an attribute
 * value, so no gap, quote or empty-tag spelling has to be guessed at. An
 * element written the long way, `></xsl:import>`, ends at the `>` of its end
 * tag instead, which is found only where the source between the two tags is
 * gap — anything else there, a comment holding a `</` of its own among the
 * possibilities, and no fix is offered at all rather than a span cut through
 * the middle of something.
 *
 * Rebuilding the line as `' '.repeat(columnNumber - 1)` and then `<name
 * href="value"/>` was the shape before, and it assumed three things at once:
 * no gap around the `=`, a double-quoted delimiter, and an empty tag with
 * nothing in front of the `/>`. `src/fixer.js` applies a fix only where the
 * source decodes to its `value`, so only the canonical spelling was ever
 * applied. Eight others stand in one fixture now — a gap around the `=`,
 * single quotes with a trailing gap behind them, a space in front of the `/>`,
 * the long form, a wider gap after the element name, an element wrapped across
 * two lines, one sharing its line with a sibling that survives, and one ending
 * a line it does not own — and master applies none of them, each announced and
 * then refused with "the source no longer matches", the wording reserved for a
 * span an earlier edit had moved, on a file nothing had touched (#793). It is
 * #594, #681 and #718 one level out, at the element rather than the attribute.
 * Which tier the cut is offered at stays with the check offering it, the way it
 * does for the three builders beside this one.
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
 * The text as an attribute value delimited by the given quote may hold it, with
 * the three characters XML forbids there written as references: an `&`, which
 * would otherwise open a reference of its own, a `<`, and the delimiter, which
 * would otherwise close the value early. The `&` goes first or it would escape
 * the `&` of the two that follow it.
 *
 * A `>` is left as it stands, since an attribute value may hold one — so a
 * source that spelled it `&gt;` is written back with the bare character. That
 * is a change in spelling and not in value, which is the line this draws: the
 * text a fix carries is the *decoded* value, and encoding it again cannot
 * recover which characters the author chose to write as references.
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
 * A fix that replaces an attribute's value, leaving its name, the gaps around
 * its `=` and its delimiter as the source spells them. Nothing about that
 * spelling has to be known: the value opens one character past the delimiter
 * xmldom reports, whichever quote stands there, and the value the parser read
 * is what `src/fixer.js` decodes the source back to.
 *
 * Rebuilding the whole attribute as `name="value"` was the shape before, and
 * it assumed three things at once — that the name stands a fixed distance in
 * front of the delimiter, that the delimiter is a double quote, and that no gap
 * surrounds the `=`. Ordinary XML defeats each of them, and they fail together:
 * the column lands past the name and the text stands nowhere in the file, so
 * the fixer announced the fix and then declined it as no longer matching,
 * naming an edit that never happened (#718). Narrowing to the value is what
 * removes the assumption rather than repairing it — a name nobody rewrites is a
 * name nobody has to find.
 *
 * The delimiter is still read from the source, because the value written back
 * has to be spelled as a value standing in *that* quote. What a fix carries is
 * the decoded text, so an expression the source wrote `//a[@x &lt; 1]` arrives
 * holding a bare `<` and would close the element early were it written as it
 * stands. Reading the character xmldom points at is not the guess this whole
 * change removes — the delimiter is the one position the parser reports
 * exactly, which is why {@link deletion} reads it too; what nobody can find is
 * the *name*, and no fix here looks for one.
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
