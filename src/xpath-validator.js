/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {isValid} = require('./xpath')
const {walked} = require('./tree')
const {XSLT} = require('./xsl-version')
const {yaml} = require('./helpers')
const path = require('path')
const {logger} = require('./logger')

/**
 * Name of the check this validator owns.
 * @type {string}
 */
const CHECK = 'invalid-xpath-expression'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = yaml.parsedFromFile(
  path.join(__dirname, 'resources', 'checks', 'validation', `${CHECK}.yaml`),
)

/**
 * Names of the checks this validator owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * Attribute nodes that carry a bare Xpath expression, scoped to XSLT elements
 * so literal result elements are left alone. Pattern attributes (match, count,
 * from, group-starting-with, group-ending-with), attribute value templates,
 * and sequence types (as) are not expressions and stay out.
 * @type {string}
 */
const EXPRESSIONS = [
  'select', 'test', 'use', 'value', 'group-by', 'group-adjacent',
  'key', 'initial-value', 'xpath', 'context-item', 'with-params',
  'namespace-context', 'for-each-item', 'for-each-source', 'use-when',
]

/**
 * Whether the walked node is one of those attributes on an XSLT element. The
 * walk answers the same set a descendant scan did and answers it linearly
 * (#635), so the name test that was a predicate inside the XPath is a filter
 * here.
 * @param {Node} node - A node of the walk
 * @return {boolean} - True when it holds an expression to validate
 */
const held = function(node) {
  return node.nodeType === 2 && EXPRESSIONS.includes(node.localName) &&
    node.ownerElement.namespaceURI === XSLT
}

/**
 * A reference to an entity left unresolved in a parsed expression — an entity
 * declared in an external DTD the parser never read. Such an expression cannot
 * be validated (`&` is not an XPath operator), so it is neither reported nor
 * kept: reporting it would be a false positive over a resolution gap.
 * @type {RegExp}
 */
const UNRESOLVED = /&[A-Za-z_][\w.-]*;/

/**
 * Validate every Xpath expression in the corpus, splitting the valid ones out
 * for the expression linters to consume from the malformed ones, which become
 * defects. An expression that cannot be parsed by the engine that would run it
 * is reported here and never handed on. A code-based linter is staged
 * differently — it takes the whole corpus and reads its own expressions from
 * `src/attributes.js`, patterns and attribute value templates included, which
 * this validator does not cover — so it does still read a refused expression
 * and report what it finds. What it may not do is offer to rewrite one, and
 * `defect` in `src/checks.js` is where that is withheld (#636).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{expressions: Array.<{source: object, expression: Node}>, defects:
 *  {name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]}} - Valid expressions and defects found
 */
const validate = function(corpus, suppressions = []) {
  logger.debug(`Xpath validation started`)
  const expressions = []
  const defects = []
  const suppressed = suppressions.some((sup) => CHECK.includes(sup))
  for (const source of corpus) {
    for (const expression of walked(source.xsl).filter(held)) {
      if (isValid(expression.nodeValue)) {
        expressions.push({source: source, expression: expression})
      } else if (UNRESOLVED.test(expression.nodeValue)) {
        logger.debug(`Skipping expression with an unresolved entity`)
      } else if (!suppressed) {
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: source.file,
          line: expression.lineNumber,
          pos: expression.columnNumber,
        })
      }
    }
  }
  logger.debug(`Found ${defects.length} invalid expressions`)
  return {expressions: expressions, defects: defects}
}

module.exports = {
  validate,
  names,
}
