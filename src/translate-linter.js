/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {masked, closes} = require('./expressions')
const {GAP} = require('./tokens')
const {metaOf, suppressed, defect} = require('./checks')
const {expressionsOf} = require('./attributes')
const {MODERN, since, versionOf} = require('./xsl-version')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'translate-for-case'

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
 * A `translate(` call opener, unprefixed so a custom one is left alone.
 * @type {RegExp}
 */
const CALL = new RegExp(`(^|[^\\w:.-])translate${GAP}*\\(`, 'g')

/**
 * The uppercase ASCII alphabet.
 * @type {string}
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The uppercase alphabet as a quoted XPath string literal.
 * @type {string}
 */
const UPPER = `'${ALPHABET}'`

/**
 * The lowercase alphabet as a quoted XPath string literal.
 * @type {string}
 */
const LOWER = `'${ALPHABET.toLowerCase()}'`

/**
 * The top-level, comma-separated arguments of a call, read from the original
 * text while the blanked copy locates the depth-zero commas (so a comma inside
 * a nested call or a literal does not split an argument).
 * @param {string} expression - The original attribute value
 * @param {string} blanked - The same value with literals blanked
 * @param {number} from - Offset just after the opening `(`
 * @param {number} to - Offset of the closing `)`
 * @return {Array.<string>} - The argument strings, in order
 */
const args = function(expression, blanked, from, to) {
  const parts = []
  let depth = 0
  let start = from
  for (let at = from; at < to; at++) {
    const char = blanked[at]
    if (char === '(' || char === '[') {
      depth++
    } else if (char === ')' || char === ']') {
      depth--
    } else if (char === ',' && depth === 0) {
      parts.push(expression.slice(start, at))
      start = at + 1
    }
  }
  parts.push(expression.slice(start, to))
  return parts
}

/**
 * The case-folding function a `translate` collapses to, given its second and
 * third arguments, or null when the two are not the alphabet in both cases.
 * @param {string} from - The second argument, trimmed
 * @param {string} to - The third argument, trimmed
 * @return {?string} - `lower-case`, `upper-case`, or null
 */
const folds = function(from, to) {
  let fold = null
  if (from === UPPER && to === LOWER) {
    fold = 'lower-case'
  } else if (from === LOWER && to === UPPER) {
    fold = 'upper-case'
  }
  return fold
}

/**
 * The alphabet-`translate` case folds in an expression: each carries the offset
 * it starts at, its verbatim text, and the `lower-case`/`upper-case` call that
 * replaces it. A call that is not a three-argument alphabet fold is skipped.
 * @param {string} expression - The attribute value
 * @return {Array.<{offset: number, value: string, replacement: string}>} -
 *  The folds found
 */
const folded = function(expression) {
  const found = []
  const blanked = masked(expression)
  for (const match of blanked.matchAll(CALL)) {
    const start = match.index + match[1].length
    const open = match.index + match[0].length - 1
    const close = closes(blanked, open)
    if (close < 0) {
      continue
    }
    const parts = args(expression, blanked, open + 1, close)
    if (parts.length !== 3) {
      continue
    }
    const fold = folds(parts[1].trim(), parts[2].trim())
    if (!fold) {
      continue
    }
    found.push({
      offset: start,
      value: expression.slice(start, close + 1),
      replacement: `${fold}(${parts[0].trim()})`,
    })
  }
  return found
}

/**
 * Lint the corpus for `translate(x, 'A..Z', 'a..z')` case folding in an XSLT
 * 2.0 or 3.0 stylesheet, reporting one defect per call with a suggestion fix
 * that rewrites it to `lower-case(x)`/`upper-case(x)`.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByTranslate = function(corpus, suppressions = []) {
  logger.debug(`Translate-case linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const source of corpus) {
      for (const {node, start, expression} of expressionsOf(source.xsl)) {
        if (since(versionOf(node), MODERN)) {
          for (const {offset, value, replacement} of folded(expression)) {
            defects.push(
              defect(CHECK, META, source, node, start + offset, expression,
                {value, replacement, suggestion: true},
              ),
            )
          }
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} translate case-fold defects`)
  return defects
}

module.exports = {
  lintByTranslate,
  names,
}
