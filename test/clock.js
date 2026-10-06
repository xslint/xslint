/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The one clock every in-process timing reads, the chains of
 * `test/chains.js`. Processor time rather than the wall, which
 * charges a window for every slice the scheduler hands elsewhere; capped at
 * the wall all the same, since `process.cpuUsage` sums every thread and V8
 * collects and compiles on threads of its own (#906, #908).
 */

/**
 * Processor time spent so far, in microseconds, user and system together.
 * @return {number} - Microseconds spent on a processor
 */
const charged = function() {
  const spent = process.cpuUsage()
  return spent.user + spent.system
}

/**
 * Wall time spent so far, in microseconds, off the monotonic clock rather than
 * a calendar one a machine may set back under a running window.
 * @return {number} - Microseconds since a point this process fixed
 */
const spanned = function() {
  return Number(process.hrtime.bigint() / 1000n)
}

/**
 * What one window may be charged: the processor time the clock summed over it,
 * or the wall time it spanned, whichever a single thread could have spent.
 * @param {number} cpu - Microseconds of processor time the clock summed
 * @param {number} wall - Microseconds of wall time the window spanned
 * @return {number} - What one thread can have spent in the window
 */
const capped = function(cpu, wall) {
  return Math.min(cpu, wall)
}

/**
 * What a call costs one thread, in microseconds, beside whatever it answers.
 * @param {function(): object} fun - What to time
 * @return {{span: number, answer: object}} - Microseconds and the answer
 */
const clocked = function(fun) {
  const began = {cpu: charged(), wall: spanned()}
  const answer = fun()
  return {
    span: capped(charged() - began.cpu, spanned() - began.wall),
    answer: answer,
  }
}

module.exports = {capped, clocked}
