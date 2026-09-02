/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {VALUED, calls, gathered, offsetOf, operatorOf, stringOf,
  textOf} = require('../syntax')
const {qualified} = require('../tokens')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, since} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'name-compared-to-string'

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
 * The two standard functions that answer a node's name.
 * @type {Array.<string>}
 */
const NAMING = ['name', 'local-name']

/**
 * The operators this check is about, spelled as `operatorOf` canonicalises
 * them, so the `eq` and `ne` of a value comparison arrive here as the symbols
 * their general-comparison twins are written with. An ordering comparison is a
 * different question — `name() lt 'z'` asks where the name sorts, not whether
 * the element is a `z` — and a node test cannot say it.
 * @type {Array.<string>}
 */
const OPERATORS = ['=', '!=']

/**
 * The standard function a node calls about the *current* node — `name` or
 * `local-name` — or null where it calls neither, or calls one about some other
 * node: `name()` and `name(.)` are this check's question where `name(@a)` is
 * about a node a rewrite could not reach. The prefix is no part of it: a
 * `fn:name()` and a `Q{urn:mine}name()` are the same function (#598, #577).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {?string} - The local name of the call, or null
 */
const naming = function(found, node) {
  let local = null
  if (node.children.length === 0 ||
    (node.children.length === 1 && node.children[0].kind === 'context')) {
    local = NAMING.find((name) => calls(found, node, name)) ?? null
  }
  return local
}

/**
 * The call and the string of a comparison, whichever side each stands on, or
 * null where its two operands are not that pair. XPath compares in either
 * order and a stylesheet is written both ways, so the question is which of the
 * two operands is which rather than what follows the call.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A comparison node of its tree
 * @return {?{local: string, literal: string}} - The pair, or null
 */
const paired = function(found, node) {
  const named = node.children.map((child) => naming(found, child))
  const held = node.children.map((child) => stringOf(found, child))
  let pair = null
  if (named[0] !== null && held[1] !== null) {
    pair = {local: named[0], literal: held[1]}
  } else if (named[1] !== null && held[0] !== null) {
    pair = {local: named[1], literal: held[0]}
  }
  return pair
}

/**
 * The node test that replaces a comparison, or null when it cannot be built
 * with one edit — a string XML cannot spell a name with, or a `local-name()`
 * comparison in a 1.0 stylesheet where the `*:name` wildcard does not exist.
 * Whether the string is a name is XML's question and the lexer's answer, asked
 * as `qualified` rather than as an ASCII class refusing `name() = 'é'` (#731).
 * @param {string} local - The called function, `name` or `local-name`
 * @param {string} operator - The comparison operator, `=` or `!=`
 * @param {string} literal - The compared string
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {?string} - The replacement expression, or null
 */
const test = function(local, operator, literal, modern) {
  let node = `self::*:${literal}`
  if (local === 'name') {
    node = `self::${literal}`
  }
  let replacement = node
  if (!qualified(literal) || (local === 'local-name' && !modern)) {
    replacement = null
  } else if (operator === '!=') {
    replacement = `not(${node})`
  }
  return replacement
}

/**
 * The `name()`/`local-name()`-versus-string comparisons in an expression: each
 * carries the offset it starts at, its verbatim text, and the node test that
 * replaces it (or null when it cannot be rewritten). Both classes are gathered,
 * XPath spelling one question two ways from 2.0 on (#763), and the string is
 * what the literal holds rather than how it is written (#598).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(found, modern) {
  const results = []
  for (const node of gathered(found, VALUED)) {
    const pair = paired(found, node)
    const operator = operatorOf(found, node.children[0], node.children[1])
    if (pair !== null && OPERATORS.includes(operator)) {
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        replacement: test(pair.local, operator, pair.literal, modern),
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for `name()`/`local-name()` compared with a string
 * literal, reporting one defect per comparison with the fix that turns it into
 * a node test when one can be built.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: ?object}[]} - Defects found
 */
const lintByName = function(expressions, suppressions = []) {
  logger.debug(`Name-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      const modern = since(found.version, MODERN)
      for (const {offset, value, replacement} of comparisons(found, modern)) {
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
  logger.debug(`Found ${defects.length} name comparison defects`)
  return defects
}

module.exports = {
  lintByName,
  names,
}
