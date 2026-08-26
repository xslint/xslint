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
 * Every file an `xsl:output` governs: each import tree that declares one, or
 * that reaches past the linted set, taken whole. A tree serializes together,
 * so a module is answered by the sheets importing it as much as by the ones it
 * imports (#548, #468).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<{from: string, to: string}>} edges - The import graph
 * @return {Set.<string>} - The files a serialization already covers
 */
const covered = function(corpus, edges) {
  const held = new Set(corpus.map(({file}) => path.normalize(file)))
  const supplying = new Set(
    corpus
      .filter(({xsl}) => holds(xsl, 'output'))
      .map(({file}) => path.normalize(file)),
  )
  const outward = new Set(
    importsOf(corpus)
      .filter((edge) => !held.has(edge.to))
      .map((edge) => path.normalize(edge.file)),
  )
  const settled = new Set()
  for (const {file} of corpus) {
    const reach = reaching(file, edges)
    if (Array.from(reach).some(
      (one) => supplying.has(one) || outward.has(one),
    )) {
      reach.forEach((one) => settled.add(one))
    }
  }
  return settled
}

/**
 * Lint the corpus for a module carrying templates that no serialization
 * covers, the import tree being what settles it rather than the file (#548).
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
    const settled = covered(corpus, graphOf(corpus))
    for (const {file, xsl} of corpus) {
      if (rooted(xsl) && holds(xsl, 'template') &&
        !settled.has(path.normalize(file))) {
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
