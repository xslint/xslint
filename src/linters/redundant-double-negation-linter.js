/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov SPDX-License-
 * Identifier: MIT
 */

const {coerced, unwrapped} = require('../booleans')
const {calls, gathered, offsetOf, textOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-double-negation'

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
 * Whether the node negates one thing: a call to the standard `not` with exactly
 * one argument. The prefix is no part of the question — bare, behind a prefix
 * bound to the XPath functions namespace, or with that namespace written
 * inline, all three name the one function, and a `my:not()` of your own names
 * another (#596, #577). `fn:not` takes exactly one argument in every version,
 * so a call spelling none or several negates nothing and rewriting it to its
 * argument wrote an empty `@test` (#576).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {boolean} - True when the node is that call
 */
const negates = function(found, node) {
  return calls(found, node, 'not') && node.children.length === 1
}

/**
 * The double negations in an expression: a `not(...)` whose one argument is
 * itself a `not(...)` of one thing. Each carries the offset it stands at, its
 * own text, and the text that replaces it — `not(not(x))` is `boolean(x)`
 * everywhere, and where nothing but a truth is taken it is `x`, which is the
 * same reduction `redundant-boolean-call` would ask for next if the wrapper
 * were left standing (#596).
 *
 * It reads the calls the grammar built rather than matching `not` against the
 * text, which is what makes the prefixed spellings one construct with the bare
 * one instead of three shapes to match, and what leaves a `not(not(...))`
 * inside a string literal or a comment invisible without anything being blanked
 * first. The argument is the node the parse separated, too, so a binding clause
 * is one argument however many commas it holds — `not(not(for $va in a, $vb in
 * b return $va))` is reported and fixed, where counting commas at depth zero
 * read the clause as several arguments and fell silent (#576).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The negations found
 */
const negations = function(found) {
  const results = []
  const places = coerced(found)
  for (const node of gathered(found, ['call'])) {
    const [inner] = node.children
    if (negates(found, node) && negates(found, inner)) {
      const [argument] = inner.children
      let replacement = `boolean(${textOf(found, argument)})`
      const bare = unwrapped(found, places, node, argument)
      if (bare !== null) {
        replacement = bare
      }
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        replacement: replacement,
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for `not(not(x))`, a redundant double negation,
 * reporting one defect per occurrence with a safe fix: bare `x` where the place
 * takes nothing but a truth, and `boolean(x)` everywhere else, where the
 * boolean value itself is what is wanted.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByDoubleNegation = function(expressions, suppressions = []) {
  logger.debug(`Double-negation linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      for (const {offset, value, replacement} of negations(found)) {
        defects.push(
          defect(
            CHECK, META, source, found, offset,
            {value, replacement},
          ),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} double negations`)
  return defects
}

module.exports = {
  lintByDoubleNegation,
  names,
}
