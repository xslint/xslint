/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {comparedToZero} = require('./comparisons')
const {metaOf, suppressed, defect} = require('./checks')
const {expressionsOf} = require('./attributes')
const {MODERN, since, versionOf} = require('./xsl-version')
const {logger} = require('./logger')

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
 * alone.
 * @param {string} operator - The comparison operator
 * @param {string} zero - The compared digit, `0` or `1`
 * @param {string} argument - The call's argument
 * @return {?{test: string, argument: string}} - The classification, or null
 */
const decide = function(operator, zero, argument) {
  const test = collapses(operator, zero)
  return test ? {test: test, argument: argument} : null
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
  return modern ? `${test}(${argument})` :
    test === 'exists' ?
      (whole ? argument : `boolean(${argument})`) :
      `not(${argument})`
}

/**
 * The `count(...)`-versus-zero existence tests in an expression, in either
 * operand order (`count(x) > 0` and `0 < count(x)` alike), each carrying its
 * classification and argument.
 * @param {string} expression - The attribute value
 * @return {Array.<{offset: number, value: string, test: string,
 *  argument: string}>} - The comparisons found
 */
const comparisons = function(expression) {
  return comparedToZero(expression, 'count', decide)
}

/**
 * Lint the corpus for `count(...)` compared with zero to test existence,
 * reporting one defect per comparison with a safe fix — `exists()`/`empty()` on
 * XSLT 2.0/3.0, and the 1.0-and-later `boolean(x)`/bare `x`/`not(x)` forms
 * otherwise, so the fix is version-appropriate on every stylesheet.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByCount = function(corpus, suppressions = []) {
  logger.debug(`Count-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const source of corpus) {
      for (const found of expressionsOf(source.xsl)) {
        const {node, expression} = found
        const modern = since(versionOf(node), MODERN)
        for (const {offset, value, test, argument} of comparisons(expression)) {
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
  }
  logger.debug(`Found ${defects.length} count comparison defects`)
  return defects
}

module.exports = {
  lintByCount,
  names,
}
