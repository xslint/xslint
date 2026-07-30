/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {comparedToZero} = require('./comparisons')
const {metaOf, suppressed, defect} = require('./checks')
const {expressionsOf} = require('./attributes')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'string-length-compared-to-zero'

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
 * Whether the comparison tests for a non-empty string (`true`), an empty one
 * (`false`), or is a genuine length check that is left alone (`null`).
 * @param {string} operator - The comparison operator
 * @param {string} zero - The right-hand side, `0` or `1`
 * @return {?boolean} - Non-empty, empty, or null
 */
const empty = function(operator, zero) {
  if (zero === '0') {
    if (operator === '>' || operator === '!=') {
      return false
    }
    if (operator === '=' || operator === '<=') {
      return true
    }
  }
  if (zero === '1') {
    if (operator === '>=') {
      return false
    }
    if (operator === '<') {
      return true
    }
  }
  return null
}

/**
 * Whether an argument is a single operand that binds tighter than `!=`, so
 * `X != ''` keeps the original meaning. An argument carrying a top-level `|` or
 * space (a union or a binary operator) does not, and gets no fix.
 * @param {string} argument - The call's argument, already literal-blanked
 * @return {boolean} - Whether the argument is a simple operand
 */
const simple = function(argument) {
  let depth = 0
  for (const char of argument) {
    if (char === '(' || char === '[') {
      depth++
    } else if (char === ')' || char === ']') {
      depth--
    } else if (depth === 0 && (char === '|' || char === ' ')) {
      return false
    }
  }
  return true
}

/**
 * Classify a `string-length(...)`-versus-`0`/`1` comparison for
 * `comparedToZero`. An emptiness test is reported; it rewrites to
 * `argument = ''`/`argument != ''` when the argument is a simple operand, and
 * carries no replacement (report-only) otherwise. A genuine length check is
 * left alone.
 * @param {string} operator - The comparison operator
 * @param {string} zero - The compared digit, `0` or `1`
 * @param {string} argument - The call's argument
 * @param {string} blanked - The argument with string/comment spans blanked
 * @return {?{replacement: ?string}} - The rewrite, or null when not emptiness
 */
const decide = function(operator, zero, argument, blanked) {
  const hollow = empty(operator, zero)
  if (hollow === null) {
    return null
  }
  return {
    replacement: simple(blanked) ?
      `${argument} ${hollow ? '=' : '!='} ''` : null,
  }
}

/**
 * The `string-length(...)`-versus-zero emptiness tests in an expression, in
 * either operand order.
 * @param {string} expression - The attribute value
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(expression) {
  return comparedToZero(expression, 'string-length', decide)
}

/**
 * Lint the corpus for `string-length(...)` compared with zero to test
 * emptiness, reporting one defect per comparison with a *suggestion* fix that
 * rewrites it to `X != ''` or `X = ''` when the argument is a simple operand.
 * It is a suggestion, not a safe fix, because `X op ''` is not a general
 * equivalent: they differ when `X` is an absent attribute or empty node-set
 * (`string-length(@x) = 0` is true, `@x = ''` is false) and when `X` is a
 * multi-node set (`string-length` reads the first node, `X != ''` any node).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: ?object}[]} - Defects found
 */
const lintByStringLength = function(corpus, suppressions = []) {
  logger.debug(`String-length-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      for (const {node, start, expression} of expressionsOf(xsl)) {
        for (const {offset, value, replacement} of comparisons(expression)) {
          defects.push(
            defect(
              CHECK, META, file, node, start + offset,
              replacement === null ?
                undefined : {value, replacement, suggestion: true},
            ),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} string-length comparison defects`)
  return defects
}

module.exports = {
  lintByStringLength,
  names,
}
