/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  evaluateXPath, evaluateXPathToNodes, evaluateXPathToStrings,
  compileXPathToJavaScript,
} = require('fontoxpath')

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
 * The namespace axis, which XPath 3.0 dropped but 1.0 and 2.0 define. The
 * engine cannot parse it, so an expression that uses it is rewritten to a
 * supported axis before being retried.
 * @type {RegExp}
 */
const NAMESPACE_AXIS = /namespace\s*::/g

/**
 * The axis separator together with the whitespace around it. XPath lexes `::`
 * as one token and allows whitespace between tokens, so `child :: a` names the
 * step `child::a` names, yet the engine reads the spaced spelling as a name
 * followed by rubbish.
 * @type {RegExp}
 */
const SPACED_AXIS = /\s*::\s*/g

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
 * A node test's name together with the whitespace between it and its `(`, and
 * whatever follows that bracket. XPath 1.0 §3.7 recognises one of these names
 * as a NodeType when a `(` follows it "possibly after intervening
 * ExprWhitespace", but the engine reads it as an element name unless the
 * bracket is adjacent, and refuses a `(` its `)` does not touch. The names are
 * spelled out rather than taken as any name, because it is only a node test a
 * bracket changes the meaning of; a name that merely ends in one is left
 * alone, so `my-text ()` stays the call it already was.
 * @type {RegExp}
 */
const SPACED_TEST = new RegExp(
  `(^|[^\\w.-])(${TESTS.join('|')})\\s*\\(\\s*`, 'g',
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
 * The expression respelled the one way the engine reads it: the namespace axis
 * rewritten to a supported one, the whitespace around an axis separator and
 * around the bracket of a node test squeezed out. Every one of these is a
 * spelling the grammar allows and the engine alone refuses, and squeezing
 * whitespace out of a step cannot make a broken expression whole — `child ::`
 * still has no node test once its gap is gone.
 * @param {string} xpath - Xpath expression
 * @return {string} - The same expression, spelled for the engine
 */
const squeezed = function(xpath) {
  return xpath
    .replace(NAMESPACE_AXIS, 'child::')
    .replace(SPACED_AXIS, '::')
    .replace(SPACED_TEST, '$1$2(')
}

/**
 * Whether given Xpath expression is syntactically valid. The same engine that
 * runs the rules parses it, so an expression is valid here exactly when the
 * processor can parse it. Every prefix resolves, isolating syntax from
 * unresolved-prefix errors. What the engine refuses yet the grammar spells —
 * the namespace axis of the older dialects, whitespace around an axis
 * separator or a node test's bracket (#615) — is retried respelled, and an
 * expression the respelling gets through is valid too.
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
