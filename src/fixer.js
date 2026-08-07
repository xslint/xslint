/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {character, offsetAt} = require('./source')
const {logger} = require('./logger')

/**
 * The raw offset just past the source that decodes to `value` starting at
 * `from`, or `-1` when the source there does not decode to `value` (an
 * already-edited file). Decoding as it walks matches a `>` written `&gt;` or
 * literally alike.
 *
 * A line ending answers to a space as well as to itself, which is the last
 * normalisation between a parsed value and its source: XML 1.0 §3.3.3 turns
 * every line ending inside an attribute value into a space, so a check reading
 * `count(item) > 0` off a value wrapped after `count(item)` builds a fix whose
 * space stands where the source holds a newline. Without this the comparison
 * failed on that one character and the whole fix was declined, so no fix could
 * reach an expression a line wrap crossed — announced as fixable and then
 * refused with "the source no longer matches", which names an edit that never
 * happened (#629).
 *
 * The licence belongs here and not in `character`, which serves the position
 * walk too and cannot tell an attribute value from element content, where a
 * line ending stays one and normalisation never applies. Here it widens only
 * what a fix may match, and only towards the text the parser has already read.
 * @param {string} content - Raw source text
 * @param {number} from - Zero-based offset to match from
 * @param {string} value - The decoded fix value
 * @return {number} - The raw offset after the match, or -1
 */
const decodes = function(content, from, value) {
  let raw = from
  const matched = [...value].every((char) => {
    let step = [null, raw]
    if (raw < content.length) {
      step = character(content, raw)
    }
    const [decoded, next] = step
    raw = next
    return decoded === char || (char === ' ' && decoded === '\n')
  })
  let past = -1
  if (matched) {
    past = raw
  }
  return past
}

/**
 * The edits that overlap none already accepted, in source order. Two fixes
 * whose spans intersect cannot both be applied: the second would splice the
 * text with offsets the first has already shifted, swallowing whatever now sits
 * at the tail of its stale span. The left-most span wins, and where two start
 * together the wider one does — an outer fix replaces the very text its inner
 * neighbour would have edited, so the neighbour is moot rather than merely
 * postponed. A dropped edit is announced and its defect stays in the report,
 * for a later run to fix.
 * @param {Array.<{defect: object, start: number, end: number}>} edits - Edits,
 *  each already verified against the file as it was read
 * @return {Array.<{defect: object, start: number, end: number}>} - The ones
 *  that do not overlap
 */
const disjoint = function(edits) {
  const kept = []
  let border = 0
  for (const edit of [...edits].sort(
    (left, right) => left.start - right.start || right.end - left.end,
  )) {
    if (edit.start < border) {
      logger.warn(
        `Skipped fixing ${edit.defect.name} at ` +
        `${edit.defect.file}:${edit.defect.fix.line}, it overlaps another fix`,
      )
    } else {
      kept.push(edit)
      border = edit.end
    }
  }
  return kept
}

/**
 * Apply the fixes carried by defects to their sources, returning the rewritten
 * content of each changed file and the defects whose fix was applied. Each fix
 * names a source position, a decoded `value`, and its replacement. The position
 * is already the true one, worked out against the raw text by `src/checks.js`,
 * so the fixer goes straight there and matches `value` decoding as it goes —
 * a `>`
 * written `&gt;` matches alike. A fix whose source no longer decodes to `value`
 * (an already-edited file) is skipped rather than corrupting, and so is one
 * overlapping a fix already accepted in the same run — the spans are proved
 * against the file as read, which says nothing about what an earlier edit has
 * since moved. Fixes for one file are applied from the end backwards so earlier
 * offsets stay valid.
 * @param {Array.<{file: string, content: string}>} sources - Original sources
 * @param {Array.<{file: string, fix: {line: number, col: number,
 *  value: string, replacement: string, suggestion: boolean}}>}
 *  defects - Defects; only those carrying a `fix` are fixed (`offset`
 *  defaults to 0)
 * @param {boolean} suggestions - Whether to also apply the fixes marked as
 *  suggestions, not just the safe ones
 * @return {{contents: Map.<string, string>, applied: Array.<object>}} - The
 *  rewritten content by file and the defects that were applied
 */
const fixed = function(sources, defects, suggestions = false) {
  const fixable = defects.filter(
    (defect) => defect.fix && (suggestions || !defect.fix.suggestion),
  )
  const contents = new Map()
  const applied = []
  for (const {file, content} of sources) {
    const edits = disjoint(
      fixable
        .filter((defect) => defect.file === file)
        .map((defect) => {
          const start = offsetAt(content, defect.fix.line, defect.fix.col)
          return {
            defect: defect,
            start: start,
            end: decodes(content, start, defect.fix.value),
          }
        })
        .filter(({defect, end}) => {
          if (end < 0) {
            logger.warn(
              `Skipped fixing ${defect.name} at ${file}:${defect.fix.line}, ` +
              `the source no longer matches`,
            )
          }
          return end >= 0
        }),
    )
    if (edits.length > 0) {
      let text = content
      for (const {defect, start, end} of [...edits].reverse()) {
        text =
          text.slice(0, start) +
          defect.fix.replacement +
          text.slice(end)
        applied.push(defect)
      }
      contents.set(file, text)
    }
  }
  return {contents: contents, applied: applied}
}

module.exports = {
  fixed,
}
