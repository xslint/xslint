/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The double slash trio is one construct read three ways off the tree rather
 * than off the text, where a string literal or a `Q{...}` holds no separator
 * (#490). A `//` opening a branch of a pattern is redundant, one inside a
 * branch is broad, and one opening a path of its own in an expression or a
 * predicate walks the document each time it is evaluated (#948, #970). That
 * third check stays quiet where the walk is paid once, under a top-level
 * binding or in the template a stylesheet is entered at, climbing past the
 * `REPEATING` instructions rather than reading the carrying element alone
 * (#958, #978). It offers no fix, since `.//` selects other nodes wherever the
 * context is not the root (#949).
 */

const {gathered, parseOf} = require('../syntax')
const {metaOf, suppressed, defect} = require('../checks')
const {TOKENS, normalized} = require('../tokens')
const {XSLT, MODERN, since} = require('../xsl-version')
const {holding} = require('../tree')
const {attributeOf} = require('../expressions')
const {logger} = require('../logger')

/**
 * Name of the check for a `//` that opens a branch of the pattern.
 * @type {string}
 */
const LEADING = 'starts-with-double-slash'

/**
 * Name of the check for a `//` standing anywhere else on the path the pattern
 * itself walks, a predicate's own being an expression's and not that path's.
 * @type {string}
 */
const INNER = 'use-double-slash'

/**
 * Name of the check for a `//` opening a path of an expression, which is the
 * same two characters asking a third question: a pattern is matched by walking
 * up from a node, so a `//` in front of one adds nothing, where an expression
 * is evaluated forwards and a `//` opening a path there walks the document
 * whole, once for every time the expression is evaluated.
 * @type {string}
 */
const SCANNING = 'scans-whole-document'

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
 * The two XSLT elements a top-level declaration of either binds once, against
 * the source root, for the whole transformation — the one place a scan from
 * the root is the cheapest spelling there is (#958).
 * @type {Array.<string>}
 */
const BOUND = ['variable', 'param']

/**
 * The XSLT instructions that instantiate their content once for every item of
 * something, so an expression standing under one is evaluated as many times
 * however far above it the declaration holding it stands.
 * @type {Array.<string>}
 */
const REPEATING = [
  'for-each', 'for-each-group', 'iterate', 'analyze-string', 'merge',
]

/**
 * The one XSLT element whose patterns are ranked against one another, which is
 * what makes dropping a leading `//` there a change of behaviour rather than of
 * text alone: a pattern carrying a `/` step has a default priority of 0.5 where
 * a lone name test has 0 (#583). Nowhere else is anything ranked, `priority`
 * being an attribute of `xsl:template` alone, so nothing else loses rank to it.
 * @type {string}
 */
const RANKED = 'template'

/**
 * The one XSLT element whose pattern matches the same nodes with or without a
 * leading `//` at every version. From 2.0 on a pattern opening `//` matches
 * only a node whose tree is rooted at a document node, where `item` also
 * matches in a parentless tree, but `key()` answers over a document alone
 * (#1015).
 * @type {string}
 */
const KEYED = 'key'

/**
 * The pattern that matches the document node itself, which a stylesheet is
 * entered at once however many nodes it goes on to process.
 * @type {string}
 */
const ROOT = '/'

/**
 * What puts a root template back within a caller's reach: a `@name` makes it
 * callable from anywhere, and a `@mode` leaves it reachable only by an
 * `xsl:apply-templates` naming that mode, which runs as often as whatever
 * holds it and over whatever tree it selects (#978).
 * @type {Array.<string>}
 */
const CALLABLE = ['name', 'mode']

/**
 * Whether the declaration is the template a transformation enters once: the
 * element `RANKED` names, with the root for a pattern and nothing `CALLABLE`
 * standing on it. Every attribute answers in its shadow spelling too, which
 * outranks the plain one (#1114), and the pattern is read after the gaps XML
 * keeps and XSLT throws away (#978).
 * @param {Node} declared - The top-level declaration holding the expression
 * @return {boolean} - True when the stylesheet enters it once
 */
const entered = function(declared) {
  return declared.localName === RANKED &&
    !CALLABLE.some(
      (one) => declared.hasAttribute(one) || declared.hasAttribute(`_${one}`),
    ) &&
    normalized(attributeOf(declared, 'match')) === ROOT
}

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
 * Whether the `//` at that token index stands inside a predicate, which is what
 * decides the language it is written in: a predicate holds an expression, and
 * everything the pattern spells outside one is a step of the path it walks.
 * @param {Array.<object>} inner - The predicate nodes the pattern holds
 * @param {number} at - Index of the `//` token
 * @return {boolean} - True when a predicate holds it
 */
const buried = function(inner, at) {
  return inner.some((one) => one.from <= at && at < one.to)
}

/**
 * Whether the `//` at that token index is a step of the pattern's own path, or
 * else opens a path of the expression a predicate holds. A descendant step
 * between brackets answers to no check of ours anywhere else — the
 * `xi//omicron` a `select` carries draws nothing, where the same text under a
 * `@match` drew this one (#948).
 * @param {Array.<object>} inner - The predicate nodes the pattern holds
 * @param {Array.<object>} paths - The path nodes it holds
 * @param {number} at - Index of the `//` token
 * @return {boolean} - True when one of the two carries it
 */
const owned = function(inner, paths, at) {
  let own = true
  if (buried(inner, at)) {
    own = paths.some((one) => one.from === at)
  }
  return own
}

/**
 * The fix that drops a leading `//`: the two characters where they truly stand,
 * never sliced off the front of the value, since on `match=" //spaced"` that
 * would leave `/spaced` and turn an unanchored pattern into an absolute one.
 * A suggestion on an `xsl:template` for the reason `RANKED` carries, and on
 * 2.0+ anywhere but where `KEYED` stands, for the reason it carries (#1015).
 * @param {{node: Node, version: string}} found - The pattern's record
 * @param {{value: string}} token - The `//` token
 * @return {{value: string, replacement: string}} - The fix
 */
const cut = function(found, token) {
  const element = holding(found.node).localName
  let tier = {}
  if (element === RANKED ||
    (element !== KEYED && since(found.version, MODERN))) {
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
      if (buried(inner, at)) {
        entry = {check: SCANNING}
      } else if (heads(branches, at)) {
        entry = {check: LEADING, fix: cut(found, token)}
      }
      results.push({...entry, at: token.start})
    }
  })
  return results
}

/**
 * The element carrying the expression and every ancestor of it below the
 * stylesheet root, nearest first — what stands between an expression and the
 * top-level declaration it belongs to.
 * @param {Node} element - The element carrying the expression
 * @return {Array.<Node>} - It and its ancestors, the root's own child last
 */
const climbed = function(element) {
  const chain = []
  let where = element
  while (where !== null && where !== where.ownerDocument.documentElement) {
    chain.push(where)
    where = where.parentNode
  }
  return chain
}

/**
 * Whether the expression is evaluated once for the whole transformation — a
 * top-level binding, bound against the source root, or the template the
 * stylesheet is entered at. Either way `//item` standing there is a single
 * traversal naming every `item` in the document, which is what hoisting an
 * expression into a global binding is for and what the advice would ask for.
 * @param {{node: Node}} found - The expression, as `expressionsOf` yields it
 * @return {boolean} - True when nothing evaluates it twice
 */
const once = function(found) {
  const chain = climbed(holding(found.node))
  const declared = chain[chain.length - 1]
  return declared !== undefined && declared.namespaceURI === XSLT &&
    (BOUND.includes(declared.localName) || entered(declared)) &&
    !chain.slice(1).some(
      (one) => one.namespaceURI === XSLT && REPEATING.includes(one.localName),
    )
}

/**
 * The `//` steps of an expression that open a path of their own, each one a
 * walk of the document from its root, and no fix behind any of them. Where
 * the slashes stand in the parse decides nothing, a sub-expression scanning
 * the tree the whole of one scans, so what is asked is whether a path starts
 * there rather than descends from something.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {Array.<{check: string, at: number}>} - The scans found
 */
const scanning = function(found) {
  const paths = gathered(found, ['path'])
  const results = []
  if (!once(found)) {
    parseOf(found).tokens.forEach((token, at) => {
      if (token.type === TOKENS.DOUBLE_SLASH &&
        paths.some((one) => one.from === at)) {
        results.push({check: SCANNING, at: token.start})
      }
    })
  }
  return results
}

/**
 * Lint the valid expressions a stylesheet carries for the `//` steps they
 * hold, reporting one that opens a branch of a pattern as redundant, with the
 * fix that drops it, and every other one as broader than its author meant.
 * Every attribute holding a pattern is read (#586), and every expression for
 * the third check, whichever attribute carries it (#958).
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
    let entries = scanning(found)
    if (found.pattern) {
      entries = separators(found)
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
