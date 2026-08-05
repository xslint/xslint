/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {nodes, isValid} = require('./xpath')
const {FIXERS} = require('./fixers')
const {expressionsOf} = require('./attributes')
const {allFilesFrom, yaml} = require('./helpers')
const path = require('path')
const {logger} = require('./logger')

/**
 * Xpath packs, each parsed once at load: the name suppressions match against
 * and the rule the linter applies.
 * @type {Array.<{name: string, xpath: string, severity: string,
 *  message: string}>}
 */
const PACKS = allFilesFrom(
  path.join(__dirname, 'resources', 'checks', 'xpath'),
).map((pack) => ({
  name: pack.substring(
    pack.lastIndexOf(path.sep) + 1, pack.lastIndexOf('.yaml'),
  ),
  ...yaml.parsedFromFile(pack),
}))

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = PACKS.map((pack) => pack.name)

/**
 * Evaluate Xpath on given XSL and return found nodes.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @param {string} xpath - Xpath
 * @return {{name: string, line: number, pos: number}[]} - Matching
 *  nodes in the order defined by the XPath
 */
const evaluateXpath = function(xsl, xpath) {
  return nodes(xsl, xpath).map((node) => ({
    name: node.nodeName,
    line: node.lineNumber,
    pos: node.columnNumber,
  }))
}

/**
 * The refusal already worked out for a document. A declarative fix is offered
 * per defect, and the answer is a property of the stylesheet, so it is derived
 * once and remembered against the document itself the way `expressionsOf` is —
 * a `WeakMap` releases it when the corpus does.
 * @type {WeakMap}
 */
const REFUSED = new WeakMap()

/**
 * The nodes no fix may be attached to: every node holding an expression the
 * engine cannot parse — an attribute, or a text node whose braces carry a
 * template — and the element around it. The element is there because a
 * declarative rule selects it while the fix lands somewhere inside, and a fixer
 * names that target within itself, where no gate can read it. It reaches in
 * both directions: `starts-with-double-slash` matches the `xsl:template` and
 * reaches sideways for its `@match`, while `text-outside-xsl-text` matches the
 * instruction and reaches down into the loose text, which it rewrites whole —
 * so on `delta {1 +} epsilon` it would wrap the unparsable brace in an
 * `xsl:text` were the parent not listed here.
 *
 * Listing the element withholds every fix on it, including one aimed at a
 * sound attribute beside the broken one. That is deliberate: an element whose
 * expression no processor parses is not worth tidying, and the cost of being
 * wrong here is a correction that waits for the syntax to be fixed, against a
 * rewrite of text the same run reported malformed (#651).
 *
 * Its own attributes are listed with it, because a rule may select the
 * attribute rather than the element carrying it — `starts-with-double-slash`
 * does, so that one selector covers every attribute holding a pattern (#583) —
 * and an attribute is not reachable from the element through this set.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Set.<Node>} - The nodes a fix must not be offered on
 */
const refused = function(xsl) {
  if (!REFUSED.has(xsl)) {
    const found = new Set()
    for (const held of expressionsOf(xsl)) {
      if (!isValid(held.expression)) {
        const owner = held.node.ownerElement || held.node.parentNode
        found.add(held.node)
        found.add(owner)
        for (const beside of owner.attributes) {
          found.add(beside)
        }
      }
    }
    REFUSED.set(xsl, found)
  }
  return REFUSED.get(xsl)
}

/**
 * Lint the corpus of stylesheets by per-file Xpath packs.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByXpath = function(corpus, suppressions = []) {
  logger.debug(`Xpath linting started`)
  const defects = []
  const active = PACKS.filter(
    (pack) => !suppressions.some((sup) => pack.name.includes(sup)),
  )
  for (const {file, xsl} of corpus) {
    for (const pack of active) {
      for (const node of nodes(xsl, pack.xpath)) {
        const defect = {
          name: pack.name,
          severity: pack.severity,
          message: pack.message,
          file: file,
          line: node.lineNumber,
          pos: node.columnNumber,
        }
        const fix = FIXERS[pack.name] && !refused(xsl).has(node) &&
          FIXERS[pack.name](node)
        if (fix) {
          defect.fix = fix
        }
        defects.push(defect)
      }
    }
  }
  logger.debug(`Found ${defects.length} defects`)
  return defects
}

module.exports = {
  lintByXpath,
  evaluateXpath,
  names,
}
