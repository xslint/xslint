/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {calls, gathered, isValid, parseOf, tokensOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {expressionsOf, whole} = require('../attributes')
const {TOKENS} = require('../tokens')
const {holding} = require('../tree')
const {XSLT} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'confusing-variable-and-node'

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = metaOf(CHECK)

/**
 * The attribute this check reads.
 * @type {string}
 */
const SELECT = 'select'

/**
 * The XSLT element a name may collide with.
 * @type {string}
 */
const DECLARES = 'variable'

/**
 * The XSLT instructions whose `@select` chooses nodes, every one of which a
 * bare name can be confused in. `xsl:apply-templates` was the whole list until
 * #560, and a `select="items"` reads the child element in all four alike.
 * @type {Array.<string>}
 */
const SELECTING = ['apply-templates', 'copy-of', 'for-each', 'value-of']

/**
 * The attribute a variable declares its name in.
 * @type {string}
 */
const NAME = 'name'

/**
 * The attributes a variable binds a value in, the second being the shadow
 * spelling XSLT 3.0 gives any attribute of an XSLT element. A variable bound
 * by content instead holds a tree of its own, which is why the two are asked
 * for (#922).
 * @type {Array.<string>}
 */
const BINDS = [SELECT, `_${SELECT}`]

/**
 * Whether the node is an `xsl:variable` binding a name to an expression, which
 * is the only declaration a bare name can be confused with. A variable bound
 * by content holds a parentless tree instead, whose nodes belong to no
 * document, so `node() except $errors` subtracts nothing and the bare name
 * beside it is the element the template meant to replace (#922).
 * @param {Node} node - A node of the stylesheet
 * @return {boolean} - True when it takes a name a bare one collides with
 */
const binding = function(node) {
  return node.nodeType === 1 && node.namespaceURI === XSLT &&
    node.localName === DECLARES && node.hasAttribute(NAME) &&
    BINDS.some((one) => node.hasAttribute(one))
}

/**
 * The standard functions answering an atomic value, whichever nodes they are
 * handed: a variable bound to one of them holds no node to select (#1001).
 * @type {Array.<string>}
 */
const ATOMIC = ['string', 'number', 'boolean', 'concat', 'normalize-space',
  'string-length', 'count', 'sum', 'data', 'string-join', 'name',
  'local-name']

/**
 * The namespace of XML Schema, whose types an `as` names an atomic value by.
 * @type {string}
 */
const SCHEMA = 'http://www.w3.org/2001/XMLSchema'

/**
 * Every expression of a document, keyed by the element holding it, indexed
 * once per document rather than searched once per variable.
 * @type {WeakMap.<Document, Map.<Element, Array.<object>>>}
 */
const INDEXED = new WeakMap()

/**
 * Whether a variable holds an atomic value rather than nodes: an `as` naming
 * a type of XML Schema's, or a `select` that is a literal or a call answering
 * an atomic value whatever it is handed. Spelling such a variable where a
 * node is selected is a type error, so no fix offers it (#1001).
 * @param {Element} variable - The `xsl:variable` a bare name collides with
 * @return {boolean} - Whether it is bound to an atomic value
 */
const atomised = function(variable) {
  const document = variable.ownerDocument
  if (!INDEXED.has(document)) {
    const index = new Map()
    for (const record of expressionsOf(document)) {
      const held = holding(record.node)
      if (!index.has(held)) {
        index.set(held, [])
      }
      index.get(held).push(record)
    }
    INDEXED.set(document, index)
  }
  const record = INDEXED.get(document).get(variable).find(
    (one) => BINDS.some((name) => whole(one, name)),
  )
  const type = (variable.getAttribute('as') || variable.getAttribute('_as') ||
    '').trim().split(':')
  const typed = type.length > 1 &&
    variable.lookupNamespaceURI(type[0]) === SCHEMA
  let valued = false
  if (record !== undefined && isValid(record)) {
    const tree = parseOf(record).tree
    valued = tree.kind === 'literal' ||
      ATOMIC.some((name) => calls(record, tree, name))
  }
  return typed || valued
}

/**
 * The variables in scope at the element, each under the name it takes, the
 * nearest one taking it: a local variable reaches the siblings behind it and
 * what they hold, so the walk climbs from the element and reads the siblings
 * in front of it and of each ancestor below the stylesheet's own children,
 * where a variable declared inside an earlier sibling reaches nothing (#1001).
 * @param {Element} element - The element the bare name stands in
 * @return {Map.<string, Element>} - The variables in scope there
 */
const declared = function(element) {
  const taken = new Map()
  let node = element
  while (node.parentNode.nodeType === 1 &&
    node.parentNode !== element.ownerDocument.documentElement) {
    let sibling = node.previousSibling
    while (sibling !== null) {
      if (binding(sibling) && !taken.has(sibling.getAttribute(NAME))) {
        taken.set(sibling.getAttribute(NAME), sibling)
      }
      sibling = sibling.previousSibling
    }
    node = node.parentNode
  }
  return taken
}

/**
 * The global names of each stylesheet, remembered against it: they depend on
 * the document alone, where the scan asking for them runs once per expression.
 * @type {WeakMap}
 */
const GLOBALS = new WeakMap()

/**
 * The stylesheet's own top-level `xsl:variable` declarations under the names
 * they take, in scope in every template it holds however the two are ordered
 * (#560).
 * @param {Document} xsl - The stylesheet the element stands in
 * @return {Map.<string, Element>} - Its globals by name
 */
const globals = function(xsl) {
  if (!GLOBALS.has(xsl)) {
    GLOBALS.set(xsl, new Map(
      Array.from(xsl.documentElement.childNodes)
        .filter(binding)
        .map((node) => [node.getAttribute(NAME), node]),
    ))
  }
  return GLOBALS.get(xsl)
}

/**
 * The steps that open a path, which are the only ones a variable name can be
 * confused at: a name deeper in a path is a child of whatever stands in front
 * of it. A union has as many heads as it has branches, so `x | title/y` holds
 * one where the text this replaces read the front of the value and saw none.
 * A predicate is asked of another context node, so nothing in one is (#1001).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<object>} - The head steps found
 */
const heads = function(found) {
  const below = (node) => node.children.flatMap(
    (kid) => [kid].concat(below(kid)),
  )
  const inner = new Set(
    gathered(found, ['path']).flatMap((path) => path.children.slice(1))
      .concat(gathered(found, ['predicate']).flatMap(below)),
  )
  return gathered(found, ['step']).filter((step) => !inner.has(step))
}

/**
 * The bare names the expression opens a path with that a variable in scope has
 * taken, each with the fix spelling the variable unless it is atomic. A step is
 * read for the name it *tests* rather than for the text it begins with, so
 * `@title`, `child::title` and `*` are none of them this construct, where a
 * `title[1]`, a gapped ` title/x` and every union branch but the first are.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {Map.<string, Element>} taken - The variables in scope, by name
 * @return {Array.<{at: number, fix: ?object}>} - The names found
 */
const confused = function(found, taken) {
  const results = []
  for (const step of heads(found)) {
    const first = tokensOf(found, step)[0]
    if (first.type === TOKENS.NAME && taken.has(first.value)) {
      let fix = {value: first.value, replacement: `$${first.value}`}
      if (atomised(taken.get(first.value))) {
        fix = undefined
      }
      results.push({at: first.start, fix})
    }
  }
  return results
}

/**
 * The variables in scope where the record stands, or nothing where it is not
 * one this check reads: it wants the whole `@select` of a selecting
 * instruction. Those are the declarations in scope there, and behind them the
 * stylesheet's globals (#560, #788, #1001).
 * @param {{node: Node, start: number, pattern: boolean}} found - The record
 * @return {?Map.<string, Element>} - The variables in scope there, or nothing
 *  where it is not the attribute this check reads
 */
const selecting = function(found) {
  let taken = null
  const element = holding(found.node)
  if (whole(found, SELECT) && element.namespaceURI === XSLT &&
    SELECTING.includes(element.localName)) {
    taken = new Map([...globals(element.ownerDocument),
      ...declared(element)])
  }
  return taken
}

/**
 * Lint the valid expressions a stylesheet carries for an `xsl:apply-templates`
 * selecting a node by a name a variable in scope has already taken, where the
 * bare name picks the child element and the author usually meant the variable.
 * The name is the tree's answer rather than the front of the attribute's text,
 * a step saying what it tests where a `starts-with` read characters.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByBareName = function(expressions, suppressions = []) {
  logger.debug(`Bare name linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      const taken = selecting(found)
      if (taken) {
        for (const {at, fix} of confused(found, taken)) {
          defects.push(defect(CHECK, META, source, found, at, fix))
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} bare name defects`)
  return defects
}

module.exports = {
  lintByBareName,
  names,
}
