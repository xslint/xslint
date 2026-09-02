/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `template-writes-nothing` and `output-method-xml`, of which only the
 * second still asks which template is the *root* one — `starts-with(@match,
 * '/')` until #788, where every absolute pattern begins that way. So a
 * `match="/alpha"`, a template for an `alpha` element standing at a
 * document's root, was read as the root template and told that it "contains
 * only variable declarations", which is advice about a template the
 * stylesheet does not have; this repository's own motive rule names that
 * error. The pattern grammar answers it now: a pattern is a union of
 * branches and the root is the branch holding no step at all, so
 * `match="/"` is one and `match="alpha | /"` is one, where `match="/alpha"`
 * and `match="document-node()"` are not. The first check asked it too until
 * #559 and had no business to: what a template writes its own body decides,
 * and a `match="item"` holding nothing but variables is as dead as the root
 * one, in a way no processor reports since an empty result is legal. It
 * reads every `xsl:template` off the shared walk now, named ones included,
 * and is named for what it is about rather than for what the stylesheet
 * produces. Both its packs had asserted the narrowing, each carrying a
 * variable-only `match="/objects/o/o[…]"` the fixture expected to stay
 * quiet, which is what #494's packs turned out to be doing. A body of
 * nothing but `xsl:param` is left alone deliberately: DocBook-XSL's
 * `xsl/fo/math.xsl` has both four lines apart, variable-only at 65 and
 * parameter-only at 60, and a parameter is a signature a template may keep
 * while producing nothing on purpose. That one at 65 is the whole of what
 * the widening reports over the three corpora. A template writes nothing
 * when every element it holds is an `xsl:variable` and every text node of
 * it is blank — a CDATA section being one kind of text and not a construct
 * of its own, which is what a `text()` step says too. The `xsl:output` the
 * second check reports is taken from the stylesheet's own children, XSLT
 * reading a declaration nowhere else, and its fix rewrites the value alone
 * through `substitution`. What makes the result HTML is the **outermost**
 * element the template builds and not an `html` anywhere under it, which is
 * #495: an XML document may embed an HTML fragment and stay XML — an Atom
 * entry's `content`, an XHTML island — so a check reading any descendant
 * told a valid feed to serialize itself as HTML and `--fix-suggestions`
 * rewrote the `method` to match, which emits unclosed tags and no XML
 * declaration. Outermost means every element up to the template is an XSLT
 * instruction that passes its content through, which is every one of them
 * but the eleven in `DIVERTED` — three binding a value (`xsl:variable`,
 * `xsl:param`, `xsl:with-param`), `xsl:element` building the wrapper its
 * content becomes children of, three reducing it to a string
 * (`xsl:attribute`, `xsl:comment`, `xsl:processing-instruction`),
 * `xsl:message` writing to the message stream, `xsl:result-document`
 * opening a secondary document with a serialization of its own, and
 * `xsl:map-entry` and `xsl:array-member` building a map's value or an
 * array's member, which is a value and not a node the element above it
 * holds. Their containers are outside the list and the asymmetry is
 * deliberate: an `xsl:map` holds a sequence of maps and an `xsl:array` a
 * sequence of arrays, so an `html` directly inside one is invalid XSLT
 * rather than output standing anywhere — that last being the one with
 * teeth, since a stylesheet already declaring `method="html"` there drew
 * the warning against its *primary* output and the fix would have rewritten
 * that. The list is named for the rule rather than enumerated to fit it,
 * which is what the first spelling did: `BOUND`, two names and a docblock
 * about binding, left four shapes reporting that its own sentence excluded.
 * What keeps it honest is a gate rather than the reviewer who found that,
 * since the second round of the same defect was the packs and not the list
 * — four names sat behind a `<report>` literal result element, which makes
 * an `html` non-outermost whatever the list holds, so dropping all four
 * left every test green, and `param` was asserted by nothing at all,
 * inherited from the two-name spelling. A pack's zero has to come from the
 * name under test: `test/root-template-linter.test.js` walks each `html` in
 * each pack up to its template and refuses a name that no pack leaves
 * standing **alone** above one, so a name masked by a wrapper or added
 * without a shape of its own turns red — which is #645's shape, a fixture
 * whose zero another mechanism produces reading exactly like one that
 * passed. xsltproc settles the eight of them XSLT 1.0 has by showing what
 * each builds — an `html` under `xsl:element` comes out
 * `<wrapper><html/></wrapper>` and one under `xsl:message` never comes out
 * at all — and `xsl:copy` is deliberately absent, copying the *document
 * node* being transparent, so under a root template an `html` inside one
 * really is the document element and xsltproc answers
 * `<html><body/></html>`. The namespace decides the other half: an `html` a
 * document puts in the XHTML namespace is XHTML, which serializes as `xml`
 * in 1.0 and `xhtml` from 2.0 and never as the `html` this check
 * recommends, so it is left alone rather than given advice its version
 * cannot take — the false negative #495 names beside the false positive,
 * which wants a check of its own rather than the wrong half of this one.
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
