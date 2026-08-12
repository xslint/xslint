/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {calls, gathered, offsetOf, operatorOf, textOf} = require('./syntax')

/**
 * The digits a call is compared against to ask a question about existence
 * rather than about a number: nothing is smaller than none, and one is where
 * something begins.
 * @type {Array.<string>}
 */
const DIGITS = ['0', '1']

/**
 * The two kinds a comparison of a call with a digit comes back as. XPath spells
 * one question two ways from 2.0 on — `count(x) = 0` and `count(x) eq 0` — and
 * the grammar builds a node of a different kind for each, so a scan gathering
 * one of them walks past every stylesheet written in the other (#763). The node
 * comparisons are no part of this: `count(x) is 0` compares node identity
 * with a number and is a type error, not a count of nothing.
 * @type {Array.<string>}
 */
const KINDS = ['comparison', 'value-comparison']

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
 * operand order (`f(x) > 0` and `0 < f(x)` alike) and either class (`= 0` and
 * `eq 0` alike). Each is handed to a `decide(found, comparison, args)`
 * classifier, which answers an object of fields — merged into the found
 * comparison — for a comparison worth reporting, or null when it is a genuine
 * count or length rather than an existence or emptiness test. The comparison
 * reaches it as `{operator, zero, worded}`: the operator in the forward
 * direction and the symbol spelling whichever side the call stands on and
 * whichever class it was written in, so a classifier has one order and one
 * spelling to reason about, and `worded` for the one thing the class itself
 * decides — a rewrite that carries an operator writes back the family it was
 * given rather than the one this table is keyed on.
 *
 * This reads the tree the grammar built rather than the text (#577, #578).
 * Three questions the regular expressions underneath it could only approximate
 * are answered by construction now. **What the comparison's operands are**: a
 * digit is one when it is the whole operand, which the tree says outright,
 * where the scan had to bound it by hand and let `$max + 1 > count(x)` through
 * until #573 spelled the arithmetic out. **What the call is**: the standard
 * function of that name, told from a user function of the same local name by
 * the URI its prefix resolves to, where a character class refused every prefix
 * and so missed the `fn:count` of any 2.0 stylesheet while accepting an inline
 * `Q{urn:mine}count`. And **what its arguments are**: the nodes the parse has
 * already separated, so a comma binding a `for` clause is no separator and a
 * gap around an argument is no operator — `string-length( @x )` carries the
 * same one operand the tight spelling does, where a scan reading a space as a
 * binary operator withheld the rewrite from it.
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
  for (const node of gathered(found, KINDS)) {
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
