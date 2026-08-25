/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('../checks')
const {deletion, standsAt} = require('../fixes')
const {logger} = require('../logger')
const {GAPS} = require('../tokens')
const {XSLT} = require('../xsl-version')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-namespace-declarations'

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
 * one (`xmlns:foo` binds `foo`; a plain attribute or the default `xmlns` binds
 * nothing).
 * @param {string} name - Attribute name
 * @return {?string} - The bound prefix, or null
 */
const declared = function(name) {
  let prefix = null
  if (name.startsWith('xmlns:')) {
    prefix = name.slice('xmlns:'.length)
  }
  return prefix
}

/**
 * The two standard attributes that name namespace prefixes as bare tokens
 * rather than inside a qualified name, so a scan looking for `prefix:` cannot
 * see them.
 * @type {Array.<string>}
 */
const LISTS = ['exclude-result-prefixes', 'extension-element-prefixes']

/**
 * The prefixes an element names in a prefix list. The spelling depends on what
 * the element is: on an XSLT element the attribute stands unprefixed, while on
 * a literal result element it is `xsl:exclude-result-prefixes`, an unprefixed
 * one there being text bound for the result tree. `#default` names the default
 * namespace, which binds no prefix and so matches nothing here.
 * @param {Element} element - The element to read
 * @return {Array.<string>} - The tokens its prefix lists hold
 */
const listed = function(element) {
  let prefixes = []
  for (const name of LISTS) {
    let value = element.getAttributeNS(XSLT, name)
    if (element.namespaceURI === XSLT) {
      value = element.getAttribute(name)
    }
    if (value) {
      prefixes = prefixes.concat(value.split(GAPS))
    }
  }
  return prefixes
}

/**
 * Whether a prefix is used anywhere in the document — by an element name, an
 * attribute name, a qualified name inside an attribute value, or a prefix list
 * naming it; a namespace declaration itself is not usage. A prefix list is,
 * deleting a declaration it names leaving a reference bound to nothing that a
 * processor rejects (#553), and `#all` is usage of every prefix at once.
 * @param {Array.<Element>} elements - Every element of the document
 * @param {string} prefix - Prefix to look for
 * @return {boolean} - True when the prefix is used
 */
const used = function(elements, prefix) {
  const qualifier = `${prefix}:`
  return elements.some((element) => {
    const prefixes = listed(element)
    return element.nodeName.startsWith(qualifier) ||
      prefixes.includes(prefix) ||
      prefixes.includes('#all') ||
      Array.from(element.attributes).some(
        (attribute) =>
          !declared(attribute.name) &&
          attribute.name !== 'xmlns' &&
          (attribute.name.startsWith(qualifier) ||
            attribute.value.includes(qualifier)),
      )
  })
}

/**
 * Lint the corpus for namespace prefixes declared on the stylesheet but used
 * nowhere, reporting one defect per dead declaration with the fix that deletes
 * it. The span to cut is read from the source by `deletion`, so either
 * delimiter and any gap around the `=` is deleted rather than declined (#594);
 * where it stands is read the same way, so report and fix agree (#681).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByNamespace = function(corpus, suppressions = []) {
  logger.debug(`Namespace linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, content, xsl} of corpus) {
      const elements = Array.from(xsl.getElementsByTagName('*'))
      for (const attribute of Array.from(xsl.documentElement.attributes)) {
        const prefix = declared(attribute.name)
        if (prefix && prefix !== 'xml' && !used(elements, prefix)) {
          const where = standsAt(attribute, content)
          defects.push({
            name: CHECK,
            severity: META.severity,
            message: META.message,
            file: file,
            line: where.line,
            pos: where.pos,
            fix: deletion(attribute, content),
          })
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} redundant namespace declarations`)
  return defects
}

module.exports = {
  lintByNamespace,
  names,
}
