/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Which elements of a stylesheet are literal result elements, copying the
 * namespaces in scope into the output, and whether any does so unexcluded.
 * Both `leaking-result-namespace` and `redundant-namespace-declarations` ask
 * it, and a linter requires no other (#1174).
 */

const {GAPS} = require('./tokens')
const {XSLT, since, versionOf} = require('./xsl-version')

/**
 * Whether the element is data a processor never instantiates: top-level data
 * or inside it, a non-XSLT child of an XSLT root such as an oXygen `doc:doc`
 * block (#1006), or the inline schema of an `xsl:import-schema` (#1174).
 * @param {Element} element - Element to test
 * @return {boolean} - True for data outside every sequence constructor
 */
const documentary = function(element) {
  const xsl = element.ownerDocument
  let top = element
  let schema = false
  while (top.parentNode !== xsl && top.parentNode.parentNode !== xsl) {
    top = top.parentNode
    schema = schema || (top.namespaceURI === XSLT &&
      top.localName === 'import-schema')
  }
  return xsl.documentElement.namespaceURI === XSLT &&
    (schema || top.namespaceURI !== XSLT)
}

/**
 * The attribute an element lists prefixes in under a local name: the plain
 * one on an XSLT element, the one in the XSLT namespace on any other, whose
 * plain namesake is a result attribute (#1040).
 * @param {Element} element - The element to read
 * @param {string} name - The local name of the attribute
 * @return {Array.<string>} - The tokens it lists
 */
const listOf = function(element, name) {
  let value = element.getAttributeNS(XSLT, name)
  if (element.namespaceURI === XSLT) {
    value = element.getAttribute(name)
  }
  return (value || '').split(GAPS).filter(Boolean)
}

/**
 * The extension-element prefixes the stylesheet root declares (#1086).
 * @param {Element} root - The stylesheet root
 * @return {Set.<string>} - The prefixes of its extension instructions
 */
const extensionsOf = function(root) {
  return new Set(listOf(root, 'extension-element-prefixes'))
}

/**
 * Whether the element is a literal result element: a non-XSLT element that
 * is neither an extension instruction nor data, so it is copied into the
 * output and carries the stylesheet's in-scope namespaces with it.
 * @param {Element} element - Element to test
 * @param {Set.<string>} extension - Extension-element prefixes
 * @return {boolean} - True for a literal result element
 */
const literal = function(element, extension) {
  return element.namespaceURI !== XSLT && !extension.has(element.prefix) &&
    !documentary(element)
}

/**
 * Whether `#all` keeps every namespace of an element out of the output: a
 * prefix list on itself or an ancestor names it where XSLT 2.0 is in force,
 * since a 1.0 processor reads it as a prefix nothing binds (#1174).
 * @param {Element} element - Element to test
 * @return {boolean} - True when no namespace of it reaches the output
 */
const shut = function(element) {
  let all = false
  for (let node = element; node.nodeType === node.ELEMENT_NODE;
    node = node.parentNode) {
    all = all || (listOf(node, 'exclude-result-prefixes').includes('#all') &&
      since(versionOf(node), '2.0'))
  }
  return all
}

/**
 * Whether the output carries the namespaces the root declares: a literal
 * result element copies every one in scope that `#all` does not exclude, so
 * deleting one that names nothing still changes what the stylesheet writes.
 * @param {Array.<Element>} elements - Every element of the document
 * @return {boolean} - True when a literal result element copies them
 */
const carried = function(elements) {
  const extension = extensionsOf(elements[0])
  return elements.some((element) =>
    literal(element, extension) && !shut(element))
}

module.exports = {
  carried,
  extensionsOf,
  literal,
}
