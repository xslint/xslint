/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {nodes} = require('./xpath')
const {masked, closes} = require('./expressions')
const {metaOf, suppressed, defect} = require('./checks')
const {selectorOf} = require('./attributes')
const {logger} = require('./logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-boolean-call'

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
 * An unprefixed `boolean(` at the very start of the expression, so a custom
 * `my:boolean()` or a `boolean()` nested in a larger expression is left alone.
 * @type {RegExp}
 */
const WRAPPER = /^\s*boolean\s*\(/

/**
 * The redundant `boolean(...)` wrapping a whole `@test`, or null when the test
 * is not a single `boolean(...)` call. In a test the value is already coerced
 * to a boolean, so the wrapper adds nothing and its argument stands alone. A
 * `boolean(...)` that is only part of a larger expression (`a = boolean(b)`) is
 * left alone, since there the coercion can matter. The replacement is the
 * argument trimmed, so `boolean( x )` reduces to `x` and never leaves the
 * surrounding whitespace that `redundant-whitespace` would then flag.
 * @param {string} test - The `@test` value
 * @return {?{offset: number, value: string, replacement: string}} - The strip
 */
const stripped = function(test) {
  const blanked = masked(test)
  const wrapper = WRAPPER.exec(blanked)
  const open = wrapper ? wrapper[0].length - 1 : -1
  const close = wrapper ? closes(blanked, open) : -1
  const offset = wrapper ? wrapper[0].indexOf('boolean') : -1
  return close < 0 || blanked.slice(close + 1).trim() !== '' ?
    null :
    {
      offset: offset,
      value: test.slice(offset, close + 1),
      replacement: test.slice(open + 1, close).trim(),
    }
}

/**
 * Lint the corpus for a whole `@test` of an XSLT element that is a single
 * `boolean(...)` call, reporting one defect per test with the safe fix that
 * strips the wrapper. Nothing outside such a test coerces the value, so neither
 * a literal result element's `test` — output text — nor the expression of an
 * attribute value template, where the wrapper decides whether `true`/`false` or
 * the node's own text is printed, is read.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByBooleanCall = function(corpus, suppressions = []) {
  logger.debug(`Boolean-call linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const source of corpus) {
      for (const attribute of nodes(source.xsl, selectorOf('test'))) {
        const strip = stripped(attribute.nodeValue)
        if (strip) {
          defects.push(
            defect(
              CHECK, META, source, attribute, strip.offset,
              attribute.nodeValue,
              {value: strip.value, replacement: strip.replacement},
            ),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} redundant boolean calls`)
  return defects
}

module.exports = {
  lintByBooleanCall,
  names,
}
