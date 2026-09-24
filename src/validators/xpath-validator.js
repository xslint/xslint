/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parseOf, isValid} = require('../syntax')
const {expressionsOf} = require('../attributes')
const {defect, suppressed} = require('../checks')
const {KNOWN} = require('../xsl-version')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Name of the check reporting an expression no version of the language admits,
 * which is a mistake in the text and nowhere else.
 * @type {string}
 */
const MALFORMED = 'invalid-xpath-expression'

/**
 * Name of the check reporting one a later version admits than the version in
 * force where it stands, which is a promise the stylesheet breaks rather than
 * a mistake in the text: the same characters are a different language under a
 * different version, so the expression and the `version` disagree and either
 * one of them can be the thing that moves (#925).
 * @type {string}
 */
const RAISED = 'syntax-newer-than-xslt-version'

/**
 * Names of the checks this validator owns.
 * @type {Array.<string>}
 */
const names = [MALFORMED, RAISED]

/**
 * Defect metadata of the two checks, keyed by name.
 * @type {{[check: string]: {severity: string, message: string}}}
 */
const META = {
  [MALFORMED]: kinds.validation[MALFORMED],
  [RAISED]: kinds.validation[RAISED],
}

/**
 * A reference to an entity left unresolved in a parsed expression — an entity
 * declared in an external DTD the parser never read. Such an expression cannot
 * be validated (`&` is not an XPath operator), so it is neither reported nor
 * kept: reporting it would be a false positive over a resolution gap.
 * @type {RegExp}
 */
const UNRESOLVED = /&[A-Za-z_][\w.-]*;/

/**
 * Whether a later version of the language admits the expression than the one in
 * force where it stands, which makes the version and not the text the cause of
 * the refusal. Asked only of a version this tool knows: where none is declared
 * `parseOf` has already read the expression at the most permissive one, so
 * nothing later is left to ask and a refusal there is the text's own.
 * @param {{expression: string, pattern: boolean, version: string}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {boolean} - True when a later version admits it
 */
const raised = function(found) {
  const at = KNOWN.indexOf(found.version)
  let later = []
  if (at >= 0) {
    later = KNOWN.slice(at + 1)
  }
  return later.some((version) => isValid({...found, version: version}))
}

/**
 * Validate every Xpath expression in the corpus, splitting the valid ones out
 * for the expression linters to consume from the rest, which become defects.
 * Every expression means every one `expressionsOf` yields (#589), and what this
 * hands on is the whole of what those linters are staged over (#750). A refusal
 * the version in force is the whole cause of is reported apart (#631, #925).
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
  for (const source of corpus) {
    let skipped = 0
    for (const found of expressionsOf(source.xsl)) {
      const reading = parseOf(found)
      if (reading.fault === '') {
        expressions.push({source: source, found: found})
      } else if (UNRESOLVED.test(found.node.nodeValue)) {
        skipped++
      } else {
        let check = MALFORMED
        if (raised(found)) {
          check = RAISED
        }
        if (!suppressed(check, suppressions)) {
          defects.push(defect(check, META[check], source, found, reading.at))
        }
      }
    }
    if (skipped > 0) {
      logger.info(
        `Skipped ${skipped} expression(s) in ${source.file} holding an ` +
          `entity no declaration this run read resolves`,
      )
    }
  }
  logger.debug(`Found ${defects.length} expressions the version in force refuses`)
  return {expressions: expressions, defects: defects}
}

module.exports = {
  validate,
  names,
}
