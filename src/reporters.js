/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require('path')
const {out} = require('./output')
const version = require('./version')

/**
 * Defect severity mapped to a SARIF level.
 * @type {{warning: string, error: string}}
 */
const LEVEL = {warning: 'warning', error: 'error'}

/**
 * A defect's file as a path relative to the working directory, in posix form,
 * the shape the machine formats and GitHub code scanning expect. A file outside
 * the working directory, whose relative path would climb out with '..' (or is
 * absolute across drives), is named by its absolute path instead, so an
 * out-of-tree file is unambiguous rather than a confusing relative climb.
 * @param {string} file - Absolute path of the stylesheet
 * @return {string} - Relative posix path, or absolute when it would escape
 */
const located = function(file) {
  const relative = path.relative(process.cwd(), file)
  const escapes = relative.startsWith('..') || path.isAbsolute(relative)
  let named = relative
  if (escapes) {
    named = file
  }
  return named.split(path.sep).join('/')
}

/**
 * Print defects as the human-readable lines that xslint has always emitted.
 * @param {Array.<object>} defects - Defects to print
 */
const text = function(defects) {
  for (const defect of defects) {
    out[defect.severity](
      '%s(%d:%d) %s (%s)',
      defect.file,
      defect.line,
      defect.pos,
      defect.message,
      defect.name,
    )
  }
}

/**
 * Print defects as a flat JSON array, one object per defect.
 * @param {Array.<object>} defects - Defects to print
 */
const json = function(defects) {
  console.log(JSON.stringify(
    defects.map((defect) => ({
      rule: defect.name,
      severity: defect.severity,
      message: defect.message,
      file: located(defect.file),
      line: defect.line,
      column: defect.pos,
    })),
    null,
    2,
  ))
}

/**
 * Print defects as a SARIF 2.1.0 log. The rules are derived from the defects
 * present, so the log is self-contained; GitHub code scanning ingests it.
 * @param {Array.<object>} defects - Defects to print
 */
const sarif = function(defects) {
  const rules = []
  const indexed = {}
  for (const defect of defects) {
    if (!Object.hasOwn(indexed, defect.name)) {
      indexed[defect.name] = rules.length
      rules.push({
        id: defect.name,
        shortDescription: {text: defect.message},
        defaultConfiguration: {level: LEVEL[defect.severity]},
      })
    }
  }
  console.log(JSON.stringify({
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {driver: {name: 'xslint', version: version.what, rules: rules}},
      results: defects.map((defect) => ({
        ruleId: defect.name,
        ruleIndex: indexed[defect.name],
        level: LEVEL[defect.severity],
        message: {text: defect.message},
        locations: [{
          physicalLocation: {
            artifactLocation: {uri: located(defect.file)},
            region: {startLine: defect.line, startColumn: defect.pos},
          },
        }],
      })),
    }],
  }, null, 2))
}

/**
 * Escape a value for the message data of a workflow command.
 * @param {string} data - Raw text
 * @return {string} - Escaped text
 */
const escapedData = function(data) {
  return String(data)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
}

/**
 * Escape a value for a property of a workflow command, where the property
 * delimiters also need escaping.
 * @param {string} data - Raw text
 * @return {string} - Escaped text
 */
const escapedProperty = function(data) {
  return escapedData(data).replace(/:/g, '%3A').replace(/,/g, '%2C')
}

/**
 * Print defects as GitHub Actions workflow commands, so a run inside a GitHub
 * Action renders each as an inline annotation on the pull-request diff with no
 * separate upload step.
 * @param {Array.<object>} defects - Defects to print
 */
const github = function(defects) {
  for (const defect of defects) {
    console.log(
      `::${LEVEL[defect.severity]} ` +
      `file=${escapedProperty(located(defect.file))},` +
      `line=${defect.line},col=${defect.pos},` +
      `title=${escapedProperty(defect.name)}` +
      `::${escapedData(defect.message)}`,
    )
  }
}

/**
 * Reporters by format name, each a function that writes given defects.
 * @type {{[format: string]: function(Array.<object>): void}}
 */
const REPORTERS = {text: text, json: json, sarif: sarif, github: github}

/**
 * The reporter for a format, so a caller writes defects without knowing how.
 * @param {string} format - Format name (text, json, sarif, or github)
 * @return {function(Array.<object>): void} - Reporter that writes the defects
 */
const reporterOf = function(format) {
  return REPORTERS[format]
}

module.exports = {
  reporterOf,
}
