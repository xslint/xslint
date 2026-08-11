/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  evaluateXPath, evaluateXPathToNodes, evaluateXPathToStrings,
  compileXPathToJavaScript,
} = require('fontoxpath')
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
 * Whether the engine compiles the expression, counting a static-type
 * complaint as success. The engine is XPath 3.1, so it rejects the implicit
 * numeric coercion an XPath 1.0 stylesheet leans on (substring-before(...) -
 * 1); that is a dialect mismatch, not a syntax error. It tells the two apart
 * by the shape of the failure: a parse error is "<position>: <source>", a
 * static or type error a W3C code such as XPTY0004.
 *
 * No verdict of a run passes through here any more (#732): this is the second
 * opinion `test/grammar-corpus.test.js` and `test/grammar-shapes.test.js` diff
 * the grammar against, and it is exported for them. Which is why it may stay
 * strict where the specification is not — an engine that refuses a spelling
 * XPath spells is evidence about the engine, and the suite accounts for the
 * three such spellings by name rather than by respelling them (#738).
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
 * (#615, #639) — so the respelling retry those three needed is gone rather than
 * merely bypassed, and nothing in `src/` rewrites an expression to ask about it
 * any more (#738). And
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
}
