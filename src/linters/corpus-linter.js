/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {chosen, valued} = require('../selectors')
const {NAMED} = require('../tokens')
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
 * Usages against the names they reference, per usage set and template, so the
 * corpus is read once for a template rather than once for a declaration.
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
 * Defects of a check that matches a declaration's name against the usage
 * values by exact identity: the name a `usage` selector yields is the name of
 * a declaration that is used. A named template defined in one file but invoked
 * from another is thus not flagged.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply
 * @return {Array.<object>} - Defects found
 */
const byName = function(corpus, check) {
  const used = new Set(corpus.flatMap(({xsl}) => valued(xsl, check.usage)))
  return corpus.flatMap(({file, xsl}) => chosen(xsl, check.declaration)
    .filter((node) => !used.has(node.getAttribute('name')))
    .map((node) => defect(check, file, node)))
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
 * The whole run of name characters beginning at an offset, which is the name
 * a `$` opens — `$rownum` names `rownum` and no shorter name inside it.
 * @param {string} value - Usage value
 * @param {number} at - Offset the run begins at
 * @return {string} - The run, empty where no name stands there
 */
const ahead = function(value, at) {
  let till = at
  while (till < value.length && NAMED.test(value[till])) {
    till++
  }
  return value.slice(at, till)
}

/**
 * The whole run of name characters ending at an offset, which is the name a
 * `(` closes — `myfoo(` calls `myfoo` and no shorter name inside it.
 * @param {string} value - Usage value
 * @param {number} at - Offset the run ends at
 * @return {string} - The run, empty where no name stands there
 */
const behind = function(value, at) {
  let from = at
  while (from > 0 && NAMED.test(value[from - 1])) {
    from--
  }
  return value.slice(from, at)
}

/**
 * What a check's template anchors its name against: the fixed text a scan
 * finds, and which side of it the name stands on. Read once for a template
 * rather than once per usage value. Exactly one end carries that text, and a
 * template failing it is refused here rather than obeyed — neither end hangs
 * the run on an empty mark, both ends report a live declaration dead (#783).
 * @param {string} reference - The check's template, holding `{name}`
 * @return {{mark: string, precedes: boolean}} - The text and which side it is
 */
const anchoring = function(reference) {
  const stands = reference.indexOf('{name}')
  const opens = reference.slice(0, stands)
  const closes = reference.slice(stands + '{name}'.length)
  if ((opens.length > 0) === (closes.length > 0)) {
    throw new Error(
      `The reference template "${reference}" anchors the name against text ` +
        'at neither end or at both, where exactly one end must carry it',
    )
  }
  let anchor = {mark: closes, precedes: false}
  if (opens.length > 0) {
    anchor = {mark: opens, precedes: true}
  }
  return anchor
}

/**
 * Every name a usage value references under a check's anchor — the names
 * behind each `$` for a variable, the names in front of each `(` for a call.
 * The name is the run of name characters beside the anchor's text, so a
 * reference is to the *whole* name and never to one spelled inside a longer
 * one: `$rownum` is no reference to `$row` (#783).
 * @param {string} value - Usage value
 * @param {{mark: string, precedes: boolean}} anchor - What `anchoring` read
 * @return {Set.<string>} - The names it references
 */
const referencing = function(value, anchor) {
  const names = new Set()
  let at = value.indexOf(anchor.mark)
  while (at !== -1) {
    let name = behind(value, at)
    if (anchor.precedes) {
      name = ahead(value, at + anchor.mark.length)
    }
    if (name.length > 0) {
      names.add(name)
    }
    at = value.indexOf(anchor.mark, at + 1)
  }
  return names
}

/**
 * The usages referencing each name, built once for a usage set and template.
 * A declaration then costs a lookup rather than a scan of every usage: the
 * scan asked its question once per distinct name, which over DocBook-XSL is
 * `unused-variable` alone taking 1207 names against 72,077 attributes — 87
 * million substring tests, and 98% of what this stage spent scanning (#783).
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @param {string} reference - The check's template, holding `{name}`
 * @return {Map.<string, Array.<Node>>} - Usages against the names they hold
 */
const indexed = function(usages, reference) {
  if (!INDEXED.has(usages)) {
    INDEXED.set(usages, new Map())
  }
  const held = INDEXED.get(usages)
  if (!held.has(reference)) {
    const anchor = anchoring(reference)
    const index = new Map()
    for (const usage of usages) {
      for (const name of referencing(usage.value, anchor)) {
        if (!index.has(name)) {
          index.set(name, [])
        }
        index.get(name).push(usage)
      }
    }
    held.set(reference, index)
  }
  return held.get(reference)
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
 * @param {object} check - The check to apply, carrying a `reference` template
 * @param {Node} declaration - Declaring node
 * @return {Array.<Node>} - The usages referencing it
 */
const mentioning = function(usages, check, declaration) {
  return indexed(usages, check.reference)
    .get(declaration.getAttribute('name')) ?? []
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
 * another declaration that is itself used. Mutually recursive functions that
 * nothing else calls are reached by neither, so both stay unreachable.
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
 * called only from within a recursion cycle (self or mutual) that nothing
 * enters, so it never runs. A function nothing references at all is left to
 * the by-call check, not double-reported here.
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
 * all, a function unreachable when called only from within a dead recursion
 * cycle, and a variable by an in-scope reference.
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
 * function trapped in a dead recursion cycle, or by in-scope reference for a
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
  anchoring,
  lintByCorpus,
  names,
}
