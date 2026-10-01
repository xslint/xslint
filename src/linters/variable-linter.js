/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `undefined-variable`, the first of #208's name-resolution tier: a `$name`
 * no binding in scope declares, which a processor refuses with XPST0008
 * before it transforms anything. What is in scope is read off the tree the
 * reference stands in, and behind it the globals of the stylesheet. Those are
 * known only for a whole one, so a module is judged against each tree an entry
 * point makes, and a library no such tree holds is left alone, its globals
 * being its importer's. Over the three corpora that leaves the 16 reports
 * Saxon-HE 12.9 raises as XPST0008, where judging every module drew 96. The
 * trees are walked once per entry point over an adjacency built once.
 */

const {expressionsOf} = require('../attributes')
const {expandedOf, attributeOf, nameOf} = require('../expressions')
const {gathered, isValid, parseOf, variableOf, offsetOf} = require('../syntax')
const {importsOf} = require('../import-graph')
const {entered} = require('../roots')
const {holding, named} = require('../tree')
const {metaOf, suppressed, defect} = require('../checks')
const {TOKENS, TRIVIA} = require('../tokens')
const {XSLT} = require('../xsl-version')
const {logger} = require('../logger')
const path = require('path')

/**
 * Name of the check this linter owns.
 * @type {string}
 */
const CHECK = 'undefined-variable'

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = [CHECK]

/**
 * Defect metadata of the check.
 * @type {{severity: string, message: string}}
 */
const META = metaOf(CHECK)

/**
 * The XSLT elements binding a name, by local name.
 * @type {Array.<string>}
 */
const BINDINGS = ['variable', 'param']

/**
 * The XSLT elements a stylesheet module is rooted at, whose children are its
 * top level.
 * @type {Array.<string>}
 */
const ROOTS = ['stylesheet', 'transform', 'package']

/**
 * The XSLT elements whose binding children are globals: the top level, and an
 * `xsl:override` replacing a used package's own.
 * @type {Array.<string>}
 */
const GLOBAL = ROOTS.concat(['override'])

/**
 * The XSLT elements pulling in another module.
 * @type {Array.<string>}
 */
const PULLS = ['import', 'include']

/**
 * The names an `xsl:catch` binds for what it caught, in the namespace of
 * XPath's errors, XSLT 3.0 §8.3 naming them.
 * @type {Array.<string>}
 */
const CAUGHT = ['code', 'description', 'value', 'module', 'line-number',
  'column-number', 'additional', 'map']
  .map((local) => `Q{http://www.w3.org/2005/xqt-errors}${local}`)

/**
 * The name an `xsl:accumulator-rule` binds for the accumulator's value.
 * @type {string}
 */
const VALUE = 'Q{}value'

/**
 * Whether the node is an XSLT element of one of the local names.
 * @param {?Node} node - The node to weigh
 * @param {Array.<string>} locals - The local names
 * @return {boolean} - True when it is one of them
 */
const xslt = function(node, locals) {
  return node?.nodeType === 1 && node.namespaceURI === XSLT &&
    locals.includes(node.localName)
}

/**
 * Every `xsl:variable` and `xsl:param` a document holds, off the walk the
 * run has already taken.
 * @param {Document} xsl - Parsed stylesheet
 * @return {Array.<Element>} - The binding elements
 */
const bindingsOf = function(xsl) {
  const buckets = named(xsl).buckets
  return BINDINGS.flatMap((local) => buckets.get(`${XSLT} ${local}`) ?? [])
}

/**
 * Whether a module may draw on one nobody handed over past what its hrefs
 * name: it pulls in one only a processor works out, or it uses a package.
 * @param {Document} xsl - Parsed stylesheet
 * @return {boolean} - True when a global may come from outside the corpus
 */
const leaks = function(xsl) {
  const buckets = named(xsl).buckets
  const pulls = PULLS.flatMap((local) => buckets.get(`${XSLT} ${local}`) ?? [])
  return (buckets.get(`${XSLT} use-package`) ?? []).length > 0 ||
    pulls.some((element) => attributeOf(element, 'href') === '')
}

/**
 * The files a module reaches through `xsl:import` and `xsl:include`, itself
 * among them, over an adjacency built once for the corpus.
 * @param {string} file - Where the walk starts
 * @param {Map.<string, Array.<string>>} next - What each file pulls in
 * @return {Set.<string>} - The files of its tree
 */
const reaching = function(file, next) {
  const seen = new Set([file])
  const queue = [file]
  while (queue.length > 0) {
    for (const one of next.get(queue.shift()) ?? []) {
      if (!seen.has(one)) {
        seen.add(one)
        queue.push(one)
      }
    }
  }
  return seen
}

/**
 * The tree a module is the entry point of, which is everything it reaches,
 * or nothing where it is none: something in the corpus pulls it in, or no
 * template of it matches the root or names the initial one.
 * @param {string} file - The module's normalized path
 * @param {Document} xsl - Parsed stylesheet
 * @param {Set.<string>} imported - The files something pulls in
 * @param {Map.<string, Array.<string>>} next - What each file pulls in
 * @return {Array.<string>} - The files of its tree
 */
const entryOf = function(file, xsl, imported, next) {
  let tree = []
  if (!imported.has(file) && entered(xsl)) {
    tree = Array.from(reaching(file, next))
  }
  return tree
}

/**
 * The globals of every tree holding each module, a tree being what a
 * transformation starts at, a module nothing in the corpus pulls in whose
 * templates match the root or name the initial one, with all it reaches. A
 * tree leaking past the corpus judges nothing, its globals being unknown, so
 * a module no whole tree holds is judged by none.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @return {Map.<string, Array.<Set.<string>>>} - Each file's trees' globals
 */
const treesOf = function(corpus) {
  const held = new Set(corpus.map(({file}) => path.normalize(file)))
  const imports = importsOf(corpus)
  const next = new Map()
  const leaky = new Set()
  for (const edge of imports) {
    if (held.has(edge.to)) {
      next.set(edge.file, (next.get(edge.file) ?? []).concat([edge.to]))
    } else {
      leaky.add(edge.file)
    }
  }
  const imported = new Set(Array.from(next.values()).flat())
  const declared = new Map()
  for (const {file, xsl} of corpus) {
    const own = path.normalize(file)
    if (leaks(xsl)) {
      leaky.add(own)
    }
    declared.set(own, bindingsOf(xsl)
      .filter((element) => xslt(element.parentNode, GLOBAL))
      .map((element) => nameOf(element, 'name')))
  }
  const trees = new Map()
  for (const {file, xsl} of corpus) {
    const own = path.normalize(file)
    const tree = entryOf(own, xsl, imported, next)
    if (!tree.some((one) => leaky.has(one))) {
      const known = new Set(tree.flatMap((one) => declared.get(one)))
      for (const one of tree) {
        trees.set(one, (trees.get(one) ?? []).concat([known]))
      }
    }
  }
  return trees
}

/**
 * The names the XSLT tree binds at the node a reference stands in: the
 * bindings in front of it and of each ancestor below the top level, which is
 * where a local variable reaches, and what an `xsl:accumulator-rule` or an
 * `xsl:catch` above it binds of its own accord. A text value template stands
 * in its own text node, so a binding beside that node is in front of it.
 * @param {Node} start - The text node or element holding the reference
 * @return {Set.<string>} - The expanded names in scope, globals aside
 */
const localsOf = function(start) {
  const taken = new Set()
  let node = start
  while (node.parentNode?.nodeType === 1 && !xslt(node.parentNode, ROOTS)) {
    let sibling = node.previousSibling
    while (sibling !== null) {
      if (xslt(sibling, BINDINGS)) {
        taken.add(nameOf(sibling, 'name'))
      }
      sibling = sibling.previousSibling
    }
    if (xslt(node, ['accumulator-rule'])) {
      taken.add(VALUE)
    }
    if (xslt(node, ['catch'])) {
      CAUGHT.forEach((name) => taken.add(name))
    }
    node = node.parentNode
  }
  return taken
}

/**
 * The name standing behind the `$` at a token index, joined the way
 * `variableOf` joins one: a braced URI and the local name behind it, or a
 * lexical QName alone.
 * @param {Array.<{type: string, value: string}>} tokens - The tokens
 * @param {number} at - The index of the `$`
 * @return {string} - The name as written
 */
const spelledAt = function(tokens, at) {
  const rest = tokens.slice(at + 1).filter(
    (token) => !TRIVIA.includes(token.type),
  )
  let name = rest[0].value
  if (rest[0].type === TOKENS.URI) {
    name = `${rest[0].value}${rest[1].value}`
  }
  return name
}

/**
 * The names an expression binds itself, in a `for`, `let`, `some` or `every`
 * clause or as a parameter of an inline function, whose signature holds no
 * `$` but its parameters'. Any of them anywhere in the expression counts, a
 * wider reach than XPath's own and so never a report on a name it binds.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<string>} - The names as written
 */
const ownOf = function(found) {
  const tokens = parseOf(found).tokens
  const clauses = gathered(found, ['binding']).map(
    (node) => spelledAt(tokens, node.from),
  )
  const params = gathered(found, ['inline']).flatMap((node) => {
    const taken = []
    for (let at = node.from; tokens[at].type !== TOKENS.LBRACE; at++) {
      if (tokens[at].type === TOKENS.DOLLAR) {
        taken.push(spelledAt(tokens, at))
      }
    }
    return taken
  })
  return clauses.concat(params)
}

/**
 * Whether a name as written resolves to an expanded one at the element: a
 * prefix bound nowhere is XPST0081 rather than this check's fault, and a
 * report here would name the wrong one.
 * @param {Element} element - The element holding the reference
 * @param {string} written - The name as written
 * @return {boolean} - True when its prefix, if any, is bound there
 */
const resolvable = function(element, written) {
  const colon = written.indexOf(':')
  return written.startsWith('Q{') || colon < 0 ||
    element.lookupNamespaceURI(written.slice(0, colon)) !== null
}

/**
 * The references an expression makes that no binding in scope declares, in
 * some whole tree holding it.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {Array.<Set.<string>>} known - The globals of each tree holding it
 * @return {Array.<{found: object, at: number}>} - Where each one stands
 */
const undefinedIn = function(found, known) {
  const element = holding(found.node)
  const references = gathered(found, ['variable'])
  let loose = []
  if (references.length > 0) {
    const own = ownOf(found).map((one) => expandedOf(element, one))
    const locals = localsOf(found.node.ownerElement ?? found.node)
    loose = references.filter((reference) => {
      const written = variableOf(found, reference)
      const name = expandedOf(element, written)
      return resolvable(element, written) && !own.includes(name) &&
        !locals.has(name) && known.some((tree) => !tree.has(name))
    })
  }
  return loose.map((reference) => ({found, at: offsetOf(found, reference)}))
}

/**
 * Lint the corpus for a variable reference no binding in scope declares.
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByVariable = function(corpus, suppressions = []) {
  logger.debug(`Variable linting started`)
  let defects = []
  if (!suppressed(CHECK, suppressions)) {
    const trees = treesOf(corpus)
    defects = corpus.flatMap((source) => {
      const known = trees.get(path.normalize(source.file)) ?? []
      return expressionsOf(source.xsl)
        .filter((found) => known.length > 0 && isValid(found))
        .flatMap((found) => undefinedIn(found, known))
        .map(({found, at}) => defect(CHECK, META, source, found, at))
    })
  }
  logger.debug(`Found ${defects.length} undefined variable defects`)
  return defects
}

module.exports = {
  lintByVariable,
  names,
}
