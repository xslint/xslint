/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS, OPAQUE, GAP} = require('../tokens')
const {metaOf, suppressed, defect, rawly} = require('../checks')
const {skip} = require('../source')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'redundant-whitespace'

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
 * A run of more than one gap character, for looking inside a token that carries
 * one.
 * @type {RegExp}
 */
const INTERNAL = new RegExp(`${GAP}{2,}`)

/**
 * The redundant run a token holds inside itself, or null. Only an axis holds
 * one: the lexer folds the gap in front of its `::` into the axis token, so a
 * scan reading only `whitespace` tokens saw the run behind the colons and not
 * the one in front (#642). A string or a comment is kept whole, so neither is
 * looked into. Whether the run wraps a line is `wrapping`'s question.
 * @param {{type: string, value: string, start: number}} token - The token
 * @return {?{offset: number, value: string, replacement: string}} - The run
 */
const inside = function(token) {
  let run = null
  if (!OPAQUE.includes(token.type)) {
    run = INTERNAL.exec(token.value)
  }
  let held = null
  if (run !== null) {
    held = {offset: token.start + run.index, value: run[0], replacement: ' '}
  }
  return held
}

/**
 * Whether a run of whitespace wraps a line. Neither text alone can say: XML
 * turns a line ending inside an attribute value into a space, so a wrap and a
 * typed double space are the same characters in the value (#628), while a
 * `&#10;` is exempt and holds a real ending the source never shows. Either
 * sighting counts, and a run holding one is not redundant at all.
 * @param {{file: string, content: string}} source - The file the run sits in
 * @param {{node: Node, start: number}} found - The expression holding it
 * @param {{offset: number, value: string}} run - The run
 * @return {boolean} - True when either text holds a line ending in the run
 */
const wrapping = function(source, found, run) {
  const from = rawly(source, found, run.offset)
  return /[\r\n]/.test(run.value) || /[\r\n]/.test(
    source.content.slice(from, skip(source.content, from, run.value.length)),
  )
}

/**
 * Redundant whitespace runs in an expression. A run is redundant when it is
 * longer than one space, or leads or trails the expression; runs inside string
 * literals or comments are never seen, the lexer keeping those whole. Each
 * carries its offset, its raw value, and the text replacing it — empty at
 * either end, one space in the middle.
 * @param {string} expression - Xpath expression
 * @return {Array.<{offset: number, value: string, replacement: string}>} - Runs
 */
const redundancies = function(expression) {
  const runs = []
  for (const token of tokenized(expression)) {
    const edge =
      token.start === 0 ||
      token.start + token.value.length === expression.length
    let run = null
    if (token.type !== TOKENS.WHITESPACE) {
      run = inside(token)
    }
    if (
      token.type === TOKENS.WHITESPACE &&
      (edge || token.value.length > 1)
    ) {
      let replacement = ' '
      if (edge) {
        replacement = ''
      }
      runs.push({
        offset: token.start,
        value: token.value,
        replacement: replacement,
      })
    } else if (run !== null) {
      runs.push(run)
    }
  }
  return runs
}

/**
 * Lint the valid Xpath expressions for redundant whitespace. They are already
 * known to parse, so validity is never re-checked here. Each arrives as the
 * record `expressionsOf` built, which the validator hands on rather than re-
 * deriving from the attribute (#589), so a pattern and a brace's expression
 * are read here too.
 * @param {Array.<{source: object, found: object}>} expressions - Valid
 *  expressions, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByFormat = function(expressions, suppressions = []) {
  logger.debug(`Format linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      for (const run of redundancies(found.expression)) {
        if (!wrapping(source, found, run)) {
          defects.push(
            defect(CHECK, META, source, found, run.offset, {
              value: run.value,
              replacement: run.replacement,
            }),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} redundant whitespace defects`)
  return defects
}

module.exports = {
  lintByFormat,
  names,
}
