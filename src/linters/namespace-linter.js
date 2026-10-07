/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf} = require('../attributes')
const {metaOf, suppressed} = require('../checks')
const {deletion, standsAt} = require('../fixes')
const {carried} = require('../literals')
const {logger} = require('../logger')
const {parseOf} = require('../syntax')
const {GAPS, NAMED, TOKENS} = require('../tokens')
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
 * The kinds a qualified name is lexed as, a prefixed function standing
 * before its bracket being one of its own.
 * @type {Array.<string>}
 */
const NAMES = [TOKENS.NAME, TOKENS.USER_FUNCTION]

/**
 * The kinds holding a literal, whose text names a prefix as surely as a step
 * does in `function-available('ext:name')`, and is read as text for it.
 * @type {Array.<string>}
 */
const LITERALS = [TOKENS.STRING, TOKENS.UNCLOSED]

/**
 * Whether a token stream qualifies a name with a prefix: a name spelled with
 * it, a wildcard it opens (`tei:*`, lexed as three tokens), or a literal
 * holding it. The lexer decides where a name begins, so `last()-tei:x` uses
 * `tei` where a scan of the text reads the `-` as part of a name (#1041).
 * @param {Array.<{type: string, value: string}>} tokens - Lexed expression
 * @param {string} prefix - Prefix to look for
 * @param {RegExp} pattern - The pattern of its use in a text
 * @return {boolean} - True when the prefix is used
 */
const qualifies = function(tokens, prefix, pattern) {
  return tokens.some((token, index) =>
    (NAMES.includes(token.type) && token.value.startsWith(`${prefix}:`)) ||
    (token.type === TOKENS.NAME && token.value === prefix &&
      tokens[index + 1]?.type === TOKENS.COLON &&
      tokens[index + 2]?.type === TOKENS.MULTI) ||
    (LITERALS.includes(token.type) && pattern.test(token.value)),
  )
}

/**
 * What a document says outside its elements' names and prefix lists, read
 * once for every prefix it declares: the tokens of each expression it carries,
 * and each attribute value with those expressions blanked out of it — a
 * QName-valued `mode` or `as`, the text around a template's braces — which is
 * scanned as text, as every value was until #1041.
 * @param {Document} xsl - The document to read
 * @param {Array.<Element>} elements - Every element of the document
 * @return {{streams: Array.<Array>, texts: Array.<string>}} - What to scan
 */
const readOf = function(xsl, elements) {
  const records = new Map()
  for (const found of expressionsOf(xsl)) {
    records.set(found.node, (records.get(found.node) ?? []).concat([found]))
  }
  return {
    streams: expressionsOf(xsl).map((found) => parseOf(found).tokens),
    texts: elements.flatMap((element) => Array.from(element.attributes))
      .filter((attribute) =>
        !declared(attribute.name) && attribute.name !== 'xmlns')
      .map((attribute) => (records.get(attribute) ?? []).reduce(
        (value, found) => [
          value.slice(0, found.start),
          ' '.repeat(found.expression.length),
          value.slice(found.start + found.expression.length),
        ].join(''),
        attribute.value,
      )),
  }
}

/**
 * Whether a prefix is used anywhere in the document — by an element name, an
 * attribute name, a qualified name inside an expression or a literal it
 * holds, the text of a value no expression covers, or a prefix list naming
 * it; a namespace declaration itself is not usage.
 * @param {Array.<Element>} elements - Every element of the document
 * @param {{streams: Array.<Array>, texts: Array.<string>}} read - What the
 *  document says, as {@link readOf} reads it
 * @param {string} prefix - Prefix to look for
 * @return {boolean} - True when the prefix is used
 */
const used = function(elements, read, prefix) {
  const qualifier = `${prefix}:`
  const pattern = qualifying(prefix)
  return elements.some((element) =>
    element.nodeName.startsWith(qualifier) ||
      listed(element).includes(prefix) ||
      Array.from(element.attributes).some(
        (attribute) =>
          !declared(attribute.name) && attribute.name.startsWith(qualifier),
      ),
  ) || read.texts.some((text) => pattern.test(text)) ||
    read.streams.some((tokens) => qualifies(tokens, prefix, pattern))
}

/**
 * The instructions that resolve a prefix at run time against the namespaces
 * in scope, each with the attribute that hands them a namespace instead: a
 * computed `xsl:element` or `xsl:attribute` name, and any `xsl:evaluate`.
 * @type {Map.<string, {guard: string, open: function(Element): boolean}>}
 */
const RESOLVERS = new Map([
  ['element', {guard: 'namespace', open: (element) => computed(element)}],
  ['attribute', {guard: 'namespace', open: (element) => computed(element)}],
  ['evaluate', {guard: 'namespace-context', open: () => true}],
])

/**
 * Whether an element's name is computed: a value template in `name`, or a
 * shadow `_name`, so no scan can tell which prefix it spells.
 * @param {Element} element - The `xsl:element` or `xsl:attribute`
 * @return {boolean} - True when the name is known only at run time
 */
const computed = function(element) {
  return (element.getAttribute('name') ?? '').includes('{') ||
    element.hasAttribute('_name')
}

/**
 * Whether some instruction resolves a prefix at run time, so a declaration
 * nothing names may still be the one it needs (#1174).
 * @param {Array.<Element>} elements - Every element of the document
 * @return {boolean} - True when a prefix is resolved past every scan
 */
const resolving = function(elements) {
  return elements.some((element) => {
    const resolver = RESOLVERS.get(element.localName)
    return element.namespaceURI === XSLT && resolver !== undefined &&
      !element.hasAttribute(resolver.guard) &&
      !element.hasAttribute(`_${resolver.guard}`) && resolver.open(element)
  })
}

/**
 * Lint the corpus for prefixes the stylesheet declares and uses nowhere, each
 * with the fix that deletes it unless the output carries it (#1174). The span
 * to cut is read from the source by `deletion`, so either delimiter and any gap
 * around the `=` is deleted rather than declined (#594); where it stands is
 * read the same way, so report and fix agree (#681).
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
      const read = readOf(xsl, elements)
      const output = carried(elements)
      const open = resolving(elements)
      for (const attribute of Array.from(xsl.documentElement.attributes)) {
        const prefix = declared(attribute.name)
        if (prefix && prefix !== 'xml' && !open &&
          !used(elements, read, prefix)) {
          const where = standsAt(attribute, content)
          const defect = {
            name: CHECK,
            severity: META.severity,
            message: META.message,
            file: file,
            line: where.line,
            pos: where.pos,
          }
          if (!output || attribute.value === XSLT) {
            defect.fix = deletion(attribute, content)
          }
          defects.push(defect)
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
