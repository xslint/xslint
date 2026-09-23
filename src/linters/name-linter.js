/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `name-compared-to-string` read what a comparison held and never where it
 * stood, and a node test is a question about what stands in the context. The
 * `self` axis's principal node kind is element, so a name test under it is
 * false for every attribute and every namespace node: `@*[name() != 'as']`
 * drew the advice to write `@*[not(self::as)]`, a predicate that excludes
 * nothing at all. Saxon 12.9 keeps every attribute through the second where
 * the first drops the one it names, so the rewrite copied into the result the
 * very attribute the stylesheet meant to leave out — and it is a suggestion an
 * editor offers in one click. Sixty-two of them stood over the three corpora,
 * `@*[name(.) = 'xml:id']` and `namespace::*[name() = '']` among them (#930).
 *
 * The axis is half of that question and the node test is the other half, which
 * asking the axis alone got wrong the other way about. A
 * `processing-instruction()` stands on the child axis, whose principal node
 * kind is element, and selects no element at all, so the
 * `processing-instruction()[name() = 'ditaot']` of a real stylesheet drew
 * `self::ditaot` — a predicate xsltproc answers for nothing where the
 * comparison answers for the one instruction, the `name()` of a processing
 * instruction being its target. Twenty-three of those stood over the corpora,
 * thirteen in TEI and ten in DITA-OT. A `comment()` and a `text()` have no name
 * for either spelling to read, and a `node()` reaches an instruction beside the
 * elements, so the two part there as well — fourteen in DocBook-XSL,
 * `node()[not(local-name() = 'title')]` among them. Two kind tests select an
 * element and nothing else, `element()` and `schema-element()`, and the report
 * stands under those.
 *
 * A step is not the only thing a predicate can hang off, either. Brackets take
 * one as a *filter*, so `(@one | @two)[name() = 'eff']` carries no axis for
 * anything to ask about, and what answers instead is whatever the filter
 * yields: a union off every arm at once — every, since one attribute arm is
 * enough to put the rewrite back on a node a name cannot name — a path off its
 * last step, and a variable, a call, the context item or an empty pair of
 * brackets off nothing, so those answer no. Three shapes answer no that could
 * have answered otherwise: a `Q{urn:x}foo` name test and a `..` step, which
 * select an element and nothing else, and a bare `.`, whose context is whatever
 * stands outside the expression. Each is a report withheld rather than a file
 * broken, and admitting all three draws not one further defect over the three
 * corpora.
 *
 * What is withheld is the whole report and not the fix alone, since the
 * message names the rewrite it cannot make. XPath 2.0 does have a node test
 * for the attribute half — `self::attribute(as)`, a kind test rather than a
 * name test — but that is a rewrite of another shape, and 1.0 has none at all,
 * so the string comparison is the only way to put the question there.
 *
 * That rule reached the axis arm and not the version one until #962. `test`
 * builds no node test for a `local-name()` comparison in a 1.0 stylesheet,
 * the `*:name` wildcard being 2.0's, nor for a string XML cannot spell a name
 * with, and `lintByName` reported both regardless and dropped the fix alone.
 * So the advice named a rewrite the version has no spelling for, over
 * `local-name()`, which is the one call that is *not* prefix-fragile and so
 * answers half the message before it is read. 302 of the check's 498 rows
 * over the three corpora were such reports: 293 a `local-name()` in 1.0
 * DocBook-XSL, and 9 a `name() = ''`, which asks whether a node has a name at
 * all and no node test spells at any version. What builds no replacement is
 * withheld whole now, one rule over both causes rather than a version test
 * standing beside a literal test.
 *
 * The context is carried down a walk rather than climbed to, because the parse
 * holds no parent pointers and a step holds its predicates as its children.
 * Only a predicate moves it, and it moves to what the step or the filter
 * holding it yields, which is a distinction rather than a convenience: the
 * `name()` of `@*[../child::zed[name() = 'gee']]` is asked of an element and
 * still reported, where the one in `@*[name() != 'as']` is asked of an
 * attribute.
 */

const {VALUED, calls, offsetOf, operatorOf, parseOf, stringOf,
  textOf, tokensOf} = require('../syntax')
const {AXIS_KINDS, TOKENS, TRIVIA, qualified} = require('../tokens')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, since} = require('../xsl-version')
const {logger} = require('../logger')

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
 * The two standard functions that answer a node's name.
 * @type {Array.<string>}
 */
const NAMING = ['name', 'local-name']

/**
 * The operators this check is about, spelled as `operatorOf` canonicalises
 * them, so the `eq` and `ne` of a value comparison arrive here as the symbols
 * their general-comparison twins are written with. An ordering comparison is a
 * different question — `name() lt 'z'` asks where the name sorts, not whether
 * the element is a `z` — and a node test cannot say it.
 * @type {Array.<string>}
 */
const OPERATORS = ['=', '!=']

/**
 * The axes whose principal node kind is not element, so no `self::` name test
 * ever matches what they select: `self::as` is false for every attribute node
 * and for every namespace node (#930).
 * @type {Array.<string>}
 */
const UNNAMED = [TOKENS.AT, TOKENS.ATTRIBUTE, TOKENS.NAMESPACE]

/**
 * The two kind tests selecting an element and nothing else. Every other one
 * reaches a node no name test matches, and `node()` reaches both at once, so
 * a rewrite there drops whatever is not an element rather than nothing.
 * @type {Array.<string>}
 */
const ELEMENTS = ['element', 'schema-element']

/**
 * The node kinds whose first child is the expression they stand over.
 * @type {Array.<string>}
 */
const FILTERED = ['filter', 'parenthesized']

/**
 * Whether a step selects elements alone, which its axis and its node test
 * answer together and neither answers alone: `processing-instruction()` stands
 * on the child axis, whose principal node kind is element, and selects no
 * element at all, while the wildcard of `@*` would match one on any axis but
 * the one it is written on (#930).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A step of its tree
 * @return {boolean} - Whether every node it selects is an element
 */
const elemental = function(found, node) {
  const tokens = tokensOf(found, node).filter(
    (token) => !TRIVIA.includes(token.type),
  )
  let test = tokens
  if (AXIS_KINDS.includes(tokens[0].type) || tokens[0].type === TOKENS.AT) {
    test = tokens.slice(1)
  }
  let answer = !UNNAMED.includes(tokens[0].type) && test.length > 0 &&
    [TOKENS.NAME, TOKENS.MULTI].includes(test[0].type)
  if (answer && test.length > 1 && test[1].type === TOKENS.LPAREN) {
    answer = ELEMENTS.includes(test[0].value)
  }
  return answer
}

/**
 * Whether every node an expression yields is an element, so that a `self::`
 * name test over it asks what a `name()` comparison asks: a filter off what it
 * filters, a predicate narrowing a sequence and never widening one, a union off
 * every arm, a path off its last step. A variable, a call, the context item and
 * the two shapes holding nothing — `()`, and the `/` that is the root — say no.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {boolean} - Whether it yields elements alone
 */
const yields = function(found, node) {
  const kids = node.children
  let answer = false
  if (node.kind === 'step') {
    answer = elemental(found, node)
  } else if (FILTERED.includes(node.kind) && kids.length > 0) {
    answer = yields(found, kids[0])
  } else if (node.kind === 'union') {
    answer = kids.every((arm) => yields(found, arm))
  } else if (node.kind === 'path' && kids.length > 0) {
    answer = yields(found, kids[kids.length - 1])
  }
  return answer
}

/**
 * Every comparison of the tree, each with whether a node test standing in its
 * place would be asked of an element. A predicate is the one thing that moves
 * the answer, and it moves it to what the step or the filter holding it
 * yields: the `name()` of `@*[../child::zed[name() = 'gee']]` is asked of an
 * element where the one in `@*[name() != 'as']` is asked of an attribute.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<{node: object, names: boolean}>} - The comparisons found
 */
const weighed = function(found) {
  const held = []
  /**
   * Take the node where it is a comparison, then walk what it holds — its
   * predicates under what it yields, the rest under what reached it.
   * @param {object} node - A node of the tree
   * @param {boolean} names - Whether an element is what stands in context
   */
  const visit = function(node, names) {
    if (VALUED.includes(node.kind)) {
      held.push({node, names})
    }
    node.children.forEach((kid) => {
      let under = names
      if (kid.kind === 'predicate') {
        under = yields(found, node)
      }
      visit(kid, under)
    })
  }
  visit(parseOf(found).tree, true)
  return held
}

/**
 * The standard function a node calls about the *current* node — `name` or
 * `local-name` — or null where it calls neither, or calls one about some other
 * node: `name()` and `name(.)` are this check's question where `name(@a)` is
 * about a node a rewrite could not reach. The prefix is no part of it: a
 * `fn:name()` and a `Q{urn:mine}name()` are the same function (#598, #577).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {?string} - The local name of the call, or null
 */
const naming = function(found, node) {
  let local = null
  if (node.children.length === 0 ||
    (node.children.length === 1 && node.children[0].kind === 'context')) {
    local = NAMING.find((name) => calls(found, node, name)) ?? null
  }
  return local
}

/**
 * The call and the string of a comparison, whichever side each stands on, or
 * null where its two operands are not that pair. XPath compares in either
 * order and a stylesheet is written both ways, so the question is which of the
 * two operands is which rather than what follows the call.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A comparison node of its tree
 * @return {?{local: string, literal: string}} - The pair, or null
 */
const paired = function(found, node) {
  const named = node.children.map((child) => naming(found, child))
  const held = node.children.map((child) => stringOf(found, child))
  let pair = null
  if (named[0] !== null && held[1] !== null) {
    pair = {local: named[0], literal: held[1]}
  } else if (named[1] !== null && held[0] !== null) {
    pair = {local: named[1], literal: held[0]}
  }
  return pair
}

/**
 * Whether the node test resolves where the comparison stands. `name()` answers
 * the source node's lexical QName and is compared with no declaration at all,
 * where a prefixed node test asks about the namespace the stylesheet binds
 * that prefix to — so one naming a prefix nothing binds refuses to compile
 * (#991).
 * @param {{node: Node}} found - The record the expression came from
 * @param {string} literal - The compared string
 * @return {boolean} - True when the test the literal spells resolves
 */
const bound = function(found, literal) {
  const prefix = literal.split(':')[0]
  const element = found.node.ownerElement ?? found.node.parentNode
  return prefix === literal || element.lookupNamespaceURI(prefix) !== null
}

/**
 * The node test that replaces a comparison, or null when it cannot be built
 * with one edit — a string XML cannot spell a name with, or a `local-name()`
 * comparison in a 1.0 stylesheet where the `*:name` wildcard does not exist.
 * Whether the string is a name is XML's question and the lexer's answer, asked
 * as `qualified` rather than as an ASCII class refusing `name() = 'é'` (#731).
 * @param {string} local - The called function, `name` or `local-name`
 * @param {string} operator - The comparison operator, `=` or `!=`
 * @param {string} literal - The compared string
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {?string} - The replacement expression, or null
 */
const test = function(local, operator, literal, modern) {
  let node = `self::*:${literal}`
  if (local === 'name') {
    node = `self::${literal}`
  }
  let replacement = node
  if (!qualified(literal) || (local === 'local-name' && !modern)) {
    replacement = null
  } else if (operator === '!=') {
    replacement = `not(${node})`
  }
  return replacement
}

/**
 * The `name()`/`local-name()`-versus-string comparisons a node test replaces:
 * the offset, the verbatim text, and that test — null where nothing binds its
 * prefix (#991), and absent where no test replaces it, the report being
 * withheld whole there (#962). Both classes are gathered (#763), and the
 * string is what the literal holds rather than how it is written (#598).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(found, modern) {
  const results = []
  for (const {node, names} of weighed(found)) {
    const pair = paired(found, node)
    const operator = operatorOf(found, node.children[0], node.children[1])
    let replacement = null
    if (pair !== null && OPERATORS.includes(operator) && names) {
      replacement = test(pair.local, operator, pair.literal, modern)
    }
    if (replacement !== null) {
      let offered = replacement
      if (!bound(found, pair.literal)) {
        offered = null
      }
      results.push({
        offset: offsetOf(found, node),
        value: textOf(found, node),
        replacement: offered,
      })
    }
  }
  return results
}

/**
 * Lint the valid expressions for `name()`/`local-name()` compared with a string
 * literal, reporting one defect per comparison a node test replaces, with the
 * fix that turns it into one.
 * @param {Array.<{source: object, found: object}>} expressions - The valid
 *  expressions the validator kept, each paired with the file it came from
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number, fix: ?object}[]} - Defects found
 */
const lintByName = function(expressions, suppressions = []) {
  logger.debug(`Name-comparison linting started`)
  const defects = []
  if (!suppressed(CHECK, suppressions)) {
    for (const {source, found} of expressions) {
      const modern = since(found.version, MODERN)
      for (const {offset, value, replacement} of comparisons(found, modern)) {
        let fix = undefined
        if (replacement !== null) {
          fix = {value, replacement}
        }
        defects.push(defect(CHECK, META, source, found, offset, fix))
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
