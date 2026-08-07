/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('./checks')
const {deletion} = require('./fixes')
const {logger} = require('./logger')
const {GAPS} = require('./tokens')
const {XSLT} = require('./xsl-version')

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
 * a literal result element it is a standard attribute in the XSLT namespace
 * (`xsl:exclude-result-prefixes`) — an unprefixed one there is text bound for
 * the result tree, naming no prefix at all, the same distinction
 * `src/attributes.js` draws for a `select`. The split is on `GAPS` because that
 * is the one spelling of a gap this repository allows, not because a tab can
 * reach here: attribute-value normalization turned every `S` into a space
 * before the value was read, and only a run of them survives. `#default` names
 * the default namespace, which binds no prefix and so matches nothing here.
 * @param {Element} element - The element to read
 * @return {Array.<string>} - The tokens its prefix lists hold
 */
const listed = function(element) {
  const prefixes = []
  for (const name of LISTS) {
    let value = element.getAttributeNS(XSLT, name)
    if (element.namespaceURI === XSLT) {
      value = element.getAttribute(name)
    }
    if (value) {
      prefixes.push(...value.split(GAPS))
    }
  }
  return prefixes
}

/**
 * Whether a prefix is used anywhere in the document — by an element name, an
 * attribute name, a qualified name inside an attribute value, or a prefix list
 * naming it. Namespace declarations themselves are not usage, so they are
 * skipped.
 *
 * A prefix list is usage even though nothing in it is qualified: a declaration
 * `exclude-result-prefixes` names is what tells the processor to keep that
 * namespace out of the output, and deleting the declaration leaves the
 * reference bound to nothing, which a conformant processor rejects (XTSE0808).
 * The check reported such a prefix as never used and its safe fix then cut the
 * declaration, so `--fix` turned a stylesheet that compiled into one that does
 * not (#553). `#all` says every namespace in scope is excluded, so it is usage
 * of every prefix at once — read at any version, as `leaking-result-namespace`
 * reads it, since `#all` is no NCName and can never be the prefix under
 * judgement.
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
 * it. The span to cut is read from the source by `deletion`, so a declaration
 * spelled with either delimiter, or with a gap of any width around its `=`, is
 * deleted rather than announced and then declined (#594).
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
          defects.push({
            name: CHECK,
            severity: META.severity,
            message: META.message,
            file: file,
            line: attribute.lineNumber,
            pos: attribute.columnNumber - attribute.name.length - 1,
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
