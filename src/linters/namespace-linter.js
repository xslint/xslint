/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf} = require('../attributes')
const {metaOf, suppressed} = require('../checks')
const {deletion, standsAt} = require('../fixes')
const {logger} = require('../logger')
const {GAPS, NAMED} = require('../tokens')
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
 * The two attributes of `xsl:namespace-alias`, each naming one bare prefix;
 * deleting a declaration either names leaves XTSE0812 behind (#999).
 * @type {Array.<string>}
 */
const ALIASES = ['stylesheet-prefix', 'result-prefix']

/**
 * The prefixes an element names bare. The spelling depends on what the element
 * is: on an XSLT element a prefix list stands unprefixed, while on a literal
 * result element it is `xsl:exclude-result-prefixes`, an unprefixed one there
 * being text bound for the result tree. `#default` and `#all` bind no prefix,
 * so they match nothing here.
 * @param {Element} element - The element to read
 * @return {Array.<string>} - The tokens its prefix lists hold
 */
const listed = function(element) {
  let names = LISTS.map((name) => element.getAttributeNS(XSLT, name))
  if (element.namespaceURI === XSLT) {
    names = LISTS.map((name) => element.getAttribute(name))
    if (element.localName === 'namespace-alias') {
      names = ALIASES.map((name) => element.getAttribute(name))
    }
  }
  return names.filter(Boolean).flatMap((value) => value.split(GAPS))
}

/**
 * What finds a prefix qualifying a name in a text: the prefix and its colon,
 * with no name character in front unless an axis ends there, so `tei:y` is no
 * use of `i` while `child::tei:y` is one of `tei`, and no second colon behind,
 * so an axis is no use of a prefix spelled like it (#999).
 * @param {string} prefix - Prefix to look for
 * @return {RegExp} - The pattern of its use
 */
const qualifying = function(prefix) {
  return new RegExp(
    `(?:(?<!${NAMED.source})|(?<=::))${prefix.replaceAll('.', '\\.')}:(?!:)`, 'u',
  )
}

/**
 * Whether a prefix is used anywhere in the document — by an element name, an
 * attribute name, a qualified name inside an attribute value or a text value
 * template, or a prefix list naming it; a namespace declaration itself is not
 * usage. A value is read as text rather than as tokens, since a string literal
 * such as `function-available('ext:name')` names a prefix as surely as a step.
 * @param {Document} xsl - The document to read
 * @param {Array.<Element>} elements - Every element of the document
 * @param {string} prefix - Prefix to look for
 * @return {boolean} - True when the prefix is used
 */
const used = function(xsl, elements, prefix) {
  const qualifier = `${prefix}:`
  const pattern = qualifying(prefix)
  return elements.some((element) =>
    element.nodeName.startsWith(qualifier) ||
      listed(element).includes(prefix) ||
      Array.from(element.attributes).some(
        (attribute) =>
          !declared(attribute.name) &&
          attribute.name !== 'xmlns' &&
          (attribute.name.startsWith(qualifier) ||
            pattern.test(attribute.value)),
      ),
  ) || expressionsOf(xsl).some(
    (found) => found.node.nodeType !== 2 && pattern.test(found.expression),
  )
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
        if (prefix && prefix !== 'xml' && !used(xsl, elements, prefix)) {
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
