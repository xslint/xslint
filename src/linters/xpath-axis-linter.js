/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS} = require('../tokens')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, since, versionOf} = require('../xsl-version')
const {logger} = require('../logger')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'unabbreviated-axis'

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
 * The abbreviation each axis specifier collapses to on its own, whatever node
 * test follows it. What gets replaced is measured by `spans`, not taken from
 * the token: the token carries the gap in front of the colons and `spans`
 * reaches the one behind them, so a spaced `child ::  a` is stripped in full
 * from either side.
 * @type {{[type: string]: {replacement: string}}}
 */
const SHORT = {
  [TOKENS.CHILD]: {replacement: ''},
  [TOKENS.ATTRIBUTE]: {replacement: '@'},
}

/**
 * The abbreviation each axis collapses to when — and only when — its node test
 * is `node()`, in which case the whole step goes. The same axis before any
 * other node test names a kind of node rather than every one, so it keeps its
 * longhand.
 * @type {{[type: string]: {replacement: string}}}
 */
const STEP = {
  [TOKENS.PARENT]: {replacement: '..'},
  [TOKENS.SELF]: {replacement: '.'},
}

/**
 * How many significant tokens a `node()` test and the bracket that may follow
 * it come to: the name, the two parentheses, and the bracket. A run of
 * whitespace may precede each, so twice that bounds the slice they sit in.
 * @type {number}
 */
const SPAN = 4

/**
 * Offset just past the axis at the given token index, counting in any
 * whitespace behind its colons. XPath allows a gap there, and it belongs to the
 * axis rather than to the node test, so shortening `attribute::  name` has to
 * take the gap with it — leaving `@  name` would be a fix that reads worse than
 * what it replaced. A gap the source wrote as a line break cannot be told apart
 * here — the parser turned it into a space before the lexer saw it — so such a
 * fix reaches the source as a run of spaces, fails to match, and is declined
 * rather than misapplied. That is #629's to settle, not this function's.
 * @param {Array.<{type: string, value: string, start: number}>} tokens - Tokens
 * @param {number} index - Index of the axis token
 * @return {number} - Offset just past the axis and the gap behind it
 */
const spans = function(tokens, index) {
  const gap = tokens[index + 1]
  const axis = tokens[index]
  let past = axis.start + axis.value.length
  if (gap !== undefined && gap.type === TOKENS.WHITESPACE) {
    past = gap.start + gap.value.length
  }
  return past
}

/**
 * The `node()` test that follows the axis token at the given index, or null
 * when the axis carries another node test. The whitespace XPath allows between
 * the pieces is insignificant, so `node ( )` names the same test as `node()`.
 * A predicate on the step is reported alongside, because the abbreviations are
 * not free to take one everywhere.
 * @param {Array.<{type: string, value: string, start: number}>} tokens - Tokens
 * @param {number} index - Index of the axis token
 * @return {?{end: number, predicated: boolean}} - Where it ends, and its shape
 */
const afterNode = function(tokens, index) {
  const rest = tokens.slice(index + 1, index + 1 + SPAN * 2).filter(
    (token) => token.type !== TOKENS.WHITESPACE,
  )
  const shaped = rest.length >= 3 &&
    rest[0].type === TOKENS.NAME && rest[0].value === 'node' &&
    rest[1].type === TOKENS.LPAREN && rest[2].type === TOKENS.RPAREN
  let node = null
  if (shaped) {
    node = {
      end: rest[2].start + 1,
      predicated: rest.length > 3 && rest[3].type === TOKENS.LBRACKET,
    }
  }
  return node
}

/**
 * Abbreviable axis specifiers in an expression. Each carries the offset where
 * it starts and the fix that shortens it, or no fix where the shorter form
 * cannot stand in that place: `child::` drops away, `attribute::` becomes `@`,
 * `parent::node()` becomes `..`, and `self::node()` becomes `.`. Those four are
 * the whole of it — a `parent::` or `self::` before any other node test has no
 * shorter form, and neither has any remaining axis, `descendant-or-self`
 * aside, whose `//` trades a named step for a whole-tree walk. Before XPath 2.0
 * gave the context item a predicate list, `.` and `..` were an AbbreviatedStep,
 * which takes no predicate, so `self::node()[1]` is only reported on a 1.0
 * sheet: `.[1]` is a syntax error there. A longhand step in a pattern goes
 * unreported because no pattern offers a shorter one. `parent::node()` is not a
 * legal pattern in any version, the parent axis not being among the downward
 * ones a pattern step takes, so `..` never enters the question. The self
 * axis is illegal before 3.0 for the same kind of reason and legal after it,
 * where `match="."` is still no synonym — a pattern in its own right, not a
 * step inside one, illegal in a union, and outranked by the longhand where it
 * stands alone. Axes inside string literals or comments are never seen because
 * the lexer keeps those whole.
 * @param {string} expression - Xpath expression or pattern
 * @param {boolean} modern - Whether the stylesheet declares XSLT 2.0 or later
 * @param {boolean} pattern - Whether the expression is a pattern, which has no
 *  abbreviated step to offer, so a longhand one there is not a defect at all
 * @return {Array.<{offset: number, fix: ?object}>} - Axes and their fixes
 */
const abbreviable = function(expression, modern, pattern) {
  const tokens = tokenized(expression)
  const found = []
  tokens.forEach((token, index) => {
    let step = null
    if (STEP[token.type]) {
      step = afterNode(tokens, index)
    }
    if (SHORT[token.type]) {
      found.push({
        offset: token.start,
        fix: {
          value: expression.slice(token.start, spans(tokens, index)),
          replacement: SHORT[token.type].replacement,
        },
      })
    } else if (step !== null && !pattern) {
      let fix
      if (!step.predicated || modern) {
        fix = {
          value: expression.slice(token.start, step.end),
          replacement: STEP[token.type].replacement,
        }
      }
      found.push({offset: token.start, fix: fix})
    }
  })
  return found
}

/**
 * Lint the valid expressions for axis specifiers that have a shorter form,
 * reporting one defect per occurrence with the fix that abbreviates it.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByAxis = function(expressions, suppressions = []) {
  logger.debug(`Axis linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      const {node, expression} = found
      for (const {offset, fix} of abbreviable(
        expression, since(versionOf(node), MODERN), found.pattern,
      )) {
        defects.push(
          defect(
            CHECK, META, source, found, offset, fix,
          ),
        )
      }
    }
  }
  logger.debug(`Found ${defects.length} unabbreviated axis defects`)
  return defects
}

module.exports = {
  lintByAxis,
  names,
}
