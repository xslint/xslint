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
 * in a template match is caught too, and so are the two an `xsl:merge-source`
 * holds beside its `select` (#627).
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
 * Whether the expression is the whole value of an attribute of that name, the
 * narrowing a linter needs now that it is handed the records the validator
 * kept (#750). One question rather than two on purpose: taking the name alone
 * would read the `test="{boolean(x)}"` of a literal result element, where
 * stripping the wrapper prints the node (#654).
 * @param {{node: Node, start: number}} found - A record `expressionsOf` yielded
 * @param {string} name - The name of the attribute a linter narrows to
 * @return {boolean} - True when the expression is that attribute's whole value
 */
const whole = function(found, name) {
  let called = found.node.nodeName
  if (found.node.namespaceURI === XSLT) {
    called = found.node.localName
  }
  return found.start === 0 && called === name
}

/**
 * The names that hold a bare XPath, for testing one attribute at a time. Asking
 * XPath for all of them at once — a union of twenty descendant scans, one per
 * name — costs more than a single scan of every XSLT attribute filtered by name
 * here, and costs it quadratically: 4.4 s against 0.3 s on a 2000-line
 * stylesheet (#633).
 * @type {Set.<string>}
 */
const NAMED = new Set(ATTRIBUTES)

/**
 * The expression list already derived for a document. Eight code-based linters
 * ask for the same one in a run and deriving it walks every attribute and text
 * node, so it is derived once and remembered against the document itself —
 * which a `WeakMap` releases when the corpus does (#633). The array and each
 * entry are frozen, eight callers sharing one array.
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
    if (node.namespaceURI === XSLT) {
      setting = node.getAttribute('expand-text')
    } else {
      setting = node.getAttributeNS(XSLT, 'expand-text')
    }
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
 * Whether the attribute's whole value is an XPath expression rather than a
 * template. XSLT spells one two ways: unprefixed on an XSLT element, and in
 * the XSLT namespace on a result-vocabulary element, the only spelling a
 * simplified stylesheet has. The rest of that reach costs a report on a file
 * already refused, never a defect against working code (#654).
 * @param {Node} attribute - The attribute node
 * @return {boolean} - True when its whole value is an expression
 */
const wholly = function(attribute) {
  return (NAMED.has(attribute.nodeName) &&
    attribute.ownerElement.namespaceURI === XSLT) ||
    (NAMED.has(attribute.localName) && attribute.namespaceURI === XSLT)
}

/**
 * The whole value of an attribute as one expression, standing where the value
 * itself starts. Every expression this module yields is such a record — the
 * node, the offset inside its value, the text, whether it is a pattern, and
 * the version in force where it stands — and a linter narrowing to one
 * attribute builds the record here rather than handing the pieces on (#648).
 * @param {Node} attribute - The attribute node
 * @param {string} version - The version in force at its element
 * @return {{node: Node, start: number, expression: string, pattern: boolean,
 *  version: string}} - The expression it holds whole
 */
const wholeOf = function(attribute, version) {
  return Object.freeze({
    node: attribute, start: 0, expression: attribute.nodeValue,
    pattern: PATTERNS.includes(attribute.nodeName.replace(/^_/, '')),
    version: version,
  })
}

/**
 * The expressions a node contributes: a whole value when it is a bare-XPath or
 * shadow attribute, otherwise each expression its braces enclose — an
 * attribute value template, or a text value template in a text node (a CDATA
 * section is one too) of a 3.0 stylesheet whose `expand-text` is on. Only an
 * attribute takes the attribute branch.
 * @param {Node} node - An attribute, text, or CDATA node
 * @param {Set.<Node>} bare - Attributes holding a bare XPath
 * @param {string} version - The version in force at the node
 * @return {Array.<{node: Node, start: number, expression: string}>} - Found
 */
const carried = function(node, bare, version) {
  const three = since(version, '3.0')
  const entire = node.nodeType === 2 &&
    (bare.has(node) || (three && shadow(node)))
  const braced = node.nodeType === 2 || (three && expands(node))
  let taken = []
  if (entire) {
    taken = [wholeOf(node, version)]
  } else if (braced) {
    taken = enclosed(node.nodeValue).map((brace) => Object.freeze({
      node: node, start: brace.offset, expression: brace.value, pattern: false,
      version: version,
    }))
  }
  return taken
}

/**
 * Every expression a stylesheet carries, in document order. An attribute
 * holding a bare XPath contributes its whole value; another attribute, and a
 * text node under an on `expand-text` in a 3.0 stylesheet, contribute each
 * expression their braces enclose. Each names the node, the offset inside its
 * value, the text, and the version in force there, derived once here (#845).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<{node: Node, start: number, expression: string}>} - The
 *  expressions found, each saying whether it is a pattern
 */
const expressionsOf = function(xsl) {
  if (!DERIVED.has(xsl)) {
    const held = walked(xsl)
    const bare = new Set(held.filter(
      (one) => one.nodeType === 2 && wholly(one),
    ))
    DERIVED.set(xsl, Object.freeze(held.flatMap(
      (node) => carried(node, bare, versionOf(node)),
    )))
  }
  return DERIVED.get(xsl)
}

module.exports = {
  ATTRIBUTES,
  ON,
  PATTERNS,
  whole,
  expressionsOf,
}
