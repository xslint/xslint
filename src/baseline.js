/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The defects a tree held when it adopted xslint, stored so a run reports only
 * the ones added since (#1188). Each is counted by file, check, and a hash of
 * the text of its line, so a line moved by an edit above it still matches. A
 * run judges and rewrites only the files it read and the checks it ran.
 */

const crypto = require('crypto')
const {compared, slashed} = require('./helpers')
const {ENDINGS} = require('./source')
const {GAPS} = require('./tokens')

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
 * Lines of every source, keyed by the file its defects name, split at every
 * line ending the parser counts, a bare carriage return among them.
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @return {Map.<string, Array.<string>>} - Lines by file
 */
const linesOf = function(sources) {
  return new Map(
    sources.map((source) => [source.file, source.content.split(ENDINGS)]),
  )
}

/**
 * An object with its keys ranked by `compared`, in code unit order, so the
 * machine's locale cannot reorder them (#638), and each value mapped by
 * `inner`.
 * @param {object} unordered - Keys in any order
 * @param {function(*): *} inner - What each value becomes
 * @return {object} - The same keys, ordered
 */
const ordered = function(unordered, inner) {
  return Object.fromEntries(
    Object.keys(unordered)
      .sort(compared)
      .map((key) => [key, inner(unordered[key])]),
  )
}

/**
 * The baseline a run's defects make over what an earlier one recorded: its
 * entries for a file the run did not read, or a check it did not run, stay as
 * they were, and every other entry is replaced by what the run drew.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @param {string} base - Directory the baseline file lives in
 * @param {Array.<string>} ran - Names of the checks the run ran
 * @param {object} earlier - What the baseline file held before, or `{}`
 * @return {object} - Counts by file, then check, then hash
 */
const recorded = function(reported, sources, base, ran, earlier) {
  const lines = linesOf(sources)
  const read = sources.map((source) => slashed(source.file, base))
  const counts = {}
  for (const [file, checks] of Object.entries(earlier)) {
    for (const [name, hashes] of Object.entries(checks)) {
      if (!read.includes(file) || !ran.includes(name)) {
        counts[file] ??= {}
        counts[file][name] = {...hashes}
      }
    }
  }
  for (const defect of reported) {
    const file = slashed(defect.file, base)
    const hash = hashed(defect, lines)
    counts[file] ??= {}
    counts[file][defect.name] ??= {}
    counts[file][defect.name][hash] = (counts[file][defect.name][hash] ?? 0) + 1
  }
  return ordered(
    counts, (checks) => ordered(checks, (hashes) => ordered(hashes, Number)),
  )
}

/**
 * The defects a baseline does not cover, and the entries it records more
 * often than the run drew them, among the files the run read and the checks
 * it ran, since a run says nothing of what it never looked at.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string, content: string}>} sources - What was linted
 * @param {object} baseline - What `recorded` answered for an earlier run
 * @param {string} base - Directory the baseline file lives in
 * @param {Array.<string>} ran - Names of the checks the run ran
 * @return {{fresh: Array.<object>, stale: Array.<{file: string, name: string,
 *  count: number}>}} - Defects to report and entries to rewrite
 */
const matched = function(reported, sources, baseline, base, ran) {
  const lines = linesOf(sources)
  const left = structuredClone(baseline)
  const fresh = reported.filter((defect) => {
    const counts = left[slashed(defect.file, base)]?.[defect.name] ?? {}
    const hash = hashed(defect, lines)
    const covered = (counts[hash] ?? 0) > 0
    if (covered) {
      counts[hash]--
    }
    return !covered
  })
  const stale = sources
    .map((source) => slashed(source.file, base))
    .flatMap((file) => Object.entries(left[file] ?? {}).map(
      ([name, counts]) => ({
        file: file,
        name: name,
        count: Object.values(counts).reduce((sum, count) => sum + count, 0),
      }),
    ))
    .filter((entry) => entry.count > 0 && ran.includes(entry.name))
  return {fresh: fresh, stale: stale}
}

module.exports = {
  recorded,
  matched,
}
