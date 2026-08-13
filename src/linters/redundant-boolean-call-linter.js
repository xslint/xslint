/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {coerced, unwrapped} = require('../booleans')
const {calls, gathered, offsetOf, textOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-boolean-call'

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
 * The redundant `boolean(...)` calls in an expression: each one standing where
 * nothing but a truth is taken, so the wrapper computes what its own place
 * computes next anyway. Each carries the offset it stands at, its own text, and
 * the argument that stands in its place.
 *
 * A whole `@test` was the only such place until #561. XSLT takes the truth of a
 * whole `use-when` as well, and inside the expression it is XPath that coerces:
 * an operand of `and` or `or`, the argument of `not()` or of another
 * `boolean()`, the condition of an `if` and the body of a `satisfies` all take
 * the effective boolean value of what stands there, so `not(boolean(@x))` says
 * what `not(@x)` says. Which places those are is one question in
 * `src/booleans.js`, asked there rather than listed here, and shared with
 * `redundant-double-negation`. What decides is where the call stands rather
 * than how much of the attribute it covers, which is a question about the tree,
 * and reading the tree is what lets the prefixed and inline spellings of
 * `fn:boolean` be the same call as the bare one (#561, #577).
 *
 * `fn:boolean` takes exactly one argument in every version, so a call spelling
 * none or several wraps nothing and stripping it wrote an empty `@test` (#576).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The wrappers found
 */
const stripped = function(found) {
  const results = []
  const places = coerced(found)
  for (const node of gathered(found, ['call'])) {
    let bare = null
    if (calls(found, node, 'boolean') && node.children.length === 1) {
      bare = unwrapped(found, places, node, node.children[0])
    }
    if (bare !== null) {
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        replacement: bare,
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for a `boolean(...)` call standing where nothing
 * but a truth is taken, reporting one defect per occurrence with the safe fix
 * that strips the wrapper. Nowhere else is the value coerced, so neither an
 * operand of a comparison nor a predicate — where a number is a position rather
 * than a truth — nor the expression of an attribute value template, where the
 * wrapper decides whether `true`/`false` or the node's own text is printed, is
 * reported.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByBooleanCall = function(expressions, suppressions = []) {
  logger.debug(`Boolean-call linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      for (const {offset, value, replacement} of stripped(found)) {
        defects.push(
          defect(
            CHECK, META, source, found, offset,
            {value, replacement},
          ),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} redundant boolean calls`)
  return defects
}

module.exports = {
  lintByBooleanCall,
  names,
}
