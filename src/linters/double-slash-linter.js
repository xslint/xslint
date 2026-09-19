/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The double slash trio is one construct read three ways, and all three of the
 * questions it asks are ones a selector had no way to put. What a `//` *is*:
 * `contains(@match, '//')` counted the one in `match="alpha[@url =
 * 'http://example.com']"`, where the lexer gives a string literal, a comment
 * and an inline `Q{...}` one token each and not one of them holds a separator
 * (#490).
 *
 * Where one *stands*: the checks split the work by whether the slashes led the
 * string, which holds only while the pattern is one branch, since a branch of
 * a union is matched unanchored exactly as the whole pattern is. So the `//`
 * of `match="alpha | //beta"` is the first check's redundancy and drew the
 * second's advice instead, with no fix behind it — while the `//` of `mu[nu |
 * //xi]` opens no branch, a predicate holding an expression rather than a
 * pattern, and scans the document from its root once for every node the
 * pattern is tested against. A `branch` node with nothing of its own to the
 * left of the `//` is the whole of that test, so a bracketed branch counts and
 * 3.0 admits one anywhere in a path.
 *
 * And *whose* path one is, which is the third question and #948's. A predicate
 * holds an expression, and an expression's inner `//` answers to no check of
 * ours anywhere: `select="xi//omicron"` draws nothing, where
 * `match="nu[xi//omicron]"` drew the advice to name the path. There is no path
 * there to name. The one the pattern walks is `nu` either way, and what the
 * brackets hold is the question being asked about it — which a run over a real
 * project reported on a `match="abstract[... and not(.//o[contains(@base,
 * 'x')])]"`, advising against the very anchoring the third check recommends.
 * So a `//` a predicate holds is reported only where it *opens* a path there,
 * the token index standing at that path's own `from`, which is the `mu[nu |
 * //xi]` above; everything else between the brackets is the expression's own
 * business.
 *
 * Two more things came with the kind. The fix cuts the two characters where
 * they stand rather than rewriting the value around them, so it no longer
 * overlaps `redundant-whitespace` on a `match=" //spaced"` and both land in
 * one run, and every branch of `match="alpha | //beta | //gamma"` loses its
 * own where one whole-value substitution could only ever drop the first
 * (#571). And the pair reads every attribute holding a pattern — `PATTERNS`'
 * five names, standing in seven places over five elements — rather than
 * `xsl:template/@match` alone, so an `xsl:key` matching `gamma//delta` is
 * reported at last.
 *
 * The third check is the same shape one attribute over: it was declarative and
 * selected `//*`, so `select-starts-with-double-slash` read the `select` of a
 * literal result element as XPath — output data no processor evaluates — and
 * `--fix-suggestions` wrote `.//` into the result tree, a check about
 * expressions changing what a stylesheet emits (#788). It is handed the
 * records the validator kept, which hold no such attribute, and the `//` it
 * reports is the first token of the parse rather than the first characters of
 * a value, so a comment or a gap standing in front of one no longer hides it.
 *
 * It offers no fix, and did from #457 until #949. `.//` names the same nodes
 * only where the context is the root, and there it walks the same tree the
 * `//` walked — so the rewrite changes what is selected wherever it would save
 * a traversal, and saves none wherever it is sound. Under Saxon 9.1.0.8 a
 * template matching `/object/metas` answers 2 nodes for `//o` and 0 for
 * `.//o`, where one matching `/` answers 2 for both. eo's `add-probes.xsl` is
 * the first shape, a named template gathering its candidates and called from
 * that match, so the rewrite left a stylesheet that compiles, runs and finds
 * nothing. The report stands, the path being the author's to name.
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
 * expression is evaluated forwards and a `//` in front of that one scans the
 * whole document, once for every node the template is applied to.
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
 * a lone name test has 0 (#583). Nowhere else is anything ranked, `priority`
 * being an attribute of `xsl:template` alone, so the edit is safe there.
 * @type {string}
 */
const RANKED = 'template'

/**
 * Whether the `//` at that token index opens a branch of the pattern, which is
 * the whole of what tells the two checks apart: a branch is matched unanchored,
 * so a `//` in front of everything it holds selects nothing extra. The union is
 * where the text could not answer it — in `alpha | //beta` the `//` opens the
 * second branch and drew the advice meant for a defect it is not (#586).
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
 * Whether the `//` at that token index is a step of the pattern's own path,
 * rather than of an expression a predicate holds. A predicate holds an
 * expression, whose inner `//` answers to no check of ours anywhere else — the
 * `xi//omicron` a `select` carries draws nothing, where the same text under a
 * `@match` drew this one (#948).
 * @param {Array.<object>} inner - The predicate nodes the pattern holds
 * @param {Array.<object>} paths - The path nodes it holds
 * @param {number} at - Index of the `//` token
 * @return {boolean} - True when the pattern's own path carries it
 */
const owned = function(inner, paths, at) {
  let own = true
  if (inner.some((one) => one.from <= at && at < one.to)) {
    own = paths.some((one) => one.from === at)
  }
  return own
}

/**
 * The fix that drops a leading `//`: the two characters where they truly stand,
 * never sliced off the front of the value, since on `match=" //spaced"` that
 * would leave `/spaced` and turn an unanchored pattern into an absolute one.
 * A suggestion inside an `xsl:template` and safe everywhere else, for the
 * reason `RANKED` carries — the one tier a linter grades (#899).
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
 * and, where the check has one, the fix that resolves it. A separator is read
 * off the token stream rather than found in the text, so a string literal, a
 * comment and a braced URI literal hold none — where a `contains(@match, '//')`
 * read the URL of `match="alpha[@url = 'http://x.com']"` as a step (#490).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  pattern, whole, as `expressionsOf` yields it
 * @return {Array.<{check: string, at: number, fix: (object|undefined)}>} -
 *  The separators found
 */
const separators = function(found) {
  const branches = gathered(found, ['branch'])
  const inner = gathered(found, ['predicate'])
  const paths = gathered(found, ['path'])
  const results = []
  parseOf(found).tokens.forEach((token, at) => {
    if (token.type === TOKENS.DOUBLE_SLASH && owned(inner, paths, at)) {
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
 * The `//` opening the expression, where one does, and no fix behind it.
 * Opening it means standing in front of every solid token, so a comment or a
 * gap ahead of the slashes changes nothing.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{check: string, at: number}>} - The scan found
 */
const scanning = function(found) {
  const first = parseOf(found).tokens.find(
    (token) => !TRIVIA.includes(token.type),
  )
  const results = []
  if (first.type === TOKENS.DOUBLE_SLASH) {
    results.push({check: SCANNING, at: first.start})
  }
  return results
}

/**
 * Lint the valid patterns a stylesheet carries for the `//` steps they hold,
 * reporting one that opens a branch as redundant, with the fix that drops it,
 * and every other one as broader than its author meant. Every attribute holding
 * a pattern is read (#586), and a `select` for the third check, whose record
 * `expressionsOf` yields is what a `//@select[...]/..` could not narrow (#788).
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
