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
 * not this file (#758). Starting from the files that import something reaches
 * them all, a file only ever imported being finished by its importer's walk.
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
 * imports itself). The graph is asked once rather than every edge in turn, a
 * walk per edge costing the square of an import chain and converging on the 4.0
 * a quadratic predicts where one pass reads the 2.0 of the edges (#769).
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
 * `xsl:import` and also by `xsl:include`. The two differ in import precedence:
 * an included module's definitions stand at the level of the including
 * stylesheet's own, an imported module's below them, so deleting either moves
 * definitions between levels, which the author decides and not a fix (#597).
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
 * resolved target but the last, that last reference being the one fixing the
 * module's import precedence (#667). Each carries a suggested fix deleting the
 * duplicate, withheld where both mechanisms reach the module or `excision` can
 * place no span; the span is read from the source, never rebuilt (#793).
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
