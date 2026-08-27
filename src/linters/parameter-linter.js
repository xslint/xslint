/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf, ON} = require('../attributes')
const {gathered, isValid, variableOf} = require('../syntax')
const {holding, walked} = require('../tree')
const {metaOf, suppressed} = require('../checks')
const {XSLT} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'unused-function-template-parameter'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = metaOf(CHECK)

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * The node kind a reference to a parameter arrives as.
 * @type {Array.<string>}
 */
const REFERENCES = ['variable']

/**
 * The two XSLT elements that take parameters, by local name. An
 * `xsl:with-param` supplies one and an `xsl:variable` is not one at all, so
 * neither declares the scope a reference has to fall in.
 * @type {Array.<string>}
 */
const TAKERS = ['function', 'template']

/**
 * The `nodeType` of an attribute, which is what the document-order walk hands
 * over beside its text nodes.
 * @type {number}
 */
const ATTRIBUTE = 2

/**
 * The attribute that makes a parameter one a caller must supply, whose
 * declaration therefore does something no reference in the body shows (#781).
 * @type {string}
 */
const REQUIRED = 'required'

/**
 * What a scope holds when it holds no expression at all, so a lookup that
 * misses answers the same shape as one that hits.
 * @type {{names: Set.<string>, refused: Array.<string>}}
 */
const NOTHING = Object.freeze({names: new Set(), refused: []})

/**
 * Whether a node is one of the two XSLT elements that take parameters.
 * @param {?Node} node - Node to weigh
 * @return {boolean} - True when it is an `xsl:function` or an `xsl:template`
 */
const takes = function(node) {
  return node?.namespaceURI === XSLT && TAKERS.includes(node.localName)
}

/**
 * The `xsl:function` or `xsl:template` a node stands inside, or null where it
 * stands inside neither. A parameter is local to the element declaring it, so
 * this is the scope a reference has to fall in to count as one.
 * @param {?Node} node - Node to climb from
 * @return {?Element} - The element whose parameters are in scope, or null
 */
const scopeOf = function(node) {
  let climbed = node
  while (climbed !== null && climbed !== undefined && !takes(climbed)) {
    climbed = climbed.parentNode
  }
  return climbed ?? null
}

/**
 * What each scope of a stylesheet references, keyed by the element declaring
 * it: the names its expressions really hold, and the text of every expression
 * there the grammar refuses. A reference is a `variable` node of the parse and
 * not the characters `$name` standing anywhere in the subtree, which read `$n`
 * in `$name`, a `'$quoted'` literal and a `<para>$shown</para>` alike (#776).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Map.<Element, {names: Set.<string>, refused: Array.<string>}>} -
 *  What each scope references
 */
const referenced = function(xsl) {
  const scopes = new Map()
  for (const found of expressionsOf(xsl)) {
    const scope = scopeOf(holding(found.node))
    if (scope !== null) {
      if (!scopes.has(scope)) {
        scopes.set(scope, {names: new Set(), refused: []})
      }
      const held = scopes.get(scope)
      if (isValid(found)) {
        for (const node of gathered(found, REFERENCES)) {
          held.names.add(variableOf(found, node))
        }
      } else {
        held.refused.push(found.expression)
      }
    }
  }
  return scopes
}

/**
 * The `@name` of every parameter a stylesheet declares directly inside an
 * `xsl:function` or an `xsl:template`, in document order. Read off the one
 * document-order walk `src/tree.js` remembers against the document rather than
 * by a descendant step per parameter, which fontoxpath answers quadratically
 * over an xmldom tree and was the whole of what this check cost (#635, #776).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Node>} - The name attribute of each parameter
 */
const declared = function(xsl) {
  return walked(xsl).filter(
    (node) => node.nodeType === ATTRIBUTE && node.nodeName === 'name' &&
      node.ownerElement.namespaceURI === XSLT &&
      node.ownerElement.localName === 'param' &&
      !ON.includes((node.ownerElement.getAttribute(REQUIRED) ?? '').trim()) &&
      takes(node.ownerElement.parentNode),
  )
}

/**
 * Whether a parameter of that name is referenced inside its scope. An
 * expression the grammar refuses is read as text here and nowhere else in this
 * check: what it references cannot be read at all, so one of the two answers
 * has to be guessed, and staying quiet is the cheap direction — the other
 * invents an unused parameter on a file the run already reports for its syntax.
 * @param {{names: Set.<string>, refused: Array.<string>}} held - What the
 *  scope references
 * @param {string} name - The parameter's name
 * @return {boolean} - True when the scope references it
 */
const used = function(held, name) {
  return held.names.has(name) ||
    held.refused.some((expression) => expression.includes(`$${name}`))
}

/**
 * Lint the corpus for parameters a function or template declares and never
 * references, walking each stylesheet once rather than once per parameter.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByParameter = function(corpus, suppressions = []) {
  logger.debug(`Parameter linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      const scopes = referenced(xsl)
      for (const attribute of declared(xsl)) {
        const element = attribute.ownerElement
        if (!used(scopes.get(element.parentNode) ?? NOTHING, attribute.value)) {
          defects.push({
            name: CHECK,
            severity: META.severity,
            message: META.message,
            file: file,
            line: element.lineNumber,
            pos: element.columnNumber,
          })
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} unused parameter defects`)
  return defects
}

module.exports = {
  lintByParameter,
  names,
}
