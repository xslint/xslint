/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf} = require('../attributes')
const {metaOf, suppressed} = require('../checks')
const {walked} = require('../tree')
const {XSLT} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'not-creating-element-correctly'

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
 * The XSLT instruction this check is about.
 * @type {string}
 */
const INSTRUCTION = 'element'

/**
 * The attribute holding the name of the element it builds.
 * @type {string}
 */
const NAME = 'name'

/**
 * The attribute pinning the namespace that name belongs to. An
 * `xsl:element` carrying one is not the instruction a literal result element
 * replaces: the literal form takes its namespace from the prefixes in scope,
 * where this one names it outright and may name one nothing in the stylesheet
 * binds.
 * @type {string}
 */
const NAMESPACE = 'namespace'

/**
 * The `@name` of every `xsl:element` a stylesheet holds, off the one walk
 * `src/tree.js` remembers rather than a descendant scan of this linter's own,
 * which fontoxpath evaluates over an xmldom tree quadratically (#635).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Node>} - The name attributes found
 */
const instructed = function(xsl) {
  return walked(xsl).filter(
    (node) => node.nodeType === 2 && node.nodeName === NAME &&
      node.ownerElement.namespaceURI === XSLT &&
      node.ownerElement.localName === INSTRUCTION,
  )
}

/**
 * The namespace the name's own prefix resolves to where it carries one, read
 * from the element that spells it rather than from the prefix's spelling: a
 * document binds `xsl:` where it pleases, and a name is the URI it resolves to.
 * @param {Node} attribute - The `@name` attribute
 * @return {?string} - The namespace of its prefix, or nothing where it has none
 */
const bound = function(attribute) {
  let namespace = null
  const colon = attribute.value.indexOf(':')
  if (colon > 0) {
    namespace = attribute.ownerElement.lookupNamespaceURI(
      attribute.value.slice(0, colon),
    )
  }
  return namespace
}

/**
 * Lint the corpus for an `xsl:element` whose name is static, which a literal
 * result element says in one line and without the instruction around it. What
 * makes a name dynamic is an attribute value template and nothing else, which
 * is `expressionsOf`'s answer rather than a substring's (#558); a name bound to
 * the XSLT namespace is left alone, its literal form being an instruction.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByElement = function(corpus, suppressions = []) {
  logger.debug(`Element linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      const templated = new Set(expressionsOf(xsl).map((one) => one.node))
      for (const attribute of instructed(xsl)) {
        const element = attribute.ownerElement
        if (!templated.has(attribute) && !element.hasAttribute(NAMESPACE) &&
          bound(attribute) !== XSLT) {
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
  logger.debug(`Found ${defects.length} static element defects`)
  return defects
}

module.exports = {
  lintByElement,
  names,
}
