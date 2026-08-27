/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf, whole} = require('../attributes')
const {gathered, isValid} = require('../syntax')
const {metaOf, suppressed} = require('../checks')
const {substitution} = require('../fixes')
const {WHITESPACE} = require('../tokens')
const {holding, named} = require('../tree')
const {XSLT} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check for a root template that writes nothing.
 * @type {string}
 */
const SILENT = 'template-writes-nothing'

/**
 * Name of the check for a serialization method that disagrees with what the
 * root template builds.
 * @type {string}
 */
const MISLABELLED = 'output-method-xml'

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [SILENT, MISLABELLED]

/**
 * Defect metadata of both checks, keyed by name.
 * @type {{[check: string]: {severity: string, message: string}}}
 */
const META = {[SILENT]: metaOf(SILENT), [MISLABELLED]: metaOf(MISLABELLED)}

/**
 * The attribute holding the pattern a template is selected by.
 * @type {string}
 */
const MATCH = 'match'

/**
 * The XSLT elements this linter reads: the one a pattern selects, the one whose
 * children it counts, and the one declaring how the result is serialized.
 * @type {{[role: string]: string}}
 */
const ELEMENTS = {template: 'template', variable: 'variable', output: 'output'}

/**
 * The attribute naming the serialization method, and the value this check is
 * about.
 * @type {{[part: string]: string}}
 */
const SERIALIZED = {attribute: 'method', value: 'xml'}

/**
 * The two spellings of the element that gives an HTML result away, which the
 * check has always named both of because a name test asks for one spelling of
 * one name.
 * @type {Array.<string>}
 */
const HTML = ['html', 'HTML']

/**
 * The XSLT instructions whose content does not flow into the result tree
 * around them: a value binding, a wrapper, a string, the message stream, a
 * secondary document, a map entry, an array member. `xsl:copy` is absent,
 * copying a document node being transparent; dropping any name here reddens a
 * pack (#645).
 * @type {Array.<string>}
 */
const DIVERTED = [
  'array-member', 'attribute', 'comment', 'element', 'map-entry', 'message',
  'param', 'processing-instruction', 'result-document', 'variable',
  'with-param',
]

/**
 * Whether the pattern matches the root of the document. A pattern is a union
 * of branches and the root is the branch holding no step at all — the whole of
 * `match="/"`, and one arm of `match="/ | alpha"`. A `starts-with(@match,
 * '/')` was the question before, and every absolute pattern begins that way,
 * so `match="/alpha"` was read as the root template.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  pattern, whole, as `expressionsOf` yields it
 * @return {boolean} - True when the root is one of the nodes it matches
 */
const rooted = function(found) {
  return gathered(found, ['branch']).some(
    (branch) => branch.children.length === 0,
  )
}

/**
 * Every template of the stylesheet whose pattern matches the root. A pattern
 * the grammar refuses is passed over: what it would match cannot be read, and
 * the same run already reports it as invalid.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Element>} - The root templates found
 */
const roots = function(xsl) {
  return expressionsOf(xsl)
    .filter(
      (found) => whole(found, MATCH) &&
        holding(found.node).localName === ELEMENTS.template &&
        holding(found.node).namespaceURI === XSLT &&
        isValid(found) && rooted(found),
    )
    .map((found) => holding(found.node))
}

/**
 * Every `xsl:template` of the stylesheet, off the shared walk, since the
 * question this check asks of one is about its own body rather than about the
 * nodes its pattern selects (#559).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Element>} - The templates found, in document order
 */
const templates = function(xsl) {
  return named(xsl).buckets.get(`${XSLT} ${ELEMENTS.template}`) ?? []
}

/**
 * Whether every character of the text is a gap, which is what `normalize-space`
 * asks of the text a template holds: XML's `S` and not JavaScript's idea of a
 * space, since a no-break space is a character the result tree carries.
 * @param {string} text - The text to weigh
 * @return {boolean} - True when it holds nothing else
 */
const blank = function(text) {
  return Array.from(text).every((one) => WHITESPACE.includes(one))
}

/**
 * Whether the template writes nothing to the result tree: it declares at least
 * one variable, declares nothing else, and holds no text of its own. A CDATA
 * section counts as text, being one kind of it rather than a construct of its
 * own — which is what a `text()` step says too.
 * @param {Element} template - The root template
 * @return {boolean} - True when nothing it holds reaches the result
 */
const silent = function(template) {
  const kids = Array.from(template.childNodes)
  const elements = kids.filter((node) => node.nodeType === 1)
  return elements.length > 0 &&
    elements.every(
      (node) => node.namespaceURI === XSLT &&
        node.localName === ELEMENTS.variable,
    ) &&
    kids.filter((node) => node.nodeType === 3 || node.nodeType === 4)
      .every((node) => blank(node.nodeValue))
}

/**
 * Whether the element stands where the template's own result stands: every
 * element between it and the template is an XSLT instruction passing its
 * content through, which is all of them but `DIVERTED`. An `html` under a
 * literal result element is a fragment, not the document; `xsl:if` and
 * `xsl:for-each` are transparent, so this is a walk.
 * @param {Element} element - The element being judged
 * @param {Element} template - The root template holding it
 * @return {boolean} - True when the template builds it outermost
 */
const outermost = function(element, template) {
  let node = element.parentNode
  let outside = true
  while (outside && node !== template) {
    outside = node.namespaceURI === XSLT && !DIVERTED.includes(node.localName)
    node = node.parentNode
  }
  return outside
}

/**
 * Whether the template builds an HTML document. Holding an `html` element
 * somewhere inside it was the question until #495, and an XML document may
 * embed an HTML fragment and stay XML, so a check reading any descendant told
 * a valid feed to serialize itself as HTML. An `html` in the XHTML namespace
 * is XHTML, serialized as neither.
 * @param {Element} template - The root template
 * @return {boolean} - True when it builds one
 */
const html = function(template) {
  return HTML.some((name) => Array.from(template.getElementsByTagName(name))
    .some((element) => element.namespaceURI === null &&
      outermost(element, template)))
}

/**
 * The `xsl:output` elements the stylesheet declares at its root, which is where
 * XSLT takes one from — an `xsl:output` deeper in the tree is not a declaration
 * at all.
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Array.<Element>} - The output declarations found
 */
const outputs = function(xsl) {
  return Array.from(xsl.documentElement.childNodes).filter(
    (node) => node.nodeType === 1 && node.namespaceURI === XSLT &&
      node.localName === ELEMENTS.output,
  )
}

/**
 * A defect of the given check, standing where the element it is about does.
 * @param {string} check - Name of the check
 * @param {string} file - Path of the file the element stands in
 * @param {Element} element - The element to report
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}} - The defect
 */
const reported = function(check, file, element) {
  return {
    name: check,
    severity: META[check].severity,
    message: META[check].message,
    file: file,
    line: element.lineNumber,
    pos: element.columnNumber,
  }
}

/**
 * Lint the corpus for the two faults a root template gives away: one that
 * declares variables and writes nothing, and one that builds HTML under an
 * `xsl:output` declaring the XML method. Which template is the root one is the
 * pattern grammar's answer since #723 and was a substring's until now, only
 * the bare `/` being the root (#788's family, one check over).
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByRootTemplate = function(corpus, suppressions = []) {
  logger.debug(`Root template linting started`)
  const defects = []
  for (const {file, content, xsl} of corpus) {
    if (!suppressed(SILENT, suppressions)) {
      for (const template of templates(xsl).filter(silent)) {
        defects.push(reported(SILENT, file, template))
      }
    }
    if (!suppressed(MISLABELLED, suppressions) && roots(xsl).some(html)) {
      for (const output of outputs(xsl)) {
        const method = output.getAttributeNode(SERIALIZED.attribute)
        if (method && method.value === SERIALIZED.value) {
          defects.push({
            ...reported(MISLABELLED, file, output),
            fix: {
              ...substitution(method, 'html', content),
              suggestion: true,
            },
          })
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} root template defects`)
  return defects
}

module.exports = {
  DIVERTED,
  HTML,
  lintByRootTemplate,
  names,
}
