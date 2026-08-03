/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  evaluateXPath, evaluateXPathToNodes, evaluateXPathToStrings,
  compileXPathToJavaScript,
} = require('fontoxpath')
const {WHITESPACE} = require('./tokens')

/**
 * Namespace URI of the xslint custom XPath functions.
 * @type {string}
 */
const FUNCTIONS = 'https://github.com/maxonfjvipon/xslint'

/**
 * Standard prefixes bound in every Xpath expression. When validating, an
 * unknown prefix must not be mistaken for a syntax error, so these resolve to
 * their real URIs and any other prefix resolves to a placeholder.
 * @type {object}
 */
const STANDARD = {
  'xsl': 'http://www.w3.org/1999/XSL/Transform',
  'xs': 'http://www.w3.org/2001/XMLSchema',
  'fn': 'http://www.w3.org/2005/xpath-functions',
  'map': 'http://www.w3.org/2005/xpath-functions/map',
  'array': 'http://www.w3.org/2005/xpath-functions/array',
  'math': 'http://www.w3.org/2005/xpath-functions/math',
}

/**
 * Prefixes.
 * @type {{xsl: string, xslint: string}}
 */
const PREFIXES = {
  'xsl': STANDARD.xsl,
  'xslint': FUNCTIONS,
}

/**
 * Resolve prefix.
 * @param {string} prefix - Prefix itself
 * @return {null | string} - Resolved prefix
 */
const resolvePrefix = function(prefix) {
  let spec = null
  if (Object.hasOwn(PREFIXES, prefix)) {
    spec = PREFIXES[prefix]
  }
  return spec
}

/**
 * Nodes matching given Xpath on given XSL.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @param {string} xpath - Xpath
 * @return {Array.<Node>} - Matching nodes in the order defined by the XPath
 */
const nodes = function(xsl, xpath) {
  return evaluateXPathToNodes(
    xpath, xsl, null, {}, {namespaceResolver: resolvePrefix},
  )
}

/**
 * String values matching given Xpath on given XSL.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @param {string} xpath - Xpath
 * @return {Array.<string>} - Matching string values
 */
const strings = function(xsl, xpath) {
  return evaluateXPathToStrings(
    xpath, xsl, null, {}, {namespaceResolver: resolvePrefix},
  )
}

/**
 * A thrown compile failure that carries a W3C error code, as opposed to a
 * parse failure. The engine reports a syntax error as "<position>: <source>",
 * but a static or type error as a QName-shaped code such as XPTY0004 or
 * XPST0017. Only the former means the expression is genuinely malformed.
 * @type {RegExp}
 */
const CODED = /^[A-Z]{4}\d{4}/

/**
 * One character of ExprWhitespace, which XPath 1.0 §3.7 spells as XML's `S`:
 * a space, a tab, a carriage return or a newline, and nothing else. The lexer
 * reads a gap through the same four. A wider class would be wrong rather than
 * generous, because the six further characters JavaScript's `\s` counts — a
 * no-break space and an em space among them — stand nowhere in an expression
 * outside a string literal, so a gap spelled with one is malformed and must
 * not be respelled into something the engine accepts.
 * @type {string}
 */
const SPACE = `[${WHITESPACE}]`

/**
 * What may stand where a node test stands: a name, or the wildcard. Nothing
 * else follows an axis separator, so a gap in front of anything else is not a
 * gap a step spells.
 * @type {string}
 */
const TEST = '[*\\p{L}_]'

/**
 * What may stand inside the brackets of a node test: the closing bracket
 * itself, a name, a wildcard, or the string literal a
 * processing-instruction test names.
 * @type {string}
 */
const ARGUMENT = '[)*\'"\\p{L}_]'

/**
 * A name the AxisName production spells, and the whole of it — an NCName is
 * read as an axis only when it is one of these thirteen, so a gap behind any
 * other name is not a gap a step spells.
 * @type {Array.<string>}
 */
const AXES = [
  'ancestor-or-self', 'ancestor', 'attribute', 'child', 'descendant-or-self',
  'descendant', 'following-sibling', 'following', 'namespace', 'parent',
  'preceding-sibling', 'preceding', 'self',
]

/**
 * The names a node test is spelled with: the four NodeTypes of XPath 1.0, the
 * kind tests 2.0 added, and the one 3.0 added.
 * @type {Array.<string>}
 */
const TESTS = [
  'node', 'text', 'comment', 'processing-instruction',
  'document-node', 'element', 'attribute', 'schema-element',
  'schema-attribute', 'namespace-node',
]

/**
 * An axis name spaced from the `::` behind it, up to the node test that
 * follows. XPath lexes `::` as one token and lets a gap stand on either side,
 * so `child :: a` names the step `child::a` names, yet the engine reads the
 * spaced spelling as a name followed by rubbish. The axis in front and the
 * test behind are both required, because deleting a gap between anything else
 * writes a token that was not there: `(` next to `::` spells the comment
 * opener `(:`, and `::` next to `)` the closer `:)`, either of which would
 * bury a broken expression in a comment the engine skips.
 * @type {RegExp}
 */
const SPACED_AXIS = new RegExp(
  `(?<![\\w.-])(${AXES.join('|')})${SPACE}*::${SPACE}*(?=${TEST})`, 'gu',
)

/**
 * The namespace axis, which XPath 3.0 dropped but 1.0 and 2.0 define. The
 * engine cannot parse it, so an expression that uses it is rewritten to a
 * supported axis before being retried. Its own gaps are gone by then, squeezed
 * out with every other axis's.
 * @type {RegExp}
 */
const NAMESPACE_AXIS = /(?<![\w.-])namespace::/g

/**
 * A node test's name spaced from its `(`, up to what the brackets hold. XPath
 * 1.0 §3.7 recognises one of these names as a NodeType when a `(` follows it
 * "possibly after intervening ExprWhitespace", but the engine reads it as an
 * element name unless the bracket is adjacent, and refuses a `(` its `)` does
 * not touch. The names are spelled out rather than taken as any name, because
 * it is only a node test a bracket changes the meaning of; a name that merely
 * ends in one is left alone, so `my-text ()` stays the call it already was.
 * What the brackets hold is required for the same reason the axis is: a `(`
 * pulled onto a `:` would spell a comment opener.
 * @type {RegExp}
 */
const SPACED_TEST = new RegExp(
  `(?<![\\w.-])(${TESTS.join('|')})${SPACE}*\\(${SPACE}*(?=${ARGUMENT})`, 'gu',
)

/**
 * Whether the engine compiles the expression, counting a static-type
 * complaint as success. The engine is XPath 3.1, so it rejects the implicit
 * numeric coercion an XPath 1.0 stylesheet leans on (substring-before(...) -
 * 1); that is a dialect mismatch, not a syntax error. It tells the two apart
 * by the shape of the failure: a parse error is "<position>: <source>", a
 * static or type error a W3C code such as XPTY0004.
 * @param {string} xpath - Xpath expression
 * @return {boolean} - True when it compiles or fails only on a type
 */
const compiles = function(xpath) {
  let ok = true
  try {
    compileXPathToJavaScript(xpath, evaluateXPath.ALL_RESULTS_TYPE, {
      namespaceResolver: (prefix) =>
        Object.hasOwn(STANDARD, prefix) ? STANDARD[prefix] : FUNCTIONS,
    })
  } catch (err) {
    ok = CODED.test(String(err.message))
  }
  return ok
}

/**
 * The expression respelled the one way the engine reads it: an axis pulled
 * onto its separator, a node test onto its bracket, and the namespace axis
 * rewritten to a supported one — in that order, so the rewrite meets a
 * separator whose gaps are already gone. Each squeeze runs between a step's
 * own parts and nowhere else, so it deletes a gap the grammar allows and never
 * writes a token: what surrounds the gap reads as a step before the squeeze
 * and after it, which is why a broken expression cannot come out whole.
 * @param {string} xpath - Xpath expression
 * @return {string} - The same expression, spelled for the engine
 */
const squeezed = function(xpath) {
  return xpath
    .replace(SPACED_AXIS, '$1::')
    .replace(NAMESPACE_AXIS, 'child::')
    .replace(SPACED_TEST, '$1(')
}

/**
 * Whether given Xpath expression is syntactically valid. The same engine that
 * runs the rules parses it, so an expression is valid here exactly when the
 * processor can parse it. Every prefix resolves, isolating syntax from
 * unresolved-prefix errors. What the engine refuses yet the grammar spells —
 * the namespace axis of the older dialects, ExprWhitespace around an axis
 * separator or in front of a node test's bracket (#615) — is retried
 * respelled, and an expression the respelling gets through is valid too.
 * @param {string} xpath - Xpath expression
 * @return {boolean} - True when the expression parses
 */
const isValid = function(xpath) {
  return compiles(xpath) || compiles(squeezed(xpath))
}

module.exports = {
  nodes,
  strings,
  isValid,
}
