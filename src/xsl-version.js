/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {holding} = require('./tree')
const {attributeOf} = require('./expressions')

/**
 * The XSLT namespace, which distinguishes a stylesheet root from a literal
 * result element standing in as one.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * The version the 2.0 language begins at. Gates read it as a floor rather than
 * a name, so every version after it is modern too: XSLT 3.0 §3.9 puts XSLT 1.0
 * behaviour at an effective version of exactly 1.0, and anything from here up
 * is outside it.
 * @type {string}
 */
const MODERN = '2.0'

/**
 * The versions this tool knows, in the spelling every gate compares against.
 * @type {Array.<string>}
 */
const KNOWN = ['1.0', '2.0', '3.0']

/**
 * The lexical space of `xs:decimal`, which is the type `version` is declared
 * with. It is narrower than what `Number` will swallow — `0x2` and `2e0` are
 * numbers to JavaScript and versions to nobody — so the spelling is tested
 * before the value is.
 * @type {RegExp}
 */
const DECIMAL = /^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$/

/**
 * The one element XSLT 3.0 §3.9 excludes when it names the effective version:
 * `xsl:output`, whose `version` is a serialization parameter naming the
 * version of the output method, so `4.0` there asks for HTML 4.0. Nothing else
 * needs it, `xsl:result-document` spelling its own parameter `output-version`.
 * @type {string}
 */
const SERIALIZING = 'output'

/**
 * The version a declared value names. `version` is an `xs:decimal`, so `2`,
 * `2.0` and `2.00` are one number written three ways, and a processor drops
 * the surrounding whitespace; all are answered with the canonical spelling. A
 * value naming no version this tool knows is handed back untouched, so a gate
 * refuses it and a check can report it.
 * @param {string} value - The attribute's value
 * @return {string} - The canonical spelling, or the value as it stands
 */
const canonical = function(value) {
  const declared = value.trim()
  const known = DECIMAL.test(declared) &&
    KNOWN.find((one) => Number(one) === Number(declared))
  return known || declared
}

/**
 * Whether the version in force is the given one or later. A version gate is a
 * lower bound, not a list of spellings: a construct XSLT 2.0 introduced is in
 * 3.0 and in whatever comes after, and a hazard that begins where XSLT 1.0
 * behaviour ends only deepens past that point. A value that is no decimal names
 * no version and so clears no bound.
 * @param {string} version - The version in force, as `versionOf` answers it
 * @param {string} floor - The earliest version the construct belongs to
 * @return {boolean} - True when the version is the floor or later
 */
const since = function(version, floor) {
  return DECIMAL.test(version) && Number(version) >= Number(floor)
}

/**
 * The XSLT version the given element declares, or empty when it declares none.
 * An XSLT element spells it `version`, or `_version` as any attribute of one
 * may be spelled; anything else — a literal result element standing in as the
 * stylesheet — spells it `xsl:version`, which has no shadow form, that being
 * what makes such an element a stylesheet. A serializing element's is output's.
 * @param {Node} element - The element to read
 * @return {string} - The declared version, or empty
 */
const declaring = function(element) {
  const xslt = element.namespaceURI === XSLT
  let declared = element.getAttributeNS(XSLT, 'version')
  if (xslt && element.localName === SERIALIZING) {
    declared = ''
  } else if (xslt) {
    declared = attributeOf(element, 'version')
  }
  return declared
}

/**
 * The version in force at the given node, which XSLT 3.0 §3.9 names the
 * effective version: the decimal value of the `version` attribute on the
 * element itself or on the innermost ancestor carrying one, excluding an
 * `xsl:output`'s. Either spelling governs everything below it, so the root
 * answers only when nothing nearer does.
 * @param {Node} node - Any node of a stylesheet, or the document itself
 * @return {string} - The version in force, or empty when none is declared
 */
const versionOf = function(node) {
  let element = holding(node)
  let found = ''
  while (found === '' && element !== null && element.nodeType === 1) {
    found = declaring(element) || ''
    element = element.parentNode
  }
  return canonical(found)
}

/**
 * The version in force at a node as a number, or `NaN` where none is declared
 * or what is declared is no decimal. A declarative gate compares it as a floor
 * and `NaN` clears no comparison, so an absent or malformed version leaves a
 * report unmade rather than inventing one against a stylesheet whose processor
 * would otherwise have to be guessed at (#851).
 * @param {Node} node - Any node of a stylesheet, or the document itself
 * @return {number} - The version in force, or `NaN`
 */
const numbered = function(node) {
  const version = versionOf(node)
  let found = NaN
  if (DECIMAL.test(version)) {
    found = Number(version)
  }
  return found
}

module.exports = {
  XSLT,
  MODERN,
  KNOWN,
  DECIMAL,
  since,
  versionOf,
  numbered,
}
