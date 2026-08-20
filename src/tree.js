/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The kind of node an attribute is, which is the one kind of the three below a
 * selector reaches by an axis of its own.
 * @type {number}
 */
const ATTRIBUTE = 2

/**
 * Node kinds a walk collects: an attribute, a text node, and the CDATA section
 * that is a text node written another way.
 * @type {Array.<number>}
 */
const CARRIED = [ATTRIBUTE, 3, 4]

/**
 * Namespace declarations, which XPath does not count among an element's
 * attributes however the DOM lists them — they are namespace nodes, reached by
 * an axis of their own.
 * @type {RegExp}
 */
const DECLARED = /^xmlns(:|$)/

/**
 * Where each kind of node keeps the element it hangs off. A node kind not named
 * here — a text node, a comment — hangs off its parent.
 * @type {{[kind: number]: function(Node): ?Node}}
 */
const HELD = {
  9: (node) => node.documentElement,
  2: (node) => node.ownerElement,
  1: (node) => node,
}

/**
 * The element the given node hangs off: an attribute hangs off the element
 * carrying it, a text node off its parent, a document off its root, and an
 * element off itself. It is where anything a stylesheet's structure says about
 * a node is read — the version in force where an expression stands, and the
 * namespace a prefix inside it resolves to — so both questions begin here
 * rather than each walking to an element its own way.
 * @param {Node} node - Any node of a stylesheet
 * @return {?Node} - Where to begin looking, or null
 */
const holding = function(node) {
  const held = HELD[node.nodeType]
  let where = node.parentNode
  if (held !== undefined) {
    where = held(node)
  }
  return where
}

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
 * order: each element's attributes, then its children in the order they were
 * written. Two details keep the sequence the one a descendant scan
 * answers, so that swapping the two changes no report: a namespace declaration
 * is left out, XPath counting those as nodes of another kind, and an element's
 * attributes come out sorted by **local** name, ties left in the order they
 * were written, which is the order fontoxpath yields them in — XPath leaves it
 * to the implementation, and matching the old one is what makes this change
 * invisible rather than a re-ordering of every report. The prefix is no part of
 * that answer, and sorting by the whole name said otherwise wherever an
 * attribute carried one: the engine answers a `table` written
 * `summary border xml:id` with `border xml:id summary`, where the name sorts
 * `summary` ahead of `xml:id` — 37 files of the three corpora hold such an
 * element, so the claim above held for every other one and the two orders
 * parted here (#811).
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
          let order = 0
          if (one.localName < two.localName) {
            order = -1
          } else if (two.localName < one.localName) {
            order = 1
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

/**
 * The attributes already parted from a walk. The question is asked once for
 * each document a cross-file check reads, so the answer is remembered beside
 * the walk it comes off rather than filtered again.
 * @type {WeakMap}
 */
const ATTRIBUTED = new WeakMap()

/**
 * Every attribute of a document, in the order a descendant sweep for one
 * answers: the sequence `//@*` selects, which three of the four cross-file
 * checks are written in and which costs fontoxpath 1.613 s over DocBook-XSL
 * where these 72,077 attributes come off a walk the run has already taken in 8
 * ms — 18% of a whole run for one selector, and #635's quadratic showing as a
 * per-node climb: 5.50 microseconds an attribute under 200 nodes and 64.28
 * above 3200, so six files of 291 are 70% of what it spends (#811).
 * @param {Document} xsl - Parsed stylesheet
 * @return {Array.<Node>} - Every attribute it carries, in document order
 */
const attributed = function(xsl) {
  if (!ATTRIBUTED.has(xsl)) {
    ATTRIBUTED.set(
      xsl,
      Object.freeze(walked(xsl).filter(
        (node) => node.nodeType === ATTRIBUTE,
      )),
    )
  }
  return ATTRIBUTED.get(xsl)
}

/**
 * The elements already bucketed for a document. Every declarative check that
 * sweeps descendants wants the same buckets, so they are built once and
 * remembered against the document the way `walked` is.
 * @type {WeakMap}
 */
const NAMED = new WeakMap()

/**
 * Every element of a document bucketed by namespace and local name, each bucket
 * in document order, beside the rank each element holds in that order. This is
 * what a `//xsl:variable` selects, reached by walking rather than by asking the
 * engine to descend: fontoxpath evaluates a descendant step over an xmldom tree
 * quadratically (#635), so one plain walk of DocBook-XSL's 69,842 elements
 * costs 0.011 to 0.020 s where a single `//*` through the engine costs 0.87,
 * and the 38 declarative checks each paid for a traversal of their own — 5.64 s
 * of a 10.34 s staged run (#784).
 *
 * One walk serves every bucket, so the cost is paid once for the whole stage
 * rather than once per check. Two things keep reading a bucket invisible to a
 * report rather than a re-ordering of one. The order within a bucket is the
 * order a descendant sweep answers in, a pre-order walk visiting an element
 * before its children and a child before its next sibling, which is document
 * order by definition. And the rank is what a *union* needs: `//(xsl:variable |
 * xsl:template)` is a path, so XPath answers it in document order with the two
 * names interleaved, where concatenating one bucket onto another would answer
 * every variable ahead of every template. Nothing sorts a defect downstream,
 * the report being the order the linters push in, so the merge happens here.
 * @param {Document} xsl - Parsed stylesheet
 * @return {{buckets: Map.<string, Array.<Node>>, rank: Map.<Node, number>}} -
 *  The buckets, and where each element stands in document order
 */
const named = function(xsl) {
  if (!NAMED.has(xsl)) {
    const buckets = new Map()
    const rank = new Map()
    /**
     * Bucket the elements below the node, then walk into each of them.
     * @param {Node} node - The document, or an element within it
     */
    const visit = function(node) {
      for (let kid = node.firstChild; kid !== null; kid = kid.nextSibling) {
        if (kid.nodeType === 1) {
          const key = `${kid.namespaceURI} ${kid.localName}`
          if (!buckets.has(key)) {
            buckets.set(key, [])
          }
          buckets.get(key).push(kid)
          rank.set(kid, rank.size)
          visit(kid)
        }
      }
    }
    visit(xsl)
    NAMED.set(xsl, {buckets: buckets, rank: rank})
  }
  return NAMED.get(xsl)
}

module.exports = {
  attributed,
  holding,
  named,
  walked,
}
