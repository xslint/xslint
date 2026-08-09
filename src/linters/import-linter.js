/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('../checks')
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
 * Whether the goal file is reachable from the start file by following import
 * edges — so an edge sits on a cycle exactly when its target can reach back to
 * its source.
 * @param {Map.<string, Array.<{to: string}>>} adjacency - Edges by source file
 * @param {string} start - File to walk from
 * @param {string} goal - File to look for
 * @return {boolean} - True when goal is reachable from start
 */
const reaches = function(adjacency, start, goal) {
  const stack = [start]
  const seen = new Set()
  let reached = false
  while (stack.length > 0 && !reached) {
    const current = stack.pop()
    reached = current === goal
    if (!reached && !seen.has(current)) {
      seen.add(current)
      for (const edge of adjacency.get(current) || []) {
        stack.push(edge.to)
      }
    }
  }
  return reached
}

/**
 * Defects for `circular-import` — each import/include edge whose target can
 * reach back to its own source, so the stylesheet is part of a cycle (or
 * imports itself).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @return {Array.<object>} - Defects found
 */
const byCircularity = function(corpus) {
  const edges = graphOf(corpus)
  const adjacency = new Map()
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, [])
    }
    adjacency.get(edge.from).push(edge)
  }
  return edges
    .filter((edge) => reaches(adjacency, edge.to, edge.from))
    .map((edge) => defect(CIRCULAR, edge.from, edge.node))
}

/**
 * A safe fix that deletes a redundant import — its whole line, reconstructed
 * from the element as its indentation, the self-closing tag with its single
 * `href`, and the trailing newline. The fixer applies it only when the source
 * is exactly that, so an oddly formatted, single-quoted, or non-self-closing
 * import is reported but left untouched rather than wrongly cut. It is offered
 * only where every reference to that module uses one mechanism, which is what
 * `crossed` decides — the module stays imported by the reference left standing,
 * so the deletion is safe rather than a suggestion. Safe there is not safe
 * everywhere: import precedence is positional, so where an import of another
 * module stands between two imports of this one, cutting the later of the two
 * drops this module below that one and can change the output (#667).
 * @param {Element} node - The duplicate import/include element
 * @return {{line: number, col: number, value: string, replacement: string}} -
 *  The fix
 */
const removal = function(node) {
  return {
    line: node.lineNumber,
    col: 1,
    value: `${' '.repeat(node.columnNumber - 1)}` +
      `<${node.nodeName} href="${node.getAttribute('href')}"/>\n`,
    replacement: '',
  }
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
 * Defects for `redundant-import` — the second and later `xsl:import`/
 * `xsl:include` of the same resolved target within one stylesheet's own list.
 * The target need not be a corpus file: importing the same external library
 * twice is redundant too. Each carries a fix that deletes the duplicate line,
 * except where the module is reached by both mechanisms, which is reported
 * without one.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @return {Array.<object>} - Defects found
 */
const byRedundancy = function(corpus) {
  const imports = importsOf(corpus)
  const mixed = crossed(imports)
  const seen = new Set()
  const defects = []
  for (const {file, node, to} of imports) {
    const key = `${file}|${to}`
    if (seen.has(key)) {
      const report = defect(REDUNDANT, file, node)
      if (mixed.has(key)) {
        defects.push(report)
      } else {
        defects.push({...report, fix: removal(node)})
      }
    } else {
      seen.add(key)
    }
  }
  return defects
}

/**
 * Lint the corpus for import-graph defects: `xsl:import`/`xsl:include` cycles
 * (`circular-import`, an error) and the same module imported more than once in
 * one stylesheet (`redundant-import`, a warning). Both resolve hrefs against
 * the importing file's directory (`src/import-graph.js`).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByImports = function(corpus, suppressions = []) {
  logger.debug(`Import linting started`)
  const defects = []
  if (!suppressed(CIRCULAR, suppressions)) {
    defects.push(...byCircularity(corpus))
  }
  if (!suppressed(REDUNDANT, suppressions)) {
    defects.push(...byRedundancy(corpus))
  }
  logger.debug(`Found ${defects.length} import defects`)
  return defects
}

module.exports = {
  lintByImports,
  names,
}
