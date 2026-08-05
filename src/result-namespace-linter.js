/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('./checks')
const {GAP} = require('./tokens')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'leaking-result-namespace'

/**
 * The XSLT namespace, whose elements are instructions rather than results.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = metaOf(CHECK)

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * The prefix a namespace declaration binds, or null when the attribute is not
 * one (`xmlns:foo` binds `foo`, a plain attribute binds nothing).
 * @param {string} name - Attribute name
 * @return {?string} - The bound prefix, or null
 */
const declared = function(name) {
  return name.startsWith('xmlns:') ? name.slice('xmlns:'.length) : null
}

/**
 * The prefix part of a qualified name, or null when it carries none.
 * @param {string} name - Qualified name
 * @return {?string} - The prefix, or null
 */
const prefixOf = function(name) {
  return name.includes(':') ? name.slice(0, name.indexOf(':')) : null
}

/**
 * Whether the element is a literal result element — a non-XSLT element that is
 * not an extension instruction, so it is copied verbatim into the output and
 * carries the stylesheet's in-scope namespaces with it.
 * @param {Element} element - Element to test
 * @param {Set.<string>} extension - Extension-element prefixes
 * @return {boolean} - True for a literal result element
 */
const literal = function(element, extension) {
  return element.namespaceURI !== XSLT && !extension.has(element.prefix)
}

/**
 * The prefixes that genuinely appear in the serialized output — a literal
 * result element's own prefix, a prefix on one of its attributes, or the
 * static name of an `xsl:element`/`xsl:attribute` — so excluding them would
 * be wrong.
 * @param {Array.<Element>} elements - Every element of the document
 * @param {Set.<string>} extension - Extension-element prefixes
 * @return {Set.<string>} - Prefixes present in the result
 */
const outputs = function(elements, extension) {
  const set = new Set()
  for (const element of elements) {
    if (literal(element, extension)) {
      set.add(element.prefix)
      for (const attribute of Array.from(element.attributes)) {
        if (!attribute.name.startsWith('xmlns')) {
          set.add(prefixOf(attribute.name))
        }
      }
    } else if (element.namespaceURI === XSLT &&
      (element.localName === 'element' || element.localName === 'attribute')) {
      const name = element.getAttribute('name')
      if (name && !name.includes('{')) {
        set.add(prefixOf(name))
      }
    }
  }
  return set
}

/**
 * Whether a prefix is used anywhere in the document — by an element name, an
 * attribute name, or a qualified name inside an attribute value — so that a
 * prefix used nowhere is left to the redundant-declaration check, not flagged
 * here.
 * @param {Array.<Element>} elements - Every element of the document
 * @param {string} prefix - Prefix to look for
 * @return {boolean} - True when the prefix is used
 */
const used = function(elements, prefix) {
  const qualifier = `${prefix}:`
  return elements.some(
    (element) =>
      element.nodeName.startsWith(qualifier) ||
      Array.from(element.attributes).some(
        (attribute) =>
          !attribute.name.startsWith('xmlns') &&
          attribute.name !== 'xmlns' &&
          (attribute.name.startsWith(qualifier) ||
            attribute.value.includes(qualifier)),
      ),
  )
}

/**
 * Whether the stylesheet serializes as text, where no namespace ever appears,
 * so nothing can leak.
 * @param {Array.<Element>} elements - Every element of the document
 * @return {boolean} - True when the default output method is text
 */
const textual = function(elements) {
  return elements.some(
    (element) =>
      element.namespaceURI === XSLT &&
      element.localName === 'output' &&
      !element.getAttribute('name') &&
      element.getAttribute('method') === 'text',
  )
}

/**
 * A suggestion fix that stops a prefix leaking by adding it to the root's
 * `exclude-result-prefixes` — appended to the existing attribute, or a new one
 * inserted after the element name. It is a suggestion because it changes the
 * serialized output. Only offered when a single prefix leaks, since several
 * would each edit the one shared attribute and collide.
 * @param {Element} root - The stylesheet root
 * @param {string} prefix - The leaking prefix to exclude
 * @return {{line: number, col: number, value: string, replacement: string,
 *  suggestion: boolean}} - The fix
 */
const exclusion = function(root, prefix) {
  const attribute = root.getAttributeNode('exclude-result-prefixes')
  return attribute ?
    {
      line: attribute.lineNumber,
      col: attribute.columnNumber - attribute.name.length - 1,
      value: `${attribute.name}="${attribute.value}"`,
      replacement: `${attribute.name}="${attribute.value} ${prefix}"`,
      suggestion: true,
    } :
    {
      line: root.lineNumber,
      col: root.columnNumber + root.nodeName.length + 1,
      value: '',
      replacement: ` exclude-result-prefixes="${prefix}"`,
      suggestion: true,
    }
}

/**
 * Lint the corpus for namespace prefixes declared on the stylesheet, used only
 * in its logic, and copied into the output by a literal result element. A
 * prefix is a defect when the stylesheet emits a literal result element, the
 * prefix is not the XSLT one, not already excluded (nor `#all`), not an
 * extension prefix, absent from the serialized result, yet used somewhere — so
 * it leaks. Text-only stylesheets are skipped, since they serialize no
 * namespaces.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByResultNamespace = function(corpus, suppressions = []) {
  logger.debug(`Result-namespace linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, xsl} of corpus) {
      const root = xsl.documentElement
      const elements = Array.from(xsl.getElementsByTagName('*'))
      const extension = new Set(
        (root.getAttribute('extension-element-prefixes') || '').split(new RegExp(`${GAP}+`)),
      )
      const excluded = new Set(
        (root.getAttribute('exclude-result-prefixes') || '').split(new RegExp(`${GAP}+`)),
      )
      const leaks = !excluded.has('#all') &&
        !textual(elements) &&
        elements.some((element) => literal(element, extension))
      const output = leaks ? outputs(elements, extension) : new Set()
      const leaking = leaks ?
        Array.from(root.attributes).filter((attribute) => {
          const prefix = declared(attribute.name)
          return prefix && prefix !== 'xml' && prefix !== root.prefix &&
            !excluded.has(prefix) && !extension.has(prefix) &&
            !output.has(prefix) && used(elements, prefix)
        }) :
        []
      for (const attribute of leaking) {
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: file,
          line: attribute.lineNumber,
          pos: attribute.columnNumber - attribute.name.length - 1,
          ...(leaking.length === 1 &&
            {fix: exclusion(root, declared(attribute.name))}),
        })
      }
    }
  }
  logger.debug(`Found ${defects.length} leaking result namespaces`)
  return defects
}

module.exports = {
  lintByResultNamespace,
  names,
}
