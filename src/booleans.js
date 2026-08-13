/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {whole} = require('./attributes')
const {calls, parseOf, textOf, tight} = require('./syntax')

/**
 * The kinds whose every operand is taken as a truth. XPath asks for the
 * effective boolean value of each side of an `and` and an `or`, so a wrapper
 * that computes one is doing what the operator does next anyway.
 * @type {Array.<string>}
 */
const OPERANDS = ['and', 'or']

/**
 * The kinds whose last child is taken as a truth: `some` and `every` read the
 * effective boolean value of the expression behind their `satisfies`. What
 * stands in front of it is one `binding` node per variable, and the value a
 * variable binds is that node's child rather than the quantifier's, so the
 * index says which child is the body rather than fending off a candidate — no
 * check asks about a binding, which is why no fixture can turn that half of the
 * question red.
 * @type {Array.<string>}
 */
const QUANTIFIED = ['some', 'every']

/**
 * The standard functions whose one argument is taken as a truth and nothing
 * else. `fn:not` negates the effective boolean value of its argument and
 * `fn:boolean` is that value itself, so either one asks of its argument exactly
 * what a wrapper inside it has already answered.
 * @type {Array.<string>}
 */
const ASKING = ['boolean', 'not']

/**
 * Whether an expression binding loosely may stand in a child's place with no
 * brackets put round it. Every place a truth is taken has brackets round it
 * already, or nothing after it — the argument of a call, the condition of an
 * `if`, the body of a `satisfies`, a whole `@test` — except the operands of
 * `and` and `or`, where what follows binds tighter than what a replacement may
 * carry: `a or b` substituted into `boolean(a or b) and @c` would be read as
 * `a or (b and @c)`.
 * @param {object} parent - The node the place belongs to
 * @return {boolean} - True when a loose expression stands there unbracketed
 */
const loosely = function(parent) {
  return !OPERANDS.includes(parent.kind)
}

/**
 * Whether the parent takes nothing but the effective boolean value of the child
 * standing at that index.
 *
 * A predicate is deliberately not one of those places, though it does coerce:
 * XPath reads a *numeric* predicate as a test on the context position, so
 * `a[boolean(count(b))]` selects every `a` with a `b` under it while
 * `a[count(b)]` selects the one whose position that count happens to be. What
 * the wrapper hides there is the difference between a truth and a number, which
 * is work rather than noise. Neither is an operand of a comparison: `@a =
 * boolean(@b)` compares a value with a truth, and dropping the wrapper compares
 * two values instead.
 *
 * A bracket is transparent, and only where it stands in such a place itself, so
 * the `(boolean(@x))` of a whole `@test` is one and the `(boolean(@x))` of a
 * `select` is not.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} parent - The node above
 * @param {number} index - Which of its children is being asked about
 * @param {Map.<object, boolean>} places - What is known of the nodes above
 * @return {boolean} - True when only a truth is taken there
 */
const asks = function(found, parent, index, places) {
  return OPERANDS.includes(parent.kind) ||
    (parent.kind === 'parenthesized' && places.has(parent)) ||
    (parent.kind === 'conditional' && index === 0) ||
    (QUANTIFIED.includes(parent.kind) &&
      index === parent.children.length - 1) ||
    (parent.kind === 'call' && parent.children.length === 1 &&
      ASKING.some((name) => calls(found, parent, name)))
}

/**
 * Every node of the record's tree standing where nothing but its effective
 * boolean value is taken, each paired with whether an expression that binds
 * loosely may stand there as it is.
 *
 * The whole expression is one such node when it is the whole `@test` of an XSLT
 * element, XSLT taking the truth of a test and nothing else; inside the
 * expression it is XPath that says so, and it says so about the operands of
 * `and` and `or`, the argument of `fn:not` and `fn:boolean`, the condition of
 * an `if` and the body of a `satisfies`. Walked from the root down rather than
 * asked of one node upwards, because the tree carries no parent to climb to and
 * a bracket inherits what its own place is (#561, #596).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Map.<object, boolean>} - The places a truth alone is taken
 */
const coerced = function(found) {
  const places = new Map()
  const root = parseOf(found).tree
  if (whole(found, 'test')) {
    places.set(root, true)
  }
  /**
   * Take each child that stands in such a place, then look below it.
   * @param {object} node - A node of the tree
   */
  const spread = function(node) {
    node.children.forEach((child, index) => {
      if (asks(found, node, index, places)) {
        places.set(child, loosely(node))
      }
      spread(child)
    })
  }
  spread(root)
  return places
}

/**
 * The text that may stand where a node does once nothing but `inner`'s value is
 * carried over, or null where the place takes more than a truth and the
 * wrapper is therefore doing work. A loose expression is bracketed where the
 * place is an operand rather than a bracket of its own, so the operator around
 * it cannot regroup what arrives.
 *
 * `tight` answers that in terms of the general comparison, which is one rung
 * tighter than the `and` it is asked about here, so a comparison carried into
 * an operand is bracketed where it need not be — `(@a = 1) and @b`. That is one
 * ladder borrowed rather than a second one written down beside the grammar, and
 * brackets nobody needs are noise where a missing pair is a rewrite that means
 * something else.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {Map.<object, boolean>} places - What `coerced` answered for it
 * @param {object} node - The node a fix would replace
 * @param {object} inner - The node whose value carries over
 * @return {?string} - The text to write there, or null
 */
const unwrapped = function(found, places, node, inner) {
  let text = null
  if (places.has(node)) {
    text = textOf(found, inner)
    if (!places.get(node) && !tight(inner)) {
      text = `(${text})`
    }
  }
  return text
}

module.exports = {
  coerced,
  unwrapped,
}
