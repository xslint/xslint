/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {nodes, strings} = require('./xpath')
const {kinds} = require('./resources/checks.json')
const {logger} = require('./logger')

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
  const used = new Set(corpus.flatMap(({xsl}) => strings(xsl, check.usage)))
  return corpus.flatMap(({file, xsl}) => nodes(xsl, check.declaration)
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
 * The reference string that stands for a declaration in an expression —
 * `name(` for a function, `$name` for a variable.
 * @param {object} check - The check to apply, carrying a `reference` template
 * @param {Node} declaration - Declaring node
 * @return {string} - Substring a referencing usage value contains
 */
const needle = function(check, declaration) {
  return check.reference.replaceAll('{name}', declaration.getAttribute('name'))
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
    hosts: usages
      .filter((usage) =>
        !within(node, usage) &&
        usage.value.includes(needle(check, node)) &&
        inScope(check, node, usage))
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
  const usages = corpus.flatMap(({xsl}) => nodes(xsl, check.usage))
  return corpus.flatMap(({file, xsl}) => nodes(xsl, check.declaration)
    .filter((node) =>
      usages.every((usage) => !usage.value.includes(needle(check, node))))
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
  const usages = corpus.flatMap(({xsl}) => nodes(xsl, check.usage))
  return corpus.flatMap(({file, xsl}) => nodes(xsl, check.declaration)
    .filter((node) => !usages.some((usage) =>
      !within(node, usage) &&
      usage.value.includes(needle(check, node)) &&
      inScope(check, node, usage)))
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
  const usages = corpus.flatMap(({xsl}) => nodes(xsl, check.usage))
  const declarations = corpus.flatMap(({file, xsl}) =>
    nodes(xsl, check.declaration).map((node) => ({file, node})))
  const used = reachable(check, declarations, usages)
  return declarations
    .filter(({node}) => !used.has(node))
    .filter(({node}) =>
      usages.some((usage) => usage.value.includes(needle(check, node))))
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
  lintByCorpus,
  names,
}
