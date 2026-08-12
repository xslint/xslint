/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {comparedToZero} = require('../comparisons')
const {metaOf, suppressed, defect} = require('../checks')
const {textOf} = require('../syntax')
const {MODERN, since, versionOf} = require('../xsl-version')
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
 * existence test carries its kind (`exists`/`empty`) and the argument, for the
 * linter to turn into a version-appropriate rewrite; anything else is left
 * alone. `fn:count` takes exactly one argument, so a call spelling none or
 * several counts nothing and is not this construct at all — which the parse
 * says outright, a comma binding a `for` clause being no separator (#576).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {string} operator - The comparison operator
 * @param {string} zero - The compared digit, `0` or `1`
 * @param {Array.<object>} args - The call's arguments
 * @return {?{test: string, argument: string}} - The classification, or null
 */
const decide = function(found, operator, zero, args) {
  const test = collapses(operator, zero)
  let carried = null
  if (test && args.length === 1) {
    carried = {test: test, argument: textOf(found, args[0])}
  }
  return carried
}

/**
 * The direct form a classified test rewrites to, version-appropriate and never
 * one another check re-flags. On XSLT 2.0/3.0 it is `exists(x)`/`empty(x)`; on
 * 1.0 — and unversioned, where `boolean`/`not` are valid too — an existence
 * test is a bare `x` in a whole `@test` (which already coerces to a boolean),
 * `boolean(x)` elsewhere, and an emptiness test is `not(x)`.
 * @param {string} test - The classification, `exists` or `empty`
 * @param {string} argument - The call's argument
 * @param {boolean} modern - Whether the stylesheet is XSLT 2.0/3.0
 * @param {boolean} whole - Whether the comparison is the entire `@test`
 * @return {string} - The replacement expression
 */
const rewritten = function(test, argument, modern, whole) {
  let direct = `not(${argument})`
  if (modern) {
    direct = `${test}(${argument})`
  } else if (test === 'exists' && whole) {
    direct = argument
  } else if (test === 'exists') {
    direct = `boolean(${argument})`
  }
  return direct
}

/**
 * The `count(...)`-versus-zero existence tests an expression holds, in either
 * operand order (`count(x) > 0` and `0 < count(x)` alike), each carrying its
 * classification and argument.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<{offset: number, value: string, test: string,
 *  argument: string}>} - The comparisons found
 */
const comparisons = function(found) {
  return comparedToZero(found, 'count', decide)
}

/**
 * Lint the valid expressions for `count(...)` compared with zero to test
 * existence, reporting one defect per comparison with a safe fix —
 * `exists()`/`empty()` on XSLT 2.0/3.0, and the 1.0-and-later `boolean(x)`/bare
 * `x`/`not(x)` forms otherwise, so the fix is version-appropriate on every
 * stylesheet.
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
      const {node} = found
      const modern = since(versionOf(node), MODERN)
      for (const {offset, value, test, argument} of comparisons(found)) {
        const whole = node.nodeName === 'test' &&
          node.nodeValue.trim() === value
        defects.push(
          defect(CHECK, META, source, found, offset, {
            value: value,
            replacement: rewritten(test, argument, modern, whole),
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
