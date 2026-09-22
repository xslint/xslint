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
 * business. And the one that does open a path there answers to the third check
 * rather than to either of the pair, which is #970's: a predicate holds an
 * expression wherever it stands, so `match="item[//flag]"` walks the document
 * from its root once for every candidate, exactly as the `select` beside it
 * would. It drew the second check's advice to name a specific path, which is
 * about breadth and has nothing to say to a test that names no node of the
 * pattern at all — #432 having rewritten both messages to stop claiming a
 * document scan, rightly for the steps of a path and wrongly for the one
 * construct between brackets that performs one.
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
 * selected `//*`, so it read the `select` of a literal result element as
 * XPath — output data no processor evaluates — and `--fix-suggestions` wrote
 * `.//` into the result tree, a check about expressions changing what a
 * stylesheet emits (#788). It is handed the records the validator kept, which
 * hold no such attribute.
 *
 * What it asks is #958's, and until then it asked about the spelling instead
 * of the cost. It read one attribute, so the `//` of an `xsl:when`'s `test`
 * drew nothing where a `select` beside it drew the warning, though both are
 * evaluated for every node the template is applied to — and so did an
 * `xsl:key`'s `use` and the braces of a literal result element. It read one
 * token, the first solid one of the parse, so the two scans of
 * `distinct-values((//o/@name, //o/@local))` were invisible although each
 * walks the tree the whole of one walks. And it never asked how often the
 * expression runs, so a **top-level** `xsl:variable` or `xsl:param` drew it —
 * the one place the scan is paid once, against the source root, for the whole
 * transformation, where naming a narrower path binds something else, an
 * `xsl:key` answers a lookup by value, and hoisting into a global binding is
 * what the stylesheet already did. Its *content* is bound with it, so `once`
 * climbs rather than reads the carrying element: what a global binding holds
 * is evaluated once as surely as what its `select` says, and only an
 * instruction between the two whose content runs per item breaks that —
 * which is why `REPEATING` is the five of those and not a rule about depth.
 * eo's `restore-aliases.xsl` is the shape, four `xsl:sequence` children of
 * one global binding, and reading the carrying element alone answered two of
 * them and not the other two. That question was 16 of the 147 reports over
 * the three pinned corpora; the other two directions are the `path`
 * nodes the grammar built, a `//` counting where one opens a path of its own
 * and nowhere else, which is the test `owned` already applies one language
 * over. So `items//item` descends from a step, `/objects//o` from an absolute
 * one, `$root//node` from a binding and `.//item` from the context node, and
 * none of the four starts at the root. The name moved with the question:
 * `select-starts-with-double-slash` named an attribute this no longer singles
 * out and a position it no longer asks about.
 *
 * A top-level binding is not the only place the scan is paid once, which is
 * #978's. The template a stylesheet is *entered* at — the root for a pattern,
 * with nothing `CALLABLE` names on it — is applied to the single document
 * node, so its content runs once for a transformation and a `//` standing
 * there walks the tree the one time, with nothing narrower to name and nothing
 * to hoist it into that would not be evaluated as often. That is 28 of the 306
 * reports over the three pinned corpora, 12 in DocBook-XSL and 16 in TEI, none
 * at all in DITA-OT. Four neighbours are none of it and stay reported.
 * `CALLABLE` holds the two that put the template back within a caller's reach:
 * a `@name` makes it callable from anywhere and as often as its callers run,
 * and a `@mode` leaves it reachable only by an `xsl:apply-templates` naming
 * that mode, which runs as often as whatever holds it and over whatever tree
 * it selects — TEI's `odds/extract-isosch.xsl` applying one to a variable's
 * temporary tree rather than to the source at all. A pattern naming anything
 * below the root, the document element included, may be reached more than once
 * the same way; and `REPEATING` holds as it does under a binding, an
 * `xsl:for-each` inside the root template instantiating its content per item.
 * What is left unguarded is an unmoded root template re-entered by a
 * default-mode application of the document node, and the corpora say it is
 * theory: every `apply-templates` selecting one there names a mode, so no
 * withdrawal above rests on it. Each attribute is read in its shadow spelling
 * at every version rather than at 3.0 alone: a template spelling `_match`
 * lower down declares no pattern any processor honours, so what the reach
 * costs there is a report withheld on a file already broken and never one
 * invented against working code. Deeper than that lies the call graph — a
 * template reached from the root template alone is entered once as surely —
 * and those 38 further reports stand, reachability being a question about the
 * whole corpus where this one is answered by climbing from an expression to
 * the declaration above it.
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
const {TOKENS, normalized} = require('../tokens')
const {XSLT} = require('../xsl-version')
const {holding} = require('../tree')
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
 * being an attribute of `xsl:template` alone, so the edit is safe there.
 * @type {string}
 */
const RANKED = 'template'

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
 * standing on it. Every attribute answers in its shadow spelling too, and the
 * pattern is read after the gaps XML keeps and XSLT throws away (#978).
 * @param {Node} declared - The top-level declaration holding the expression
 * @return {boolean} - True when the stylesheet enters it once
 */
const entered = function(declared) {
  return declared.localName === RANKED &&
    !CALLABLE.some(
      (one) => declared.hasAttribute(one) || declared.hasAttribute(`_${one}`),
    ) &&
    [declared.getAttribute('match'), declared.getAttribute('_match')].some(
      (pattern) => pattern !== null && normalized(pattern) === ROOT,
    )
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
