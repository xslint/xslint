/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `not-using-output`, asked of the import tree rather than the file: an
 * `xsl:output` merges into whatever imports it, so a main module keeping its
 * serialization in a shared `_output.xsl` was reported for missing what it
 * had (#548). Reach through `graphOf` runs both ways, a tree serializing
 * together, and an href leaving the linted set is assumed fine (#468). A
 * module is judged only where a transformation starts, nothing in the corpus
 * importing it and a template of it entering at the root, and the report
 * stands on it alone (#1004, #1046). A named `xsl:output` supplies nothing,
 * and an `xsl:package` is not judged, `xsl:use-package` being an edge this
 * linter does not follow.
 */

const {graphOf, importsOf} = require('../import-graph')
const {logger} = require('../logger')
const {metaOf, suppressed} = require('../checks')
const {entered} = require('../roots')
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
 * Whether the root holds an unnamed top-level `xsl:output`. A named one, in
 * either spelling, is only a format an `xsl:result-document` asks for, and
 * declares nothing about how the tree's own result is serialized (#1004).
 * @param {Document} xsl - The parsed stylesheet
 * @return {boolean} - Whether one stands there
 */
const serializes = function(xsl) {
  return Array.from(xsl.documentElement.childNodes).some(
    (node) => node.namespaceURI === XSLT && node.localName === 'output' &&
      !node.hasAttribute('name') && !node.hasAttribute('_name'),
  )
}

/**
 * Every file reachable from some of them along the import graph, themselves
 * included, walking each edge once however many walks would have crossed it.
 * `graphOf` yields an edge only where the target is in the corpus, so a library
 * nobody handed us settles nothing either way, which is the guardrail #468 asks
 * for: a subset lint stays quiet rather than inventing an answer.
 * @param {Set.<string>} files - Where the walk starts
 * @param {Map.<string, Array.<string>>} links - Each file's neighbours
 * @return {Set.<string>} - Files reachable from any of them
 */
const reaching = function(files, links) {
  const seen = new Set(files)
  const queue = Array.from(files)
  for (let at = 0; at < queue.length; at++) {
    (links.get(queue[at]) ?? [])
      .filter((one) => !seen.has(one))
      .forEach((one) => {
        seen.add(one)
        queue.push(one)
      })
  }
  return seen
}

/**
 * The import graph as each file's neighbours, read in one direction.
 * @param {Array.<{from: string, to: string}>} edges - The import graph
 * @param {string} side - Which end an edge is read from, `from` or `to`
 * @param {string} other - Which end it leads to
 * @return {Map.<string, Array.<string>>} - Neighbours by file
 */
const linked = function(edges, side, other) {
  const links = new Map(edges.map((edge) => [edge[side], []]))
  for (const edge of edges) {
    links.get(edge[side]).push(edge[other])
  }
  return links
}

/**
 * Every file an `xsl:output` governs: each import tree that declares one, or
 * that reaches past the linted set, taken whole. A tree serializes together,
 * so a module is answered by the sheets importing it as much as by the ones it
 * imports. One walk back from the settling files and one forward, never one
 * per file, which cost the cube of an import chain (#548, #468, #1141).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<{from: string, to: string}>} edges - The import graph
 * @return {Set.<string>} - The files a serialization already covers
 */
const covered = function(corpus, edges) {
  const held = new Set(corpus.map(({file}) => path.normalize(file)))
  const supplying = new Set(
    corpus
      .filter(({xsl}) => serializes(xsl))
      .map(({file}) => path.normalize(file)),
  )
  const outward = new Set(
    importsOf(corpus)
      .filter((edge) => !held.has(edge.to))
      .map((edge) => path.normalize(edge.file)),
  )
  return reaching(
    reaching(
      new Set(Array.from(held).filter(
        (one) => supplying.has(one) || outward.has(one),
      )),
      linked(edges, 'to', 'from'),
    ),
    linked(edges, 'from', 'to'),
  )
}

/**
 * Lint the corpus for an entry point no serialization covers: a module nothing
 * in the corpus imports, where a transformation starts, whose import tree
 * declares no output and reaches nothing outside the corpus (#548, #1004).
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
    const settled = covered(corpus, edges)
    const imported = new Set(edges.map((edge) => edge.to))
    for (const {file, xsl} of corpus) {
      if (rooted(xsl) && !imported.has(path.normalize(file)) &&
        !settled.has(path.normalize(file)) && entered(xsl)) {
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
