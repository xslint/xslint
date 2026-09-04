/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `walked`, `named`, `attributed` and `holding` — one pass over a document,
 * remembered against it, and the axis every served selector comes off.
 * `named` buckets each element twice since #811's wildcard phase, once under
 * its own name and once under its namespace beside a literal `*`, which no
 * local name is — so `//xsl:*` is a bucket the walk already holds rather than
 * the one shape past a name that a sweep still paid for. That second key has
 * to be the *walk's* rather than a gather at the door, and the difference is
 * the whole of what the phase buys: building the wildcard's candidates by
 * filtering the buckets and sorting the union of them by rank reads every XSLT
 * element there is before a predicate has narrowed anything, where a bucket
 * standing in document order already needs neither.
 * `modern-construct-in-xslt-1` reads 116-120 ms over DocBook-XSL with its
 * wildcard arm at the engine and 31 with the bucket, and DITA-OT 10.1-10.8
 * against 3.1-3.7. TEI is the one corpus it leaves dearer, 11.3-14.0 against
 * 14.1-16.4: three quarters of its elements are XSLT and the arm's own
 * predicate is what narrows them, so the bucket hands over nearly everything
 * the sweep would have.
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
 * a node is read — the version in force, and the namespace a prefix resolves
 * to — so both questions begin here.
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
 * order. Two details keep the sequence the one a descendant scan answers: a
 * namespace declaration is left out, and an element's attributes come out
 * sorted by **local** name, which is fontoxpath's own order (#811). Walking is
 * linear where a descendant step over xmldom is not (#635).
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
 * ms (#635, #811).
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
 * The attribute ranks already taken for a document, remembered the way the
 * walk they come off is.
 * @type {WeakMap}
 */
const RANKED = new WeakMap()

/**
 * Where each attribute of a document stands in document order. A union merges
 * on a rank, and the rank `named` keeps counts elements alone, so a union of
 * attribute axes has none to merge on until this one — the same numbering, over
 * the sequence `attributed` already holds (#811).
 * @param {Document} xsl - Parsed stylesheet
 * @return {Map.<Node, number>} - Where each attribute stands in document order
 */
const ranked = function(xsl) {
  if (!RANKED.has(xsl)) {
    const rank = new Map()
    for (const node of attributed(xsl)) {
      rank.set(node, rank.size)
    }
    RANKED.set(xsl, rank)
  }
  return RANKED.get(xsl)
}

/**
 * The elements already bucketed for a document. Every declarative check that
 * sweeps descendants wants the same buckets, so they are built once and
 * remembered against the document the way `walked` is.
 * @type {WeakMap}
 */
const NAMED = new WeakMap()

/**
 * Put an element in the bucket one key names, opening that bucket where the
 * element is the first to want it.
 * @param {Map.<string, Array.<Node>>} buckets - What the walk has bucketed
 * @param {string} key - Namespace and name the bucket stands under
 * @param {Node} node - The element to put in it
 */
const bucket = function(buckets, key, node) {
  if (!buckets.has(key)) {
    buckets.set(key, [])
  }
  buckets.get(key).push(node)
}

/**
 * Every element of a document bucketed by namespace and local name, and again
 * by namespace alone under `*`, which a local name never is, each bucket in
 * document order beside the rank each element holds in it. This is what a
 * `//xsl:variable` and a `//xsl:*` select, walked rather than swept by a step
 * the engine answers quadratically (#635, #784, #811).
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
          bucket(buckets, `${kid.namespaceURI} ${kid.localName}`, kid)
          bucket(buckets, `${kid.namespaceURI} *`, kid)
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
  ranked,
  walked,
}
