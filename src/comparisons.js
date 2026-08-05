/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {masked, closes} = require('./expressions')
const {GAP} = require('./tokens')

/**
 * The comparison that follows a call: an operator, then a `0` or `1` as the
 * whole right operand. The two lookaheads keep the digit off the tail of a
 * longer number (`0.5`, `10`) and off the head of a wider arithmetic operand
 * (`+`, `-`, `*`, `div`, `mod`), so `count(x) > 0 + $n` does not match on `0`.
 * @type {RegExp}
 */
const TAIL = new RegExp(
  `^${GAP}*(!=|<=|>=|=|<|>)${GAP}*([01])(?![\\w.])` +
  `(?!${GAP}*(?:[-+*]|div\\b|mod\\b))`,
)

/**
 * The operand-reversed comparison just before a call, as in `0 < f(x)`. The
 * digit is the whole left operand only when what precedes it — past
 * whitespace — starts the expression, opens `(`/`[`/`,`, or closes a boolean
 * operator (`and`, `or`); an arithmetic operator before it makes the digit
 * part of a wider operand, so `$max + 1 > count(x)` does not match on `1`.
 * @type {RegExp}
 */
const HEAD = new RegExp(
  `(^${GAP}*|[([,]${GAP}*|\\b(?:and|or)\\b${GAP}*)` +
  `([01])${GAP}*(!=|<=|>=|=|<|>)${GAP}*$`,
)

/**
 * Each operator with its sides swapped, so a reversed `0 < f(x)` reads as
 * `f(x) > 0` and feeds the same classifier.
 * @type {{[operator: string]: string}}
 */
const FLIP = {
  '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '!=': '!=',
}

/**
 * The `name(...)`-versus-`0`/`1` comparisons in an expression, in either
 * operand order (`f(x) > 0` and `0 < f(x)` alike). Each match is handed to a
 * `decide(operator, zero, argument, blanked)` classifier, which returns an
 * object of fields — merged into the found comparison — for a comparison worth
 * reporting (a `{replacement}`, or a classification the linter later turns into
 * one), or null when the comparison is a genuine count/length rather than an
 * existence/emptiness test. A call whose parentheses do not balance is skipped.
 * String and comment spans are blanked first, so a call-looking substring
 * inside a literal is never seen.
 * @param {string} expression - The attribute value
 * @param {string} name - The unprefixed function name, e.g. `count`
 * @param {function(string, string, string, string): ?object} decide - The
 *  per-comparison classifier
 * @return {Array.<{offset: number, value: string}>} - The comparisons found,
 *  each carrying the fields `decide` returned
 */
const comparedToZero = function(expression, name, decide) {
  const call = new RegExp(`(^|[^\\w:.-])${name}${GAP}*\\(`, 'g')
  const found = []
  const blanked = masked(expression)
  for (const match of blanked.matchAll(call)) {
    const start = match.index + match[1].length
    const open = match.index + match[0].length - 1
    const close = closes(blanked, open)
    if (close < 0) {
      continue
    }
    const argument = expression.slice(open + 1, close)
    const inner = blanked.slice(open + 1, close)
    const tail = TAIL.exec(blanked.slice(close + 1))
    const forward = tail && decide(tail[1], tail[2], argument, inner)
    if (forward) {
      found.push({
        offset: start,
        value: expression.slice(start, close + 1 + tail[0].length),
        ...forward,
      })
      continue
    }
    const head = HEAD.exec(blanked.slice(0, start))
    const back = head && decide(FLIP[head[3]], head[2], argument, inner)
    if (back) {
      const from = start - head[0].length + head[1].length
      found.push({
        offset: from,
        value: expression.slice(from, close + 1),
        ...back,
      })
    }
  }
  return found
}

module.exports = {
  comparedToZero,
}
