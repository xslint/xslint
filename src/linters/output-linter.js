/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `not-using-output` was a per-file selector — `[xsl:template and
 * not(xsl:output)]` — and an `xsl:output` is not a per-file fact. It merges
 * into the sheet that imports it and governs the whole import tree, so a main
 * module that pushes its serialization into a shared `_output.xsl` was
 * reported for missing what it had, and the module holding it was reported by
 * `stylesheet-has-no-templates` for holding nothing else. One decomposition,
 * punished at both ends, and the one `too-many-templates` recommends (#548,
 * #494).
 *
 * The question needs the graph, so the check moved to the code stage and the
 * YAML kept only its severity and message. `graphOf` yields an edge only where
 * the target is in the corpus, which is half of what #468's guardrail asks;
 * the other half is that an href leaving the linted set means *external,
 * assume fine*. Reachability is transitive,
 * an `xsl:output` three imports down governing as surely as one directly
 * imported, and it is not directional either: a tree serializes together, so
 * the module holding the only templates is answered by the sheet importing it
 * as much as by the ones it imports. Saxon over a `main.xsl` declaring
 * `method="text"` and a `_lib.xsl` declaring nothing emits text, where
 * `_lib.xsl` alone emits XML. So the question is the tree's rather than the
 * file's, and a module is quiet when any tree holding it declares an output or
 * reaches outside. Downward alone answers the smaller half: DocBook-XSL's 178
 * reports fall to 143 that way and to 19 with both directions, TEI's 159 to
 * 112 and then to 14, DITA-OT's 118 to 95.
 *
 * That guardrail settles the importer and never the module it names, so every
 * module of a tree the graph could not see was still judged (#1004). 91 of
 * DITA-OT's 96 reports were modules its build reaches through a `plugin:` URI,
 * which joined onto a directory names no file; and DocBook's `html/lists.xsl`,
 * linted alone, was reported where the whole tree is quiet. A module is judged
 * now only where a transformation starts — nothing in the corpus imports it,
 * and a template of it matches the root or is `xsl:initial-template` — and
 * the report stands on it alone, that being where an `xsl:output` belongs,
 * while `src/import-graph.js` reads a `plugin:` URI. The corpora fall from 19,
 * 14 and 96 to 5, 3 and 3, `coverage-report.xsl` among the five; two of
 * DITA-OT's three are modules its install generates from a `_template.xsl`
 * the checkout holds instead, which nothing here reads. A library matching the
 * root and linted alone is still judged, so one file of a project can still
 * draw what all of them do not. A named `xsl:output` supplies nothing, being
 * a format an `xsl:result-document` asks for.
 *
 * One decision no pack defeats. The namespace half of `rooted` fires only on a
 * root *named* stylesheet or transform outside the XSLT namespace while
 * holding XSLT children, which is no stylesheet at all, and it stays: a
 * local-name test standing without its namespace is the shape this repository
 * refuses everywhere else. Two the first spelling carried are gone, for two
 * different reasons. `!holds(xsl, 'output')` beside the report was redundant
 * against every input there is, a file holding one being in `supplying` and so
 * settled through its own reach before the conjunct is read. `rooted` inside
 * `supplying` fired only on a root that is neither stylesheet nor transform
 * yet holds a top-level `xsl:output` — an `xsl:package`, where it was wrong, a
 * package's output governing the modules it imports as any other does, or a
 * shape XSLT refuses; 842 corpus stylesheets hold neither. So one went for
 * deciding nothing, one for deciding wrongly, and the third stays for deciding
 * rightly where nothing valid reaches it. What `rooted` decides whole is the
 * file judged, and the package is that live case: reached by
 * `xsl:use-package`, an edge this linter does not follow, so judging one
 * invents a defect out of a tree nobody handed us — #468 once more.
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
      .filter(({xsl}) => serializes(xsl))
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
