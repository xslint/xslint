/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS, OPAQUE, GAP} = require('../tokens')
const {wholeOf} = require('../attributes')
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
 * one: the lexer folds the gap in front of its `::` into the axis token, so
 * `ancestor  ::` is a single token and a scan reading only `whitespace` tokens
 * saw the run behind the colons and not the one in front of them — one of the
 * two runs in `ancestor  ::  b`, with `--fix` leaving the other in the file and
 * the next run calling it clean (#642). A string or a comment is kept
 * whole on purpose, so neither is ever looked into. Whether the run wraps a
 * line is `wrapping`'s question, since the value the run is read from answers
 * only half of it.
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
 * Whether a run of whitespace wraps a line. Neither text alone can say: XML 1.0
 * §3.3.3 turns a line ending inside an attribute value into a space, so a wrap
 * and a typed-out double space are the same characters in the value the run was
 * found in — which is why reading the value alone answered no to every wrapped
 * attribute and a wrapped expression drew a warning per line it wrapped onto
 * (#628). A character reference is exempt from that normalisation, so `&#10;`
 * runs the other way: the value holds a real line ending the source never
 * shows. Each text sees a wrap the other cannot, and either sighting counts.
 *
 * Wrapping a long expression is formatting, not a defect — xcop, which this
 * project runs over its own fixtures, asks for it — so a run holding a line
 * ending is not redundant whitespace at all, neither reported nor fixed. The
 * doubled spaces standing within one line still are.
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
 * literals or comments are never seen because the lexer keeps those whole. Each
 * run carries the offset where it starts, its raw value, and the text that
 * should replace it — empty when it leads or trails, a single space when it is
 * a doubled run in the middle. Whether a run wraps a line is settled by
 * `wrapping`, which reads the source as well, since the expression handed here
 * has had every literal wrap in it normalised to a space already.
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
 * Lint the valid Xpath expressions for redundant whitespace. The expressions
 * are already known to parse — the validator dropped the malformed ones — so
 * this linter never re-checks validity, it only reasons over their tokens.
 * @param {Array.<{source: object, attribute: Node}>} expressions - Valid
 *  expressions, each the attribute holding one paired with the file it came
 *  from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByFormat = function(expressions, suppressions = []) {
  logger.debug(`Format linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, attribute} of expressions) {
      const found = wholeOf(attribute)
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
