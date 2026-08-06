/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * Node kinds a walk collects: an attribute, a text node, and the CDATA section
 * that is a text node written another way.
 * @type {Array.<number>}
 */
const CARRIED = [2, 3, 4]

/**
 * Namespace declarations, which XPath does not count among an element's
 * attributes however the DOM lists them — they are namespace nodes, reached by
 * an axis of their own.
 * @type {RegExp}
 */
const DECLARED = /^xmlns(:|$)/

/**
 * The walk already taken over a document. Every stage that needs the attributes
 * or the text of a stylesheet wants the same sequence, so it is walked once and
 * remembered against the document — released with it, a `WeakMap` holding no
 * stylesheet the corpus has finished with.
 * @type {WeakMap}
 */
const WALKED = new WeakMap()

/**
 * Every attribute, text node and CDATA section of a document, in document
 * order: each element's attributes in the order they were written, then its
 * children in theirs. Two details keep the sequence the one a descendant scan
 * answers, so that swapping the two changes no report: a namespace declaration
 * is left out, XPath counting those as nodes of another kind, and an element's
 * attributes come out sorted by name, which is the order fontoxpath yields them
 * in — XPath leaves it to the implementation, and matching the old one is what
 * makes this change invisible rather than a re-ordering of every report.
 *
 * This is the set a descendant scan for every attribute and every text node
 * answers, reached by walking rather than by XPath, which is the point.
 * fontoxpath evaluates a descendant step over an
 * xmldom tree quadratically — 15 ms at 165 lines, 3060 ms at 4805 — where the
 * walk is linear and reaches 2.7 ms on the same input for the same nodes
 * (#635). Nothing here interprets a stylesheet; the checks' own XPath is still
 * XPath, and only the scans this project issues on its own behalf are walked.
 * @param {Document} xsl - Parsed stylesheet
 * @return {Array.<Node>} - The nodes it carries, in document order
 */
const walked = function(xsl) {
  if (!WALKED.has(xsl)) {
    const found = []
    /**
     * Add what the node carries, then walk into the elements below it.
     * @param {Node} node - The document, or an element within it
     */
    const visit = function(node) {
      const carried = Array.from(node.attributes || [])
        .filter((one) => !DECLARED.test(one.nodeName))
        .sort((one, two) => {
          let order = 1
          if (one.nodeName < two.nodeName) {
            order = -1
          }
          return order
        })
      for (const one of carried) {
        found.push(one)
      }
      for (const kid of Array.from(node.childNodes)) {
        if (kid.nodeType === 1) {
          visit(kid)
        } else if (CARRIED.includes(kid.nodeType)) {
          found.push(kid)
        }
      }
    }
    visit(xsl)
    WALKED.set(xsl, Object.freeze(found))
  }
  return WALKED.get(xsl)
}

module.exports = {
  walked,
}
