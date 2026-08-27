/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {gathered, tokensOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {whole} = require('../attributes')
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
 * The XSLT elements it reads around: the declaration a name may collide with,
 * and the scope a declaration inside one reaches no further than.
 * @type {{[role: string]: string}}
 */
const ELEMENTS = {declares: 'variable', scope: 'template'}

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
 * The nearest ancestor template of the element, which is as far as a variable
 * declared inside one reaches.
 * @param {Element} element - The element to climb from
 * @return {?Element} - The template holding it, or nothing where none does
 */
const scoped = function(element) {
  let node = element.parentNode
  while (node && node.nodeType === 1 &&
    !(node.namespaceURI === XSLT && node.localName === ELEMENTS.scope)) {
    node = node.parentNode
  }
  let template = null
  if (node && node.nodeType === 1) {
    template = node
  }
  return template
}

/**
 * The names of the variables the template declares in front of the element,
 * which are the ones a bare name standing there can be confused with. A
 * variable declared behind it is out of scope for it, so the walk stops where
 * the element does rather than reading the whole template.
 * @param {Element} template - The template holding the element
 * @param {Element} element - The element the walk stops at
 * @return {Set.<string>} - The names declared in front of it
 */
const declared = function(template, element) {
  const taken = new Set()
  let reached = false
  /**
   * Take the name this node declares, then walk the nodes below it, until the
   * element the scan stops at is met.
   * @param {Node} node - A node of the template
   */
  const visit = function(node) {
    if (node === element) {
      reached = true
    }
    if (!reached) {
      if (node.nodeType === 1 && node.namespaceURI === XSLT &&
        node.localName === ELEMENTS.declares && node.hasAttribute(NAME)) {
        taken.add(node.getAttribute(NAME))
      }
      Array.from(node.childNodes).forEach(visit)
    }
  }
  visit(template)
  return taken
}

/**
 * The global names of each stylesheet, remembered against it: they depend on
 * the document alone, where the scan asking for them runs once per expression.
 * @type {WeakMap}
 */
const GLOBALS = new WeakMap()

/**
 * The names the stylesheet's own top-level `xsl:variable` declarations take,
 * in scope in every template it holds however the two are ordered (#560).
 * @param {Document} xsl - The stylesheet the element stands in
 * @return {Set.<string>} - The names its globals have taken
 */
const globals = function(xsl) {
  if (!GLOBALS.has(xsl)) {
    GLOBALS.set(xsl, new Set(
      Array.from(xsl.documentElement.childNodes)
        .filter(
          (node) => node.nodeType === 1 && node.namespaceURI === XSLT &&
            node.localName === ELEMENTS.declares && node.hasAttribute(NAME),
        )
        .map((node) => node.getAttribute(NAME)),
    ))
  }
  return GLOBALS.get(xsl)
}

/**
 * The steps that open a path, which are the only ones a variable name can be
 * confused at: a name deeper in a path is a child of whatever stands in front
 * of it. A union has as many heads as it has branches, so `x | title/y` holds
 * one where the text this replaces read the front of the value and saw none.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<object>} - The head steps found
 */
const heads = function(found) {
  const inner = new Set(
    gathered(found, ['path']).flatMap((path) => path.children.slice(1)),
  )
  return gathered(found, ['step']).filter((step) => !inner.has(step))
}

/**
 * The bare names the expression opens a path with that a variable in scope has
 * already taken, each paired with the fix that spells the variable. A step is
 * read for the name it *tests* rather than for the text it begins with, so
 * `@title`, `child::title` and `*` are none of them this construct, where a
 * `title[1]`, a gapped ` title/x` and every union branch but the first are.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {Set.<string>} taken - The names variables in scope have taken
 * @return {Array.<{at: number, fix: object}>} - The names found
 */
const confused = function(found, taken) {
  const results = []
  for (const step of heads(found)) {
    const first = tokensOf(found, step)[0]
    if (first.type === TOKENS.NAME && taken.has(first.value)) {
      results.push({
        at: first.start,
        fix: {
          value: first.value,
          replacement: `$${first.value}`,
          suggestion: true,
        },
      })
    }
  }
  return results
}

/**
 * The names in scope where the record stands, or nothing where it is not one
 * this check reads: it wants the whole `@select` of a selecting instruction.
 * Those names are the stylesheet's globals, and the declarations standing in
 * front of it in the template holding it (#560, #788).
 * @param {{node: Node, start: number, pattern: boolean}} found - The record
 * @return {?Set.<string>} - The names taken there, or nothing where it is not
 *  the attribute this check reads
 */
const selecting = function(found) {
  let taken = null
  const element = holding(found.node)
  if (whole(found, SELECT) && element.namespaceURI === XSLT &&
    SELECTING.includes(element.localName)) {
    const template = scoped(element)
    taken = new Set(globals(element.ownerDocument))
    if (template) {
      declared(template, element).forEach((one) => taken.add(one))
    }
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
