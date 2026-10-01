/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `name-compared-to-string` advises a node test in place of comparing `name()`
 * or `local-name()` with a string, and asks first where the call stands: a name
 * test under the `self` axis is false for every attribute and namespace node,
 * and a kind test such as `processing-instruction()` selects no element (#930).
 * The context is carried down the walk to each predicate from what the step or
 * filter holding it yields, and outside every predicate `outer` climbs to the
 * instruction or template setting it (#1000). Where no replacement can be built
 * at the version in force the report is withheld whole rather than the fix
 * alone (#962), bar an unprefixed `name()` in 1.0, reported unfixed (#1042).
 */

const {VALUED, calls, isValid, offsetOf, operatorOf, parseOf, stringOf,
  textOf, tokensOf} = require('../syntax')
const {expressionsOf, whole} = require('../attributes')
const {holding} = require('../tree')
const {AXIS_KINDS, TOKENS, TRIVIA, qualified} = require('../tokens')
const {metaOf, suppressed, defect} = require('../checks')
const {MODERN, XSLT, since} = require('../xsl-version')
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
 * The node kinds a path of steps is, an expression's and a pattern's.
 * @type {Array.<string>}
 */
const PATHS = ['path', 'branch']

/**
 * The instructions whose `select` sets the context of what they hold, and the
 * declarations whose `match` does (#1000).
 * @type {Array.<string>}
 */
const SETTERS = ['for-each', 'for-each-group', 'iterate']

/**
 * The declarations whose `match` sets the context of what they hold.
 * @type {Array.<string>}
 */
const MATCHERS = ['template', 'accumulator-rule']

/**
 * The XSLT elements past which nothing can say what the context is: a
 * function has none, a top-level declaration is evaluated wherever a run
 * starts, and the others set a string or a document as the context.
 * @type {Array.<string>}
 */
const BOUNDS = ['function', 'stylesheet', 'transform', 'package',
  'matching-substring', 'non-matching-substring', 'source-document',
  'merge-action']

/**
 * Every expression of a document, keyed by the element holding it, indexed
 * once per document rather than searched once per comparison.
 * @type {WeakMap.<Document, Map.<Element, Array.<object>>>}
 */
const INDEXED = new WeakMap()

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
  } else if (PATHS.includes(node.kind) && kids.length > 0) {
    answer = yields(found, kids[kids.length - 1])
  }
  return answer
}

/**
 * Whether what an expression yields may stand as the context of a `self::`
 * name test: elements alone, or the root, whose name is as empty as no name
 * test matches it. A pattern answers off every one of its branches.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {boolean} - Whether a name test there asks what the name does
 */
const settled = function(found, node) {
  let answer = yields(found, node)
  if (PATHS.includes(node.kind) && node.children.length === 0) {
    answer = true
  } else if (node.kind === 'pattern') {
    answer = node.children.every((arm) => settled(found, arm))
  }
  return answer
}

/**
 * Whether the expression an element holds in an attribute of a name yields a
 * context a `self::` name test may stand in, which it does not where the
 * element holds no such expression, or one that does not parse.
 * @param {Element} element - The element holding the attribute
 * @param {string} name - The attribute's name, `select` or `match`
 * @return {boolean} - Whether its items are a settled context
 */
const chosen = function(element, name) {
  const document = element.ownerDocument
  if (!INDEXED.has(document)) {
    const index = new Map()
    for (const record of expressionsOf(document)) {
      const held = holding(record.node)
      if (!index.has(held)) {
        index.set(held, [])
      }
      index.get(held).push(record)
    }
    INDEXED.set(document, index)
  }
  const record = (INDEXED.get(document).get(element) ?? []).find(
    (one) => whole(one, name) || whole(one, `_${name}`),
  )
  return record !== undefined && isValid(record) &&
    settled(record, parseOf(record).tree)
}

/**
 * The context an expression's own element sets for it, or null where that
 * element sets none: a sort key is asked of what its parent selects, a
 * grouping key of what its own group selects, a key's `use` of what it matches.
 * @param {{node: Node}} found - The record
 * @return {?boolean} - Whether that context is settled, or null
 */
const own = function(found) {
  const owner = found.node.ownerElement
  let answer = null
  if (owner?.namespaceURI === XSLT) {
    const selected = whole(found, 'select') || whole(found, '_select')
    if (owner.localName === 'sort') {
      answer = chosen(owner.parentNode, 'select')
    } else if (owner.localName === 'for-each-group' && !selected) {
      answer = chosen(owner, 'select')
    } else if (owner.localName === 'key' && !whole(found, 'match')) {
      answer = chosen(owner, 'match')
    }
  }
  return answer
}

/**
 * The context an XSLT element sets for what it holds, or null where it sets
 * none: an instruction's `select`, a template's `match`, or a bound past which
 * nothing says what the context is.
 * @param {Element} element - An XSLT element
 * @return {?boolean} - Whether that context is settled, or null
 */
const setting = function(element) {
  const local = element.localName
  const selects = element.hasAttribute('select') ||
    element.hasAttribute('_select')
  let answer = null
  if (SETTERS.includes(local) || (local === 'copy' && selects)) {
    answer = chosen(element, 'select')
  } else if (MATCHERS.includes(local)) {
    answer = chosen(element, 'match')
  } else if (BOUNDS.includes(local)) {
    answer = false
  }
  return answer
}

/**
 * Whether the context XSLT sets around an expression is known to be one a
 * `self::` name test may stand in, climbed to from the node holding it. An
 * element's own attributes are evaluated outside the context it sets, and a
 * text node inside it; the document is reached only above a simplified
 * stylesheet, whose one template matches the root (#1000).
 * @param {{node: Node}} found - The record
 * @return {boolean} - Whether the context is settled
 */
const outer = function(found) {
  let answer = own(found)
  let element = holding(found.node)
  if (found.node.nodeType === 2) {
    element = element.parentNode
  }
  while (answer === null) {
    if (element.nodeType !== 1) {
      answer = true
    } else if (element.namespaceURI === XSLT) {
      answer = setting(element)
    }
    element = element.parentNode
  }
  return answer
}

/**
 * Whether an `xpath-default-namespace` puts an unprefixed name test in a
 * namespace where the expression stands, the nearest declaration deciding and
 * an empty one taking the test back out of any.
 * @param {{node: Node}} found - The record
 * @return {boolean} - Whether a bare name test names a namespace there
 */
const defaulted = function(found) {
  let element = holding(found.node)
  let declared = null
  while (declared === null && element.nodeType === 1) {
    declared = element.getAttributeNodeNS(XSLT, 'xpath-default-namespace')
    if (element.namespaceURI === XSLT) {
      declared = element.getAttributeNode('xpath-default-namespace')
    }
    element = element.parentNode
  }
  return declared !== null && declared.value !== ''
}

/**
 * Every comparison of the tree, each with whether a node test standing in its
 * place would be asked of an element. A predicate is the one thing that moves
 * the answer, and it moves it to what the step or the filter holding it
 * yields: the `name()` of `@*[../child::zed[name() = 'gee']]` is asked of an
 * element where the one in `@*[name() != 'as']` is asked of an attribute.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @return {Array.<{node: object, names: ?boolean}>} - The comparisons found,
 *  null where the context is whatever stands outside the expression
 */
const weighed = function(found) {
  const held = []
  /**
   * Take the node where it is a comparison, then walk what it holds — its
   * predicates under what it yields, the rest under what reached it.
   * @param {object} node - A node of the tree
   * @param {?boolean} names - Whether an element is what stands in context,
   *  or null where that is what XSLT sets around the expression
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
  visit(parseOf(found).tree, null)
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
 * What a comparison is reported with: the node test replacing it, a null one
 * where an unprefixed `name()` needs the `*:name` wildcard 1.0 lacks (#1042),
 * or null where nothing is reported — a string XML cannot spell a name with,
 * or a `local-name()` in 1.0, which is not prefix-fragile (#962, #1000).
 * @param {{local: string, literal: string}} pair - The call and the string
 * @param {string} operator - The comparison operator, `=` or `!=`
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @param {boolean} spaced - Whether `xpath-default-namespace` is in force
 * @return {?{replacement: ?string}} - The verdict, or null
 */
const test = function(pair, operator, modern, spaced) {
  const literal = pair.literal
  let node = `self::*:${literal}`
  if (pair.local === 'name' && (literal.includes(':') || spaced)) {
    node = `self::${literal}`
  }
  let verdict = {replacement: node}
  if (!qualified(literal) || (pair.local === 'local-name' && !modern)) {
    verdict = null
  } else if (node.includes('*:') && !modern) {
    verdict = {replacement: null}
  } else if (operator === '!=') {
    verdict = {replacement: `not(${node})`}
  }
  return verdict
}

/**
 * The `name()`/`local-name()`-versus-string comparisons reported: the
 * offset, the verbatim text, and the node test — null where nothing binds its
 * prefix (#991) or 1.0 cannot spell it (#1042), and absent where `test`
 * withholds the report (#962). Both classes are gathered (#763), and the
 * string is what the literal holds rather than how it is written (#598).
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @param {boolean} modern - Whether the stylesheet is 2.0 or 3.0
 * @return {Array.<{offset: number, value: string, replacement: ?string}>} -
 *  The comparisons found
 */
const comparisons = function(found, modern) {
  const results = []
  let around = null
  for (const {node, names} of weighed(found)) {
    const pair = paired(found, node)
    const operator = operatorOf(found, node.children[0], node.children[1])
    let verdict = null
    let settles = names
    if (pair !== null && OPERATORS.includes(operator) && names === null) {
      around = around ?? outer(found)
      settles = around
    }
    if (pair !== null && OPERATORS.includes(operator) && settles) {
      verdict = test(pair, operator, modern, modern && defaulted(found))
    }
    if (verdict !== null) {
      let offered = verdict.replacement
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
