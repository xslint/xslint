/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS} = require('./tokens')
const {metaOf, suppressed, defect} = require('./checks')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-whitespace'

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
 * Redundant whitespace runs in an expression. A run is redundant when it is
 * longer than one space, or leads or trails the expression; a run that wraps a
 * line is left alone, and runs inside string literals or comments are never
 * seen because the lexer keeps those whole. Each run carries the offset where
 * it starts, its raw value, and the text that should replace it — empty when it
 * leads or trails, a single space when it is a doubled run in the middle.
 * @param {string} expression - Xpath expression
 * @return {Array.<{offset: number, value: string, replacement: string}>} - Runs
 */
const redundancies = function(expression) {
  const runs = []
  for (const token of tokenized(expression)) {
    const edge =
      token.start === 0 ||
      token.start + token.value.length === expression.length
    if (
      token.type === TOKENS.WHITESPACE &&
      !/[\r\n]/.test(token.value) &&
      (edge || token.value.length > 1)
    ) {
      runs.push({
        offset: token.start,
        value: token.value,
        replacement: edge ? '' : ' ',
      })
    }
  }
  return runs
}

/**
 * Lint the valid Xpath expressions for redundant whitespace. The expressions
 * are already known to parse — the validator dropped the malformed ones — so
 * this linter never re-checks validity, it only reasons over their tokens.
 * @param {Array.<{file: string, expression: Node}>} expressions - Valid
 *  expressions paired with the file they came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByFormat = function(expressions, suppressions = []) {
  logger.debug(`Format linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, expression} of expressions) {
      for (const {offset, value, replacement} of redundancies(
        expression.nodeValue,
      )) {
        defects.push(
          defect(
            CHECK, META, source, expression, offset, expression.nodeValue,
            {value, replacement},
          ),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} redundant whitespace defects`)
  return defects
}

module.exports = {
  lintByFormat,
  names,
}
