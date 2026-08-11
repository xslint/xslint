/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {refusalOf} = require('../xpath')
const {expressionsOf} = require('../attributes')
const {defect} = require('../checks')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Name of the check this validator owns.
 * @type {string}
 */
const CHECK = 'invalid-xpath-expression'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = kinds.validation[CHECK]

/**
 * Names of the checks this validator owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * A reference to an entity left unresolved in a parsed expression — an entity
 * declared in an external DTD the parser never read. Such an expression cannot
 * be validated (`&` is not an XPath operator), so it is neither reported nor
 * kept: reporting it would be a false positive over a resolution gap.
 * @type {RegExp}
 */
const UNRESOLVED = /&[A-Za-z_][\w.-]*;/

/**
 * Validate every Xpath expression in the corpus, splitting the valid ones out
 * for the expression linters to consume from the malformed ones, which become
 * defects. An expression our own grammar cannot parse at the version in force
 * where it stands is reported here and never handed on.
 *
 * Every expression means every one `expressionsOf` yields — the one derivation
 * the code-based linters have always read, rather than a walk of this
 * validator's own over a list of attribute *names* it derived by subtracting
 * the pattern-holding ones. That subtraction was the whole gap #589 is about:
 * over this repository's own fixtures the derivation yields 451 expressions and
 * the walk reached 286, so a `match` no grammar accepts, an attribute value
 * template holding `{1 +}`, and a 3.0 text value template were each validated
 * by nothing at all — while a code-based linter, staged over the whole corpus,
 * read those same expressions and reported what it found in them. Only
 * `defect`'s parse gate kept a fix off that (#636). A pattern illegal before
 * XSLT 3.0 is reported with them, which is #631: `matched` has refused one
 * since #723 and had nobody to say so.
 *
 * The defect stands where the fault does, not where the attribute opens, which
 * is what the offset on the refusal is for — and what the widening makes
 * necessary rather than merely nicer, two braces of one attribute value being
 * two expressions that would otherwise report the same column.
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{expressions: Array.<{source: object, found: object}>, defects:
 *  {name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]}} - Valid expressions and defects found
 */
const validate = function(corpus, suppressions = []) {
  logger.debug(`Xpath validation started`)
  const expressions = []
  const defects = []
  const suppressed = suppressions.some((sup) => CHECK.includes(sup))
  for (const source of corpus) {
    for (const found of expressionsOf(source.xsl)) {
      const refusal = refusalOf(found)
      if (refusal.fault === '') {
        expressions.push({source: source, found: found})
      } else if (UNRESOLVED.test(found.node.nodeValue)) {
        logger.debug(`Skipping expression with an unresolved entity`)
      } else if (!suppressed) {
        defects.push(defect(CHECK, META, source, found, refusal.at))
      }
    }
  }
  logger.debug(`Found ${defects.length} invalid expressions`)
  return {expressions: expressions, defects: defects}
}

module.exports = {
  validate,
  names,
}
