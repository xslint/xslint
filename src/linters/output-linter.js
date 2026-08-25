/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {graphOf, importsOf} = require('../import-graph')
const {logger} = require('../logger')
const {metaOf, suppressed} = require('../checks')
const {XSLT} = require('../xsl-version')
const path = require('path')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'not-using-output'

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
 * Whether the document is a stylesheet module, under either spelling of the
 * root that XSLT gives it.
 * @param {Document} xsl - The parsed stylesheet
 * @return {boolean} - Whether its root is one
 */
const rooted = function(xsl) {
  return xsl.documentElement.namespaceURI === XSLT &&
    ['stylesheet', 'transform'].includes(xsl.documentElement.localName)
}

/**
 * Whether the root holds a top-level XSLT child of that name.
 * @param {Document} xsl - The parsed stylesheet
 * @param {string} name - The local name to look for
 * @return {boolean} - Whether one stands there
 */
const holds = function(xsl, name) {
  return Array.from(xsl.documentElement.childNodes).some(
    (node) => node.namespaceURI === XSLT && node.localName === name,
  )
}

/**
 * Every file reachable from one through the import graph, itself included.
 * `graphOf` yields an edge only where the target is in the corpus, so a library
 * nobody handed us settles nothing either way, which is the guardrail #468 asks
 * for: a subset lint stays quiet rather than inventing an answer.
 * @param {string} file - Where the walk starts
 * @param {Array.<{from: string, to: string}>} edges - The import graph
 * @return {Set.<string>} - Files reachable from it
 */
const reaching = function(file, edges) {
  const seen = new Set([path.normalize(file)])
  const queue = [path.normalize(file)]
  while (queue.length > 0) {
    const here = queue.shift()
    edges
      .filter((edge) => edge.from === here && !seen.has(edge.to))
      .forEach((edge) => {
        seen.add(edge.to)
        queue.push(edge.to)
      })
  }
  return seen
}

/**
 * Lint the corpus for a module carrying templates and declaring no
 * serialization, quiet where the import tree supplies one for it and where an
 * href leaves the linted set (#548, #468).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByOutput = function(corpus, suppressions = []) {
  logger.debug(`Output linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    const edges = graphOf(corpus)
    const held = new Set(corpus.map(({file}) => path.normalize(file)))
    const outward = new Set(
      importsOf(corpus)
        .filter((edge) => !held.has(edge.to))
        .map((edge) => path.normalize(edge.file)),
    )
    const supplying = new Set(
      corpus
        .filter(({xsl}) => rooted(xsl) && holds(xsl, 'output'))
        .map(({file}) => path.normalize(file)),
    )
    for (const {file, xsl} of corpus) {
      const bare = rooted(xsl) && holds(xsl, 'template') && !holds(xsl, 'output')
      const reach = Array.from(reaching(file, edges))
      if (bare && !reach.some(
        (one) => supplying.has(one) || outward.has(one),
      )) {
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: file,
          line: xsl.documentElement.lineNumber,
          pos: xsl.documentElement.columnNumber,
        })
      }
    }
  }
  logger.debug(`Found ${defects.length} stylesheets with no serialization`)
  return defects
}

module.exports = {
  lintByOutput,
  names,
}
