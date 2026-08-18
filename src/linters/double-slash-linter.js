/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {gathered, parseOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {TOKENS, TRIVIA} = require('../tokens')
const {whole} = require('../attributes')
const {holding} = require('../tree')
const {logger} = require('../logger')

/**
 * Name of the check for a `//` that opens a branch of the pattern.
 * @type {string}
 */
const LEADING = 'starts-with-double-slash'

/**
 * Name of the check for a `//` standing anywhere else in it.
 * @type {string}
 */
const INNER = 'use-double-slash'

/**
 * Name of the check for a `//` opening the expression of a `select`, which is
 * the same two characters asking a third question: a pattern is matched by
 * walking up from a node, so a `//` in front of one adds nothing, where an
 * expression is evaluated forwards and a `//` in front of that one is a scan of
 * the whole document from its root, run once for every node the template is
 * applied to.
 * @type {string}
 */
const SCANNING = 'select-starts-with-double-slash'

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [LEADING, INNER, SCANNING]

/**
 * Defect metadata of the three checks, keyed by name.
 * @type {{[check: string]: {severity: string, message: string}}}
 */
const META = {
  [LEADING]: metaOf(LEADING), [INNER]: metaOf(INNER),
  [SCANNING]: metaOf(SCANNING),
}

/**
 * The attribute whose expression is read for a scan from the root. It is one
 * name rather than every expression a stylesheet carries because that is the
 * check as it is written and named: a `//` opening a `@test` or a `@group-by`
 * scans the document exactly as this one does, and reporting it is a widening
 * with a message of its own to write.
 * @type {string}
 */
const SELECT = 'select'

/**
 * The one XSLT element whose patterns are ranked against one another, which is
 * what makes dropping a leading `//` there a change of behaviour rather than of
 * text alone: a pattern carrying a `/` step has a default priority of 0.5 where
 * a lone name test has 0, so a rule loses half a point against every rule it
 * competes with and a template that used to win can start losing (#583).
 *
 * Nowhere else is anything ranked. `priority` is an attribute of `xsl:template`
 * alone, so an `xsl:key` or `xsl:number` pattern only selects, an
 * `xsl:for-each-group` pattern only tests membership, and
 * `xsl:accumulator-rule` resolves a clash by declaration order — the same edit
 * is deterministic and semantics-preserving there, and tiering every kind as a
 * suggestion would withhold five of the six from `--fix` for a hazard only the
 * sixth has.
 * @type {string}
 */
const RANKED = 'template'

/**
 * Whether the `//` at that token index opens a branch of the pattern, which is
 * the whole of what tells the two checks apart. A branch is matched unanchored,
 * exactly as the pattern around it is, so a `//` standing in front of
 * everything the branch holds selects nothing extra; one standing between two
 * of its steps is the descendant step its author meant to write.
 *
 * The union is where the text could not answer it. The two checks split the
 * work by where the slashes sat in the string, and that split holds only while
 * the pattern is one branch: in `alpha | //beta` the `//` opens the second
 * branch and drew the advice meant for a defect it is not, with no fix behind
 * it (#586). A branch the pattern inside a bracket holds is one as much, XSLT
 * 3.0 admitting a bracketed branch at any position of a path — while the `//`
 * of `mu[nu | //xi]` opens none, a predicate holding an expression rather than
 * a pattern, and there a leading `//` really does reach for the whole document.
 * @param {Array.<object>} branches - The branch nodes the pattern holds
 * @param {number} at - Index of the `//` token
 * @return {boolean} - True when it opens one of them
 */
const heads = function(branches, at) {
  return branches.some(
    (branch) => branch.from <= at && at < branch.to &&
      branch.children.every((kid) => at < kid.from),
  )
}

/**
 * The fix that drops a leading `//`: the two characters where they truly stand,
 * never sliced off the front of the value, since on `match=" //spaced"` that
 * would leave `/spaced` and turn an unanchored pattern into an absolute one.
 * A suggestion inside an `xsl:template` and safe everywhere else, for the
 * reason `RANKED` carries.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {{value: string}} token - The `//` token
 * @return {{value: string, replacement: string}} - The fix
 */
const cut = function(found, token) {
  let tier = {}
  if (holding(found.node).localName === RANKED) {
    tier = {suggestion: true}
  }
  return {value: token.value, replacement: '', ...tier}
}

/**
 * The `//` separators a pattern holds, each paired with the check it answers to
 * and, where the check has one, the fix that resolves it.
 *
 * A separator is read off the token stream rather than found in the text, which
 * is what makes every other spelling of those two characters invisible: a
 * string literal, a comment and the braced URI literal of an inline namespace
 * are each one token of their own, so `match="alpha[@url = 'http://x.com']"`
 * holds no separator at all where a `contains(@match, '//')` read one and
 * reported the URL as a step (#490). Which of the two checks a separator
 * answers to is the tree's question rather than the stream's.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  pattern, whole, as `expressionsOf` yields it
 * @return {Array.<{check: string, at: number, fix: (object|undefined)}>} -
 *  The separators found
 */
const separators = function(found) {
  const branches = gathered(found, ['branch'])
  const results = []
  parseOf(found).tokens.forEach((token, at) => {
    if (token.type === TOKENS.DOUBLE_SLASH) {
      let entry = {check: INNER}
      if (heads(branches, at)) {
        entry = {check: LEADING, fix: cut(found, token)}
      }
      results.push({...entry, at: token.start})
    }
  })
  return results
}

/**
 * The `//` opening the expression, where one does, paired with the fix that
 * anchors it. Opening it means standing in front of every solid token, so a
 * comment or a gap ahead of the slashes changes nothing — a `select=" //x"`
 * scans the document as surely as the tight spelling, and one holding a comment
 * scans it though `starts-with(normalize-space(...), '//')` reads neither.
 *
 * The fix writes the `.` where the slashes stand rather than rebuilding the
 * value around them, so the author's own gap survives and the edit cannot
 * overlap the one `redundant-whitespace` offers on the same attribute (#571).
 * It stays a suggestion: `.//` is one of several anchors, and choosing it
 * changes an absolute scan into a relative one.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{check: string, at: number, fix: object}>} - The scan found
 */
const scanning = function(found) {
  const first = parseOf(found).tokens.find(
    (token) => !TRIVIA.includes(token.type),
  )
  const results = []
  if (first.type === TOKENS.DOUBLE_SLASH) {
    results.push({
      check: SCANNING,
      at: first.start,
      fix: {value: first.value, replacement: `.${first.value}`,
        suggestion: true},
    })
  }
  return results
}

/**
 * Lint the valid patterns a stylesheet carries for the `//` steps they hold,
 * reporting one that opens a branch as redundant, with the fix that drops it,
 * and every other one as broader than its author meant.
 *
 * Every attribute holding a pattern is read, which is the five names of
 * `PATTERNS` standing in seven places over five elements, and comes free of the
 * records the validator kept: the redundancy and the breadth are properties of
 * the pattern language rather than of `xsl:template`, and one of the two checks
 * read `xsl:template/@match` alone, so an `xsl:key` matching `gamma//delta`
 * drew nothing at all (#586).
 *
 * A `select` is read for the third check, whose subject is the same two
 * characters and whose question is neither of the other two: an expression is
 * evaluated forwards, so a `//` in front of one scans the whole document from
 * its root rather than standing redundant. What it reads is the record
 * `expressionsOf` yields, which is what the selector `//@select[...]/..` could
 * not narrow to: that reads the attribute of *any* element, so a literal result
 * element's `<widget select="//everything"/>` — output data on its way to the
 * result tree, evaluated by nobody — drew the warning, and the fix behind it
 * wrote `.//everything` into the output (#788).
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: object}[]} - Defects found
 */
const lintByDoubleSlash = function(expressions, suppressions = []) {
  logger.debug(`Double slash linting started`)
  const defects = []
  for (const {source, found} of expressions) {
    let entries = []
    if (found.pattern) {
      entries = separators(found)
    } else if (whole(found, SELECT)) {
      entries = scanning(found)
    }
    for (const {check, at, fix} of entries) {
      if (!suppressed(check, suppressions)) {
        defects.push(defect(check, META[check], source, found, at, fix))
      }
    }
  }
  logger.debug(`Found ${defects.length} double slash defects`)
  return defects
}

module.exports = {
  lintByDoubleSlash,
  names,
}
