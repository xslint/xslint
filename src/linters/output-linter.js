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
 * assume fine*. Both are the same rule read from either side — never invent a
 * defect out of what we were not handed — so linting one file of a project
 * cannot report what linting all of them does not. Reachability is transitive,
 * an `xsl:output` three imports down governing as surely as one directly
 * imported, and it is not directional either: a tree serializes together, so
 * the module holding the only templates is answered by the sheet importing it
 * as much as by the ones it imports. Saxon over a `main.xsl` declaring
 * `method="text"` and a `_lib.xsl` declaring nothing emits text, where
 * `_lib.xsl` alone emits XML. So the question is the tree's rather than the
 * file's, and a module is quiet when any tree holding it declares an output or
 * reaches outside. Downward alone answers the smaller half: DocBook-XSL's 178
 * reports fall to 143 that way and to 19 with both directions, TEI's 159 to
 * 112 and then to 14, DITA-OT's 118 to 95. What survives is what should —
 * `anttools/xspec/coverage-report.xsl` is a `match="/"` with no `xsl:output`
 * that nobody imports.
 *
 * Ten *decisions* carry it, `rooted` being two and `outward` two, and mutating
 * each says what pins it: seven redden a single pack, `supplying` four, and
 * the file's own place in its own reach five. Read coarsely — `rooted` one
 * decision and `outward` one — it is four that redden a single pack. Neither
 * reading is the other's, so a count here is stated with the decomposition it
 * was taken under, a sentence claiming five having been true under neither.
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
