/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Which non-XSLT elements a processor never instantiates. Both
 * `leaking-result-namespace` and `redundant-namespace-declarations` ask it of
 * an element before counting it as a literal result element that copies its
 * namespaces into the output, and a linter requires no other (#1174).
 */

const {XSLT} = require('./xsl-version')

/**
 * Whether the element is top-level data or stands inside it: a non-XSLT child
 * of an XSLT root, such as an oXygen `doc:doc` block, which a processor never
 * instantiates, so it writes nothing into the result (#1006).
 * @param {Element} element - Element to test
 * @return {boolean} - True for data outside every sequence constructor
 */
const documentary = function(element) {
  const xsl = element.ownerDocument
  let top = element
  while (top.parentNode !== xsl && top.parentNode.parentNode !== xsl) {
    top = top.parentNode
  }
  return xsl.documentElement.namespaceURI === XSLT &&
    top.namespaceURI !== XSLT
}

module.exports = {
  documentary,
}
