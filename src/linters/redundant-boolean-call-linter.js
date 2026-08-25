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
 * nothing but a truth is taken, so the wrapper computes what its place computes
 * anyway. Each carries the offset it stands at, its own text, and the argument
 * standing in its place. Where those places are is `src/booleans.js`'s question
 * (#561), and what decides is where the call stands, not its text (#576, #577).
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
 * operand of a comparison, nor a predicate, where a number is a position, nor
 * the expression of an attribute value template, which prints it, is reported.
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
