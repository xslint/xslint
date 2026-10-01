/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The one door between a record and what the grammar makes of it, and where
 * every check that reads a tree begins (#577). `parseOf` forks on the record,
 * `matched` for a pattern and `parsed` for an expression, at the version it
 * carries or at `ASSUMED`, the most permissive one, where none is placed. One
 * parse per distinct expression is kept with its tree (#689), and the offset a
 * fault stands at comes off that parse (#589). Beside it stands what a check
 * needs of a node: its tokens, text and offset, the nodes of the kinds it asks
 * for, the operator between two operands canonicalised through `WORDED`
 * (#763), whether it calls a function, the string or variable it holds, and
 * whether it can stand as a filtering predicate or as a step (#784, #774).
 */

const {parsed, matched} = require('./grammar')
const {holding} = require('./tree')
const {TOKENS, TRIVIA, unquoted} = require('./tokens')
const {KNOWN} = require('./xsl-version')

/**
 * The namespace an unprefixed function name belongs to, which XPath calls the
 * default function namespace and XSLT never changes. A prefix bound to it names
 * the same function the bare spelling does, so `fn:count` and `count` are one
 * call and `my:count` is another (#577).
 * @type {string}
 */
const FUNCTIONS = 'http://www.w3.org/2005/xpath-functions'

/**
 * The version an expression is read under when its stylesheet declares none,
 * or declares one `versionOf` cannot place. The most permissive known,
 * deliberately: letting a missing `version` decide a syntax question answers
 * one defect with an `invalid-xpath-expression` for every modern expression in
 * the file. Derived, so a version added to `KNOWN` becomes the fallback.
 * @type {string}
 */
const ASSUMED = KNOWN[KNOWN.length - 1]

/**
 * What each expression already parsed to. The grammar remembers nothing
 * between calls where a corpus repeats itself constantly, so the same parse
 * was paid for over and over (#689): one entry per distinct expression, and
 * the same text under the same version always parses the same way. The tree is
 * kept beside the refusal, or a check reading it would parse twice (#644).
 * @type {Map.<string, {tokens: Array, tree: ?object, fault: string,
 *  at: number}>}
 */
const PARSES = new Map()

/**
 * The two kinds a comparison of values comes back as. XPath spells one
 * question two ways from 2.0 on, `count(x) = 0` and `count(x) eq 0`, so a
 * check gathers both or is blind to the other (#763, #575). One list rather
 * than one per check, a copy being a kind missing from it (#708). A node
 * comparison asks about identity, not a value.
 * @type {Array.<string>}
 */
const VALUED = ['comparison', 'value-comparison']

/**
 * Each operator a general comparison is spelled with, paired with the word
 * XPath 2.0 spells the same question in. A check about the *question* meets
 * the construct twice and must know both: reading the symbols alone is how
 * `count(x) eq 0` and `[position() eq 1]` drew nothing on any 2.0 stylesheet
 * (#763, #575). A node comparison has no twin to pair.
 * @type {{[symbol: string]: string}}
 */
const WORDED = {
  '=': 'eq', '!=': 'ne', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge',
}

/**
 * Each word paired the other way about, so an operator read off the tree can be
 * canonicalised to the one spelling a classifier reasons about.
 * @type {{[word: string]: string}}
 */
const SYMBOLED = Object.fromEntries(
  Object.entries(WORDED).map(([symbol, word]) => [word, symbol]),
)

/**
 * The kinds that bind at least as loosely as a general comparison, so a node
 * of one cannot be an operand of `=` unbracketed: substituting its text
 * regroups the expression or fails to parse — `a or b` becomes `a or (b = '')`
 * — every other kind carrying over whole. XPath's own ladder from the
 * comparison up; `test/syntax.test.js` holds it to the grammar.
 * @type {Array.<string>}
 */
const LOOSE = [
  'sequence', 'for', 'let', 'some', 'every', 'conditional', 'or', 'and',
  'comparison', 'value-comparison', 'node-comparison',
]

/**
 * The kinds a `StepExpr` can be, the ladder from the other end: everything
 * carrying whole into the place a call stands in, a call being a primary —
 * `exsl:node-set($one | $two)/alpha` takes a union's `alpha` children where
 * `$one | $two/alpha` takes `$one` beside them (#774). A `path` is not one, a
 * predicate binding to its last step and not the whole.
 * @type {Array.<string>}
 */
const STEPPED = [
  'step', 'filter', 'apply', 'lookup', 'parenthesized', 'literal', 'variable',
  'call', 'context', 'map', 'array', 'reference', 'inline',
]

/**
 * What the grammar makes of the expression a record carries, asked at the
 * version in force where it stands and in the language the record says it is:
 * `matched` for a pattern, a different language rather than a second reading
 * of an expression, and `parsed` for the rest. So `1 cast as xs:integer` is
 * valid in a 2.0 sheet and a syntax error in a 1.0 one (#652).
 * @param {{expression: string, pattern: boolean, version: string}} found -
 *  The expression, whole, as `expressionsOf` yields it
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} - The
 *  tokens, the tree when it parsed, and the complaint when it did not
 */
const parseOf = function(found) {
  let version = found.version
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
 * complain about. Two callers want the verdict alone: a declarative fix is
 * withheld on an attribute no processor parses (#651), and the validator asks
 * it at a version other than the one in force, to learn which of the two the
 * refusal is about (#925). The other gate of that pair went at #750.
 * @param {{node: Node, expression: string, pattern: boolean, version: string}}
 *  found - The expression, whole, as `expressionsOf` yields it
 * @return {boolean} - True when the expression parses
 */
const isValid = function(found) {
  return parseOf(found).fault === ''
}

/**
 * The tokens one node of the tree spans. A span is a range of token indexes, so
 * this is what every other question about a node is answered from: what it
 * says, where it stands, and what the lexer made of a piece of it the tree
 * gives one kind to — a `literal` is a number or a string, and only the token
 * says which.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {Array.<{type: string, value: string, start: number}>} - Its tokens
 */
const tokensOf = function(found, node) {
  return parseOf(found).tokens.slice(node.from, node.to)
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
  return tokensOf(found, node).map((token) => token.value).join('')
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
  return tokensOf(found, node)[0].start
}

/**
 * Every node of one of the kinds the record's tree holds, outermost first. A
 * check reads this instead of scanning the text, which is what makes it blind
 * to the same characters standing inside a string, a comment or a name. A list
 * rather than one kind because a construct is often more than one: the general
 * and the value comparison are two kinds and one question (#763).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {Array.<string>} kinds - The kinds to collect
 * @return {Array.<object>} - The nodes of those kinds
 */
const gathered = function(found, kinds) {
  const collected = []
  /**
   * Take this node when it is of one of the kinds, then the nodes below it.
   * @param {object} node - A node of the tree
   */
  const visit = function(node) {
    if (kinds.includes(node.kind)) {
      collected.push(node)
    }
    node.children.forEach(visit)
  }
  visit(parseOf(found).tree)
  return collected
}

/**
 * Whether the node calls that local name in one of those namespaces, the
 * standard ones by default. The URI tells it from somebody else's, never the
 * prefix: excluding every prefixed spelling missed `fn:count`, excluding none
 * read `Q{urn:mine}count` as standard (#577), taking any read `my:node-
 * set($v)` as EXSLT's (#557). A list, `node-set` being declared twice.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @param {string} name - The function's local name, such as `count`
 * @param {Array.<string>} namespaces - The URIs the name means it in
 * @return {boolean} - True when the node calls that function
 */
const calls = function(found, node, name, namespaces = [FUNCTIONS]) {
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
    same = local === name && namespaces.includes(uri)
  }
  return same
}

/**
 * The string a literal node holds, unquoted and unescaped, or null where it
 * holds none — a number is a `literal` too (#575). `textOf` answers what the
 * author wrote, this what XPath reads: either delimiter spells one string and
 * doubling escapes it, so `"it's"` and `'it''s'` are four characters, where a
 * check comparing text read one spelling alone (#562, #598).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {?string} - The string it holds, or null
 */
const stringOf = function(found, node) {
  const [token] = tokensOf(found, node)
  let string = null
  if (node.kind === 'literal' && token.type === TOKENS.STRING) {
    string = unquoted(token)
  }
  return string
}

/**
 * The name a variable reference holds, or null where the node is not one.
 * `textOf` cannot answer it: XPath lets a gap or a comment stand between the
 * `$` and the name, so `$ para` and `$(: which :)para` both reference `para`.
 * A namespace stays part of the name, `$Q{urn:my}para` and `$my:para` each
 * referencing a variable `$para` does not.
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} node - A node of its tree
 * @return {?string} - The name it references, or null
 */
const variableOf = function(found, node) {
  let name = null
  if (node.kind === 'variable') {
    name = tokensOf(found, node)
      .filter((token) => !TRIVIA.includes(token.type))
      .slice(1)
      .map((token) => token.value)
      .join('')
  }
  return name
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
 * The kinds a predicate may be without picking a node out of the sequence it
 * filters, the question a shared walk puts of each (#784). XPath reads a
 * numeric predicate as a position test, and a candidate alone is a sequence of
 * one: only a kind the parse proves is no number is served. A `path` is
 * decided by its last step, `[a/count(.)]` picking the first.
 * @type {Array.<string>}
 */
const FILTERS = [
  'and', 'comparison', 'context', 'every', 'intersect', 'node-comparison',
  'or', 'some', 'step', 'union', 'value-comparison',
]

/**
 * The standard functions XPath declares to answer `xs:boolean`, which are the
 * calls a predicate may stand as. A call is the one kind the kind alone does
 * not settle — `not(@a)` is a truth and `count(@a)` is a number, and both come
 * back a `call` — so the name decides, and a name this list does not hold is
 * refused whatever it answers.
 * @type {Array.<string>}
 */
const BOOLEAN = [
  'boolean', 'contains', 'deep-equal', 'empty', 'ends-with', 'exists', 'lang',
  'matches', 'not', 'starts-with',
]

/**
 * Whether the node or anything under it asks about the sequence it stands in.
 * `position()` and `last()` are about the sequence a predicate filters, and
 * being boolean either hides inside a comparison the kind would pass. Read
 * here rather than through `calls`: a selector of ours stands in no
 * stylesheet, so `PREFIXES` binds `xsl` and `xslint` alone.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - The node to walk
 * @return {boolean} - Whether the sequence is read anywhere within it
 */
const positional = function(tokens, node) {
  let asks = false
  if (node.kind === 'call') {
    const token = tokens[node.from]
    asks = token.type === TOKENS.URI || token.value === 'position' ||
      token.value === 'last'
  }
  return asks || node.children.some((kid) => positional(tokens, kid))
}

/**
 * Whether the node can stand as a predicate filtering a sequence rather than
 * picking a position in it, which is what a shared walk needs of one: the axis
 * comes off the walk and each candidate is asked alone, where a positional test
 * answers true for every one (#784). Three kinds do not settle it: a `path` is
 * its last step, a `call` its name, a bracket the one thing it holds.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - The node a predicate holds, whole
 * @return {boolean} - True when it filters rather than picks
 */
const filters = function(tokens, node) {
  let sound = FILTERS.includes(node.kind)
  if (node.kind === 'path') {
    sound = filters(tokens, node.children[node.children.length - 1])
  } else if (node.kind === 'parenthesized' && node.children.length === 1) {
    sound = filters(tokens, node.children[0])
  } else if (!sound && node.kind === 'call') {
    sound = tokens[node.from].type !== TOKENS.URI &&
      BOOLEAN.includes(tokens[node.from].value)
  }
  return sound && !positional(tokens, node)
}

/**
 * Whether the node's own text can stand as a step of a path with no brackets
 * around it, which is what a rewrite substituting it where a call stood needs.
 * @param {object} node - A node of a tree
 * @return {boolean} - True when it binds as tightly as a step
 */
const stepped = function(node) {
  return STEPPED.includes(node.kind)
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

/**
 * The operator standing between two operands, spelled with symbols whichever
 * spelling its author chose: a word is canonicalised through `WORDED`, so `eq`
 * arrives as `=` and a classifier keyed on the six symbols answers for both
 * classes of comparison rather than for one of them (#763).
 * @param {{node: Node, expression: string, pattern: boolean}} found - Record
 * @param {object} left - The node on the near side
 * @param {object} right - The node on the far side
 * @return {string} - The operator, spelled with symbols
 */
const operatorOf = function(found, left, right) {
  const written = parting(found, left, right)[0].value
  return SYMBOLED[written] ?? written
}

module.exports = {
  ASSUMED,
  FILTERS,
  VALUED,
  FUNCTIONS,
  LOOSE,
  STEPPED,
  WORDED,
  calls,
  filters,
  gathered,
  isValid,
  offsetOf,
  operatorOf,
  parseOf,
  stepped,
  stringOf,
  textOf,
  tight,
  tokensOf,
  variableOf,
}
