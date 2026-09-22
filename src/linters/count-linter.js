/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {coerced, unwrapped} = require('../booleans')
const {comparedToZero} = require('../comparisons')
const {metaOf, suppressed, defect} = require('../checks')
const {textOf} = require('../syntax')
const {MODERN, since} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'count-compared-to-zero'

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
 * The existence function a comparison collapses to, or null when it is a
 * genuine count rather than an existence test (`> 1`, `>= 0`, and the like).
 * @param {string} operator - The comparison operator
 * @param {string} zero - The right-hand side, `0` or `1`
 * @return {?string} - `exists`, `empty`, or null
 */
const collapses = function(operator, zero) {
  return {
    '0>': 'exists',
    '0!=': 'exists',
    '0=': 'empty',
    '0<=': 'empty',
    '1>=': 'exists',
    '1<': 'empty',
  }[`${zero}${operator}`] ?? null
}

/**
 * Classify a `count(...)`-versus-`0`/`1` comparison for `comparedToZero`: an
 * existence test carries its kind (`exists`/`empty`) and the argument, and
 * anything else is left alone. `fn:count` takes exactly one argument, which
 * the parse says outright (#576), and the class the comparison was written in
 * it never asks, `exists(x)` carrying no operator to spell either way (#763).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {{operator: string, zero: string}} comparison - The operator, in the
 *  forward direction and spelled with symbols, and the digit compared against
 * @param {Array.<object>} args - The call's arguments
 * @return {?{test: string, inner: object}} - The classification, or null
 */
const decide = function(found, {operator, zero}, args) {
  const test = collapses(operator, zero)
  let carried = null
  if (test && args.length === 1) {
    carried = {test: test, inner: args[0]}
  }
  return carried
}

/**
 * The direct form a classified test rewrites to, version-appropriate and never
 * one another check re-flags. On XSLT 2.0/3.0 it is `exists(x)`/`empty(x)`; on
 * 1.0 — and unversioned, where `boolean`/`not` are valid too — an existence
 * test is the bare argument wherever nothing but a truth is taken, which is
 * `bare`, `boolean(x)` where more is, and an emptiness test is `not(x)`.
 * @param {string} test - The classification, `exists` or `empty`
 * @param {string} argument - The call's argument
 * @param {boolean} modern - Whether the stylesheet is XSLT 2.0/3.0
 * @param {?string} bare - What may stand where the comparison does once only
 *  its truth carries over, or null where the place takes more than one
 * @return {string} - The replacement expression
 */
const rewritten = function(test, argument, modern, bare) {
  let direct = `not(${argument})`
  if (modern) {
    direct = `${test}(${argument})`
  } else if (test === 'exists' && bare !== null) {
    direct = bare
  } else if (test === 'exists') {
    direct = `boolean(${argument})`
  }
  return direct
}

/**
 * The `count(...)`-versus-zero existence tests an expression holds, in either
 * operand order (`count(x) > 0` and `0 < count(x)` alike), each carrying its
 * classification, the node it stands at, and its argument's node.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<{node: object, offset: number, value: string, test: string,
 *  inner: object}>} - The comparisons found
 */
const comparisons = function(found) {
  return comparedToZero(found, 'count', decide)
}

/**
 * Lint the valid expressions for `count(...)` compared with zero to test
 * existence, reporting one defect per comparison with a safe fix —
 * `exists()`/`empty()` on XSLT 2.0/3.0, and the 1.0-and-later `boolean(x)`/bare
 * `x`/`not(x)` forms otherwise, so the fix is version-appropriate on every
 * stylesheet and no wrapper is written where its place computes one (#977).
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByCount = function(expressions, suppressions = []) {
  logger.debug(`Count-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      const modern = since(found.version, MODERN)
      const places = coerced(found)
      for (const {node, offset, value, test, inner} of comparisons(found)) {
        defects.push(
          defect(CHECK, META, source, found, offset, {
            value: value,
            replacement: rewritten(
              test, textOf(found, inner), modern,
              unwrapped(found, places, node, inner),
            ),
          }),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} count comparison defects`)
  return defects
}

module.exports = {
  lintByCount,
  names,
}
