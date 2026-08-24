/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The named XML entities the source may spell a character with.
 * @type {{[name: string]: string}}
 */
const NAMED = {lt: '<', gt: '>', amp: '&', quot: '"', apos: '\''}

/**
 * The three spellings of a line ending XML 1.0 §2.11 recognises, which a parser
 * counts alike when it numbers lines — so a walk that honours only `\n` would
 * disagree with the line a node reports itself on.
 * @type {RegExp}
 */
const ENDINGS = /\r\n|\r|\n/g

/**
 * The text indexed most recently and where its lines begin. Positions are
 * asked for one source at a time — every defect in a file, then every fix in
 * it — so remembering the last one spares the rescan without keeping any
 * earlier source alive, which a table of every text ever seen would do to an
 * embedder linting a buffer per keystroke (#336).
 * @type {{text: ?string, offsets: Array.<number>}}
 */
const LAST = {text: null, offsets: []}

/**
 * The offset each line of the given text starts at, computed once per text.
 * @param {string} text - Source text
 * @return {Array.<number>} - Zero-based offset of every line's first character
 */
const starts = function(text) {
  if (LAST.text !== text) {
    LAST.text = text
    LAST.offsets = [0].concat(
      [...text.matchAll(ENDINGS)].map((end) => end.index + end[0].length),
    )
  }
  return LAST.offsets
}

/**
 * Absolute offset in a text of a one-based line and column.
 * @param {string} text - Source text
 * @param {number} line - One-based line number
 * @param {number} col - One-based column number
 * @return {number} - Zero-based offset into the text
 */
const offsetAt = function(text, line, col) {
  return starts(text)[line - 1] + col - 1
}

/**
 * The one-based line and column of an absolute offset, which is the reverse of
 * {@link offsetAt} and the shape a defect is reported in.
 * @param {string} text - Source text
 * @param {number} at - Zero-based offset into the text
 * @return {{line: number, pos: number}} - Where that offset stands
 */
const placeAt = function(text, at) {
  const lines = starts(text)
  let line = 0
  while (line + 1 < lines.length && lines[line + 1] <= at) {
    line += 1
  }
  return {line: line + 1, pos: at - lines[line] + 1}
}

/**
 * The decoded character at a raw offset and the offset just past it. A named
 * XML entity reads as the single character it stands for, and a line ending as
 * the `\n` a parser turns it into, so a CRLF source is one character two
 * offsets wide. Anything else an `&` opens yields `undefined`, so a match over
 * it fails and the caller backs off.
 * @param {string} content - Raw source text
 * @param {number} at - Zero-based offset to read from
 * @return {[(string|undefined), number]} - The decoded character (or undefined)
 *  and the next raw offset
 */
const character = function(content, at) {
  let read = [content[at], at + 1]
  if (content[at] === '&') {
    const closing = content.indexOf(';', at)
    read = [undefined, at + 1]
    if (closing >= 0) {
      read = [NAMED[content.slice(at + 1, closing)], closing + 1]
    }
  } else if (content[at] === '\r') {
    read = ['\n', at + 1]
    if (content[at + 1] === '\n') {
      read = ['\n', at + 2]
    }
  }
  return read
}

/**
 * The raw offset reached after skipping that many decoded characters, so an
 * offset into a parsed value maps back to its true place even when an entity
 * ahead of it is several characters wide. Where the span holds no `&` and no
 * `\r` the answer is the count itself, the first wide one always sitting
 * inside it. A count below zero answers `at`.
 * @param {string} content - Raw source text
 * @param {number} at - Zero-based offset to start from
 * @param {number} count - Number of decoded characters to skip
 * @return {number} - The raw offset after `count` decoded characters
 */
const skip = function(content, at, count) {
  const ahead = content.slice(at, at + count)
  let raw = at + count
  if (count < 0 || ahead.includes('&') || ahead.includes('\r')) {
    raw = at
    for (let seen = 0; seen < count; seen++) {
      raw = character(content, raw)[1]
    }
  }
  return raw
}

module.exports = {
  NAMED,
  offsetAt,
  placeAt,
  character,
  skip,
}
