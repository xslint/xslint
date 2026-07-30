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
const CHECK = 'using-namespace-axis'

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
 * Versions where the namespace:: axis is deprecated. In XSLT 1.0 it is the
 * standard way to inspect namespace nodes, so it is not flagged there.
 * @type {Array.<string>}
 */
const MODERN = ['2.0', '3.0']

/**
 * Offsets of every namespace:: axis in an expression. The lexer keeps string
 * literals and comments whole, so a `namespace::` inside one is never seen, and
 * it isolates the axis from lookalike calls like `namespace-uri-for-prefix()`.
 * @param {string} expression - Xpath expression or pattern
 * @return {Array.<number>} - Offsets where the axis starts
 */
const axes = function(expression) {
  return tokenized(expression)
    .filter((token) => token.type === TOKENS.NAMESPACE)
    .map((token) => token.start)
}

/**
 * Lint the corpus for the deprecated namespace:: axis in any XPath or pattern
 * attribute of an XSLT 2.0 or 3.0 stylesheet, reporting one defect per
 * occurrence. The fix is a structural rewrite to in-scope-prefixes() and
 * namespace-uri-for-prefix(), so the defect is report-only.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByNamespaceAxis = function(corpus, suppressions = []) {
  logger.debug(`Namespace axis linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      if (MODERN.includes(xsl.documentElement.getAttribute('version'))) {
        for (const {node, start, expression} of expressionsOf(xsl)) {
          for (const offset of axes(expression)) {
            defects.push(defect(CHECK, META, file, node, start + offset))
          }
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} namespace axis defects`)
  return defects
}

module.exports = {
  lintByNamespaceAxis,
  names,
}
