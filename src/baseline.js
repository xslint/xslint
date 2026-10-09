/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The defects a tree held when it adopted xslint, stored so a run reports only
 * the ones added since (#1188). Each is counted by file and check alone, so an
 * edit to its line cannot bring it back, and a file whose count for a check
 * rises reports every defect of that check (#1197). A run judges, prunes, and
 * rewrites only the files it read and the checks it ran.
 */

const fs = require('fs')
const path = require('path')
const {compared, slashed} = require('./helpers')

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
 * Counts by file, then check, each level ordered.
 * @param {object} counts - Counts in any order
 * @return {object} - The same counts, ordered
 */
const layered = function(counts) {
  return ordered(counts, (checks) => ordered(checks, Number))
}

/**
 * How many defects of each check a run drew in each file.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {string} base - Directory the baseline file lives in
 * @return {object} - Counts by file, then check
 */
const tallied = function(reported, base) {
  const counts = {}
  for (const defect of reported) {
    const file = slashed(defect.file, base)
    counts[file] ??= {}
    counts[file][defect.name] = (counts[file][defect.name] ?? 0) + 1
  }
  return counts
}

/**
 * A baseline file's content, refused when it holds anything but a count for a
 * check, as one written before counts replaced line hashes does.
 * @param {object} baseline - What the baseline file holds
 * @param {string} file - Path of the baseline file
 * @return {object} - The same content
 */
const counted = function(baseline, file) {
  for (const checks of Object.values(baseline)) {
    for (const count of Object.values(checks)) {
      if (!Number.isInteger(count)) {
        throw new Error(
          `Baseline file ${file} holds line hashes where counts stand, delete it and record it again with --baseline-write`,
        )
      }
    }
  }
  return baseline
}

/**
 * The baseline a run's defects make over what an earlier one recorded: its
 * entries for a file the run did not read, or a check it did not run, stay as
 * they were, and every other entry is replaced by what the run drew.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string}>} sources - What was linted
 * @param {string} base - Directory the baseline file lives in
 * @param {Array.<string>} ran - Names of the checks the run ran
 * @param {object} earlier - What the baseline file held before, or `{}`
 * @return {object} - Counts by file, then check
 */
const recorded = function(reported, sources, base, ran, earlier) {
  const read = sources.map((source) => slashed(source.file, base))
  const counts = tallied(reported, base)
  for (const [file, checks] of Object.entries(earlier)) {
    for (const [name, count] of Object.entries(checks)) {
      if (!read.includes(file) || !ran.includes(name)) {
        counts[file] ??= {}
        counts[file][name] = count
      }
    }
  }
  return layered(counts)
}

/**
 * The defects of a run split by a baseline: fresh, those of every check whose
 * count in a file rose past what it records, and recorded, the rest. Neither
 * the files read nor the checks run matter, so an editor splits as the
 * command line does without judging a stale entry (#1210).
 * @param {Array.<object>} reported - Defects the run reported
 * @param {{counts: object, base: string}} ledger - What `ledgerOf` answers,
 *  counts by file and check beside the directory their paths resolve against
 * @return {{fresh: Array.<object>, recorded: Array.<object>}} - Defects to
 *  report and defects the baseline holds
 */
const baselined = function(reported, ledger) {
  const drawn = tallied(reported, ledger.base)
  const fresh = reported.filter((defect) => {
    const file = slashed(defect.file, ledger.base)
    return drawn[file][defect.name] > (ledger.counts[file]?.[defect.name] ?? 0)
  })
  return {
    fresh: fresh,
    recorded: reported.filter((defect) => !fresh.includes(defect)),
  }
}

/**
 * The entries a baseline records more often than the run drew them, among the
 * files the run read and the checks it ran, since a run says nothing of what
 * it never looked at.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string}>} sources - What was linted
 * @param {object} baseline - What `recorded` answered for an earlier run
 * @param {string} base - Directory the baseline file lives in
 * @param {Array.<string>} ran - Names of the checks the run ran
 * @return {{stale: Array.<{file: string, name: string, count: number}>}} -
 *  Entries to rewrite
 */
const matched = function(reported, sources, baseline, base, ran) {
  const drawn = tallied(reported, base)
  return {
    stale: sources
      .map((source) => slashed(source.file, base))
      .flatMap((file) => Object.entries(baseline[file] ?? {}).map(
        ([name, count]) => ({
          file: file,
          name: name,
          count: count - (drawn[file]?.[name] ?? 0),
        }),
      ))
      .filter((entry) => entry.count > 0 && ran.includes(entry.name)),
  }
}

/**
 * The baseline with every count among the files the run read and the checks
 * it ran lowered to what the run drew, so a stale entry goes and a defect the
 * baseline never held stays out.
 * @param {Array.<object>} reported - Defects the run reported
 * @param {Array.<{file: string}>} sources - What was linted
 * @param {object} baseline - What `recorded` answered for an earlier run
 * @param {string} base - Directory the baseline file lives in
 * @param {Array.<string>} ran - Names of the checks the run ran
 * @return {object} - Counts by file, then check
 */
const trimmed = function(reported, sources, baseline, base, ran) {
  const drawn = tallied(reported, base)
  const read = sources.map((source) => slashed(source.file, base))
  const counts = {}
  for (const [file, checks] of Object.entries(baseline)) {
    for (const [name, count] of Object.entries(checks)) {
      let kept = count
      if (read.includes(file) && ran.includes(name)) {
        kept = Math.min(count, drawn[file]?.[name] ?? 0)
      }
      if (kept > 0) {
        counts[file] ??= {}
        counts[file][name] = kept
      }
    }
  }
  return layered(counts)
}

/**
 * The baseline a file holds, read and refused as `counted` refuses it, beside
 * the directory its paths resolve against.
 * @param {string} file - Path of the baseline file
 * @return {{counts: object, base: string}} - What `baselined` takes
 */
const ledgerOf = function(file) {
  return {
    counts: counted(JSON.parse(fs.readFileSync(file, 'utf-8')), file),
    base: path.dirname(file),
  }
}

module.exports = {
  recorded,
  matched,
  baselined,
  trimmed,
  counted,
  ledgerOf,
}
