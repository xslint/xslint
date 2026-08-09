/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {xml} = require('../helpers')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Name of the check this validator owns.
 * @type {string}
 */
const CHECK = 'malformed-stylesheet'

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
 * Build the corpus from raw stylesheet sources, validating that each one is
 * well-formed XML. A source that does not parse is reported as a defect and
 * left out of the corpus, so the validators and linters that follow run only
 * over the stylesheets that parse.
 * @param {Array.<{file: string, content: string}>} sources - Raw stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{corpus: Array.<{file: string, content: string, xsl: Document}>,
 *  defects:
 *  Array.<object>}} - Parsed corpus and defects for the unparsable sources
 */
const validate = function(sources, suppressions = []) {
  logger.debug(`Xml validation started`)
  const corpus = []
  const defects = []
  const suppressed = suppressions.some((sup) => CHECK.includes(sup))
  for (const {file, content} of sources) {
    try {
      corpus.push({
        file: file, content: content, xsl: xml.parsedFromString(content),
      })
    } catch {
      if (!suppressed) {
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: file,
          line: 1,
          pos: 1,
        })
      }
    }
  }
  logger.debug(`Found ${defects.length} malformed stylesheets`)
  return {corpus: corpus, defects: defects}
}

module.exports = {
  validate,
  names,
}
