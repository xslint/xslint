/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Where a transformation starts: the templates matching the root of the
 * document, and whether a module holds a place a processor enters it at. It
 * was `root-template-linter`'s own question until #1004 asked it of the import
 * tree too, and a linter requires no other, so it stands in the core both of
 * them consume. A module is entered where the document node reaches it, and
 * the built-in rule hands that node's children on, so a default-mode template
 * taking whatever element stands at the top is a place too (#1046); one
 * naming elements is not, nor is a named one.
 */

const {expressionsOf, whole} = require('./attributes')
const {attributeOf} = require('./expressions')
const {gathered, isValid, parseOf, tokensOf} = require('./syntax')
const {GAP, TOKENS, TRIVIA} = require('./tokens')
const {holding, named} = require('./tree')
const {XSLT} = require('./xsl-version')

/**
 * The local name of the template XSLT 3.0 enters a stylesheet at when none is
 * asked for, in the XSLT namespace.
 * @type {string}
 */
const INITIAL = 'initial-template'

/**
 * The modes a template is in when the initial mode is the default one: none
 * named at all, or one of these among the modes it names, `#unnamed` being
 * the mode XSLT 3.0 starts in where no `default-mode` says otherwise.
 * @type {Array.<string>}
 */
const DEFAULTS = ['#default', '#unnamed', '#all']

/**
 * The node tests, spelled as their solid tokens, that every element answers.
 * @type {Array.<string>}
 */
const EVERY = ['*', 'node()', 'element()', 'element(*)']

/**
 * The token types a name test is spelled with, a wildcard standing for either
 * half of the name and a URI for its prefix.
 * @type {Array.<string>}
 */
const NAMING = [TOKENS.NAME, TOKENS.MULTI, TOKENS.COLON, TOKENS.URI]

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
 * Whether the template is in the mode a transformation starts in, in either
 * spelling of its `mode`.
 * @param {Element} template - An `xsl:template`
 * @return {boolean} - True when the default mode is one of its modes
 */
const unmoded = function(template) {
  const modes = attributeOf(template, 'mode').split(new RegExp(`${GAP}+`))
  return modes.every((mode) => mode === '') ||
    modes.some((mode) => DEFAULTS.includes(mode))
}

/**
 * The node test of a step, as its solid tokens: the axis left out, which a
 * pattern allows only where it adds nothing here, and the predicates too.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} step - A `step` of its tree
 * @return {Array.<{type: string, value: string}>} - The tokens of the test
 */
const testOf = function(found, step) {
  const solid = tokensOf(found, step)
    .filter((token) => !TRIVIA.includes(token.type) &&
      token.type !== TOKENS.CHILD)
  let cut = solid.findIndex((token) => token.type === TOKENS.LBRACKET)
  if (cut < 0) {
    cut = solid.length
  }
  return solid.slice(0, cut)
}

/**
 * Whether every element answers the node test of a step.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} step - A `step` of its tree
 * @return {boolean} - True when the test admits any element
 */
const universal = function(found, step) {
  return EVERY.includes(testOf(found, step).map((one) => one.value).join(''))
}

/**
 * Whether the pattern takes the element at the top of the document: a branch
 * of it, and not one in brackets, holding one step and no predicate that every
 * element answers, or one name test opening at the root (#1046).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  pattern, whole, as `expressionsOf` yields it
 * @return {boolean} - True when a branch of it takes that element
 */
const topmost = function(found) {
  let branches = [parseOf(found).tree]
  if (branches[0].kind === 'pattern') {
    branches = branches[0].children
  }
  return branches.some((branch) => {
    const step = branch.children[0]
    return branch.children.length === 1 && (
      (step.children.length === 0 && universal(found, step)) ||
      (tokensOf(found, branch).find(
        (token) => !TRIVIA.includes(token.type),
      ).type === TOKENS.SLASH &&
        testOf(found, step).every((one) => NAMING.includes(one.type)))
    )
  })
}

/**
 * Every template of the stylesheet whose pattern passes the test. A pattern
 * the grammar refuses is passed over: what it would match cannot be read, and
 * the same run already reports it as invalid.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @param {function(object): boolean} test - What the pattern is asked
 * @return {Array.<Element>} - The templates found
 */
const matching = function(xsl, test) {
  return expressionsOf(xsl)
    .filter(
      (found) => whole(found, 'match') &&
        holding(found.node).localName === 'template' &&
        holding(found.node).namespaceURI === XSLT &&
        isValid(found) && test(found),
    )
    .map((found) => holding(found.node))
}

/**
 * Every template of the stylesheet whose pattern matches the root.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Element>} - The root templates found
 */
const roots = function(xsl) {
  return matching(xsl, rooted)
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
 * the root of the document, or is the initial one (#1004), or takes the
 * element at the top of it in the default mode (#1046).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {boolean} - True when the module is an entry point
 */
const entered = function(xsl) {
  return roots(xsl).length > 0 ||
    (named(xsl).buckets.get(`${XSLT} template`) ?? []).some(initial) ||
    matching(xsl, topmost).some(unmoded)
}

module.exports = {
  entered,
  roots,
}
