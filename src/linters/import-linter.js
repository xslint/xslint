/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('../checks')
const {excision} = require('../fixes')
const {importsOf, graphOf} = require('../import-graph')
const {logger} = require('../logger')

/**
 * Name of the cycle check.
 * @type {string}
 */
const CIRCULAR = 'circular-import'

/**
 * Name of the duplicate-import check.
 * @type {string}
 */
const REDUNDANT = 'redundant-import'

/**
 * Metadata of both checks, keyed by name.
 * @type {{[check: string]: {severity: string, message: string}}}
 */
const META = {[CIRCULAR]: metaOf(CIRCULAR), [REDUNDANT]: metaOf(REDUNDANT)}

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CIRCULAR, REDUNDANT]

/**
 * A defect of one of the import checks.
 * @param {string} check - Check name
 * @param {string} file - File the import sits in
 * @param {Element} node - The `xsl:import`/`xsl:include` element
 * @return {object} - Defect
 */
const defect = function(check, file, node) {
  return {
    name: check,
    severity: META[check].severity,
    message: META[check].message,
    file: file,
    line: node.lineNumber,
    pos: node.columnNumber,
  }
}

/**
 * Add one file to the list another is indexed against.
 * @param {Map.<string, Array.<string>>} sides - Files by file
 * @param {string} key - File the list belongs to
 * @param {string} file - File to add to it
 */
const join = function(sides, key, file) {
  if (!sides.has(key)) {
    sides.set(key, [])
  }
  sides.get(key).push(file)
}

/**
 * Every import edge by the file it leaves, and again by the file it enters. The
 * second index is the graph reversed, which is what the component pass below
 * walks.
 * @param {Array.<{from: string, to: string}>} edges - The import edges
 * @return {{ahead: Map.<string, Array.<string>>,
 *  back: Map.<string, Array.<string>>}} - The graph both ways round
 */
const linked = function(edges) {
  const ahead = new Map()
  const back = new Map()
  for (const edge of edges) {
    join(ahead, edge.from, edge.to)
    join(back, edge.to, edge.from)
  }
  return {ahead, back}
}

/**
 * The files in the order a depth-first walk of the imports finishes them, every
 * file standing after each one it reaches. Iterative rather than recursive,
 * because the depth is the length of an import chain and a corpus decides that,
 * not this file (#758).
 *
 * Starting from the files that import something is enough to reach them all: a
 * file only ever imported is the target of an edge whose source starts a walk,
 * so it is finished by that walk. A file no edge touches is absent, and has no
 * edge to report either.
 * @param {Map.<string, Array.<string>>} ahead - Targets by importing file
 * @return {Array.<string>} - The files, in finishing order
 */
const finished = function(ahead) {
  const order = []
  const seen = new Set()
  for (const start of ahead.keys()) {
    if (!seen.has(start)) {
      seen.add(start)
      const work = [{file: start, at: 0}]
      while (work.length > 0) {
        const frame = work[work.length - 1]
        const targets = ahead.get(frame.file) || []
        if (frame.at === targets.length) {
          order.push(frame.file)
          work.pop()
        } else {
          const target = targets[frame.at]
          frame.at++
          if (!seen.has(target)) {
            seen.add(target)
            work.push({file: target, at: 0})
          }
        }
      }
    }
  }
  return order
}

/**
 * Which strongly connected component each file falls in — Kosaraju's second
 * walk, over the reversed graph, taking the files in the order the first walk
 * finished them, latest first. Two files land in one component exactly when
 * each reaches the other.
 * @param {Map.<string, Array.<string>>} back - Importing files by target
 * @param {Array.<string>} order - The files in finishing order
 * @return {Map.<string, number>} - Component number by file
 */
const grouped = function(back, order) {
  const groups = new Map()
  let group = 0
  for (let at = order.length - 1; at >= 0; at--) {
    if (!groups.has(order[at])) {
      groups.set(order[at], group)
      const work = [order[at]]
      while (work.length > 0) {
        const current = work.pop()
        for (const source of back.get(current) || []) {
          if (!groups.has(source)) {
            groups.set(source, group)
            work.push(source)
          }
        }
      }
      group++
    }
  }
  return groups
}

/**
 * Defects for `circular-import` — each import/include edge whose two ends fall
 * in one strongly connected component, so the stylesheet is part of a cycle (or
 * imports itself).
 *
 * That is the same question as whether the edge's target reaches back to its
 * source, and it is asked of the graph once rather than of every edge in turn.
 * Walking the whole graph per edge costs the square of an import chain, which
 * a corpus is long enough to feel: a chain of stylesheets read 2.48, 3.39,
 * 3.53 and 3.99 times dearer per doubling from a hundred files to sixteen
 * hundred, converging on the 4.0 a quadratic predicts, where one pass reads
 * about the 2.0 of the edges themselves (#769). A single-node component
 * answers a self-import, its one edge having both ends in it.
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @return {Array.<object>} - Defects found
 */
const byCircularity = function(corpus) {
  const edges = graphOf(corpus)
  const {ahead, back} = linked(edges)
  const groups = grouped(back, finished(ahead))
  return edges
    .filter((edge) => groups.get(edge.from) === groups.get(edge.to))
    .map((edge) => defect(CIRCULAR, edge.from, edge.node))
}

/**
 * The `file|target` keys of every module one stylesheet reaches both ways — by
 * `xsl:import` and also by `xsl:include`. The two mechanisms differ in import
 * precedence: an included module's definitions stand at the level of the
 * including stylesheet's own, an imported module's below them. So the pair is
 * not the same reference written twice, and deleting either moves definitions
 * between precedence levels, which the author decides rather than a fix (#597).
 * @param {Array.<{file: string, node: Element, to: string}>} imports - Imports
 * @return {Set.<string>} - Keys of the modules reached both ways
 */
const crossed = function(imports) {
  const mechanisms = new Map()
  for (const {file, node, to} of imports) {
    const key = `${file}|${to}`
    mechanisms.set(key, (mechanisms.get(key) || new Set()).add(node.localName))
  }
  return new Set(
    Array.from(mechanisms.keys()).filter((key) => mechanisms.get(key).size > 1),
  )
}

/**
 * Defects for `redundant-import` — every `xsl:import`/`xsl:include` of one
 * resolved target within a stylesheet's own list except the last of them. The
 * last is the reference that fixes the module's import precedence, so it is
 * the one left standing; reporting them the other way round pointed the fix
 * at the only reference that could not go (#667). The
 * target need not be a corpus file: importing the same external library twice
 * is redundant too. Each carries a suggested fix that deletes the duplicate
 * reference, except where the module is reached by both mechanisms, which is
 * reported without one — and except where `excision` can place no span, an
 * element holding more than gap being one nobody should cut blind.
 *
 * The span is read from the source rather than rebuilt from the element.
 * Rebuilding it assumed one spelling of three separate things — no gap around
 * the `=`, a double-quoted delimiter, an empty tag with nothing in front of the
 * `/>` — and `src/fixer.js` applies a fix only where the source decodes to its
 * `value`, so every other spelling was announced and then refused for a reason
 * having nothing to do with the stylesheet: the eight one fixture now holds
 * apply here and none of them on master. Every reference the fixtures carried
 * before was written the canonical way, so the reconstruction was right by
 * accident everywhere it was tested (#793).
 *
 * Which reference is cut follows from import precedence being positional
 * (XSLT 1.0 §2.6.2): a module's level is the level of its last reference, so
 * cutting the last one drops the module below anything referenced between the
 * two, and `A` became `B` under xsltproc on a stylesheet that only asked for
 * its duplicate to be tidied. Cutting an earlier one leaves the survivors in
 * the order they already stood.
 *
 * It is not enough to make the deletion safe, at either mechanism, which is
 * why the fix is a suggestion whatever it cuts. An `xsl:import` creates a
 * precedence level, and the earlier reference is shadowed for template
 * selection only: `xsl:apply-imports` walks down the chain and meets the
 * module at every level it occupies, so importing one twice answers `AA` where
 * importing it once answers `A`, and no choice of reference preserves that.
 *
 * An `xsl:include` creates no level of its own, but it copies the included
 * module's children in, and those hold its own `xsl:import` elements. So a
 * module included twice brings its imports in twice, at two levels, and the
 * same traversal walks both — a stylesheet including a `gamma` that imports
 * `delta` answers `GDD`, and `GD` once the duplicate include is cut.
 *
 * Reading the difference off the corpus was the tempting alternative and does
 * not work: the module included is usually outside the corpus — none of this
 * repository's own fixtures resolve — so the safe tier would depend on which
 * files the caller happened to pass rather than on the stylesheet (#667).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @return {Array.<object>} - Defects found
 */
const byRedundancy = function(corpus) {
  const imports = importsOf(corpus)
  const mixed = crossed(imports)
  const last = new Map()
  imports.forEach(({file, to}, at) => last.set(`${file}|${to}`, at))
  const defects = []
  imports.forEach(({file, content, node, to}, at) => {
    const key = `${file}|${to}`
    if (last.get(key) !== at) {
      const report = defect(REDUNDANT, file, node)
      const cut = excision(node, content)
      if (mixed.has(key) || !cut) {
        defects.push(report)
      } else {
        defects.push({...report, fix: {...cut, suggestion: true}})
      }
    }
  })
  return defects
}

/**
 * Lint the corpus for import-graph defects: `xsl:import`/`xsl:include` cycles
 * (`circular-import`, an error) and the same module imported more than once in
 * one stylesheet (`redundant-import`, a warning). Both resolve hrefs against
 * the importing file's directory (`src/import-graph.js`).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByImports = function(corpus, suppressions = []) {
  logger.debug(`Import linting started`)
  let defects = []
  if (!suppressed(CIRCULAR, suppressions)) {
    defects = defects.concat(byCircularity(corpus))
  }
  if (!suppressed(REDUNDANT, suppressions)) {
    defects = defects.concat(byRedundancy(corpus))
  }
  logger.debug(`Found ${defects.length} import defects`)
  return defects
}

module.exports = {
  lintByImports,
  names,
}
