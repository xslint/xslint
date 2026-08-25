/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {calls, gathered, offsetOf, stringOf, textOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, since, versionOf} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'translate-for-case'

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
 * The uppercase ASCII alphabet, as a string rather than as the literal one is
 * written with: what a `translate` folds is the characters its argument holds,
 * and the quotes around them are the author's spelling of the same 26 (#562).
 * @type {string}
 */
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The lowercase ASCII alphabet.
 * @type {string}
 */
const LOWER = UPPER.toLowerCase()

/**
 * How many arguments a `translate` that folds case takes: the string, the
 * alphabet to read, the alphabet to write.
 * @type {number}
 */
const ARGUMENTS = 3

/**
 * The case-folding function a `translate` collapses to, given the strings its
 * second and third arguments hold, or null when the two are not the alphabet in
 * both cases — a near alphabet is no alphabet, and a non-literal argument holds
 * no string at all.
 * @param {?string} from - The string the second argument holds
 * @param {?string} to - The string the third argument holds
 * @return {?string} - `lower-case`, `upper-case`, or null
 */
const folds = function(from, to) {
  let fold = null
  if (from === UPPER && to === LOWER) {
    fold = 'lower-case'
  } else if (from === LOWER && to === UPPER) {
    fold = 'upper-case'
  }
  return fold
}

/**
 * The alphabet-`translate` case folds: each carries the offset it starts at,
 * its verbatim text, and the `lower-case`/`upper-case` call that replaces it.
 * The call is the standard `translate` whichever of its three spellings names
 * it, and its arguments are the nodes the parse separated, so a binding clause
 * is one argument however many commas it holds (#562, #576).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The folds found
 */
const folded = function(found) {
  const results = []
  for (const node of gathered(found, ['call'])) {
    if (calls(found, node, 'translate') &&
      node.children.length === ARGUMENTS) {
      const fold = folds(
        stringOf(found, node.children[1]), stringOf(found, node.children[2]),
      )
      if (fold !== null) {
        results.push({
          offset: offsetOf(found, node),
          value: textOf(found, node),
          replacement: `${fold}(${textOf(found, node.children[0])})`,
        })
      }
    }
  }
  return results
}

/**
 * Lint the valid expressions for `translate(x, 'A..Z', 'a..z')` case folding in
 * an XSLT 2.0 or 3.0 stylesheet, reporting one defect per call with a
 * suggestion fix that rewrites it to `lower-case(x)`/`upper-case(x)`.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByTranslate = function(expressions, suppressions = []) {
  logger.debug(`Translate-case linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      if (since(versionOf(found.node), MODERN)) {
        for (const {offset, value, replacement} of folded(found)) {
          defects.push(
            defect(CHECK, META, source, found, offset,
              {value, replacement, suggestion: true},
            ),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} translate case-fold defects`)
  return defects
}

module.exports = {
  lintByTranslate,
  names,
}
