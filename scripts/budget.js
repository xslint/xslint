/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

/**
 * How many times a run's own seconds its budget may stand above them before it
 * has stopped being a bar. The nightly tier exists because
 * `test/scaling.test.js` measures a share of a run and so cannot see a
 * constant that slows every stage at once, and a budget cut once and left
 * behind gives that back: #755's quadratic cost DocBook-XSL 44 s against a
 * budget of 180 and would have passed it twice over. Four, as `SLACK` in
 * `test/scaling.test.js` is, and for the same reason — a shared runner
 * disagrees with a developer machine about a wall clock by more than it
 * disagrees about a share, so the two-sided window has to hold a slow night as
 * well as a fast one.
 * @type {number}
 */
const SLACK = 4

/**
 * The fewest seconds a reading has to hold for the ratchet to judge it. The
 * runner times the run with `date +%s`, so anything faster than a second reads
 * `0` or `1` — and `0` stands more than any multiple of itself below every
 * budget there could be, which would fire the ratchet on a corpus that never
 * arrived. That is the count check's defect to report rather than this one's,
 * so a reading of nothing is no reading here.
 * @type {number}
 */
const FLOOR = 1

/**
 * What is wrong with what a corpus cost, or an empty string when nothing is.
 * Two directions, because a budget is a ratchet rather than a licence: past it
 * the run has slowed, and so far under it that `SLACK` says the budget has
 * stopped standing between a healthy run and a regression.
 * @param {string} name - Name of the corpus
 * @param {number} spent - Seconds the run spent
 * @param {number} budget - Seconds it is allowed
 * @return {string} - The fault, or an empty string
 */
const verdict = function(name, spent, budget) {
  let said = ''
  if (spent > budget) {
    said = `linting ${name} took ${spent}s, past its ${budget}s budget`
  } else if (spent >= FLOOR && budget > SLACK * spent) {
    said = `linting ${name} took ${spent}s where its budget allows ` +
      `${budget}s, which is over ${SLACK} times the run: the budget has ` +
      `stopped being a bar and wants re-cutting from a measurement`
  }
  return said
}

if (require.main === module) {
  const said = verdict(
    process.argv[2], Number(process.argv[3]), Number(process.argv[4]),
  )
  if (said !== '') {
    process.stdout.write(`::error::${said}\n`)
    process.exitCode = 1
  }
}

module.exports = {verdict, SLACK}
