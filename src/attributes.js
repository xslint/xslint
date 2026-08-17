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
 * Whether the expression is the whole value of an attribute of that name — the
 * one narrowing a linter reading a single attribute needs, now that it is
 * handed the records the validator kept rather than the corpus to scan itself
 * (#750). It replaces an XPath of this module's own over the named attribute of
 * every XSLT element, and asks one question where that selector asked two: the
 * namespace test is gone rather than moved, since the derivation yields an XSLT
 * element's attribute whole and every other one only through its braces. Both
 * halves are one call rather than two conditions, because a linter taking the
 * name alone would start reading the `test="{boolean(x)}"` of a literal result
 * element, where stripping the wrapper prints the node instead of `true`. A
 * brace stands at least one character inside a value, so an expression starting
 * at `0` is the value itself. A shadow attribute keeps its underscore, so
 * `_select` is not `select`, which is what the narrowing has always said.
 * The name asked for is the unprefixed one, and an attribute in the XSLT
 * namespace answers to it: `use-when` names the `xsl:use-when` a literal result
 * element carries as much as the bare attribute of an XSLT element, the two
 * being one attribute XSLT spells twice (#654). A prefix is the document's to
 * choose, so the namespace is what the question is about, and a shadow
 * attribute keeps its underscore either way.
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
 * template. XSLT spells such an attribute two ways: unprefixed on an XSLT
 * element, and in the XSLT namespace on an element of the result vocabulary,
 * which is the only spelling a literal result element has. Until #654 this
 * asked for the first alone, so the expressions a simplified stylesheet carries
 * reached nothing at all — no code-based check and not the validator either,
 * both of them staged over the records this derivation yields. `xsl:use-when`
 * is the one attribute XSLT allows there and the whole of what the second half
 * admits in a stylesheet a processor loads: the rest of its reach — an
 * `xsl:select`, an `xsl:match` — is an attribute no version permits on such an
 * element, so reading one costs a report on a file already refused rather than
 * a defect invented against working code. A prefix is the document's own, so
 * the namespace decides and never the spelling.
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
  const entire = node.nodeType === 2 &&
    (bare.has(node) || (three && shadow(node)))
  const braced = node.nodeType === 2 || (three && expands(node))
  let taken = []
  if (entire) {
    taken = [wholeOf(node)]
  } else if (braced) {
    taken = enclosed(node.nodeValue).map((brace) => Object.freeze({
      node: node, start: brace.offset, expression: brace.value, pattern: false,
    }))
  }
  return taken
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
      (one) => one.nodeType === 2 && wholly(one),
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
  whole,
  expressionsOf,
}
