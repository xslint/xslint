/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {comparedToZero} = require('../comparisons')
const {metaOf, suppressed, defect} = require('../checks')
const {textOf, tight} = require('../syntax')
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
 * `comparedToZero`. An emptiness test is reported; it rewrites to
 * `argument = ''`/`argument != ''` when the argument can stand as an operand of
 * that comparison, and carries no replacement (report-only) otherwise. A
 * genuine length check is left alone, and so is a call spelling two arguments,
 * no such function taking any.
 *
 * Whether the argument can stand there is a question about how tightly it
 * binds, which the tree answers: `@a or @b` and `a = b` regroup or fail to
 * parse when the brackets around them go, while everything binding tighter
 * than a comparison carries over whole. Reading it off the text could only
 * approximate that — a top-level space stood in for a binary operator, so the
 * padding of `string-length( @x )` withheld the rewrite (#578) and the tight
 * `@a!=@b` was handed one that parses for nobody.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {string} operator - The comparison operator
 * @param {string} zero - The compared digit, `0` or `1`
 * @param {Array.<object>} args - The call's arguments
 * @return {?{replacement: ?string}} - The rewrite, or null when not emptiness
 */
const decide = function(found, operator, zero, args) {
  const hollow = empty(operator, zero)
  let rewrite = null
  if (hollow !== null && args.length < 2) {
    let operand = '!='
    if (hollow) {
      operand = '='
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
 * operand. It is a suggestion, not a safe fix, because `X op ''` is not a
 * general equivalent: they differ when `X` is an absent attribute or empty
 * node-set (`string-length(@x) = 0` is true, `@x = ''` is false) and when `X`
 * is a multi-node set (`string-length` reads the first node, `X != ''` any
 * node).
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
