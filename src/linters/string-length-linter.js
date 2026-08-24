/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {comparedToZero} = require('../comparisons')
const {metaOf, suppressed, defect} = require('../checks')
const {WORDED, textOf, tight} = require('../syntax')
const {logger} = require('../logger')

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
  return {
    '0>': false,
    '0!=': false,
    '0=': true,
    '0<=': true,
    '1>=': false,
    '1<': true,
  }[`${zero}${operator}`] ?? null
}

/**
 * The context item, which is what the call measures when it is given no
 * argument — `string-length() = 0` is a perfectly legal emptiness test, and
 * XPath spells the item it asks about `.`. The rewrite has to spell it too: the
 * argument was interpolated as it stood, so an absent one wrote `test=" = ''"`,
 * an expression the next run reported as invalid because it is (#572).
 * @type {string}
 */
const ITEM = '.'

/**
 * Classify a `string-length(...)`-versus-`0`/`1` comparison for
 * `comparedToZero`. An emptiness test is reported, rewritten to `argument =
 * ''` where the argument can stand as an operand there and report-only
 * otherwise — a question about binding the tree answers and the text could not
 * (#578). The rewrite keeps the class it was handed, `eq` for `eq` (#763).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {{operator: string, zero: string, worded: boolean}} comparison - The
 *  operator, in the forward direction and spelled with symbols, the digit
 *  compared against, and whether the class spells its operators in words
 * @param {Array.<object>} args - The call's arguments
 * @return {?{replacement: ?string}} - The rewrite, or null when not emptiness
 */
const decide = function(found, {operator, zero, worded}, args) {
  const hollow = empty(operator, zero)
  let rewrite = null
  if (hollow !== null && args.length < 2) {
    let operand = '!='
    if (hollow) {
      operand = '='
    }
    if (worded) {
      operand = WORDED[operand]
    }
    let argument = ITEM
    let carries = true
    if (args.length === 1) {
      argument = textOf(found, args[0])
      carries = tight(args[0])
    }
    let replacement = null
    if (carries) {
      replacement = `${argument} ${operand} ''`
    }
    rewrite = {replacement: replacement}
  }
  return rewrite
}

/**
 * The `string-length(...)`-versus-zero emptiness tests an expression holds, in
 * either operand order.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(found) {
  return comparedToZero(found, 'string-length', decide)
}

/**
 * Lint the valid expressions for `string-length(...)` compared with zero to
 * test emptiness, reporting one defect per comparison with a *suggestion* fix
 * that rewrites it to `X != ''` or `X = ''` when the argument is a simple
 * operand. A suggestion because they differ on an absent attribute and on a
 * multi-node set.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: ?object}[]} - Defects found
 */
const lintByStringLength = function(expressions, suppressions = []) {
  logger.debug(`String-length-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      for (const {offset, value, replacement} of comparisons(found)) {
        let fix
        if (replacement !== null) {
          fix = {value, replacement, suggestion: true}
        }
        defects.push(
          defect(CHECK, META, source, found, offset, fix),
        )
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
