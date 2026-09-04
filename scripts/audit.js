/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const fs = require('fs')

/**
 * The status the runner leaves when the registry answered nothing, which is the
 * one number the nightly step and this file share: the step retries on it and
 * forgives it, so a `1` here would turn every outage into a failure and a `0`
 * into a tree that reads audited and was not. `test/audit.test.js` holds the
 * step to it.
 * @type {number}
 */
const UNANSWERED = 2

/**
 * The grades npm gives an advisory, worst first, so a tally reads in the order
 * a maintainer acts on it.
 * @type {Array.<string>}
 */
const GRADES = ['critical', 'high', 'moderate', 'low', 'info']

/**
 * How many advisories a verdict names before it counts the rest. The dearest
 * reading this repository has taken is nine (#841), so the cap stands above
 * every tree anybody here has audited and truncates only one nobody could read
 * off an annotation anyway.
 * @type {number}
 */
const SHOWN = 12

/**
 * Whatever npm printed, as a reading: the report where it is one, and otherwise
 * the object npm printed in its place — or, where that is no JSON at all, the
 * first line of it under the key an npm fault would have carried it in, since a
 * crash says as much about the audit as a refusal does and reads the same way.
 * @param {string} text - What npm wrote to its stdout
 * @return {object} - The reading
 */
const read = function(text) {
  let reading = {}
  try {
    reading = JSON.parse(text)
  } catch {
    const first = text.trim().split('\n')[0]
    if (first !== '') {
      reading = {message: first}
    }
  }
  return reading
}

/**
 * Whether a reading is an audit report at all. Both keys are asked for, a
 * verdict standing on the tally inside the second and the first being what npm
 * stamps a report with.
 * @param {object} reading - What npm printed
 * @return {boolean} - Whether it reported
 */
const reported = function(reading) {
  return reading.auditReportVersion !== undefined &&
    reading.metadata?.vulnerabilities !== undefined
}

/**
 * Whether the registry left the request unanswered, which is the one fault the
 * nightly forgives. npm exits `1` on an advisory and on a 503 alike, so an exit
 * code cannot tell them apart; what can is that npm names a fault of its own —
 * an `ENOLOCK`, a bad flag — in `error.code` and names none for a registry that
 * did not answer.
 * @param {object} reading - What npm printed
 * @return {boolean} - Whether nothing came back to judge
 */
const unanswered = function(reading) {
  return !reported(reading) && reading.error?.code === undefined
}

/**
 * A count of advisories, in the number the count itself asks for.
 * @param {number} amount - How many
 * @return {string} - The count and its noun
 */
const counted = function(amount) {
  let said = `${amount} advisories`
  if (amount === 1) {
    said = `${amount} advisory`
  }
  return said
}

/**
 * Every advisory as its package and its grade, worst grade first and `SHOWN` of
 * them before the rest are counted. Which package is at fault is the whole of
 * what a maintainer needs off the annotation, a tally alone naming nothing to
 * act on (#884).
 * @param {object} vulnerabilities - The advisories, keyed by package
 * @return {string} - What to name of them
 */
const listed = function(vulnerabilities) {
  const named = Object.values(vulnerabilities)
    .sort(
      (one, two) => GRADES.indexOf(one.severity) - GRADES.indexOf(two.severity),
    )
    .map((one) => `${one.name} ${one.severity}`)
  let said = named.slice(0, SHOWN).join(', ')
  if (named.length > SHOWN) {
    said = `${said}, and ${named.length - SHOWN} more`
  }
  return said
}

/**
 * What npm blamed a non-answer on, where it named anything: the registry's own
 * words, which say whether the tree waits on a 503 or on a name that does not
 * resolve.
 * @param {object} reading - What npm printed
 * @return {string} - The cause, opened by a colon, or an empty string
 */
const cause = function(reading) {
  let said = ''
  if (reading.message !== undefined) {
    said = `: ${reading.message}`
  }
  return said
}

/**
 * What is wrong with what npm audit read, or an empty string when nothing is.
 * Three ways, and only the first of them is a finding: the registry answered
 * nothing, npm refused the command, or a report came back naming advisories. A
 * tree that went unaudited is no more a pass than a suite that asserted nothing
 * is (#645, #884).
 * @param {object} reading - What npm printed
 * @return {string} - The fault, or an empty string
 */
const verdict = function(reading) {
  let said = ''
  if (unanswered(reading)) {
    said = 'npm audit read no report from the registry, so nothing was ' +
      `audited${cause(reading)}`
  } else if (!reported(reading)) {
    said = 'npm audit could not run over this tree, so nothing was audited: ' +
      `${reading.error.code}, ${reading.error.summary.replace(/[.]$/, '')}`
  } else if (reading.metadata.vulnerabilities.total > 0) {
    said = `npm audit found ${
      counted(reading.metadata.vulnerabilities.total)}: ${
      listed(reading.vulnerabilities)}`
  }
  return said
}

if (require.main === module) {
  const reading = read(fs.readFileSync(process.argv[2], 'utf-8'))
  const said = verdict(reading)
  if (said !== '') {
    let level = 'error'
    let code = 1
    if (unanswered(reading)) {
      level = 'warning'
      code = UNANSWERED
    }
    process.stdout.write(`::${level}::${said}\n`)
    process.exitCode = code
  }
}

module.exports = {read, reported, unanswered, verdict, UNANSWERED}
