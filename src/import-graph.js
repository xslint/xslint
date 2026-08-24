/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require('path')

/**
 * The XSLT namespace, whose `import`/`include` elements pull in other modules.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * The corpus file an href resolves to, relative to the importing file's own
 * directory and normalized.
 * @param {string} file - The importing file's path
 * @param {string} href - The `@href` of an `xsl:import`/`xsl:include`
 * @return {string} - The resolved, normalized target path
 */
const target = function(file, href) {
  return path.normalize(path.join(path.dirname(file), href))
}

/**
 * Every `xsl:import`/`xsl:include` in the corpus, each with its declaring
 * file, declaring element, and the path its `@href` resolves to. No file is
 * read. A reference carrying no `@href` yields no import, joining an absent
 * href onto a directory having taken the run's report down (#668, #597); each
 * carries the raw text a fix reads its span from (#793).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @return {Array.<{file: string, content: string, node: Element,
 *  to: string}>} - The imports
 */
const importsOf = function(corpus) {
  return corpus.flatMap(({file, content, xsl}) =>
    Array.from(xsl.getElementsByTagName('*'))
      .filter(
        (element) =>
          element.namespaceURI === XSLT &&
          (element.localName === 'import' || element.localName === 'include') &&
          element.hasAttribute('href'),
      )
      .map((node) => ({
        file: path.normalize(file),
        content: content,
        node: node,
        to: target(file, node.getAttribute('href')),
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
