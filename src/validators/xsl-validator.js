/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {xml} = require('../helpers')
const {MODERN, XSLT, since, versionOf} = require('../xsl-version')
const {TOKENS, TRIVIA, tokenized} = require('../tokens')
const {staticOf} = require('../expressions')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Name of the check this validator owns.
 * @type {string}
 */
const CHECK = 'malformed-stylesheet'

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = kinds.validation[CHECK]

/**
 * Names of the checks this validator owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * Whether a condition is false with nothing evaluated: the call `false()`,
 * the empty sequence `()`, a numeric literal equal to zero, or a string
 * literal holding nothing, whatever gap stands between the tokens (#1057).
 * @param {string} condition - The text of a `use-when`
 * @return {boolean} - True when its effective boolean value is false
 */
const falsy = function(condition) {
  const solid = tokenized(condition)
    .filter((token) => !TRIVIA.includes(token.type))
  const [only] = solid
  let answer = ['false()', '()']
    .includes(solid.map((token) => token.value).join(''))
  if (solid.length === 1 && only.type === TOKENS.NUMBER) {
    answer = Number(only.value) === 0
  } else if (solid.length === 1 && only.type === TOKENS.STRING) {
    answer = only.value.length === 2
  }
  return answer
}

/**
 * Whether a processor leaves the element out at compile time: its `use-when`
 * is a literal `falsy` answers for. XSLT
 * reads it from 2.0 on and a shadow from 3.0, at the version in force, so a
 * 1.0 processor compiles what the attribute would drop. An XSLT element spells
 * it plainly, any other element under the XSLT namespace (#1048).
 * @param {Element} element - The element to judge
 * @return {boolean} - True when no processor compiles it
 */
const excluded = function(element) {
  let plain = element.getAttributeNS(XSLT, 'use-when')
  let shadowed = element.getAttributeNS(XSLT, '_use-when')
  if (element.namespaceURI === XSLT) {
    plain = element.getAttribute('use-when')
    shadowed = element.getAttribute('_use-when')
  }
  let condition = ''
  if (plain && since(versionOf(element), MODERN)) {
    condition = plain
  } else if (shadowed && since(versionOf(element), '3.0')) {
    condition = staticOf(shadowed)
  }
  return falsy(condition)
}

/**
 * The document as a processor compiles it: every element `excluded` answers
 * for is removed with all it holds, so no check judges what is never there,
 * nor a parent as if it still held it. The root is kept whatever it says, a
 * document with no element being one no check reads; the walk keeps a list of
 * its own rather than recursing, and removes nothing until it ends.
 * @param {Document} xsl - The parsed stylesheet
 * @return {Document} - The same document, pruned
 */
const compiled = function(xsl) {
  const pending = [xsl.documentElement]
  const doomed = []
  while (pending.length) {
    const element = pending.pop()
    if (element !== xsl.documentElement && excluded(element)) {
      doomed.push(element)
    } else {
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 1) {
          pending.push(child)
        }
      }
    }
  }
  for (const element of doomed) {
    element.parentNode.removeChild(element)
  }
  return xsl
}

/**
 * Build the corpus from raw stylesheet sources, validating that each one is
 * well-formed XML. A source that does not parse is reported as a defect and
 * left out of the corpus, so the validators and linters that follow run only
 * over the stylesheets that parse, each as a processor compiles it.
 * @param {Array.<{file: string, content: string, subsets: Map}>} sources -
 *  Raw stylesheets, each with the external subsets its entities name
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{corpus: Array.<{file: string, content: string, xsl: Document}>,
 *  defects:
 *  Array.<object>}} - Parsed corpus and defects for the unparsable sources
 */
const validate = function(sources, suppressions = []) {
  logger.debug(`Xml validation started`)
  const corpus = []
  const defects = []
  const suppressed = suppressions.some((sup) => CHECK.includes(sup))
  for (const {file, content, subsets} of sources) {
    try {
      corpus.push({
        file: file, content: content,
        xsl: compiled(xml.parsedFromString(content, subsets)),
      })
    } catch {
      if (!suppressed) {
        defects.push({
          name: CHECK,
          severity: META.severity,
          message: META.message,
          file: file,
          line: 1,
          pos: 1,
        })
      }
    }
  }
  logger.debug(`Found ${defects.length} malformed stylesheets`)
  return {corpus: corpus, defects: defects}
}

module.exports = {
  validate,
  names,
}
