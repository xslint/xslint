/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {calls, gathered, offsetOf, textOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, since, versionOf} = require('../xsl-version')
const {logger} = require('../logger')

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
 * The namespaces a `node-set` reading a result tree fragment as a node set is
 * declared in: EXSLT's common module, and the one Microsoft's processors put
 * their extensions in. Two URIs and one function, since both were written for
 * the same XSLT 1.0 gap and a 2.0 processor closes it for both.
 * @type {Array.<string>}
 */
const EXTENSIONS = ['http://exslt.org/common', 'urn:schemas-microsoft-com:xslt']

/**
 * How many arguments the extension takes: the fragment to read, and nothing
 * else. A call of the right name in the right namespace holding none, or two,
 * is not it — and unwrapping one wrote `select="/alpha"` where
 * `exsl:node-set()/alpha` stood, a fix the run then reported as an expression
 * of its own (#576).
 * @type {number}
 */
const ARGUMENTS = 1

/**
 * The `node-set()` wrappers an expression holds: each carries the offset it
 * starts at, its verbatim text, and the argument that replaces it.
 *
 * The call is the extension whichever of its three spellings names it — behind
 * any prefix a stylesheet binds to either namespace, or with the namespace
 * written inline — and a `node-set` of somebody else's is none of them,
 * where a scan matching `[\w.-]+:node-set` took the local name as the whole of
 * the question and read every prefix as the extension's (#557).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The wrappers found
 */
const wrappers = function(found) {
  const results = []
  for (const node of gathered(found, ['call'])) {
    if (calls(found, node, 'node-set', EXTENSIONS) &&
      node.children.length === ARGUMENTS) {
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        replacement: textOf(found, node.children[0]),
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for the `node-set()` extension used in XSLT 2.0 or
 * 3.0, where a variable is already a node sequence, reporting one defect per
 * call with the fix that unwraps it.
 *
 * Every expression a stylesheet carries is read, not the `@select` of an XSLT
 * element alone: the extension is as redundant in a `@test` as anywhere else,
 * and inside the braces of an attribute value template a processor evaluates
 * the expression whatever element carries the attribute — while the `select` a
 * literal result element spells is output text and yields no expression to read
 * at all (#557).
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByNodeSet = function(expressions, suppressions = []) {
  logger.debug(`Node-set linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      if (since(versionOf(found.node), MODERN)) {
        for (const {offset, value, replacement} of wrappers(found)) {
          defects.push(
            defect(
              CHECK, META, source, found, offset,
              {value, replacement},
            ),
          )
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
