/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parseOf} = require('../syntax')
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
 * defects. Every expression means every one `expressionsOf` yields (#589), and
 * what this hands on is the whole of what those linters are staged over
 * (#750). A pattern illegal before XSLT 3.0 is reported with them (#631).
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
      const reading = parseOf(found)
      if (reading.fault === '') {
        expressions.push({source: source, found: found})
      } else if (UNRESOLVED.test(found.node.nodeValue)) {
        logger.debug(`Skipping expression with an unresolved entity`)
      } else if (!suppressed) {
        defects.push(defect(CHECK, META, source, found, reading.at))
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
