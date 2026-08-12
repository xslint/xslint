/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed, matched} = require('./grammar')
const {holding} = require('./tree')
const {TOKENS, TRIVIA} = require('./tokens')
const {versionOf, KNOWN} = require('./xsl-version')

/**
 * The namespace an unprefixed function name belongs to, which XPath calls the
 * default function namespace and XSLT never changes. A prefix bound to it names
 * the same function the bare spelling does, so `fn:count` and `count` are one
 * call and `my:count` is another (#577).
 * @type {string}
 */
const FUNCTIONS = 'http://www.w3.org/2005/xpath-functions'

/**
 * The version an expression is read under when its stylesheet declares none, or
 * declares one `versionOf` cannot place. The most permissive version known,
 * deliberately: a missing `version` is already a defect of its own, and letting
 * it decide a syntax question would answer one defect with an
 * `invalid-xpath-expression` for every modern expression the file holds — a
 * refusal invented against XPath that is valid under the version its author
 * meant. Derived rather than spelled, so a version added to `KNOWN` becomes the
 * fallback without anybody remembering to move it.
 * @type {string}
 */
const ASSUMED = KNOWN[KNOWN.length - 1]

/**
 * What each expression already parsed to. The grammar remembers nothing between
 * calls, while a corpus repeats its expressions constantly — `.` and `@name`
 * and `text()` above all — so the same parse was being paid for over and over
 * (#689). One entry per distinct expression is bounded by the corpus that
 * asked, and the answer cannot go stale: the same text under the same version
 * parses the same way for the life of a process.
 *
 * The tree is kept beside the refusal, which it was not until Phase 4 of #644
 * began. One sentence per expression was the cheaper bargain while nothing
 * above this asked for more than a verdict; now that a check reads the tree
 * rather than matching the text, throwing it away would mean parsing every
 * expression twice — once to keep it and once for each check that walks it.
 * @type {Map.<string, {tokens: Array, tree: ?object, fault: string,
 *  at: number}>}
 */
const PARSES = new Map()

/**
 * The kinds that bind at least as loosely as a general comparison, so a node of
 * one cannot stand as an operand of `=` with no brackets around it. A rewrite
 * substituting such a node's text regroups the expression or fails to parse at
 * all — `a or b` becomes `a or (b = '')`, and `a = b` becomes a chain of
 * comparisons no version admits — while every other kind binds tighter and
 * carries over whole.
 *
 * It is XPath's own ladder read from the comparison up: the comma, the five
 * expressions `ExprSingle` names, the two boolean levels, and the three classes
 * of comparison that cannot chain onto one another. `test/syntax.test.js` holds
 * the list to the grammar rather than to this comment, asking of a specimen of
 * every kind whether `<specimen> = ''` really does come back a comparison over
 * it.
 * @type {Array.<string>}
 */
const LOOSE = [
  'sequence', 'for', 'let', 'some', 'every', 'conditional', 'or', 'and',
  'comparison', 'value-comparison', 'node-comparison',
]

/**
 * What the grammar makes of the expression a record carries, asked at the
 * version in force where it stands and in the language the record says it is:
 * `matched` for a pattern, since a `match` is a different language and not a
 * second reading of an expression, and `parsed` for everything else. So
 * `1 cast as xs:integer` is valid in a 2.0 sheet and a syntax error in a 1.0
 * one, which is the whole of #652.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} - The
 *  tokens, the tree when it parsed, and the complaint when it did not
 */
const parseOf = function(found) {
  let version = versionOf(found.node)
  if (!KNOWN.includes(version)) {
    version = ASSUMED
  }
  const key = `${version} ${found.pattern} ${found.expression}`
  if (!PARSES.has(key)) {
    let answer = parsed(found.expression, version)
    if (found.pattern) {
      answer = matched(found.expression, version)
    }
    PARSES.set(key, answer)
  }
  return PARSES.get(key)
}

/**
 * Whether an expression is syntactically valid — its parse with nothing to
 * complain about. One caller wants the verdict alone: a declarative fix is
 * withheld on an attribute whose expression no processor parses (#651), and
 * that gate has nowhere to say why. The other gate of that pair was in
 * `defect`, and #750 deleted it — a code-based check is handed the expressions
 * the validator kept, so it never reads a refused one to begin with.
 * @param {{node: Node, expression: string, pattern: boolean}} found - The
 *  expression, whole, as `expressionsOf` yields it
 * @return {boolean} - True when the expression parses
 */
const isValid = function(found) {
  return parseOf(found).fault === ''
}

/**
 * The text of one node of the tree, which is the tokens of its span joined back
 * together. The stream is lossless, so this is the expression as its author
 * spelled that part of it — every gap and every comment included, which is what
 * lets a fix stay a replacement of raw source.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {string} - The text it spans
 */
const textOf = function(found, node) {
  return parseOf(found).tokens.slice(node.from, node.to)
    .map((token) => token.value).join('')
}

/**
 * Where one node of the tree begins, counted from the start of the expression.
 * A span is a range of token indexes, and the offset is the lexer's rather than
 * anything computed from text.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {number} - Its offset inside the expression
 */
const offsetOf = function(found, node) {
  return parseOf(found).tokens[node.from].start
}

/**
 * Every node of a kind the record's tree holds, outermost first. A check reads
 * this instead of scanning the text for the shape it is about, which is what
 * makes it blind to the same characters standing inside a string, a comment or
 * a name — no masking, and nothing to keep in step with the lexer.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {string} kind - The kind to collect
 * @return {Array.<object>} - The nodes of that kind
 */
const gathered = function(found, kind) {
  const collected = []
  /**
   * Take this node when it is of the kind, then the nodes below it.
   * @param {object} node - A node of the tree
   */
  const visit = function(node) {
    if (node.kind === kind) {
      collected.push(node)
    }
    node.children.forEach(visit)
  }
  visit(parseOf(found).tree)
  return collected
}

/**
 * Whether the node is a call to the standard function of that local name.
 * XPath spells its namespace three ways and all three name one function: bare,
 * which is the default function namespace; behind a prefix the stylesheet binds
 * to it, which is the idiomatic `fn:count` of any 2.0 sheet; and with the
 * namespace written inline as `Q{...}`, which XPath 3.0 added. What tells the
 * standard call from a user function of the same local name is the URI, never
 * the prefix — a scan excluding every prefixed spelling missed `fn:count`, and
 * one excluding none read `Q{urn:mine}count` as the standard call (#577). The
 * prefix is resolved against the element the record hangs off, which is the
 * same node the version is read at.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @param {string} name - The function's local name, such as `count`
 * @return {boolean} - True when the node calls that standard function
 */
const calls = function(found, node, name) {
  const tokens = parseOf(found).tokens
  let same = false
  if (node.kind === 'call') {
    const token = tokens[node.from]
    let local = token.value
    let uri = FUNCTIONS
    if (token.type === TOKENS.URI) {
      uri = token.value.slice(2, -1)
      local = tokens[node.from + 1].value
    } else if (local.includes(':')) {
      const colon = local.indexOf(':')
      uri = holding(found.node).lookupNamespaceURI(local.slice(0, colon))
      local = local.slice(colon + 1)
    }
    same = local === name && uri === FUNCTIONS
  }
  return same
}

/**
 * Whether the node's own text can stand as an operand of a general comparison
 * with no brackets around it, which is what a rewrite substituting it needs.
 * @param {object} node - A node of a tree
 * @return {boolean} - True when it binds tighter than a comparison
 */
const tight = function(node) {
  return !LOOSE.includes(node.kind)
}

/**
 * The solid tokens standing between two nodes of one tree, which is where an
 * operator the grammar consumed without building a node of its own is read
 * from: a comparison holds its two operands and not the sign between them.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} left - The node on the near side
 * @param {object} right - The node on the far side
 * @return {Array.<object>} - The tokens carrying meaning between them
 */
const parting = function(found, left, right) {
  return parseOf(found).tokens.slice(left.to, right.from)
    .filter((token) => !TRIVIA.includes(token.type))
}

module.exports = {
  FUNCTIONS,
  LOOSE,
  calls,
  gathered,
  isValid,
  offsetOf,
  parseOf,
  parting,
  textOf,
  tight,
}
