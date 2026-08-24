/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const safe = require('colors/safe')

safe.enable()

/**
 * Whether a stream should be colored: only when it is an interactive terminal
 * and the conventional NO_COLOR variable is not set, so redirected or piped
 * output stays plain text. This is the single gate on coloring — the library's
 * own terminal heuristics are forced on above so the decision stays here.
 * @param {{isTTY: boolean|undefined}} stream - Destination stream
 * @return {boolean} - True when coloring is appropriate
 */
const colorful = function(stream) {
  return Boolean(stream.isTTY) && !Object.hasOwn(process.env, 'NO_COLOR')
}

/**
 * Leveled, prefixed writer over a sink. The diagnostics (defects) and the
 * operational logs share this formatting but not their stream: defects go to
 * stdout, logs to stderr. Coloring is applied only when asked for, so a non-
 * terminal sink receives plain text.
 * @param {function(string, ...*): void} sink - Where a formatted line goes
 * @param {boolean} colored - Whether to wrap the prefix in ANSI color
 * @return {{debug: function(string, ...*): void, info: function(string, ...*):
 *  void, warning: function(string, ...*): void, error: function(string, ...*):
 *  void}} - Writer bound to the sink
 */
const writer = function(sink, colored = true) {
  const paint = (color, text) => {
    let painted = text
    if (colored) {
      painted = safe[color](text)
    }
    return painted
  }
  return {
    debug: (msg, ...args) => sink(`${paint('gray', '[DEBUG]')} ${msg}`, ...args),
    info: (msg, ...args) => sink(`${paint('blue', '[INFO]')} ${msg}`, ...args),
    warning: (msg, ...args) =>
      sink(`${paint('yellow', '[WARNING]')} ${msg}`, ...args),
    error: (msg, ...args) => sink(`${paint('red', '[ERROR]')} ${msg}`, ...args),
  }
}

module.exports = {
  writer,
  colorful,
  out: writer(
    (msg, ...args) => console.log(msg, ...args), colorful(process.stdout),
  ),
  err: writer(
    (msg, ...args) => console.error(msg, ...args), colorful(process.stderr),
  ),
}
