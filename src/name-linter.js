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
const CHECK = 'name-compared-to-string'

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
 * A `name(` or `local-name(` call opener, unprefixed so a custom one is left
 * alone.
 * @type {RegExp}
 */
const CALL = new RegExp(`(^|[^\\w:.-])(name|local-name)${GAP}*\\(`, 'g')

/**
 * The comparison that follows the call, `= 'x'` or `!= 'x'`.
 * @type {RegExp}
 */
const TAIL = new RegExp(`^${GAP}*(=|!=)${GAP}*'([^']*)'`)

/**
 * The operand-reversed comparison sitting just before the call, `'x' = `.
 * @type {RegExp}
 */
const HEAD = new RegExp(`'([^']*)'${GAP}*(=|!=)${GAP}*$`)

/**
 * A valid unprefixed or prefixed name, so `self::` can be built from it. A
 * literal with spaces or punctuation is reported but not rewritten.
 * @type {RegExp}
 */
const NAME = /^[A-Za-z_][\w.-]*(:[A-Za-z_][\w.-]*)?$/

/**
 * The node test that replaces a comparison, or null when it cannot be built
 * with one edit — an invalid name, or a `local-name()` comparison in a 1.0
 * stylesheet where the `*:name` wildcard does not exist.
 * @param {string} fn - The called function, `name` or `local-name`
 * @param {string} operator - The comparison operator, `=` or `!=`
 * @param {string} literal - The compared string
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {?string} - The replacement expression, or null
 */
const test = function(fn, operator, literal, modern) {
  let node = `self::*:${literal}`
  if (fn === 'name') {
    node = `self::${literal}`
  }
  let replacement = node
  if (!NAME.test(literal) || (fn === 'local-name' && !modern)) {
    replacement = null
  } else if (operator === '!=') {
    replacement = `not(${node})`
  }
  return replacement
}

/**
 * The `name()`/`local-name()`-versus-string comparisons in an expression, in
 * either operand order: each carries the offset it starts at, its verbatim
 * text, and the node test that replaces it (or null when it cannot be
 * rewritten). Only a call over the current node — no argument or `.` — is
 * considered, since `self::` speaks of the current node. The literal is read
 * from the original text, as masking blanks it.
 * @param {string} expression - The attribute value
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(expression, modern) {
  const found = []
  const blanked = masked(expression)
  for (const match of blanked.matchAll(CALL)) {
    const fn = match[2]
    const start = match.index + match[1].length
    const open = match.index + match[0].length - 1
    const close = closes(blanked, open)
    if (close < 0) {
      continue
    }
    const argument = expression.slice(open + 1, close).trim()
    if (argument !== '' && argument !== '.') {
      continue
    }
    const tail = TAIL.exec(expression.slice(close + 1))
    if (tail) {
      found.push({
        offset: start,
        value: expression.slice(start, close + 1 + tail[0].length),
        replacement: test(fn, tail[1], tail[2], modern),
      })
      continue
    }
    const head = HEAD.exec(expression.slice(0, start))
    if (head) {
      const from = start - head[0].length
      found.push({
        offset: from,
        value: expression.slice(from, close + 1),
        replacement: test(fn, head[2], head[1], modern),
      })
    }
  }
  return found
}

/**
 * Lint the corpus for `name()`/`local-name()` compared with a string literal,
 * reporting one defect per comparison with the fix that turns it into a node
 * test when one can be built.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: ?object}[]} - Defects found
 */
const lintByName = function(corpus, suppressions = []) {
  logger.debug(`Name-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const source of corpus) {
      for (const {node, start, expression} of expressionsOf(source.xsl)) {
        const modern = since(versionOf(node), MODERN)
        for (const {offset, value, replacement} of comparisons(
          expression, modern,
        )) {
          let fix
          if (replacement !== null) {
            fix = {value, replacement, suggestion: true}
          }
          defects.push(
            defect(CHECK, META, source, node, start + offset, expression, fix),
          )
        }
      }
    }
  }
  logger.debug(`Found ${defects.length} name comparison defects`)
  return defects
}

module.exports = {
  lintByName,
  names,
}
