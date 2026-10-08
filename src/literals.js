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
 * @return {Array.<string>} - The tokens it spells
 */
const spelled = function(element, name) {
  let value = element.getAttributeNS(XSLT, name)
  if (element.namespaceURI === XSLT) {
    value = element.getAttribute(name)
  }
  return (value || '').split(GAPS).filter(Boolean)
}

/**
 * Whether a processor reads the prefix list an element spells: a 1.0 one
 * reads the plain attribute on the root alone, and none can see past a 3.0
 * shadow attribute, whose value a static parameter settles (#1174).
 * @param {Element} element - The element to read
 * @param {string} name - The local name of the attribute
 * @return {boolean} - True when the spelled tokens are the ones in force
 */
const known = function(element, name) {
  let shadow = element.hasAttributeNS(XSLT, `_${name}`)
  let plain = true
  if (element.namespaceURI === XSLT) {
    shadow = element.hasAttribute(`_${name}`)
    plain = element === element.ownerDocument.documentElement ||
      since(versionOf(element), '2.0')
  }
  return plain && !shadow
}

/**
 * The prefixes an element's list holds as far as a scan can know them, none
 * where `known` doubts the spelled ones.
 * @param {Element} element - The element to read
 * @param {string} name - The local name of the attribute
 * @return {Array.<string>} - The tokens in force
 */
const listOf = function(element, name) {
  let tokens = []
  if (known(element, name)) {
    tokens = spelled(element, name)
  }
  return tokens
}

/**
 * The extension-element prefixes any element of the sheet declares (#1086).
 * @param {Array.<Element>} elements - Every element of the document
 * @return {Set.<string>} - The prefixes of its extension instructions
 */
const extensionsOf = function(elements) {
  return new Set(elements.flatMap((element) =>
    listOf(element, 'extension-element-prefixes')))
}

/**
 * Whether a test holds for the element or one of its ancestors, the scope a
 * prefix list on an XSLT or literal element governs.
 * @param {Element} element - Element to start from
 * @param {function(Element): boolean} test - What to ask of each one
 * @return {boolean} - True when the element or an ancestor passes
 */
const along = function(element, test) {
  let found = false
  for (let node = element; node.nodeType === node.ELEMENT_NODE;
    node = node.parentNode) {
    found = found || test(node)
  }
  return found
}

/**
 * Whether the element is a literal result element, copied into the output
 * with the namespaces in scope: a non-XSLT element that is not data, and not
 * an extension instruction, whose prefix an `extension-element-prefixes` on
 * itself or an ancestor names.
 * @param {Element} element - Element to test
 * @return {boolean} - True for a literal result element
 */
const literal = function(element) {
  return element.namespaceURI !== XSLT && !documentary(element) &&
    !along(element, (node) =>
      listOf(node, 'extension-element-prefixes').includes(element.prefix))
}

/**
 * Whether `#all` keeps every namespace of an element out of the output: a
 * prefix list on itself or an ancestor names it where XSLT 2.0 is in force,
 * since a 1.0 processor reads it as a prefix nothing binds (#1174).
 * @param {Element} element - Element to test
 * @return {boolean} - True when no namespace of it reaches the output
 */
const shut = function(element) {
  return along(element, (node) =>
    listOf(node, 'exclude-result-prefixes').includes('#all') &&
    since(versionOf(node), '2.0'))
}

/**
 * Whether the output carries the namespaces the root declares: a literal
 * result element copies every one in scope that `#all` does not exclude, so
 * deleting one that names nothing still changes what the stylesheet writes.
 * @param {Array.<Element>} elements - Every element of the document
 * @return {boolean} - True when a literal result element copies them
 */
const carried = function(elements) {
  return elements.some((element) => literal(element) && !shut(element))
}

module.exports = {
  carried,
  extensionsOf,
  literal,
  spelled,
}
