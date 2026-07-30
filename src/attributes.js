/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {nodes} = require('./xpath')
const {enclosed} = require('./expressions')

/**
 * Attributes that hold an XPath expression or a pattern — every place a
 * construct like an axis, a predicate, or a `count(...)` call can appear.
 * Patterns (`match` and the grouping attributes) are included, so a construct
 * in a template match is caught too, not only in the expression stream.
 * @type {Array.<string>}
 */
const ATTRIBUTES = [
  'select', 'test', 'use', 'value', 'group-by', 'group-adjacent', 'key',
  'initial-value', 'xpath', 'context-item', 'with-params', 'namespace-context',
  'match', 'count', 'from', 'group-starting-with', 'group-ending-with',
]

/**
 * XPath selecting the named attribute of every XSLT element, document-wide. The
 * XSLT namespace belongs in the selector because only there does the name mean
 * an expression: an attribute the output vocabulary happens to call `test` or
 * `select` holds text destined for the result tree, not XPath.
 * @param {string} name - Name of the attribute
 * @return {string} - The Xpath selecting it
 */
const selectorOf = function(name) {
  return `//xsl:*/@${name}`
}

/**
 * XPath selecting every attribute that holds a bare XPath, across the document.
 * @type {string}
 */
const SELECTOR = ATTRIBUTES.map(selectorOf).join(' | ')

/**
 * Every expression the attributes of a stylesheet carry, in document order. An
 * attribute holding a bare XPath contributes its whole value; any other
 * attribute contributes each expression its braces enclose, an attribute value
 * template being the only way an expression hides there. Each one names the
 * attribute node, the offset it starts at inside that node's value, and its own
 * text, so a defect in it is reported — and fixed — where it truly stands.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<{node: Node, start: number, expression: string}>} - The
 *  expressions found
 */
const expressionsOf = function(xsl) {
  const bare = new Set(nodes(xsl, SELECTOR))
  return nodes(xsl, '//*/@*').flatMap((attribute) =>
    bare.has(attribute) ?
      [{node: attribute, start: 0, expression: attribute.nodeValue}] :
      enclosed(attribute.nodeValue).map((found) => ({
        node: attribute,
        start: found.offset,
        expression: found.value,
      })),
  )
}

module.exports = {
  ATTRIBUTES,
  selectorOf,
  expressionsOf,
}
