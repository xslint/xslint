/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {metaOf, suppressed} = require('../checks')
const {standsAt, substitution} = require('../fixes')
const {documentary} = require('../literals')
const {GAPS} = require('../tokens')
const {logger} = require('../logger')

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
  let prefix = null
  if (name.startsWith('xmlns:')) {
    prefix = name.slice('xmlns:'.length)
  }
  return prefix
}

/**
 * The prefix part of a qualified name, or null when it carries none.
 * @param {string} name - Qualified name
 * @return {?string} - The prefix, or null
 */
const prefixOf = function(name) {
  let prefix = null
  if (name.includes(':')) {
    prefix = name.slice(0, name.indexOf(':'))
  }
  return prefix
}

/**
 * Whether the element is a literal result element — a non-XSLT element that is
 * neither an extension instruction nor top-level data, so it is copied into
 * the output and carries the stylesheet's in-scope namespaces with it.
 * @param {Element} element - Element to test
 * @param {Set.<string>} extension - Extension-element prefixes
 * @return {boolean} - True for a literal result element
 */
const literal = function(element, extension) {
  return element.namespaceURI !== XSLT && !extension.has(element.prefix) &&
    !documentary(element)
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
 * The name a root excludes prefixes under: the plain one on an XSLT root, and
 * the one in the XSLT namespace on a simplified stylesheet, whose plain
 * namesake is a result attribute like any other — spelled with whichever
 * prefix the document binds, or empty where it binds none (#1040).
 * @param {Element} root - The stylesheet root
 * @return {string} - The qualified name, or an empty string
 */
const spelling = function(root) {
  let name = 'exclude-result-prefixes'
  if (root.namespaceURI !== XSLT) {
    name = ''
    const prefix = root.lookupPrefix(XSLT)
    if (prefix) {
      name = `${prefix}:exclude-result-prefixes`
    }
  }
  return name
}

/**
 * The attribute a root lists prefixes in under a name, in the namespace
 * `spelling` forks on, or null where it lists none: the excluded prefixes
 * (#1040) and the extension ones alike (#1086).
 * @param {Element} root - The stylesheet root
 * @param {string} name - The local name of the attribute
 * @return {?Node} - The attribute, or null
 */
const prefixes = function(root, name) {
  let attribute = root.getAttributeNode(name)
  if (root.namespaceURI !== XSLT) {
    attribute = root.getAttributeNodeNS(XSLT, name)
  }
  return attribute
}

/**
 * The fix that stops a prefix leaking by adding it to the root's excluded
 * prefixes — appended to the existing attribute, or a new one inserted after
 * the element name. It changes the serialized output, which is why the check
 * declares it a suggestion. Only offered when a single prefix leaks, since
 * several would each edit the one shared attribute and collide.
 * @param {Element} root - The stylesheet root
 * @param {string} prefix - The leaking prefix to exclude
 * @param {string} content - Raw source text of the file it stands in
 * @return {{line: number, col: number, value: string,
 *  replacement: string}} - The fix
 */
const exclusion = function(root, prefix, content) {
  const attribute = prefixes(root, 'exclude-result-prefixes')
  let fix = {
    line: root.lineNumber,
    col: root.columnNumber + root.nodeName.length + 1,
    value: '',
    replacement: ` ${spelling(root)}="${prefix}"`,
  }
  if (attribute) {
    fix = substitution(attribute, `${attribute.value} ${prefix}`, content)
  }
  return fix
}

/**
 * Lint the corpus for prefixes declared on the stylesheet, used only in its
 * logic, and copied into the output by a literal result element. A prefix
 * leaks when it binds no XSLT URI (#1075), is not excluded (nor `#all`), is no
 * extension prefix, is absent from the result, yet is used somewhere.
 * Where it stands is asked of the source, by `standsAt` (#681).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByResultNamespace = function(corpus, suppressions = []) {
  logger.debug(`Result-namespace linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {file, content, xsl} of corpus) {
      const root = xsl.documentElement
      const elements = Array.from(xsl.getElementsByTagName('*'))
      const extension = new Set(
        (prefixes(root, 'extension-element-prefixes')?.value ?? '')
          .split(GAPS),
      )
      const excluded = new Set(
        (prefixes(root, 'exclude-result-prefixes')?.value ?? '').split(GAPS),
      )
      const leaks = !excluded.has('#all') &&
        !textual(elements) &&
        elements.some((element) => literal(element, extension))
      let output = new Set()
      let leaking = []
      if (leaks) {
        output = outputs(elements, extension)
        leaking = Array.from(root.attributes).filter((attribute) => {
          const prefix = declared(attribute.name)
          return prefix && prefix !== 'xml' && attribute.value !== XSLT &&
            !excluded.has(prefix) && !extension.has(prefix) &&
            !output.has(prefix) && used(elements, prefix)
        })
      }
      for (const attribute of leaking) {
        const where = standsAt(attribute, content)
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: file,
          line: where.line,
          pos: where.pos,
          ...(leaking.length === 1 && spelling(root) &&
            {fix: exclusion(root, declared(attribute.name), content)}),
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
