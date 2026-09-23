/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Loads `checks/corpus/*.yaml`; cross-file rules. A cross-file check asks
 * one question of every declaration against every usage, so both sides
 * grow with the project and the work is their product; three things made
 * that product far dearer than it is. A usage selector is now evaluated
 * once for each corpus and xpath (`across`) rather than once for each
 * check naming it — three of the four checks give `//@*`, and choosing
 * every attribute of DocBook-XSL's 291 stylesheets costs 1.7 seconds, so
 * the run spent five answering one question three times over. A reference
 * string was built once for each declaration rather than once per pair,
 * and the usages holding it scanned once for each *distinct* reference,
 * DocBook-XSL declaring 3436 variables under 1207 names; and the cheap
 * test led, `within` climbing to the document root for every pair it
 * rejects where one `includes` rejects almost every pair. Together those
 * took the four checks from 35.0 to 10.2 seconds over that corpus and the
 * whole run from 40.2 to 29.8 (#755). What they left standing was the
 * product itself, the scan still being every distinct name against every
 * usage — 1207 against 72,077 attributes, 87 million substring tests, and
 * 98% of what the stage spent, `unused-variable` alone accounting for
 * 13.58 of its 13.81 seconds of scanning. The index is what retires it
 * (#783). `referencing` reads each usage value once for a template and
 * yields the names it *references*; `indexed` maps each name to the usages
 * holding it, once for a usage set and template; and a declaration is a
 * `Map.get` rather than a scan. `corpus-linter` falls from 8.52 to 2.20
 * seconds over DocBook-XSL, 6.26 to 1.21 over TEI and 1.37 to 0.56 over
 * DITA-OT, taking the staged run from 17.54 to 11.13, 14.33 to 9.34 and
 * 4.48 to 3.62, and the stage from half the run to a fifth of it. Speed is
 * the smaller half. A substring is not a reference: `includes('$row')` is
 * answered by `$rownum`, which is #776's defect on the other side of the
 * same product, so the fix and the speed-up are one edit and the report is
 * not byte-identical — four declarations that were silenced by a longer
 * name holding their characters are reported, `$page` behind `$pageid` and
 * `$target` behind `$targets` in DocBook-XSL, `$v` behind `$values` and
 * `$Heading` behind `$Heading1` in TEI, with none removed. Text is what
 * #783 read a name off, though, and text is the half that stayed wrong: it
 * found a fixed mark and took the run of characters `NAMED` in
 * `src/tokens.js` spells a name with beside it, so what stood between the
 * two was invisible. XPath lets a gap stand in front of the bracket a call
 * opens — the gap **Selector hygiene** calls part of a call, #621 being
 * the ticket where one of our own selectors spent it — so `my:spaced (1)`
 * called nothing this linter could see; a named function reference carries
 * no bracket at all, so `my:pick#1` called nothing either; and a mark
 * inside a string literal or a comment is a name no processor evaluates,
 * so `concat('$quoted', 'x')` and `1 (: $commented :)` each kept a
 * declaration alive that nothing uses. Two of those invent a defect
 * against working code and two withhold one (#498). So a reference is read
 * off the **tokens**, and one lexing answers all four: a literal, an
 * unclosed literal and a comment are one token apiece and hold no name to
 * find, a gap is `TRIVIA` and read over, and the `#` stands where the
 * bracket does. Which question is asked of a token first is part of the
 * reading: `$pick(41)` is XPath 3.1's dynamic call, a call on the
 * *variable*, so a name a `$` stands in front of is a variable however
 * tight the bracket behind it is. Asking the bracket first answered one
 * token two ways at once — the variable it uses reported dead, and a
 * function of that name marked used — so the `$` is asked before the
 * bracket, and asked of both spellings, `$my:pick(` lexing as one
 * `user_function` token where `$pick(` lexes as a name. A check names a
 * **kind** of reference rather than a template — `call` or `variable`,
 * what `REFERENCES` holds — and one this linter cannot read is refused by
 * `kinded` where the template's shape used to be, since an index built for
 * it holds no name at all and would report every declaration in the corpus
 * dead. `test/conformance.test.js` holds every check's `reference` to that
 * list, so the refusal stands in front of a check nobody has written yet.
 * The kinds cost one pass between them: `collected` builds every one of
 * them out of a single lexing of the usage set, a pass per kind lexing
 * DocBook-XSL's 72,077 attributes twice over, and a value holding none of
 * `$`, `(` or `#` is never lexed at all, most of an attribute set being no
 * expression. A value holding a brace is lexed twice, though, once whole
 * and once for each expression its braces enclose: an attribute the usage
 * selector chooses may be an XPath expression or an attribute value
 * template, and `//@*` cannot tell which. The two readings differ exactly
 * where a brace stands inside a string literal, which is where reading the
 * whole value as one expression loses a reference — DocBook-XSL's
 * `text="{$text} see '{$see}'"`, TEI's
 * `context="tei:param[parent::tei:model/@behaviour='{$B}']"` and DITA-OT's
 * `src="url('{concat($artworkPrefix, $image)}')"` each name a variable a
 * processor evaluates and the tokens of the value do not. So the names of
 * both readings are unioned, since a reading too wide withholds a report
 * where one too narrow invents one against working code (#498). What #783
 * left standing was the traversal itself, this being the one stage that
 * reached the engine directly: three of its four checks give `//@*` and
 * the fourth `//xsl:call-template/@name`, and neither is an axis a bucket
 * of elements can hold. It goes through `chosen` in
 * `src/selectors.js` since #811, which serves both of those and its three
 * element declarations besides, so the stage falls from 2.26 s to 0.11 s
 * over DocBook-XSL, 1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT —
 * a tenth to a twentieth of what it cost, taking the staged run down 25%,
 * 17% and 11% with the report byte-identical on all three. Half a run was
 * this stage over DocBook-XSL when #755 was filed and it is 1.5% to 2.3%
 * of one now, which is why its entry in `SHARES` is gone rather than re-
 * derived.
 */

const {chosen} = require('../selectors')
const {enclosed, staticOf} = require('../expressions')
const {TOKENS, TRIVIA, tokenized} = require('../tokens')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Corpus checks: the name suppressions match against, plus the
 * declaration/usage selectors and defect metadata.
 * @type {Array.<{name: string, declaration: string, usage: string,
 *  severity: string, message: string}>}
 */
const CHECKS = Object.entries(kinds.corpus).map(([name, check]) => ({
  name, ...check,
}))

/**
 * Nodes each xpath selects, per corpus, so several checks naming one selector
 * pay for it once. Weakly held, so a corpus is collected with its answers.
 * @type {WeakMap.<Array, Map.<string, Array.<Node>>>}
 */
const SELECTED = new WeakMap()

/**
 * Usages against the names they reference, by kind and per usage set, so the
 * corpus is lexed once rather than once for a declaration or for a kind.
 * @type {WeakMap.<Array, Map.<string, Map.<string, Array.<Node>>>>}
 */
const INDEXED = new WeakMap()

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = CHECKS.map((check) => check.name)

/**
 * Whether the attribute sits inside the declaration's own subtree, so a
 * function that only calls itself does not count as used.
 * @param {Node} declaration - Declaring node
 * @param {Node} attribute - Usage attribute
 * @return {boolean} - True when the attribute is within the declaration
 */
const within = function(declaration, attribute) {
  let node = attribute.ownerElement
  while (node && node !== declaration) {
    node = node.parentNode
  }
  return node === declaration
}

/**
 * Usages against the name each one calls by exact identity, per usage set, for
 * a check reading names rather than a kind of reference: the attribute value
 * of an `xsl:call-template`, read statically where it is a shadow (#1009).
 * @type {WeakMap.<Array, Map.<string, Array.<Node>>>}
 */
const IDENTIFIED = new WeakMap()

/**
 * The usages naming each name by exact identity, built once for a usage set.
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @return {Map.<string, Array.<Node>>} - Usages against the names they hold
 */
const identified = function(usages) {
  if (!IDENTIFIED.has(usages)) {
    const index = new Map()
    for (const usage of usages) {
      const name = staticOf(usage.value)
      if (!index.has(name)) {
        index.set(name, [])
      }
      index.get(name).push(usage)
    }
    IDENTIFIED.set(usages, index)
  }
  return IDENTIFIED.get(usages)
}

/**
 * Defects of a check matching a declaration's name against the usage values by
 * exact identity, followed through the call graph: a named template called only
 * from its own body, or from templates nothing reaches, never runs (#1009). A
 * shadow usage no static reading places may name any declaration there is, so
 * it silences the check rather than calling every one of them dead (#851).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply
 * @return {Array.<object>} - Defects found
 */
const byName = function(corpus, check) {
  const usages = across(corpus, check.usage)
  let defects = []
  if (!identified(usages).has('')) {
    const declarations = corpus.flatMap(({file, xsl}) =>
      chosen(xsl, check.declaration).map((node) => ({file, node})))
    const used = reachable(check, declarations, usages)
    defects = declarations
      .filter(({node}) => !used.has(node))
      .map(({file, node}) => defect(check, file, node))
  }
  return defects
}

/**
 * Whether the usage is in scope for the declaration. A `scoped` declaration —
 * a variable — is visible only within its parent's subtree, except a top-level
 * one, which an importing stylesheet in another file can also see. An unscoped
 * declaration — a function — is global, so every usage is in scope.
 * @param {object} check - The check to apply
 * @param {Node} declaration - Declaring node
 * @param {Node} usage - Usage attribute
 * @return {boolean} - True when the usage can see the declaration
 */
const inScope = function(check, declaration, usage) {
  return !check.scoped ||
    within(declaration.parentNode, usage) ||
    (declaration.parentNode === declaration.ownerDocument.documentElement &&
      usage.ownerElement.ownerDocument !== declaration.ownerDocument)
}

/**
 * The kinds of reference a check may name in its `reference`, which is what
 * `referencing` reads off the tokens: a `call` is a name a bracket or a `#`
 * stands behind, a `variable` one a `$` stands in front of.
 * @type {Array.<string>}
 */
const REFERENCES = ['call', 'variable']

/**
 * The kinds a name is lexed as, called or carried by a `$` alike — a prefixed
 * name tight against its bracket is one token of its own, and every other
 * spelling is a plain name.
 * @type {Array.<string>}
 */
const NAMES = [TOKENS.NAME, TOKENS.USER_FUNCTION]

/**
 * What may stand behind a called name: the bracket a call opens with, or the
 * `#` of the named function reference XSLT 3.0 writes instead.
 * @type {Array.<string>}
 */
const OPENS = [TOKENS.LPAREN, TOKENS.HASH]

/**
 * The characters a reference of any kind is spelled with, so a value holding
 * none of them is never lexed — most of an attribute set holds no expression.
 * @type {Array.<string>}
 */
const MARKS = ['$', '(', '#']

/**
 * The kind of reference a check names, refused here rather than obeyed where
 * this linter reads no such kind: an index built for a word no scan answers
 * holds no name at all, so every declaration in the corpus is reported dead.
 * `test/conformance.test.js` holds every check's `reference` to that list, so
 * this stands in front of a check nobody has written yet (#498).
 * @param {string} reference - What the check's `reference` names
 * @return {string} - The kind, where this linter reads one
 */
const kinded = function(reference) {
  if (!REFERENCES.includes(reference)) {
    throw new Error(
      `The reference kind "${reference}" is none of ` +
        `${REFERENCES.join(', ')}, so nothing would be read as a reference ` +
        'and every declaration would be reported as dead',
    )
  }
  return reference
}

/**
 * The expressions a usage value holds: the value itself, and every expression
 * its braces enclose where it holds one. An attribute the usage selector
 * chooses may be an XPath expression or an attribute value template, and a
 * selector giving `//@*` cannot tell which, so both readings are taken (#498).
 * @param {string} value - Usage value
 * @return {Array.<string>} - The expressions to read names off
 */
const readings = function(value) {
  let found = [value]
  if (value.includes('{')) {
    found = found.concat(enclosed(value).map((brace) => brace.value))
  }
  return found
}

/**
 * Every name a usage value references, by the kind of reference it is: a name
 * a `$` stands in front of is a variable, one a bracket or a `#` stands behind
 * is a call, and the `$` is asked first. Read off the tokens and never off the
 * text, so a gap inside a call is read over and a name inside a string literal
 * or a comment is no reference at all, those being one token apiece (#498).
 * @param {string} value - Usage value
 * @return {Map.<string, Set.<string>>} - The names it references, by kind
 */
const referencing = function(value) {
  const names = new Map(REFERENCES.map((kind) => [kind, new Set()]))
  for (const reading of readings(value)) {
    const tokens = tokenized(reading)
      .filter(({type}) => !TRIVIA.includes(type))
    tokens.forEach((token, at) => {
      if (NAMES.includes(token.type) && at > 0 &&
        tokens[at - 1].type === TOKENS.DOLLAR) {
        names.get('variable').add(token.value)
      } else if (NAMES.includes(token.type) && at + 1 < tokens.length &&
        OPENS.includes(tokens[at + 1].type)) {
        names.get('call').add(token.value)
      }
    })
  }
  return names
}

/**
 * Every kind's index out of one lexing of the usage set, the memo below being
 * per usage set: a pass for each kind would lex DocBook-XSL's 72,077
 * attributes twice over, and a value holding none of the characters a
 * reference is spelled with is never lexed at all (#498).
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @return {Map.<string, Map.<string, Array.<Node>>>} - Usages by kind and name
 */
const collected = function(usages) {
  const index = new Map(REFERENCES.map((kind) => [kind, new Map()]))
  for (const usage of usages) {
    if (MARKS.some((mark) => usage.value.includes(mark))) {
      for (const [kind, mentioned] of referencing(usage.value)) {
        const held = index.get(kind)
        for (const name of mentioned) {
          if (!held.has(name)) {
            held.set(name, [])
          }
          held.get(name).push(usage)
        }
      }
    }
  }
  return index
}

/**
 * The usages referencing each name, by kind, built once for a usage set. A
 * declaration then costs a lookup rather than a scan of every usage: the scan
 * asked its question once per distinct name, which over DocBook-XSL is
 * `unused-variable` alone taking 1207 names against 72,077 attributes — 87
 * million substring tests, and 98% of what this stage spent scanning (#783).
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @param {string} kind - Which kind of reference to look a name up under
 * @return {Map.<string, Array.<Node>>} - Usages against the names they hold
 */
const indexed = function(usages, kind) {
  if (!INDEXED.has(usages)) {
    INDEXED.set(usages, collected(usages))
  }
  return INDEXED.get(usages).get(kind)
}

/**
 * Nodes an xpath selects across the whole corpus, chosen once for each corpus
 * and xpath rather than once for each check that names it. Three of the four
 * cross-file checks give `//@*` as their usage, and choosing every attribute of
 * DocBook-XSL's 291 stylesheets costs 1.7 seconds, so asking per check spent
 * five of them answering one question three times over (#755).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {string} xpath - The selector to apply
 * @return {Array.<Node>} - The nodes it selects
 */
const across = function(corpus, xpath) {
  if (!SELECTED.has(corpus)) {
    SELECTED.set(corpus, new Map())
  }
  const remembered = SELECTED.get(corpus)
  if (!remembered.has(xpath)) {
    remembered.set(xpath, corpus.flatMap(({xsl}) => chosen(xsl, xpath)))
  }
  return remembered.get(xpath)
}

/**
 * The usages referencing a declaration, looked up rather than scanned for.
 * Asking it is still how a caller asks the cheap question first: `within`
 * climbs to the document root for every pair it rejects, and almost every pair
 * is rejected, so a structural test placed ahead of this one spent a full
 * ancestor walk to learn what the index already says (#755).
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @param {object} check - The check to apply, carrying a `reference` kind
 * @param {Node} declaration - Declaring node
 * @return {Array.<Node>} - The usages referencing it
 */
const mentioning = function(usages, check, declaration) {
  let index
  if (check.reference === undefined) {
    index = identified(usages)
  } else {
    index = indexed(usages, kinded(check.reference))
  }
  return index.get(declaration.getAttribute('name')) ?? []
}

/**
 * The innermost declaration whose subtree holds the usage, or null when the
 * usage sits outside every declaration — a call from a template is such a
 * root, a call from another function's body is not.
 * @param {Set.<Node>} declarations - The declaring nodes
 * @param {Node} usage - Usage attribute
 * @return {?Node} - Enclosing declaration, or null
 */
const enclosing = function(declarations, usage) {
  let node = usage.ownerElement
  while (node && !declarations.has(node)) {
    node = node.parentNode
  }
  return node
}

/**
 * The declarations reached from a root reference — one outside every
 * declaration's body — by following the call graph: a declaration is used
 * when an in-scope reference to it sits outside all declarations, or inside
 * another declaration that is itself used, so callers never reached, unused
 * or a cycle nothing enters, reach nothing.
 * @param {object} check - The check to apply, carrying a `reference` template
 * @param {Array.<{file: string, node: Node}>} declarations - Declaring nodes
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @return {Set.<Node>} - The used declarations
 */
const reachable = function(check, declarations, usages) {
  const subtrees = new Set(declarations.map(({node}) => node))
  const references = declarations.map(({node}) => ({
    node,
    hosts: mentioning(usages, check, node)
      .filter((usage) =>
        !within(node, usage) && inScope(check, node, usage))
      .map((usage) => enclosing(subtrees, usage)),
  }))
  const used = new Set()
  let growing = true
  while (growing) {
    growing = false
    references
      .filter((reference) => !used.has(reference.node))
      .filter((reference) =>
        reference.hosts.some((host) => host === null || used.has(host)))
      .forEach((reference) => {
        used.add(reference.node)
        growing = true
      })
  }
  return used
}

/**
 * Defects of a check that flags a declaration whose reference string appears
 * in no usage value anywhere in the corpus — a stylesheet function nothing
 * calls (`name(`), counting its own body too, so a function that only calls
 * itself is referenced and left to the reachability check instead.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byCall = function(corpus, check) {
  const usages = across(corpus, check.usage)
  return corpus.flatMap(({file, xsl}) => chosen(xsl, check.declaration)
    .filter((node) => mentioning(usages, check, node).length === 0)
    .map((node) => defect(check, file, node)))
}

/**
 * Defects of a scoped check that flags a declaration referenced by no in-scope
 * usage — a variable read by `$name` from nowhere its scope reaches. Its own
 * subtree is excluded, so a self-reference is not use.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byScope = function(corpus, check) {
  const usages = across(corpus, check.usage)
  return corpus.flatMap(({file, xsl}) => chosen(xsl, check.declaration)
    .filter((node) => !mentioning(usages, check, node).some((usage) =>
      !within(node, usage) && inScope(check, node, usage)))
    .map((node) => defect(check, file, node)))
}

/**
 * Defects of a reachability check that flags a declaration referenced
 * somewhere yet reached by no call from outside a function body — a function
 * called only from functions that are themselves never reached, so it never
 * runs. A function nothing references at all is left to the by-call check,
 * not double-reported here.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byReachability = function(corpus, check) {
  const usages = across(corpus, check.usage)
  const declarations = corpus.flatMap(({file, xsl}) =>
    chosen(xsl, check.declaration).map((node) => ({file, node})))
  const used = reachable(check, declarations, usages)
  return declarations
    .filter(({node}) => !used.has(node))
    .filter(({node}) => mentioning(usages, check, node).length > 0)
    .map(({file, node}) => defect(check, file, node))
}

/**
 * Defects of one check, dispatched by how it defines use: a named template by
 * the exact identity of a called name, a function by whether it is called at
 * all, a function unreachable when called only from functions never reached,
 * and a variable by an in-scope reference.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply
 * @return {Array.<object>} - Defects found
 */
const defectsOf = function(corpus, check) {
  let strategy = byCall
  if (!check.reference) {
    strategy = byName
  } else if (check.reachable) {
    strategy = byReachability
  } else if (check.scoped) {
    strategy = byScope
  }
  return strategy(corpus, check)
}

/**
 * A defect for the declaring node.
 * @param {object} check - The check that fired
 * @param {string} file - File the node belongs to
 * @param {Node} node - Declaring node
 * @return {object} - Defect
 */
const defect = function(check, file, node) {
  return {
    name: check.name,
    severity: check.severity,
    message: check.message,
    file: file,
    line: node.lineNumber,
    pos: node.columnNumber,
  }
}

/**
 * Lint the whole corpus of stylesheets by cross-file checks. A declaration is
 * a defect only when it is used by no stylesheet in the corpus — matched by
 * name for a named template, by call for a function, by reachability for a
 * function called only from dead callers, or by in-scope reference for a
 * variable — so one defined in one file but used from another is not flagged.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByCorpus = function(corpus, suppressions = []) {
  logger.debug(`Corpus linting started`)
  const defects = CHECKS
    .filter((check) => !suppressions.some((sup) => check.name.includes(sup)))
    .flatMap((check) => defectsOf(corpus, check))
  logger.debug(`Found ${defects.length} corpus defects`)
  return defects
}

module.exports = {
  REFERENCES,
  kinded,
  lintByCorpus,
  names,
}
