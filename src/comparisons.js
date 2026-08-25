/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {VALUED, calls, gathered, offsetOf, operatorOf, textOf} =
  require('./syntax')

/**
 * The digits a call is compared against to ask a question about existence
 * rather than about a number: nothing is smaller than none, and one is where
 * something begins.
 * @type {Array.<string>}
 */
const DIGITS = ['0', '1']

/**
 * Each operator with its sides swapped, so a reversed `0 < f(x)` reads as
 * `f(x) > 0` and feeds the same classifier. Six entries answer for twelve
 * spellings: `operatorOf` hands over the symbol whichever class the comparison
 * was written in, so `0 lt count(x)` reverses through the entry `0 < count(x)`
 * reverses through.
 * @type {{[operator: string]: string}}
 */
const FLIP = {
  '<': '>', '>': '<', '<=': '>=', '>=': '<=', '=': '=', '!=': '!=',
}

/**
 * The `name(...)`-versus-`0`/`1` comparisons an expression holds, in either
 * operand order and either class. Each is handed to a `decide` classifier,
 * which answers fields to merge or null for a genuine count. The comparison
 * reaches it as `{operator, zero, worded}`, forward and symbol-spelled, read
 * off the tree and not the text (#577, #578, #573).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {string} name - The function's local name, e.g. `count`
 * @param {function({node: Node}, {operator: string, zero: string,
 *  worded: boolean}, Array.<object>): ?object} decide - The per-comparison
 *  classifier
 * @return {Array.<{offset: number, value: string}>} - The comparisons found,
 *  each carrying the fields `decide` returned
 */
const comparedToZero = function(found, name, decide) {
  const results = []
  for (const node of gathered(found, VALUED)) {
    const [left, right] = node.children
    let call = left
    let digit = right
    let operator = operatorOf(found, left, right)
    if (calls(found, right, name)) {
      call = right
      digit = left
      operator = FLIP[operator]
    }
    let carried = null
    if (calls(found, call, name) && digit.kind === 'literal' &&
      DIGITS.includes(textOf(found, digit))) {
      carried = decide(found, {
        operator: operator,
        zero: textOf(found, digit),
        worded: node.kind === 'value-comparison',
      }, call.children)
    }
    if (carried) {
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        ...carried,
      })
    }
  }
  return results
}

module.exports = {
  comparedToZero,
}
