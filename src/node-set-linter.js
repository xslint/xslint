/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {nodes} = require('./xpath')
const {masked, closes} = require('./expressions')
const {metaOf, suppressed, defect} = require('./checks')
const {selectorOf} = require('./attributes')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'use-node-set-extension'

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
 * Stylesheet versions where the node-set() extension is redundant.
 * @type {Array.<string>}
 */
const MODERN = ['2.0', '3.0']

/**
 * Pattern of a `prefix:node-set(` call opener.
 * @type {RegExp}
 */
const CALL = /[\w.-]+:node-set\s*\(/g

/**
 * The node-set() wrappers in a select value: each carries the offset it starts
 * at, its verbatim text, and the inner argument that replaces it. A call whose
 * parentheses do not balance is skipped.
 * @param {string} select - The `select` attribute value
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The node-set() calls found
 */
const wrappers = function(select) {
  const found = []
  const blanked = masked(select)
  for (const match of blanked.matchAll(CALL)) {
    const open = match.index + match[0].length - 1
    const close = closes(blanked, open)
    if (close >= 0) {
      found.push({
        offset: match.index,
        value: select.slice(match.index, close + 1),
        replacement: select.slice(open + 1, close),
      })
    }
  }
  return found
}

/**
 * Lint the corpus for the `node-set()` extension used in XSLT 2.0 or 3.0, where
 * a variable is already a node sequence, reporting one defect per call with the
 * fix that unwraps it. Only the `@select` of an XSLT element is read: the
 * `select` a literal result element carries is output text, and a call standing
 * in another expression attribute, or inside an attribute value template, is
 * not looked for.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByNodeSet = function(corpus, suppressions = []) {
  logger.debug(`Node-set linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      if (MODERN.includes(xsl.documentElement.getAttribute('version'))) {
        for (const attribute of nodes(xsl, selectorOf('select'))) {
          for (const {offset, value, replacement} of wrappers(
            attribute.nodeValue,
          )) {
            defects.push(
              defect(
                CHECK, META, file, attribute, offset, {value, replacement},
              ),
            )
          }
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} node-set extension defects`)
  return defects
}

module.exports = {
  lintByNodeSet,
  names,
}
