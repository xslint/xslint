/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  evaluateXPath, evaluateXPathToNodes, evaluateXPathToStrings,
  compileXPathToJavaScript,
} = require('fontoxpath')
const {WHITESPACE, spelling} = require('./tokens')
const {parsed, matched} = require('./grammar')
const {versionOf, KNOWN} = require('./xsl-version')

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
 * the deletion is inert on the grammar rather than on the text: a gap a call's
 * brackets carry stands between the same two tokens once it is gone, while one
 * inside a string literal or a comment shortens a run the parser does not read
 * into at all — `f('a )')` is retried as `f('a)')` and compiles the same, the
 * respelling being thrown away the moment it has answered.
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
      namespaceResolver: (prefix) => {
        let uri = FUNCTIONS
        if (Object.hasOwn(STANDARD, prefix)) {
          uri = STANDARD[prefix]
        }
        return uri
      },
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
    (match, name, at) => {
      let spelled = match
      if (!swallowed(xpath, at)) {
        spelled = replacement(name)
      }
      return spelled
    },
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
 * grammar lets stand there. Its guards are a regex over characters and one
 * borrowed lexer question rather than a parse, which is why what they hold is
 * swept rather than argued: across every sequence of up to four of the pieces a
 * fabrication is spelled from, no respelling changes the kinds an expression is
 * made of, so the engine is handed the tokens it was always going to read and
 * merely spelled the way it insists on. That sweep lives in
 * `test/xpath.test.js`, and is why this is exported.
 *
 * Fabricating a delimiter is the sharp end of it — `(:` and `:)` are one token
 * each, and a gap deleted between a bracket and a colon would bury a broken
 * expression in a comment the engine skips, which is what #641 reported. It is
 * not the whole of it, though: a squeeze that merged two names across a gap
 * would move no delimiter and still change what compiles.
 *
 * What the sweep does not claim is that an expression the guards decline to
 * respell deserved refusing: that is the engine's word alone, which no
 * character-level guard can second-guess and only a grammar of our own (#677)
 * can answer.
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
 * What each expression already answered. fontoxpath remembers nothing between
 * calls — a second pass over the same four thousand expressions costs what the
 * first did — while a corpus repeats its expressions constantly, `.` and
 * `@name` and `text()` above all, so the same parse was being paid for over and
 * over (#689). One entry per distinct expression is bounded by the corpus that
 * asked, and the answer cannot go stale: the same text parses the same way for
 * the life of a process.
 *
 * What is kept is the refusal rather than a boolean, because the parse already
 * knows more than yes or no — what the grammar expected, and the offset it
 * stood at — and a caller that throws that away leaves the report pointing at
 * the attribute instead of at the fault. One derivation, one parse (#589).
 * @type {Map.<string, {fault: string, at: number}>}
 */
const VERDICTS = new Map()

/**
 * The version an expression is read under when its stylesheet declares none, or
 * declares one `versionOf` cannot place. The most permissive version known,
 * deliberately: a missing `version` is already a defect of its own, and letting
 * it decide a syntax question would answer one defect with an
 * `invalid-xpath-expression` for every modern expression the file holds — a
 * refusal invented against XPath that is valid under the version its author
 * meant. Derived rather than spelled, so a version added to `KNOWN` becomes the
 * fallback without anybody remembering to move it.
 * @type {string}
 */
const ASSUMED = KNOWN[KNOWN.length - 1]

/**
 * Why the grammar refuses an expression, asked at the version in force where it
 * stands — an empty `fault` when it takes it. Two things follow that the engine
 * could not give. The spelling is judged against the specification rather than
 * against fontoxpath, which is stricter than it — a `namespace::` axis, and
 * ExprWhitespace around an axis separator or around a node test's bracket
 * (#615, #639) — so the respelling retry those needed is off this path. And
 * the version decides, so `1 cast as xs:integer` is valid in a 2.0 sheet and a
 * syntax error in a 1.0 one, which is the whole of #652 and cannot be
 * anywhere else: fontoxpath is XPath 3.1 and knows no other dialect (#732).
 *
 * A pattern is judged by `matched` rather than by `parsed`, since a `match` is
 * a different language and not a second reading of this one — `1 + 1` is a fine
 * expression and no pattern at all.
 *
 * What comes back is the complaint and the offset it stands at, not the tree
 * beside them: the answer is remembered for every distinct expression a corpus
 * holds, and a tree per entry is a different bargain from a sentence per entry.
 * The offset is what a report needs, and having it is what lets the validator
 * point at the fault rather than at the attribute holding it (#589).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` and `wholeOf` yield it
 * @return {{fault: string, at: number}} - What the grammar expected, and where
 *  in the expression it wanted it
 */
const refusalOf = function(found) {
  let version = versionOf(found.node)
  if (!KNOWN.includes(version)) {
    version = ASSUMED
  }
  const key = `${version} ${found.pattern} ${found.expression}`
  if (!VERDICTS.has(key)) {
    let answer = parsed(found.expression, version)
    if (found.pattern) {
      answer = matched(found.expression, version)
    }
    VERDICTS.set(key, {fault: answer.fault, at: answer.at})
  }
  return VERDICTS.get(key)
}

/**
 * Whether an expression is syntactically valid — `refusalOf` with nothing to
 * complain about. Most callers want the verdict alone: a fix is withheld on a
 * defect standing in text no processor parses (#636, #651), and neither gate
 * has anywhere to say why.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` and `wholeOf` yield it
 * @return {boolean} - True when the expression parses
 */
const isValid = function(found) {
  return refusalOf(found).fault === ''
}

module.exports = {
  nodes,
  strings,
  refusalOf,
  isValid,
  compiles,
  squeezed,
}
