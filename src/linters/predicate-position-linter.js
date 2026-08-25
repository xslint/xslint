/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {TOKENS} = require('../tokens')
const {
  VALUED, calls, gathered, offsetOf, operatorOf, textOf, tokensOf,
} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'predicate-position-literal'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = metaOf(CHECK)

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * Whether the node is the call `position()` with nothing in its brackets.
 * `fn:position` takes no argument, so a call spelling one asks something else
 * and is not this construct, the way `fn:count` spelling two is not a count
 * (#576). The prefix is no part of the question, so a prefixed or inline
 * spelling names the one function and a `my:position()` names another (#577).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {boolean} - True when the node is that call
 */
const positional = function(found, node) {
  return calls(found, node, 'position') && node.children.length === 0
}

/**
 * Whether the node is what a positional predicate abbreviates to on its own: a
 * number, which XPath reads as a test on the context position, or the call
 * `last()`, which the short form keeps as it stands. A literal is one kind to
 * the grammar and the token says which spelling it is, so a string literal —
 * `[position() = '1']`, true at every position — is left alone.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {boolean} - True when the predicate can be written as this alone
 */
const shortens = function(found, node) {
  return (node.kind === 'literal' &&
    tokensOf(found, node)[0].type === TOKENS.NUMBER) ||
    (calls(found, node, 'last') && node.children.length === 0)
}

/**
 * The positional predicates written the long way, each with the offset of its
 * comparison, its text, and the operand that replaces the whole of it — so
 * `foo[position() = 1]` becomes `foo[1]`. It reads the predicates the grammar
 * built rather than a signature of one character per token, so `eq` reads as
 * `=` and an `and` holding one is not a positional predicate (#575).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The predicates found
 */
const literals = function(found) {
  const results = []
  for (const predicate of gathered(found, ['predicate'])) {
    const [inner] = predicate.children
    const [left, right] = inner.children
    let short = null
    if (VALUED.includes(inner.kind) &&
      operatorOf(found, left, right) === '=') {
      if (positional(found, left) && shortens(found, right)) {
        short = right
      } else if (positional(found, right) && shortens(found, left)) {
        short = left
      }
    }
    if (short) {
      results.push({
        offset: offsetOf(found, inner),
        value: textOf(found, inner),
        replacement: textOf(found, short),
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for a positional predicate written the long way,
 * reporting one defect per occurrence with a safe fix that rewrites the
 * predicate to its numeric or `last()` short form.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByPredicatePosition = function(expressions, suppressions = []) {
  logger.debug(`Predicate-position linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      for (const {offset, value, replacement} of literals(found)) {
        defects.push(
          defect(
            CHECK, META, source, found, offset,
            {value, replacement},
          ),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} positional predicate defects`)
  return defects
}

module.exports = {
  lintByPredicatePosition,
  names,
}
