/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The defects a tree already had when it adopted xslint, stored so a run
 * reports only the ones added since (#1188). Each is counted under its file,
 * relative to the baseline's directory, its check, and a hash of the text of
 * the line it stands on, so a line moved by an edit above it still matches. A
 * count the run no longer reaches is stale, for the caller to fail on.
 */

const crypto = require('crypto')
const path = require('path')
const {GAPS} = require('./tokens')

/**
 * A stylesheet's path as a baseline in `base` records it, in posix form, so
 * the file reads the same whichever system wrote it.
 * @param {string} file - Path of the stylesheet
 * @param {string} base - Directory the baseline file lives in
 * @return {string} - The relative posix path
 */
const relative = function(file, base) {
  return path.relative(base, file).split(path.sep).join('/')
}

/**
 * Hash of the text of the line a defect stands on, its gaps collapsed so a
 * reindented line keeps its hash.
 * @param {object} defect - A defect a run reported
 * @param {Map.<string, Array.<string>>} lines - Lines of each source by file
 * @return {string} - Sixteen hex digits
 */
const hashed = function(defect, lines) {
  const text = lines.get(defect.file)[defect.line - 1]
    .split(GAPS)
    .filter(Boolean)
    .join(' ')
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/**
 * Lines of every source, keyed by the file its defects name.
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @return {Map.<string, Array.<string>>} - Lines by file
 */
const linesOf = function(sources) {
  return new Map(
    sources.map((source) => [source.file, source.content.split(/\r?\n/)]),
  )
}

/**
 * The baseline a run's defects make, every level of it sorted by key in code
 * unit order, never the machine's locale, so a rewrite after an unrelated
 * change leaves the file as it was (#638).
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @param {string} base - Directory the baseline file lives in
 * @return {object} - Counts by file, then check, then hash
 */
const recorded = function(reported, sources, base) {
  const lines = linesOf(sources)
  const counts = {}
  const ordered = reported
    .map((defect) => [
      relative(defect.file, base), defect.name, hashed(defect, lines),
    ])
    .sort((left, right) => {
      const one = left.join('\n')
      const two = right.join('\n')
      return Number(one > two) - Number(one < two)
    })
  for (const [file, name, hash] of ordered) {
    counts[file] ??= {}
    counts[file][name] ??= {}
    counts[file][name][hash] = (counts[file][name][hash] ?? 0) + 1
  }
  return counts
}

/**
 * The defects a baseline does not cover, and the entries of the files linted
 * that it records more often than the run drew them. A file the run did not
 * read is never stale, since a run over part of a tree says nothing of it.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @param {object} baseline - What `recorded` answered for an earlier run
 * @param {string} base - Directory the baseline file lives in
 * @return {{fresh: Array.<object>, stale: Array.<{file: string, name: string,
 *  count: number}>}} - Defects to report and entries to rewrite
 */
const matched = function(reported, sources, baseline, base) {
  const lines = linesOf(sources)
  const left = structuredClone(baseline)
  const fresh = reported.filter((defect) => {
    const counts = left[relative(defect.file, base)]?.[defect.name] ?? {}
    const hash = hashed(defect, lines)
    const covered = (counts[hash] ?? 0) > 0
    if (covered) {
      counts[hash]--
    }
    return !covered
  })
  const stale = sources
    .map((source) => relative(source.file, base))
    .flatMap((file) => Object.entries(left[file] ?? {}).map(
      ([name, counts]) => ({
        file: file,
        name: name,
        count: Object.values(counts).reduce((sum, count) => sum + count, 0),
      }),
    ))
    .filter((entry) => entry.count > 0)
  return {fresh: fresh, stale: stale}
}

module.exports = {
  recorded,
  matched,
}
