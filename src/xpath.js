/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The fontoxpath environment, and the functions this project adds to it.
 * `xslint:normalize-space` is what every selector of ours spells, because
 * fontoxpath's own collapses on JavaScript's `\s` where XPath defines the
 * gap as the four characters of XML's `S` (#643): six of the seven selectors
 * spelling it were wrong in both directions before #881. The seventh was
 * served off the shared walk, which already read the four characters, and a
 * served answer differing from the engine's is worse than a slow one, so the
 * vocabulary serves only the `xslint:` spelling. `xslint:version` hands a
 * declarative gate `versionOf`'s answer at the node rather than the root's
 * (#618, #851), `NaN` where nothing declares one, which clears no floor.
 */

const {
  evaluateXPath, evaluateXPathToBoolean, evaluateXPathToNodes,
  compileXPathToJavaScript, registerCustomXPathFunction,
} = require('fontoxpath')
const {nameOf, saidOf} = require('./expressions')
const {conditional} = require('./conditions')
const {normalized} = require('./tokens')
const {numbered} = require('./xsl-version')

/**
 * Namespace URI of the xslint custom XPath functions.
 * @type {string}
 */
const FUNCTIONS = 'https://github.com/xslint/xslint'

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
 * `xslint:normalize-space`, which every selector of ours spells where XPath
 * would say `normalize-space`. The engine's own trims and collapses on `\s`,
 * so a no-break space or an em space is a gap to it, where XPath defines the
 * function over XML's four `S` characters alone — so a selector asking the
 * engine read a wider gap than the walk answering it (#643, #881).
 */
registerCustomXPathFunction(
  {namespaceURI: FUNCTIONS, localName: 'normalize-space'},
  ['xs:string?'], 'xs:string',
  (context, text) => normalized(text ?? ''),
)

/**
 * `xslint:version`, the version in force at a node, which a declarative gate
 * compares as a floor. XSLT sets it on any element and a shadow `_version`
 * spells it as readily, so no selector over the document answers it: a root's
 * own misjudges every subtree raised or lowered against it, and a list of the
 * spellings a gate must know is a second opinion about XSLT (#618, #851).
 */
registerCustomXPathFunction(
  {namespaceURI: FUNCTIONS, localName: 'version'},
  ['node()'], 'xs:double',
  (context, node) => numbered(node),
)

/**
 * `xslint:attribute`, what an attribute of an XSLT element says in either
 * spelling, `_x` holding an attribute value template rather than the value,
 * so no comparison against a literal reaches one (#992). Where the run
 * supplies the value it answers the empty sequence, so `= ''` reads an empty
 * name and never a computed one (#997).
 */
registerCustomXPathFunction(
  {namespaceURI: FUNCTIONS, localName: 'attribute'},
  ['node()', 'xs:string'], 'xs:string*',
  (context, node, name) => saidOf(node, name),
)

/**
 * `xslint:name`, the expanded name an attribute of an XSLT element holds, or
 * the empty sequence where it names none. A name is a QName rather than text,
 * so `p:x` and `q:x` are one name where both prefixes are bound to one URI,
 * and a selector comparing values reads the prefix instead (#1060).
 */
registerCustomXPathFunction(
  {namespaceURI: FUNCTIONS, localName: 'name'},
  ['node()', 'xs:string'], 'xs:string*',
  (context, node, name) => [nameOf(node, name)].filter(Boolean),
)

/**
 * `xslint:conditional`, whether a processor may leave an element out over a
 * `use-when` in a spelling its version reads. A literal false is pruned before
 * any selector runs, and what else a condition answers is a processor's, so a
 * check whose defect a `use-when` can take away asks this instead (#1060).
 */
registerCustomXPathFunction(
  {namespaceURI: FUNCTIONS, localName: 'conditional'},
  ['node()'], 'xs:boolean',
  (context, node) => conditional(node),
)

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
 * A thrown compile failure that carries a W3C error code, as opposed to a
 * parse failure. The engine reports a syntax error as "<position>: <source>",
 * but a static or type error as a QName-shaped code such as XPTY0004 or
 * XPST0017. Only the former means the expression is genuinely malformed.
 * @type {RegExp}
 */
const CODED = /^[A-Z]{4}\d{4}/

/**
 * Whether the engine compiles the expression, counting a static-type complaint
 * as success: the engine is XPath 3.1, so it rejects the numeric coercion a
 * 1.0 stylesheet leans on, which is a dialect mismatch and not a syntax error.
 * No verdict of a run passes through here (#732) — it is the suite's second
 * opinion, and may stay strict (#738).
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
 * Whether the node satisfies the expression, its effective boolean value taken
 * with that node as the context item. It is how a predicate is asked of one
 * candidate the index handed over, where the selector it came from would have
 * asked the engine to find the candidate as well (#784).
 * @param {Node} node - The node to judge
 * @param {string} xpath - Xpath to take the truth of
 * @return {boolean} - Whether it holds there
 */
const satisfies = function(node, xpath) {
  return evaluateXPathToBoolean(
    xpath, node, null, {}, {namespaceResolver: resolvePrefix},
  )
}

module.exports = {
  PREFIXES,
  nodes,
  satisfies,
  compiles,
}
