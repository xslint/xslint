/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const fs = require('fs')
const path = require('path')

/**
 * How many differing lines a verdict names before it counts the rest. A check
 * whose scope widens moves thousands at once, and an annotation nobody can read
 * says as little as none: ten of them name the shape of a change, and the file
 * the gate points at holds the whole of it.
 * @type {number}
 */
const SHOWN = 10

/**
 * A reported file named against the corpus it stands in, in posix form, so a
 * snapshot reads the same whatever directory the corpus was cloned into.
 * @param {string} root - Directory the corpus was linted at
 * @param {string} file - The file as the report names it
 * @return {string} - Its path inside the corpus
 */
const within = function(root, file) {
  return path.relative(root, path.resolve(file)).split(path.sep).join('/')
}

/**
 * A JSON report as the lines a snapshot holds: where each defect stands, the
 * check that found it, and the tier and replacement of its fix where it carries
 * one, a changed replacement being a behaviour change as much as a new
 * detection (#638). The replacement is written as a JSON string, so no text a
 * corpus carries can put a second line where one defect stands.
 * @param {string} root - Directory the corpus was linted at
 * @param {Array.<object>} reported - The defects, as `--format json` emits them
 * @return {Array.<string>} - One line per defect
 */
const lined = function(root, reported) {
  return reported.map((defect) => {
    let said = `${within(root, defect.file)}:${defect.line}:` +
      `${defect.column} ${defect.rule}`
    if (defect.fix) {
      let tier = 'fix'
      if (defect.fix.suggestion) {
        tier = 'suggestion'
      }
      said = `${said} ${tier} ${JSON.stringify(defect.fix.replacement)}`
    }
    return said
  })
}

/**
 * The lines of one list that the other does not hold at all.
 * @param {Array.<string>} lines - Lines to judge
 * @param {Array.<string>} other - Lines to judge them against
 * @return {Array.<string>} - Those of the first standing nowhere in the second
 */
const missing = function(lines, other) {
  const held = new Set(other)
  return lines.filter((line) => !held.has(line))
}

/**
 * What a run draws and a snapshot does not, marked `+`, and what a snapshot
 * holds and the run no longer draws, marked `-`.
 * @param {Array.<string>} expected - Lines the snapshot holds
 * @param {Array.<string>} reading - Lines the run drew
 * @return {Array.<string>} - The difference, gained before lost
 */
const parted = function(expected, reading) {
  return missing(reading, expected).map((line) => `+${line}`).concat(
    missing(expected, reading).map((line) => `-${line}`),
  )
}

/**
 * As many of the differing lines as a message may name, and how many more there
 * are. An empty difference is a difference all the same, in one of two ways:
 * the lines are the same and stand in another order, or one of them repeats a
 * different number of times. A reorder says nothing about any single line, so
 * naming repetition alone would point a reader at the wrong cause.
 * @param {Array.<string>} lines - The difference
 * @return {string} - What to name of it
 */
const some = function(lines) {
  let said = lines.slice(0, SHOWN).join(', ')
  if (lines.length === 0) {
    said = 'nothing but the order the lines stand in, or how often one repeats'
  } else if (lines.length > SHOWN) {
    said = `${said}, and ${lines.length - SHOWN} more`
  }
  return said
}

/**
 * A count of defects, in the number the count itself asks for.
 * @param {number} amount - How many
 * @return {string} - The count and its noun
 */
const counted = function(amount) {
  let said = `${amount} defects`
  if (amount === 1) {
    said = `${amount} defect`
  }
  return said
}

/**
 * What is wrong with what a corpus drew, or an empty string when nothing is: a
 * report that is not the one committed beside it, line for line and in order.
 * @param {string} name - Name of the corpus
 * @param {Array.<string>} expected - Lines its snapshot holds
 * @param {Array.<string>} reading - Lines the run drew
 * @return {string} - The fault, or an empty string
 */
const verdict = function(name, expected, reading) {
  let said = ''
  if (reading.join('\n') !== expected.join('\n')) {
    said = `linting ${name} no longer draws what its snapshot holds, ` +
      `${counted(reading.length)} against ${expected.length}, so regenerate ` +
      `it once the change is meant: ${some(parted(expected, reading))}`
  }
  return said
}

if (require.main === module) {
  const snapshot = process.argv[4]
  const reading = lined(
    process.argv[2], JSON.parse(fs.readFileSync(process.argv[3], 'utf-8')),
  )
  if (process.argv.includes('--write')) {
    fs.writeFileSync(snapshot, `${reading.join('\n')}\n`)
  } else {
    const said = verdict(
      path.basename(snapshot, '.txt'),
      fs.readFileSync(snapshot, 'utf-8').split('\n').filter(
        (line) => line !== '',
      ),
      reading,
    )
    if (said !== '') {
      process.stdout.write(`::error::${said}\n`)
      process.exitCode = 1
    }
  }
}

module.exports = {lined, verdict, SHOWN}
