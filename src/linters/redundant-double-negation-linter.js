/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {masked, closes} = require('../expressions')
const {GAP} = require('../tokens')
const {metaOf, suppressed, defect} = require('../checks')
const {expressionsOf} = require('../attributes')
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
 * An unprefixed `not(` opener, so a custom `my:not()` is left alone.
 * @type {RegExp}
 */
const CALL = new RegExp(`(^|[^\\w:.-])not${GAP}*\\(`, 'g')

/**
 * The inner `not(` that must open the outer `not`'s content.
 * @type {RegExp}
 */
const INNER = new RegExp(`^${GAP}*not${GAP}*\\(`)

/**
 * The double negations in an expression: an outer `not(...)` whose only content
 * is an inner `not(...)`. Each carries its start offset, verbatim text, and the
 * inner argument `x` — `not(not(x))` equals `boolean(x)`, so the caller wraps
 * the argument in `boolean(...)` for a value context and drops the wrapper for
 * a whole `@test`, which already coerces. A `not(` whose parentheses do not
 * balance, or whose content is more than a lone inner `not(...)`, is skipped.
 * @param {string} expression - The attribute value
 * @return {Array.<{offset: number, value: string, argument: string}>} -
 *  The negations found
 */
const negations = function(expression) {
  const found = []
  const blanked = masked(expression)
  for (const match of blanked.matchAll(CALL)) {
    const start = match.index + match[1].length
    const open = match.index + match[0].length - 1
    const close = closes(blanked, open)
    if (close < 0) {
      continue
    }
    const inner = INNER.exec(blanked.slice(open + 1, close))
    if (!inner) {
      continue
    }
    const innerOpen = open + inner[0].length
    const innerClose = closes(blanked, innerOpen)
    if (innerClose < 0 || blanked.slice(innerClose + 1, close).trim() !== '') {
      continue
    }
    found.push({
      offset: start,
      value: expression.slice(start, close + 1),
      argument: expression.slice(innerOpen + 1, innerClose),
    })
  }
  return found
}

/**
 * Lint the corpus for `not(not(x))`, a redundant double negation, reporting one
 * defect per occurrence with a safe fix: bare `x` when the double negation is a
 * whole `@test` (which already coerces to a boolean), and `boolean(x)`
 * everywhere else, where the boolean value itself is what is wanted.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByDoubleNegation = function(corpus, suppressions = []) {
  logger.debug(`Double-negation linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const source of corpus) {
      for (const found of expressionsOf(source.xsl)) {
        const {node, expression} = found
        for (const {offset, value, argument} of negations(expression)) {
          const bare = node.nodeName === 'test' &&
            node.nodeValue.trim() === value
          let replacement = `boolean(${argument})`
          if (bare) {
            replacement = argument
          }
          defects.push(
            defect(CHECK, META, source, found, offset, {
              value: value,
              replacement: replacement,
            }),
          )
        }
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
