/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Where a transformation starts: the templates matching the root of the
 * document, and whether a module holds a place a processor enters it at. It
 * was `root-template-linter`'s own question until #1004 asked it of the import
 * tree too, and a linter requires no other, so it stands in the core both of
 * them consume.
 */

const {expressionsOf, whole} = require('./attributes')
const {attributeOf} = require('./expressions')
const {gathered, isValid} = require('./syntax')
const {holding, named} = require('./tree')
const {XSLT} = require('./xsl-version')

/**
 * The local name of the template XSLT 3.0 enters a stylesheet at when none is
 * asked for, in the XSLT namespace.
 * @type {string}
 */
const INITIAL = 'initial-template'

/**
 * Whether the pattern matches the root of the document. A pattern is a union
 * of branches and the root is the branch holding no step at all — the whole of
 * `match="/"`, and one arm of `match="/ | alpha"`. A `starts-with(@match,
 * '/')` was the question before, and every absolute pattern begins that way,
 * so `match="/alpha"` was read as the root template.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  pattern, whole, as `expressionsOf` yields it
 * @return {boolean} - True when the root is one of the nodes it matches
 */
const rooted = function(found) {
  return gathered(found, ['branch']).some(
    (branch) => branch.children.length === 0,
  )
}

/**
 * Every template of the stylesheet whose pattern matches the root. A pattern
 * the grammar refuses is passed over: what it would match cannot be read, and
 * the same run already reports it as invalid.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Element>} - The root templates found
 */
const roots = function(xsl) {
  return expressionsOf(xsl)
    .filter(
      (found) => whole(found, 'match') &&
        holding(found.node).localName === 'template' &&
        holding(found.node).namespaceURI === XSLT &&
        isValid(found) && rooted(found),
    )
    .map((found) => holding(found.node))
}

/**
 * Whether the template is named `xsl:initial-template`, under whatever prefix
 * the document binds to XSLT and in either spelling of the attribute.
 * @param {Element} template - An `xsl:template`
 * @return {boolean} - True when a processor enters the stylesheet there
 */
const initial = function(template) {
  const [prefix, local] = attributeOf(template, 'name').split(':')
  return local === INITIAL && template.lookupNamespaceURI(prefix) === XSLT
}

/**
 * Whether a transformation can start at the module: a template of it matches
 * the root of the document, or is the initial one (#1004).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {boolean} - True when the module is an entry point
 */
const entered = function(xsl) {
  return roots(xsl).length > 0 ||
    (named(xsl).buckets.get(`${XSLT} template`) ?? []).some(initial)
}

module.exports = {
  entered,
  roots,
}
