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
 * The XSLT elements it reads them from and around: the instruction whose
 * `@select` is judged, the declaration a name may collide with, and the scope
 * that declaration reaches no further than.
 * @type {{[role: string]: string}}
 */
const ELEMENTS = {
  applies: 'apply-templates', declares: 'variable', scope: 'template',
}

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
 * The template whose variables the record's own element competes with, where
 * the record is one this check reads at all: the whole `@select` of an
 * `xsl:apply-templates` standing inside a template. A `@select` an attribute
 * value template encloses is none of it, and neither is one a literal result
 * element carries, which is output data (#788, one check over).
 * @param {{node: Node, start: number, pattern: boolean}} found - The record
 * @return {?Element} - The template it stands in, or nothing where it is not
 *  the attribute this check reads
 */
const applied = function(found) {
  let template = null
  const element = holding(found.node)
  if (whole(found, SELECT) && element.namespaceURI === XSLT &&
    element.localName === ELEMENTS.applies) {
    template = scoped(element)
  }
  return template
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
      const template = applied(found)
      if (template) {
        for (const {at, fix} of confused(
          found, declared(template, holding(found.node)),
        )) {
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
