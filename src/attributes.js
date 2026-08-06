/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {enclosed} = require('./expressions')
const {XSLT, since, versionOf} = require('./xsl-version')
const {walked} = require('./tree')

/**
 * Attributes that hold an XPath expression or a pattern — every place a
 * construct like an axis, a predicate, or a `count(...)` call can appear.
 * Patterns (`match` and the grouping attributes) are included, so a construct
 * in a template match is caught too, not only in the expression stream. So are
 * the two an `xsl:merge-source` holds beside its `select`, which carry an
 * expression the same way it does (#627).
 * @type {Array.<string>}
 */
const ATTRIBUTES = [
  'select', 'test', 'use', 'value', 'group-by', 'group-adjacent', 'key',
  'initial-value', 'xpath', 'context-item', 'with-params', 'namespace-context',
  'match', 'count', 'from', 'group-starting-with', 'group-ending-with',
  'for-each-item', 'for-each-source', 'use-when',
]

/**
 * The attributes among those that hold a *pattern* rather than an expression.
 * The two are not one language: a pattern has its own grammar, narrower where
 * an expression is free — `.` may stand alone there but not inside a union or
 * a parenthesis — and it decides which template wins rather than what a step
 * selects. A linter rewriting one has to know which of the two it is holding.
 * @type {Array.<string>}
 */
const PATTERNS = [
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
 * The names that hold a bare XPath, for testing one attribute at a time. Asking
 * XPath for all of them at once — a union of nineteen descendant scans, one per
 * name — costs more than a single scan of every XSLT attribute filtered by name
 * here, and costs it quadratically: 4.4 s against 0.3 s on a 2000-line
 * stylesheet (#633).
 * @type {Set.<string>}
 */
const NAMED = new Set(ATTRIBUTES)

/**
 * The expression list already derived for a document. Eight code-based linters
 * ask for the same one in a single run, and deriving it walks every attribute
 * and text node of the stylesheet, so it is derived once and remembered against
 * the document itself — which a `WeakMap` releases when the corpus does, rather
 * than holding every stylesheet ever linted (#633). Eight callers share one
 * array, so the array is frozen against having its entries swapped and each
 * entry is frozen where `carried` builds it — freezing the array alone leaves
 * `held.expression = ...` free to poison the other seven.
 * @type {WeakMap}
 */
const DERIVED = new WeakMap()

/**
 * The spellings that switch an XSLT boolean attribute on, whitespace trimmed —
 * `expand-text="true"` and `="1"` turn text value templates on as surely as
 * `="yes"` does.
 * @type {Array.<string>}
 */
const ON = ['yes', 'true', '1']

/**
 * Whether text value templates expand around the given text node — the nearest
 * ancestor to set `expand-text` (an XSLT element) or `xsl:expand-text` (a
 * literal result element) wins, and expansion is off until one does. In XSLT
 * 3.0 an on setting turns the `{...}` of a text node into real expressions, the
 * way a `select` carries one.
 * @param {Node} text - The text node
 * @return {boolean} - True when its braces expand
 */
const expands = function(text) {
  let node = text.parentNode
  let setting = ''
  while (node.nodeType === 1 && !setting) {
    setting = node.namespaceURI === XSLT ?
      node.getAttribute('expand-text') :
      node.getAttributeNS(XSLT, 'expand-text')
    node = node.parentNode
  }
  return Boolean(setting) && ON.includes(setting.trim())
}

/**
 * Whether the attribute is a shadow attribute standing in for a bare-XPath one
 * — `_select` for `select` — on an XSLT element, with no braces, so its whole
 * value is the static expression that becomes the real attribute (XSLT 3.0).
 * A shadow attribute that does carry braces is a template, left to `enclosed`.
 * @param {Node} attribute - The attribute node
 * @return {boolean} - True when its whole value is an expression
 */
const shadow = function(attribute) {
  return attribute.ownerElement.namespaceURI === XSLT &&
    attribute.nodeName.startsWith('_') &&
    ATTRIBUTES.includes(attribute.nodeName.slice(1)) &&
    !attribute.nodeValue.includes('{')
}

/**
 * The whole value of an attribute as one expression, standing where the value
 * itself starts. Every expression this module yields is such a record — the
 * node carrying it, the offset it begins at inside that node's value, its own
 * text, and whether it is a pattern — and a linter that narrows to one
 * attribute of its own builds the record here rather than handing a node and
 * its text on separately, which is how one word came to name both (#648).
 * @param {Node} attribute - The attribute node
 * @return {{node: Node, start: number, expression: string,
 *  pattern: boolean}} - The expression it holds whole
 */
const wholeOf = function(attribute) {
  return Object.freeze({
    node: attribute, start: 0, expression: attribute.nodeValue,
    pattern: PATTERNS.includes(attribute.nodeName.replace(/^_/, '')),
  })
}

/**
 * The expressions a node contributes: a whole value when it is a bare-XPath (or
 * shadow) attribute, otherwise each expression its braces enclose — an
 * attribute value template, or a text value template in a text node (a CDATA
 * section is one too) of a 3.0 stylesheet whose `expand-text` is on. Only an
 * attribute takes the attribute branch, so any other node the selector yields
 * is read as text rather than dereferenced as one. Each names its node, the
 * offset it starts at inside that node's value, and its own text.
 * @param {Node} node - An attribute, text, or CDATA node
 * @param {Set.<Node>} bare - Attributes holding a bare XPath
 * @param {boolean} three - Whether the stylesheet declares version 3.0
 * @return {Array.<{node: Node, start: number, expression: string}>} - Found
 */
const carried = function(node, bare, three) {
  const whole = node.nodeType === 2 &&
    (bare.has(node) || (three && shadow(node)))
  const braced = node.nodeType === 2 || (three && expands(node))
  return whole ?
    [wholeOf(node)] :
    braced ? enclosed(node.nodeValue).map((brace) => Object.freeze({
      node: node, start: brace.offset, expression: brace.value, pattern: false,
    })) : []
}

/**
 * Every expression a stylesheet carries, in document order. An attribute
 * holding a bare XPath contributes its whole value; another attribute, and a
 * text node under an on `expand-text` in a 3.0 stylesheet, contribute each
 * expression their braces enclose. Each one names the node, the offset it
 * starts at inside that node's value, and its own text, so a defect in it is
 * reported — and fixed — where it truly stands.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<{node: Node, start: number, expression: string}>} - The
 *  expressions found, each saying whether it is a pattern
 */
const expressionsOf = function(xsl) {
  if (!DERIVED.has(xsl)) {
    const held = walked(xsl)
    const bare = new Set(held.filter(
      (one) => one.nodeType === 2 && NAMED.has(one.nodeName) &&
        one.ownerElement.namespaceURI === XSLT,
    ))
    DERIVED.set(xsl, Object.freeze(held.flatMap(
      (node) => carried(node, bare, since(versionOf(node), '3.0')),
    )))
  }
  return DERIVED.get(xsl)
}

module.exports = {
  ATTRIBUTES,
  PATTERNS,
  selectorOf,
  expressionsOf,
  wholeOf,
}
