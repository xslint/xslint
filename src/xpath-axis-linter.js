/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS} = require('./tokens')
const {metaOf, suppressed, defect} = require('./checks')
const {expressionsOf} = require('./attributes')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'unabbreviated-axis'

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
 * The abbreviation of each single-token axis specifier.
 * @type {{[type: string]: {value: string, replacement: string}}}
 */
const SHORT = {
  [TOKENS.CHILD]: {value: 'child::', replacement: ''},
  [TOKENS.ATTRIBUTE]: {value: 'attribute::', replacement: '@'},
}

/**
 * Abbreviable axis specifiers in an expression. Each carries the offset where
 * it starts, its verbatim text, and the shorter form it becomes: `child::`
 * drops away, `attribute::` becomes `@`, and `parent::node()` becomes `..`. A
 * `parent::` with any other node test has no abbreviation and is left alone.
 * Axes inside string literals or comments are never seen because the lexer
 * keeps those whole.
 * @param {string} expression - Xpath expression or pattern
 * @return {Array.<{offset: number, value: string, replacement: string}>} - Axes
 */
const abbreviable = function(expression) {
  const found = []
  for (const token of tokenized(expression)) {
    if (SHORT[token.type]) {
      found.push({offset: token.start, ...SHORT[token.type]})
    } else if (
      token.type === TOKENS.PARENT &&
      expression.slice(token.start, token.start + 14) === 'parent::node()'
    ) {
      found.push({offset: token.start, value: 'parent::node()', replacement: '..'})
    }
  }
  return found
}

/**
 * Lint the corpus for axis specifiers that have a shorter form, reporting one
 * defect per occurrence with the fix that abbreviates it.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByAxis = function(corpus, suppressions = []) {
  logger.debug(`Axis linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      for (const {node, start, expression} of expressionsOf(xsl)) {
        for (const {offset, value, replacement} of abbreviable(expression)) {
          defects.push(
            defect(
              CHECK, META, file, node, start + offset, {value, replacement},
            ),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} unabbreviated axis defects`)
  return defects
}

module.exports = {
  lintByAxis,
  names,
}
