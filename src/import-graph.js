/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require('path')
const {attributeOf} = require('./expressions')

/**
 * The XSLT namespace, whose `import`/`include` elements pull in other modules.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * A DITA-OT plugin URI, `plugin:<id>:<path>`, which the build's catalog maps
 * onto the directory of the plugin declaring that id (#1004).
 * @type {RegExp}
 */
const PLUGIN = /^plugin:([^:]+):(.+)$/

/**
 * The corpus file an href resolves to, relative to the importing file's own
 * directory and normalized. A plugin URI names the corpus file standing at its
 * path under a directory of the plugin's id, that being where DITA-OT keeps a
 * plugin; one naming no such file stays a path nothing in the corpus holds.
 * @param {string} file - The importing file's path
 * @param {string} href - The `@href` of an `xsl:import`/`xsl:include`
 * @param {Array.<string>} files - Normalized paths of the corpus files
 * @return {string} - The resolved, normalized target path
 */
const target = function(file, href, files) {
  const plugged = PLUGIN.exec(href)
  let resolved = path.normalize(path.join(path.dirname(file), href))
  if (plugged) {
    const tail = path.normalize(path.join(plugged[1], plugged[2]))
    resolved = files.find(
      (one) => one === tail || one.endsWith(`${path.sep}${tail}`),
    ) ?? resolved
  }
  return resolved
}

/**
 * The module a reference names, or empty where it names none here. `href` is
 * an attribute of an XSLT element, so `_href` spells it as readily and holds
 * an attribute value template: a plain value is its own and a braced literal
 * is what it quotes, while a value a processor works out at run time names
 * nothing this walk can resolve (#851).
 * @param {Element} element - An `xsl:import` or `xsl:include`
 * @return {string} - The href it names, or empty
 */
const referenced = function(element) {
  return attributeOf(element, 'href')
}

/**
 * Every `xsl:import`/`xsl:include` in the corpus, each with its declaring
 * file, declaring element, and the path its href resolves to. No file is
 * read. A reference naming no module yields no import, joining an absent
 * href onto a directory having taken the run's report down (#668, #597); each
 * carries the raw text a fix reads its span from (#793).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @return {Array.<{file: string, content: string, node: Element,
 *  to: string}>} - The imports
 */
const importsOf = function(corpus) {
  const files = corpus.map(({file}) => path.normalize(file))
  return corpus.flatMap(({file, content, xsl}) =>
    Array.from(xsl.getElementsByTagName('*'))
      .filter(
        (element) =>
          element.namespaceURI === XSLT &&
          (element.localName === 'import' || element.localName === 'include'),
      )
      .map((node) => ({node: node, href: referenced(node)}))
      .filter(({href}) => href !== '')
      .map(({node, href}) => ({
        file: path.normalize(file),
        content: content,
        node: node,
        to: target(file, href, files),
      })))
}

/**
 * The import/include dependency edges among the corpus stylesheets — every
 * import whose target resolves to a file in the corpus, carrying the declaring
 * element so a defect can point at it. An href that resolves outside the
 * corpus is external and yields no edge, so a stylesheet that imports a library
 * it was not handed alongside is never mistaken for a dependency.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @return {Array.<{from: string, to: string, node: Element}>} - The edges
 */
const graphOf = function(corpus) {
  const files = new Set(corpus.map(({file}) => path.normalize(file)))
  return importsOf(corpus)
    .filter((edge) => files.has(edge.to))
    .map((edge) => ({from: edge.file, to: edge.to, node: edge.node}))
}

module.exports = {
  importsOf,
  graphOf,
}
