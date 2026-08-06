/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  evaluateXPath, evaluateXPathToNodes, evaluateXPathToStrings,
  compileXPathToJavaScript,
} = require('fontoxpath')
const {WHITESPACE, spelling} = require('./tokens')

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
 * generous, because the twenty-one further characters JavaScript's `\s` counts
 * — a no-break space and an em space among them — stand nowhere in an
 * expression outside a string literal, so a gap spelled with one is malformed
 * and must not be respelled into something the engine accepts.
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
  'schema-attribute', 'namespace-node', 'item', 'empty-sequence',
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
  `(${AXES.join('|')})${SPACE}*::${SPACE}*(?=${TEST})`, 'gu',
)

/**
 * The namespace axis, which XPath 3.0 dropped but 1.0 and 2.0 define. The
 * engine cannot parse it, so an expression that uses it is rewritten to a
 * supported axis before being retried. Its own gaps are gone by then, squeezed
 * out with every other axis's.
 * @type {RegExp}
 */
const NAMESPACE_AXIS = /(namespace)::/g

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
  `(${TESTS.join('|')})${SPACE}*\\(${SPACE}*(?=${ARGUMENT})`, 'gu',
)

/**
 * The gap in front of a `)`, and the character it stands behind. The engine
 * reads a kind test as its keyword glued to both brackets, so `element( a )` is
 * refused where `element(a)` passes, though XPath 2.0 lets ExprWhitespace stand
 * between any two tokens (#639). Deleting the gap glues that character to the
 * `)`, and one XPath token alone ends in one — the comment closer `:)` — so a
 * `:` is the whole of what must be left in front of a gap, and every other
 * character is safe by the grammar rather than by a list of the ones a test
 * happens to hold. A list is what refuses the wildcard of `element( * )` and
 * the non-ASCII name of `element( ä )`, both of which XPath spells. Elsewhere
 * the deletion is inert: a gap a call's brackets or a string literal carries
 * leaves the token stream exactly as it stood, so the retry spends it and the
 * engine answers the same.
 * @type {RegExp}
 */
const SPACED_CLOSE = new RegExp(`([^:${WHITESPACE}])${SPACE}+\\)`, 'gu')

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
 * The same expression with each match of the pattern rewritten, except where a
 * name is still being spelled in front of it. A `-` continues a name a letter
 * started and subtracts everywhere else, and no lookbehind can tell the two
 * apart, because it reads characters where the question is about tokens. The
 * lexer answers it instead: `spelling` walks the run of name characters back
 * and asks whether it begins the way a name may, so the `namespace` of
 * `a-namespace::x` is the tail of one name and is left alone, while the one in
 * `1-namespace::x` stands behind a minus and opens a step of its own.
 * @param {string} xpath - Xpath expression
 * @param {RegExp} pattern - Pattern whose first group is the name it opens on
 * @param {function(string): string} replacement - What that name becomes
 * @param {function(string, number): boolean} swallowed - Whether a longer name
 *  takes the match in, leaving nothing of its own to respell
 * @return {string} - The expression rewritten wherever no name runs into it
 */
const rewritten = function(xpath, pattern, replacement, swallowed) {
  return xpath.replace(
    pattern,
    (match, name, at) => swallowed(xpath, at) ? match : replacement(name),
  )
}

/**
 * Whether the node test's name at the offset is the tail of a longer name
 * rather than a test standing on its own. `spelling` answers most of it, but a
 * `:` is a name character to the lexer — a QName carries one — and the `::`
 * that puts a node test where it stands is an axis separator, not a name. So
 * the `node` of `parent::node ()` opens a test though a name reads back from
 * it, while the `text` of `my-text ()` is the end of one name. A prefixed name
 * loses nothing by the exception: the engine compiles `my:node ( )` outright.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset the name opens at
 * @return {boolean} - True when a longer name swallows the test
 */
const tailed = function(xpath, at) {
  return spelling(xpath, at) && xpath[at - 1] !== ':'
}

/**
 * The respellings, in the order they run: an axis pulled onto its separator,
 * the namespace axis then rewritten to a supported one — second, so the
 * rewrite meets a separator whose gaps are already gone — a node test pulled
 * onto the bracket it opens with, and last the bracket it closes with pulled
 * onto what it holds. One sweep of the last is enough for a nested test even
 * though it leaves a gap standing: `document-node( element( a ) )` comes out
 * `document-node(element(a) )`, because a scan does not revisit the `)` it has
 * just consumed. The engine asks for no more — what it refuses is a gap inside
 * a test, not one in front of the bracket a test closes around another.
 * @type {Array.<Array>}
 */
const SQUEEZES = [
  [SPACED_AXIS, (name) => `${name}::`, spelling],
  [NAMESPACE_AXIS, () => 'child::', spelling],
  [SPACED_TEST, (name) => `${name}(`, tailed],
  [SPACED_CLOSE, (tail) => `${tail})`, () => false],
]

/**
 * The expression respelled the one way the engine reads it. Each squeeze runs
 * between a step's own parts and nowhere else, so the gap it deletes is one the
 * grammar lets stand there, and the tests hold every merge a deletion elsewhere
 * would spell. What the retry cannot claim is that it only ever widens what is
 * accepted: its guards are a regex over characters and one borrowed lexer
 * question, not a parse, so an expression it declines to respell is refused on
 * the engine's word alone. #641 tracks what that costs.
 * @param {string} xpath - Xpath expression
 * @return {string} - The same expression, spelled for the engine
 */
const squeezed = function(xpath) {
  return SQUEEZES.reduce(
    (expression, [pattern, replacement, swallowed]) =>
      rewritten(expression, pattern, replacement, swallowed),
    xpath,
  )
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
