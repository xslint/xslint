/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, qualified, TOKENS} = require('./tokens')
const {since, MODERN} = require('./xsl-version')

/**
 * The token kinds that carry no meaning to the grammar and every meaning to the
 * source: a gap and a comment. They stay in the stream rather than being
 * filtered out of it, because a span is a range of token indexes and the text
 * of a span is the tokens in it joined back together — drop the trivia and the
 * tree stops reproducing what it was built from.
 * @type {Array.<string>}
 */
const TRIVIA = [TOKENS.WHITESPACE, TOKENS.COMMENT]

/**
 * The token a cursor reads once the stream is spent. It is a token like any
 * other, so a production asking what comes next never has to ask whether
 * anything does, and its `start` is the length of the expression, which is
 * where a fault at the end of the input truly stands.
 * @type {object}
 */
const END = Object.freeze({type: 'end', value: ''})

/**
 * The floor each construct's version gate compares against, keyed by the
 * construct rather than by the node it builds, since several build none of
 * their own. XSLT's version is what a stylesheet declares and what
 * `versionOf` hands back, so these are XSLT versions rather than XPath's: 1.0
 * carries XPath 1.0, 2.0 carries XPath 2.0, and 3.0 carries XPath 3.1. A
 * construct absent from this table is in every version, `1.0` included.
 * @type {{[kind: string]: string}}
 */
const SINCE = {
  'apply': '3.0',
  'arrow': '3.0',
  'array': '3.0',
  'cast': '2.0',
  'castable': '2.0',
  'concat': '3.0',
  'conditional': '2.0',
  'every': '2.0',
  'except': '2.0',
  'for': '2.0',
  'idiv': '2.0',
  'inline-namespace': '3.0',
  'instance': '2.0',
  'intersect': '2.0',
  'let': '3.0',
  'lookup': '3.0',
  'map': '3.0',
  'node-comparison': '2.0',
  'parenthesized-item-type': '3.0',
  'range': '2.0',
  'reference': '3.0',
  'simple-map': '3.0',
  'some': '2.0',
  'treat': '2.0',
  'value-comparison': '2.0',
}

/**
 * The words XPath spells an operator with that the lexer hands over as a name,
 * because whether one is an operator is a question about the grammar rather
 * than about the word. `instance of` is not among them: the lexer joins those
 * two into one token of its own, as it does the axes.
 * @type {Array.<string>}
 */
const KEYWORDS = [
  'as', 'cast', 'castable', 'else', 'every', 'for', 'if', 'in', 'let',
  'return', 'satisfies', 'some', 'then', 'to', 'treat',
]

/**
 * The value comparisons, which 2.0 added beside the general ones. They compare
 * single items rather than sequences, so `eq` is not a spelling of `=`.
 * @type {Array.<string>}
 */
const VALUES = [
  TOKENS.EQ, TOKENS.NE, TOKENS.LT, TOKENS.LE, TOKENS.GT, TOKENS.GE,
]

/**
 * The general comparisons, which every version has.
 * @type {Array.<string>}
 */
const GENERALS = [
  TOKENS.EQUAL, TOKENS.NOT_EQUAL, TOKENS.LESS, TOKENS.LESS_EQUAL,
  TOKENS.GREATER, TOKENS.GREAT_EQUAL,
]

/**
 * The node comparisons, which 2.0 added beside the other two. They ask about
 * identity and document order rather than about value, so `$a is $b` is true
 * only of one node named twice and no amount of equal content makes it so.
 * @type {Array.<string>}
 */
const NODES = [
  TOKENS.IS, TOKENS.PRECEDES, TOKENS.FOLLOWS,
]

/**
 * The forward and reverse axes, each of which the lexer already gives a kind of
 * its own, so a step reads an axis by kind rather than by spelling.
 * @type {Array.<string>}
 */
const AXES = [
  TOKENS.CHILD, TOKENS.PARENT, TOKENS.SELF, TOKENS.ATTRIBUTE,
  TOKENS.DESCENDANT, TOKENS.DESCENDANT_OR_SELF, TOKENS.FOLLOWING,
  TOKENS.FOLLOWING_SIBLING, TOKENS.PRECEDING, TOKENS.PRECEDING_SIBLING,
  TOKENS.ANCESTOR, TOKENS.ANCESTOR_OR_SELF, TOKENS.NAMESPACE,
]

/**
 * The names XPath has taken for itself, each with the version that took it and
 * what it took it for. A `test` is a kind test, standing where a node test
 * stands; an `item` is an item type, standing in a sequence type and nowhere a
 * node test does; a `keyword` is neither, standing for a construct of its own —
 * `if` opens a conditional, and `switch` and `typeswitch` open what those two
 * versions took the words for and this grammar has no production of.
 *
 * The floor is not a detail beside the name, it is half of what the name means:
 * below it the same characters are an ordinary call to a function so called.
 * `element(a)` is a kind test from 2.0 and a call at 1.0, `namespace-node()` a
 * kind test from 3.0 and a call before it, and xsltproc reads every name here
 * that way at 1.0 — parsing the expression and then going looking for the
 * function, which is #576's question and not this parser's. Two lists of names
 * beside a map of the floors was that fact written twice with the version in
 * one copy only, so the lists answered the same at every version and
 * `element(a)` came back a `step` in a 1.0 stylesheet: the verdict agreed with
 * the engine and the tree did not, which is the half no acceptance diff can see
 * and the half Phase 4 of #644 walks (#728). One entry per name cannot drift
 * that way, a kind test with no floor being inexpressible.
 *
 * A name is taken only where a *call* could stand, which is to say in front of
 * a bracket: `item` names an element as well as anything else does, so `//item`
 * is a path and no concern of this table.
 * @type {{[name: string]: {from: string, kind: string}}}
 */
const RESERVED = {
  'array': {from: '3.0', kind: 'item'},
  'attribute': {from: '2.0', kind: 'test'},
  'comment': {from: '1.0', kind: 'test'},
  'document-node': {from: '2.0', kind: 'test'},
  'element': {from: '2.0', kind: 'test'},
  'empty-sequence': {from: '2.0', kind: 'item'},
  'function': {from: '3.0', kind: 'item'},
  'if': {from: '2.0', kind: 'keyword'},
  'item': {from: '2.0', kind: 'item'},
  'map': {from: '3.0', kind: 'item'},
  'namespace-node': {from: '3.0', kind: 'test'},
  'node': {from: '1.0', kind: 'test'},
  'processing-instruction': {from: '1.0', kind: 'test'},
  'schema-attribute': {from: '2.0', kind: 'test'},
  'schema-element': {from: '2.0', kind: 'test'},
  'switch': {from: '3.0', kind: 'keyword'},
  'text': {from: '1.0', kind: 'test'},
  'typeswitch': {from: '2.0', kind: 'keyword'},
}

/**
 * The kinds a name arrives as: a QName, the prefixed call the lexer tells apart
 * on its own, and the braced URI literal opening one whose namespace XPath 3.0
 * writes inline. A reserved name is never one of the last two, since XPath
 * reserves an *unprefixed* spelling alone.
 * @type {Array.<string>}
 */
const NAMES = [TOKENS.NAME, TOKENS.USER_FUNCTION, TOKENS.URI]

/**
 * Whether the version in force reserves the name, which it does from the
 * version that added it and every one after.
 * @param {object} cursor - The cursor, carrying the version
 * @param {string} name - The name to weigh
 * @return {boolean} - True when this version reserves it
 */
const reserves = function(cursor, name) {
  return RESERVED[name] !== undefined &&
    since(cursor.version, RESERVED[name].from)
}

/**
 * Whether the name stands here for one of the kinds asked about: reserved by
 * the version in force, and taken for that. A node test asks for a kind test
 * and a sequence type for either of the first two, while a call asks nothing —
 * it takes any name this version has not spoken for, which is `reserves` on its
 * own.
 * @param {object} cursor - The cursor, carrying the version
 * @param {string} name - The name to weigh
 * @param {Array.<string>} kinds - The kinds that would do
 * @return {boolean} - True when it is one of them here
 */
const taken = function(cursor, name, kinds) {
  return reserves(cursor, name) && kinds.includes(RESERVED[name].kind)
}

/**
 * A cursor over a token stream: the tokens, and how far into them the parse has
 * read. The index moves, which is what a cursor is for; nothing else here does,
 * and every node a production builds is built whole and never patched.
 * @param {Array.<object>} tokens - The tokens to read
 * @param {string} version - The XSLT version in force where the expression sits
 * @return {object} - A fresh cursor over them
 */
const cursorOf = function(tokens, version) {
  return {tokens: tokens, at: 0, version: version}
}

/**
 * Refuse the expression, naming what was expected and where the parse stood.
 * It is thrown rather than returned so a production never has to carry a
 * failure through the productions above it, and `parsed` turns it back into an
 * answer at the one place a caller can see.
 * @param {object} cursor - The cursor, standing where the fault is
 * @param {string} expected - What the grammar wanted there
 * @throws {Error} - Always
 */
const refuse = function(cursor, expected) {
  const token = ahead(cursor)
  throw Object.assign(
    new Error(`expected ${expected} at ${offsetOf(cursor)}, found ${
      described(token)}`),
    {fault: true, at: offsetOf(cursor)},
  )
}

/**
 * How a token reads in a complaint: its text, or the end of the expression when
 * the stream is spent.
 * @param {object} token - The token to name
 * @return {string} - The wording a complaint uses for it
 */
const described = function(token) {
  let text = `"${token.value}"`
  if (token === END) {
    text = 'the end of the expression'
  }
  return text
}

/**
 * Where in the expression the cursor stands, in characters. A token knows the
 * offset it starts at, and the spent stream stands at the end of the last one.
 * @param {object} cursor - The cursor
 * @return {number} - The offset
 */
const offsetOf = function(cursor) {
  const tokens = cursor.tokens
  const found = significant(cursor)
  let at = 0
  if (tokens.length) {
    const last = tokens[tokens.length - 1]
    at = last.start + last.value.length
  }
  if (found < tokens.length) {
    at = tokens[found].start
  }
  return at
}

/**
 * The index of the next token that is not trivia, or the length of the stream
 * when only trivia is left.
 * @param {object} cursor - The cursor
 * @return {number} - The index
 */
const significant = function(cursor) {
  let at = cursor.at
  while (at < cursor.tokens.length && TRIVIA.includes(cursor.tokens[at].type)) {
    at += 1
  }
  return at
}

/**
 * The next token that means something to the grammar, without consuming it.
 * @param {object} cursor - The cursor
 * @return {object} - The token, or `END` when the stream is spent
 */
const ahead = function(cursor) {
  let token = END
  const at = significant(cursor)
  if (at < cursor.tokens.length) {
    token = cursor.tokens[at]
  }
  return token
}

/**
 * Whether the next token is of the given kind.
 * @param {object} cursor - The cursor
 * @param {string} type - The kind to look for
 * @return {boolean} - True when it is
 */
const sees = function(cursor, type) {
  return ahead(cursor).type === type
}

/**
 * Whether the next token is a name spelled the given way, which is how the
 * parser reads the words the lexer leaves as names because only the grammar
 * knows they are operators there.
 * @param {object} cursor - The cursor
 * @param {string} value - The spelling to look for
 * @return {boolean} - True when it is
 */
const spells = function(cursor, value) {
  const token = ahead(cursor)
  return token.type === TOKENS.NAME && token.value === value
}

/**
 * Consume the next significant token and answer it, trivia included in what is
 * passed over.
 * @param {object} cursor - The cursor
 * @return {object} - The token consumed
 */
const take = function(cursor) {
  const token = ahead(cursor)
  cursor.at = significant(cursor) + 1
  return token
}

/**
 * Consume the next token, refusing the expression when it is not of the kind
 * the grammar wants there.
 * @param {object} cursor - The cursor
 * @param {string} type - The kind required
 * @param {string} expected - How the complaint should name it
 * @return {object} - The token consumed
 */
const expect = function(cursor, type, expected) {
  if (!sees(cursor, type)) {
    refuse(cursor, expected)
  }
  return take(cursor)
}

/**
 * Consume a keyword the lexer left as a name, refusing when it is absent.
 * @param {object} cursor - The cursor
 * @param {string} value - The keyword
 * @return {object} - The token consumed
 */
const keyword = function(cursor, value) {
  if (!spells(cursor, value)) {
    refuse(cursor, `"${value}"`)
  }
  return take(cursor)
}

/**
 * Refuse a construct the version in force does not have. A gate is a lower
 * bound, so a construct 2.0 introduced is in 3.0 too, and one absent from
 * `SINCE` stands in every version.
 * @param {object} cursor - The cursor, standing at the construct
 * @param {string} kind - The kind of node about to be built
 */
const admits = function(cursor, kind) {
  if (SINCE[kind] && !since(cursor.version, SINCE[kind])) {
    refuse(cursor, `a construct XPath ${cursor.version} has`)
  }
}

/**
 * Build a node spanning the tokens from `from` up to where the cursor now
 * stands. A span is a range of token indexes rather than a pair of offsets, so
 * a position is carried rather than computed, and the text of a node is the
 * tokens of its span joined back together.
 * @param {string} kind - What the node is
 * @param {number} from - Index of its first token
 * @param {object} cursor - The cursor, standing just past its last
 * @param {Array.<object>} children - The nodes below it
 * @return {object} - The node
 */
const shaped = function(kind, from, cursor, children) {
  return Object.freeze({
    kind: kind, from: from, to: cursor.at, children: Object.freeze(children),
  })
}

/**
 * Parse a run of one production separated by tokens of the given kinds, folding
 * each operator into a node of the given kind. Every binary level of XPath's
 * precedence ladder is this shape, so the ladder is a list of levels rather
 * than a dozen functions that differ only in which tokens they look for.
 * @param {object} cursor - The cursor
 * @param {function(object): object} below - The tighter-binding production
 * @param {Array.<string>} types - The operator kinds this level takes
 * @param {string} kind - What to call the node each operator builds
 * @return {object} - The node
 */
const folded = function(cursor, below, types, kind) {
  const from = significant(cursor)
  let node = below(cursor)
  while (types.includes(ahead(cursor).type)) {
    admits(cursor, kind)
    take(cursor)
    node = shaped(kind, from, cursor, [node, below(cursor)])
  }
  return node
}

/**
 * A name, which the grammar wants wherever a QName may stand: a node test, a
 * variable, a type, a function. The lexer hands a QName over whole, colon and
 * all, so nothing here has to join one back together.
 * @param {object} cursor - The cursor
 * @return {object} - The `name` node
 */
const named = function(cursor) {
  const from = significant(cursor)
  const token = ahead(cursor)
  if (sees(cursor, TOKENS.URI)) {
    admits(cursor, 'inline-namespace')
    take(cursor)
    if (!sees(cursor, TOKENS.NAME) || ahead(cursor).value.includes(':')) {
      refuse(cursor, 'a local name behind the inline namespace')
    }
    take(cursor)
  } else if (NAMES.includes(token.type) && !qualified(token.value)) {
    refuse(cursor, 'a name XML can spell')
  } else if (!sees(cursor, TOKENS.USER_FUNCTION)) {
    expect(cursor, TOKENS.NAME, 'a name')
  } else {
    take(cursor)
  }
  return shaped('name', from, cursor, [])
}

/**
 * A kind test, and the whole of one: a name XPath reserves for a test, and the
 * brackets behind it, whatever they hold. What a check asks of a type is which
 * name it mentions, so the brackets are counted rather than read — the shape of
 * what stands inside them is #679's business.
 *
 * It takes no occurrence indicator, which is the point of it standing alone.
 * The same characters are read by three productions of different shapes — a
 * `NodeTest`'s kind test, an `ItemType` inside a `SequenceType`, and the
 * `SingleType` a cast takes — and one function serving all three took `?`, `*`
 * and `+` wherever it was called. A step has no occurrence indicator to take,
 * so `text() + 1` lost its `+` to the type and was refused where every
 * processor accepts it (#740).
 * @param {object} cursor - The cursor
 * @return {object} - The `type` node
 */
const kinded = function(cursor) {
  const from = significant(cursor)
  take(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  let depth = 1
  while (depth > 0 && ahead(cursor) !== END) {
    if (sees(cursor, TOKENS.LPAREN)) {
      depth += 1
    } else if (sees(cursor, TOKENS.RPAREN)) {
      depth -= 1
    }
    take(cursor)
  }
  if (depth > 0) {
    refuse(cursor, '")"')
  }
  return shaped('type', from, cursor, [])
}

/**
 * An item type: a kind test, a name, or another item type in brackets. XPath
 * 3.0 added that last spelling, `ParenthesizedItemType`, and it holds an item
 * type rather than a sequence type — so `(xs:integer)` and `((xs:integer))` are
 * types and `(xs:integer*)` and `()` are not, which is what every processor
 * says of them too.
 * @param {object} cursor - The cursor
 * @return {object} - The `item` node
 */
const itemed = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.LPAREN)) {
    admits(cursor, 'parenthesized-item-type')
    take(cursor)
    itemed(cursor)
    expect(cursor, TOKENS.RPAREN, '")"')
  } else if (sees(cursor, TOKENS.NAME) &&
    taken(cursor, ahead(cursor).value, ['test', 'item'])) {
    kinded(cursor)
  } else {
    named(cursor)
  }
  return shaped('item', from, cursor, [])
}

/**
 * A sequence type: an item type and how many of it, which is what `instance
 * of`, `treat as` and a function's `as` clause each take. `empty-sequence()` is
 * the one spelling that carries no occurrence indicator, being a cardinality
 * already — `SequenceType` gives it its own alternative rather than counting it
 * among the item types.
 * @param {object} cursor - The cursor
 * @return {object} - The `type` node
 */
const sequenced = function(cursor) {
  const from = significant(cursor)
  const empty = spells(cursor, 'empty-sequence')
  itemed(cursor)
  if (!empty && (sees(cursor, TOKENS.LOOKUP) || sees(cursor, TOKENS.MULTI) ||
    sees(cursor, TOKENS.PLUS))) {
    take(cursor)
  }
  return shaped('type', from, cursor, [])
}

/**
 * A single type, which is what `cast as` and `castable as` take: the name of an
 * atomic type, and an optional `?` for whether the empty sequence will do. A
 * kind test is not one — a cast makes an atomic value and there is no atomic
 * type named `node()` — and neither `*` nor `+` may follow, a cast answering
 * one item or none.
 * @param {object} cursor - The cursor
 * @return {object} - The `type` node
 */
const singled = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.NAME) &&
    taken(cursor, ahead(cursor).value, ['test', 'item'])) {
    refuse(cursor, 'the name of an atomic type')
  }
  named(cursor)
  if (sees(cursor, TOKENS.LOOKUP)) {
    take(cursor)
  }
  return shaped('type', from, cursor, [])
}

/**
 * The bindings a `for`, `let` or quantified expression opens with, each a
 * variable and the expression bound to it, separated by commas.
 * @param {object} cursor - The cursor
 * @param {string} joiner - The word standing between a variable and its value
 * @return {Array.<object>} - The `binding` nodes
 */
const bound = function(cursor, joiner) {
  const bindings = []
  do {
    const from = significant(cursor)
    expect(cursor, TOKENS.DOLLAR, '"$"')
    named(cursor)
    if (joiner === ':=') {
      expect(cursor, TOKENS.ASSIGN, '":="')
    } else {
      keyword(cursor, joiner)
    }
    bindings.push(shaped('binding', from, cursor, [single(cursor)]))
  } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  return bindings
}

/**
 * A `for` expression, and a `let` one, which differ only in the word between a
 * variable and its value and in the version that has them.
 * @param {object} cursor - The cursor
 * @param {string} kind - Which of the two is being read
 * @return {object} - The node
 */
const iterated = function(cursor, kind) {
  const from = significant(cursor)
  admits(cursor, kind)
  take(cursor)
  const bindings = bound(cursor, {'for': 'in', 'let': ':='}[kind])
  keyword(cursor, 'return')
  return shaped(kind, from, cursor, bindings.concat([single(cursor)]))
}

/**
 * A quantified expression, `some` or `every`.
 * @param {object} cursor - The cursor
 * @param {string} kind - Which of the two is being read
 * @return {object} - The node
 */
const quantified = function(cursor, kind) {
  const from = significant(cursor)
  admits(cursor, kind)
  take(cursor)
  const bindings = bound(cursor, 'in')
  keyword(cursor, 'satisfies')
  return shaped(kind, from, cursor, bindings.concat([single(cursor)]))
}

/**
 * A conditional, whose test stands in brackets of its own and whose two arms
 * are both required — XPath has no `if` without an `else`.
 * @param {object} cursor - The cursor
 * @return {object} - The `conditional` node
 */
const conditional = function(cursor) {
  const from = significant(cursor)
  admits(cursor, 'conditional')
  take(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  const test = sequence(cursor)
  expect(cursor, TOKENS.RPAREN, '")"')
  keyword(cursor, 'then')
  const met = single(cursor)
  keyword(cursor, 'else')
  return shaped('conditional', from, cursor, [test, met, single(cursor)])
}

/**
 * A node test: a name, a wildcard in any of its four spellings, or a kind test
 * such as `text()`. A wildcard's parts arrive as separate tokens, since `*` is
 * an operator elsewhere and a prefix is a name, so the four are read here
 * rather than asked of the lexer. The fourth is a braced URI literal in front
 * of the `*`, which names every element of one namespace with no prefix bound
 * to it, and is a wildcard rather than a name as much as `*:name` is.
 *
 * The prefixed spelling is taken here whole, both tokens of it, rather than
 * asked of `named` and then held to a `*`. That is the only place a name ending
 * in a colon belongs, so `qualified` can refuse one everywhere else: while that
 * permission sat in the lexer's answer it reached a variable and a call too,
 * and `$my:` and `my:(1)` parsed where no engine accepts either (#731).
 * @param {object} cursor - The cursor
 * @return {object} - The `test` node
 */
const tested = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
    if (sees(cursor, TOKENS.COLON)) {
      take(cursor)
      expect(cursor, TOKENS.NAME, 'a name after the wildcard prefix')
    }
  } else if (sees(cursor, TOKENS.URI) && reaches(cursor, TOKENS.MULTI)) {
    admits(cursor, 'inline-namespace')
    take(cursor)
    take(cursor)
  } else if (sees(cursor, TOKENS.NAME) &&
    taken(cursor, ahead(cursor).value, ['test']) &&
    reaches(cursor, TOKENS.LPAREN)) {
    kinded(cursor)
  } else if (reserves(cursor, ahead(cursor).value) &&
    reaches(cursor, TOKENS.LPAREN)) {
    refuse(cursor, 'a name XPath does not reserve')
  } else if (ahead(cursor).value.endsWith(':') &&
    reaches(cursor, TOKENS.MULTI)) {
    take(cursor)
    take(cursor)
  } else {
    named(cursor)
  }
  return shaped('test', from, cursor, [])
}

/**
 * Whether the token after the next one is of the given kind, which is how the
 * grammar sees past what it is standing on: `text` is a name until a bracket
 * follows it, and then it is a kind test.
 * @param {object} cursor - The cursor
 * @param {string} type - The kind to look for
 * @return {boolean} - True when it stands there
 */
const reaches = function(cursor, type) {
  const beyond = cursorOf(cursor.tokens, cursor.version)
  beyond.at = significant(cursor) + 1
  return sees(beyond, type)
}

/**
 * A cursor of its own, standing just past the name at this one. A name is one
 * token where it is spelled as a QName and two where XPath writes its namespace
 * inline, so what *follows* a name is not a question a fixed lookahead can ask:
 * the bracket behind `Q{urn:my}fn` stands two tokens away and the one behind
 * `fn` stands one.
 * @param {object} cursor - The cursor
 * @return {object} - A cursor standing past the name
 */
const pastName = function(cursor) {
  const beyond = cursorOf(cursor.tokens, cursor.version)
  beyond.at = significant(cursor) + 1
  if (sees(cursor, TOKENS.URI)) {
    beyond.at = significant(beyond) + 1
  }
  return beyond
}

/**
 * The predicates hanging off a step or a postfix expression.
 * @param {object} cursor - The cursor
 * @return {Array.<object>} - The `predicate` nodes
 */
const filtered = function(cursor) {
  const predicates = []
  while (sees(cursor, TOKENS.LBRACKET)) {
    const from = significant(cursor)
    take(cursor)
    const inner = sequence(cursor)
    expect(cursor, TOKENS.RBRACKET, '"]"')
    predicates.push(shaped('predicate', from, cursor, [inner]))
  }
  return predicates
}

/**
 * One step of a path: an axis and a node test, or one of the abbreviations
 * standing for one — `@name` for the attribute axis, `..` for the parent, a
 * bare name for a child.
 * @param {object} cursor - The cursor
 * @return {object} - The `step` node
 */
const stepped = function(cursor) {
  const from = significant(cursor)
  if (AXES.includes(ahead(cursor).type)) {
    take(cursor)
    tested(cursor)
  } else if (sees(cursor, TOKENS.AT)) {
    take(cursor)
    tested(cursor)
  } else if (sees(cursor, TOKENS.DOUBLE_DOT) || sees(cursor, TOKENS.DOT)) {
    take(cursor)
  } else {
    tested(cursor)
  }
  return shaped('step', from, cursor, filtered(cursor))
}

/**
 * Whether a step can begin at the cursor. A path stops where one cannot, which
 * is how `a[1]` ends after the predicate rather than reading the `]` as a test.
 * A name is one of the things it begins with, and the lexer kinds a name three
 * ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one has a bracket
 * behind it, a `URI` where it spells its namespace inline — so the question is
 * asked of `NAMES` rather than of one kind at a time. Asking about one kind is
 * how `a/Q{urn:my}b` came to be accepted while `//Q{urn:my}a` was refused
 * (#708), and how `a/my:fn(1)` was accepted while `//my:fn(1)` was refused
 * (#731): every production that *reads* a name knew all three, and the one that
 * decides where a name may stand knew one. No version test here, for the reason
 * `OPENERS` carries none — a call is no step below 2.0 and an inline namespace
 * no name below 3.0, and each is refused where that is decided, which names the
 * construct rather than the end of the expression.
 * @param {object} cursor - The cursor
 * @return {boolean} - True when a step stands there
 */
const steps = function(cursor) {
  const token = ahead(cursor)
  return AXES.includes(token.type) || token.type === TOKENS.AT ||
    token.type === TOKENS.DOUBLE_DOT || token.type === TOKENS.DOT ||
    token.type === TOKENS.MULTI ||
    (NAMES.includes(token.type) && !KEYWORDS.includes(token.value)) ||
    OPENERS.includes(token.type)
}

/**
 * The token kinds a primary expression may open with that no axis step does.
 * From 2.0 a step is `PostfixExpr | AxisStep`, so each of these opens a step as
 * readily as a name does. They are listed without a version test, deliberately:
 * gating them here changes no verdict, because `parted` refuses them at 1.0
 * anyway, and only moves the complaint from naming what a step wanted to naming
 * the end of the expression — the less useful of the two for whoever reads a
 * report. The version is tested at the one place it decides an answer.
 * @type {Array.<string>}
 */
const OPENERS = [
  TOKENS.LPAREN, TOKENS.DOLLAR, TOKENS.STRING, TOKENS.NUMBER,
  TOKENS.LBRACKET, TOKENS.LOOKUP,
]

/**
 * One part of a path after the slash that opened it. XPath 1.0 admits an axis
 * step and nothing else there — its `PathExpr` lets a `FilterExpr` open a path
 * and stand nowhere after it — while 2.0 generalised the step itself to
 * `StepExpr ::= PostfixExpr | AxisStep`, which puts a parenthesized expression,
 * a variable and a call at every position a step may take (#711). The version
 * is already in hand, so the older shape is kept where it belongs rather than
 * imposed on the versions that outgrew it.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const parted = function(cursor) {
  let node = undefined
  if (since(cursor.version, MODERN)) {
    node = postfixed(cursor)
  } else {
    node = stepped(cursor)
  }
  return node
}

/**
 * A path expression: an optional root, then steps separated by one slash or
 * two. A lone `/` is the document node and takes no step after it, which is why
 * the first step is asked for rather than assumed. A lone `//` is not the same
 * thing spelled shorter: `PathExpr` gives the two separate productions,
 * `"/" RelativePathExpr?` against `"//" RelativePathExpr`, because `//`
 * abbreviates `/descendant-or-self::node()/` and that trailing slash needs
 * something behind it. Reading them alike accepted `//` as a whole expression,
 * and the wrong verdict then bred a wrong tree: the `-` of `//-x` stood where a
 * binary operator may, so it came back a subtraction of two paths, and `//|a`
 * a union with one (#731).
 * @param {object} cursor - The cursor
 * @return {object} - The `path` node
 */
const walked = function(cursor) {
  const from = significant(cursor)
  const parts = []
  let opened = false
  if (sees(cursor, TOKENS.SLASH) || sees(cursor, TOKENS.DOUBLE_SLASH)) {
    const descends = sees(cursor, TOKENS.DOUBLE_SLASH)
    opened = true
    take(cursor)
    if (steps(cursor)) {
      parts.push(parted(cursor))
    } else if (descends) {
      refuse(cursor, 'a step for the "//" to descend to')
    }
  } else {
    parts.push(postfixed(cursor))
  }
  let rooted = opened
  while (sees(cursor, TOKENS.SLASH) || sees(cursor, TOKENS.DOUBLE_SLASH)) {
    rooted = true
    take(cursor)
    parts.push(parted(cursor))
  }
  let node = shaped('path', from, cursor, parts)
  if (!rooted && parts.length === 1) {
    node = parts[0]
  }
  return node
}

/**
 * The arguments of a call, which may be a placeholder `?` where 3.0 lets one
 * stand for an argument left open.
 * @param {object} cursor - The cursor
 * @return {Array.<object>} - The argument nodes
 */
const arguments_ = function(cursor) {
  const args = []
  expect(cursor, TOKENS.LPAREN, '"("')
  if (!sees(cursor, TOKENS.RPAREN)) {
    do {
      if (sees(cursor, TOKENS.LOOKUP)) {
        const from = significant(cursor)
        take(cursor)
        args.push(shaped('placeholder', from, cursor, []))
      } else {
        args.push(single(cursor))
      }
    } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  return args
}

/**
 * A map constructor, `map { key : value, ... }`.
 * @param {object} cursor - The cursor
 * @return {object} - The `map` node
 */
const mapped = function(cursor) {
  const from = significant(cursor)
  admits(cursor, 'map')
  take(cursor)
  expect(cursor, TOKENS.LBRACE, '"{"')
  const entries = []
  if (!sees(cursor, TOKENS.RBRACE)) {
    do {
      const key = single(cursor)
      expect(cursor, TOKENS.COLON, '":" between a key and its value')
      entries.push(key, single(cursor))
    } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  }
  expect(cursor, TOKENS.RBRACE, '"}"')
  return shaped('map', from, cursor, entries)
}

/**
 * An array constructor, square in `[1, 2]` and curly in `array { 1, 2 }`.
 * @param {object} cursor - The cursor
 * @return {object} - The `array` node
 */
const arrayed = function(cursor) {
  const from = significant(cursor)
  admits(cursor, 'array')
  const members = []
  if (sees(cursor, TOKENS.LBRACKET)) {
    take(cursor)
    if (!sees(cursor, TOKENS.RBRACKET)) {
      do {
        members.push(single(cursor))
      } while (sees(cursor, TOKENS.COMMA) && take(cursor))
    }
    expect(cursor, TOKENS.RBRACKET, '"]"')
  } else {
    take(cursor)
    expect(cursor, TOKENS.LBRACE, '"{"')
    if (!sees(cursor, TOKENS.RBRACE)) {
      members.push(sequence(cursor))
    }
    expect(cursor, TOKENS.RBRACE, '"}"')
  }
  return shaped('array', from, cursor, members)
}

/**
 * An inline function, `function ($x) { ... }`, whose parameters carry optional
 * types and whose body is an expression in braces.
 * @param {object} cursor - The cursor
 * @return {object} - The `inline` node
 */
const inlined = function(cursor) {
  const from = significant(cursor)
  admits(cursor, 'reference')
  take(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  if (!sees(cursor, TOKENS.RPAREN)) {
    do {
      expect(cursor, TOKENS.DOLLAR, '"$"')
      named(cursor)
      if (spells(cursor, 'as')) {
        take(cursor)
        sequenced(cursor)
      }
    } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  if (spells(cursor, 'as')) {
    take(cursor)
    sequenced(cursor)
  }
  expect(cursor, TOKENS.LBRACE, '"{"')
  const body = []
  if (!sees(cursor, TOKENS.RBRACE)) {
    body.push(sequence(cursor))
  }
  expect(cursor, TOKENS.RBRACE, '"}"')
  return shaped('inline', from, cursor, body)
}

/**
 * A primary expression: everything a value can begin with. A name here is
 * either a function being called or the first step of a path, and which it is
 * follows from whether a bracket comes next.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const primary = function(cursor) {
  const from = significant(cursor)
  const token = ahead(cursor)
  let node = undefined
  if (token.type === TOKENS.NUMBER || token.type === TOKENS.STRING) {
    take(cursor)
    node = shaped('literal', from, cursor, [])
  } else if (token.type === TOKENS.DOLLAR) {
    take(cursor)
    named(cursor)
    node = shaped('variable', from, cursor, [])
  } else if (token.type === TOKENS.LPAREN) {
    take(cursor)
    const inner = []
    if (!sees(cursor, TOKENS.RPAREN)) {
      inner.push(sequence(cursor))
    }
    expect(cursor, TOKENS.RPAREN, '")"')
    node = shaped('parenthesized', from, cursor, inner)
  } else if (token.type === TOKENS.DOT) {
    take(cursor)
    node = shaped('context', from, cursor, [])
  } else if (token.type === TOKENS.LBRACKET) {
    node = arrayed(cursor)
  } else if (token.type === TOKENS.LOOKUP) {
    admits(cursor, 'lookup')
    take(cursor)
    node = shaped('lookup', from, cursor, [keyed(cursor)])
  } else if (token.value === 'map' && reaches(cursor, TOKENS.LBRACE)) {
    node = mapped(cursor)
  } else if (token.value === 'array' && reaches(cursor, TOKENS.LBRACE)) {
    node = arrayed(cursor)
  } else if (token.value === 'function' && reserves(cursor, 'function') &&
    reaches(cursor, TOKENS.LPAREN)) {
    node = inlined(cursor)
  } else if (referred(cursor)) {
    admits(cursor, 'reference')
    named(cursor)
    take(cursor)
    expect(cursor, TOKENS.NUMBER, 'the arity of the function')
    node = shaped('reference', from, cursor, [])
  } else {
    named(cursor)
    node = shaped('call', from, cursor, arguments_(cursor))
  }
  return node
}

/**
 * Whether a named function reference stands at the cursor: a name with a `#`
 * behind it, which `NamedFunctionRef` makes a primary expression in its own
 * right. It was read as a postfix hanging off whatever `primary` answered, so
 * `abs#1` came back a reference to a *step* — harmless while nothing else could
 * follow a step, and wrong once the postfixes stopped following one at all.
 * @param {object} cursor - The cursor
 * @return {boolean} - True when a function reference opens here
 */
const referred = function(cursor) {
  return NAMES.includes(ahead(cursor).type) &&
    sees(pastName(cursor), TOKENS.HASH)
}

/**
 * Whether a name at the cursor is a call rather than a step. A call is a name
 * with a bracket behind it, and a kind test looks the same, so the names XPath
 * reserves for kind tests are steps however they are written.
 * @param {object} cursor - The cursor
 * @return {boolean} - True when a call stands there
 */
const called = function(cursor) {
  const token = ahead(cursor)
  return NAMES.includes(token.type) && !reserves(cursor, token.value) &&
    sees(pastName(cursor), TOKENS.LPAREN)
}

/**
 * Whether a primary expression stands at the cursor, which is the whole of the
 * fork `StepExpr ::= PostfixExpr | AxisStep` asks. It names the same shapes
 * `primary` reads, in the same order and by the same tests, so the two cannot
 * come apart: everything else is an axis step, which carries a predicate list
 * and nothing more.
 *
 * A step reaching `primary` and coming back out of its last branch is what let
 * the postfixes hang off one — `a?b` came back a lookup into a step and `@a(1)`
 * a call applied to one, neither of which any processor parses, since `(` and
 * `?` follow a `PrimaryExpr` and a name in a path is not one (#740).
 * @param {object} cursor - The cursor
 * @return {boolean} - True when a primary expression opens here
 */
const opens = function(cursor) {
  const token = ahead(cursor)
  return OPENERS.includes(token.type) || sees(cursor, TOKENS.DOT) ||
    (token.value === 'map' && reaches(cursor, TOKENS.LBRACE)) ||
    (token.value === 'array' && reaches(cursor, TOKENS.LBRACE)) ||
    (token.value === 'function' && reaches(cursor, TOKENS.LPAREN)) ||
    referred(cursor) || called(cursor)
}

/**
 * What a lookup selects: a name, a number, a wildcard, or an expression in
 * brackets.
 * @param {object} cursor - The cursor
 * @return {object} - The `key` node
 */
const keyed = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.LPAREN)) {
    take(cursor)
    sequence(cursor)
    expect(cursor, TOKENS.RPAREN, '")"')
  } else if (sees(cursor, TOKENS.MULTI) || sees(cursor, TOKENS.NUMBER)) {
    take(cursor)
  } else {
    named(cursor)
  }
  return shaped('key', from, cursor, [])
}

/**
 * A primary expression with whatever hangs off it: predicates, an argument list
 * that applies what the expression answered, and a lookup into a map or array.
 * Only the predicates are older than 3.0. Applying an expression is what a
 * function item is for and both arrived together, so `$f(1)` is a dynamic call
 * from 3.0 and nothing at all before it — where the same characters are not a
 * call by another reading either, a `FilterExpr` taking predicates and no
 * argument list, which is why xsltproc calls `count(a)(1)` a syntax error
 * rather than looking for a function. It stood ungated, so `child::element(b)`
 * came back an `apply` at 1.0 once `element` stopped being a kind test there
 * (#728).
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const postfixed = function(cursor) {
  const from = significant(cursor)
  let node = undefined
  if (opens(cursor)) {
    node = primary(cursor)
    while (sees(cursor, TOKENS.LBRACKET) || sees(cursor, TOKENS.LPAREN) ||
      sees(cursor, TOKENS.LOOKUP)) {
      if (sees(cursor, TOKENS.LBRACKET)) {
        node = shaped('filter', from, cursor, [node].concat(filtered(cursor)))
      } else if (sees(cursor, TOKENS.LPAREN)) {
        admits(cursor, 'apply')
        node = shaped('apply', from, cursor, [node].concat(arguments_(cursor)))
      } else {
        admits(cursor, 'lookup')
        take(cursor)
        node = shaped('lookup', from, cursor, [node, keyed(cursor)])
      }
    }
  } else {
    node = stepped(cursor)
  }
  return node
}

/**
 * A simple map: paths chained with `!`, each evaluated with what the one before
 * it answered as its context.
 *
 * It stands here rather than on the ladder because `ValueExpr` *is* a
 * `SimpleMapExpr`, so a map binds tighter than the unary signs above it and far
 * tighter than the four expressions that take a type on their right. Reading it
 * as a rung of the ladder put it the other side of all of them, and
 * `a instance of xs:integer ! b` came back a map over what the `instance of`
 * answered — an expression no processor parses, a sequence type being the end
 * of what may stand there (#740).
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const chained = function(cursor) {
  const from = significant(cursor)
  let node = walked(cursor)
  while (sees(cursor, TOKENS.SIMPLE_MAP)) {
    admits(cursor, 'simple-map')
    take(cursor)
    node = shaped('simple-map', from, cursor, [node, walked(cursor)])
  }
  return node
}

/**
 * A unary expression, whose signs XPath allows any number of.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const signed = function(cursor) {
  const from = significant(cursor)
  let node = undefined
  if (sees(cursor, TOKENS.MINUS) || sees(cursor, TOKENS.PLUS)) {
    take(cursor)
    node = shaped('unary', from, cursor, [signed(cursor)])
  } else {
    node = chained(cursor)
  }
  return node
}

/**
 * An arrow application, which hands what stands on its left to the function on
 * its right as that function's first argument.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const arrowed = function(cursor) {
  const from = significant(cursor)
  let node = signed(cursor)
  while (sees(cursor, TOKENS.ARROW)) {
    admits(cursor, 'arrow')
    take(cursor)
    const applied = []
    if (sees(cursor, TOKENS.DOLLAR)) {
      take(cursor)
      applied.push(named(cursor))
    } else if (sees(cursor, TOKENS.LPAREN)) {
      applied.push(primary(cursor))
    } else {
      applied.push(named(cursor))
    }
    node = shaped(
      'arrow', from, cursor, [node].concat(applied, arguments_(cursor)),
    )
  }
  return node
}

/**
 * The four expressions that take a type on their right, each spelled as a word
 * the lexer leaves as a name, and each one level of the ladder.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const typedExpr = function(cursor) {
  const from = significant(cursor)
  let node = arrowed(cursor)
  for (const word of ['cast', 'castable']) {
    if (spells(cursor, word)) {
      admits(cursor, word)
      take(cursor)
      keyword(cursor, 'as')
      node = shaped(word, from, cursor, [node, singled(cursor)])
    }
  }
  if (spells(cursor, 'treat')) {
    admits(cursor, 'treat')
    take(cursor)
    keyword(cursor, 'as')
    node = shaped('treat', from, cursor, [node, sequenced(cursor)])
  }
  if (sees(cursor, TOKENS.INSTANCE_OF)) {
    admits(cursor, 'instance')
    take(cursor)
    node = shaped('instance', from, cursor, [node, sequenced(cursor)])
  }
  return node
}

/**
 * The binary levels of XPath's precedence ladder, tightest first. Each is one
 * `folded` run, so the ladder reads as the grammar states it rather than as a
 * dozen near-identical functions.
 * @type {Array.<{types: Array.<string>, kind: string}>}
 */
const LADDER = [
  {types: [TOKENS.INTERSECT], kind: 'intersect'},
  {types: [TOKENS.EXCEPT], kind: 'except'},
  {types: [TOKENS.PIPE], kind: 'union'},
  {types: [TOKENS.UNION], kind: 'intersect'},
  {types: [TOKENS.MULTI, TOKENS.DIV, TOKENS.MOD], kind: 'product'},
  {types: [TOKENS.IDIV], kind: 'idiv'},
  {types: [TOKENS.PLUS, TOKENS.MINUS], kind: 'sum'},
  {types: [TOKENS.CONCAT], kind: 'concat'},
  {types: [TOKENS.AND], kind: 'and'},
  {types: [TOKENS.OR], kind: 'or'},
]

/**
 * The three classes of comparison, which are one level of the grammar and not
 * three. `ComparisonExpr` takes an operand from either side of one operator
 * and admits no run of them, so which class an operator belongs to names the
 * node it builds and settles nothing about what may stand beside it.
 * @type {Array.<{types: Array.<string>, kind: string}>}
 */
const COMPARISONS = [
  {types: GENERALS, kind: 'comparison'},
  {types: VALUES, kind: 'value-comparison'},
  {types: NODES, kind: 'node-comparison'},
]

/**
 * An operand of the ladder: everything that binds tighter than its first level.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const operand = function(cursor) {
  return typedExpr(cursor)
}

/**
 * The whole precedence ladder, climbed from the tightest level to the loosest.
 * Two of its levels take one operand rather than a run of them and so are
 * spelled out rather than folded: the range operator between the sums and the
 * comparisons, and the comparison itself between the concatenations and the
 * `and`.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const laddered = function(cursor) {
  let below = operand
  for (const level of LADDER) {
    const under = below
    /**
     * This level of the ladder, folding the one below it.
     * @param {object} cursor - The cursor
     * @return {object} - The node
     */
    const level_ = function(cursor) {
      return folded(cursor, under, level.types, level.kind)
    }
    below = level_
    if (level.kind === 'sum') {
      const summed = below
      /**
       * The range operator, which sits between the sums and the comparisons
       * and takes one operand rather than a run of them.
       * @param {object} cursor - The cursor
       * @return {object} - The node
       */
      const ranged = function(cursor) {
        const from = significant(cursor)
        let node = summed(cursor)
        if (spells(cursor, 'to')) {
          admits(cursor, 'range')
          take(cursor)
          node = shaped('range', from, cursor, [node, summed(cursor)])
        }
        return node
      }
      below = ranged
    }
    if (level.kind === 'concat') {
      const concatenated = below
      /**
       * A comparison, which stands between the concatenations and the `and`
       * and holds at most one operator, so `$a is $b` is an expression and
       * `$a is $b is $c` is not one.
       * @param {object} cursor - The cursor
       * @return {object} - The node
       */
      const compared = function(cursor) {
        const from = significant(cursor)
        let node = concatenated(cursor)
        const found = COMPARISONS.find(
          (one) => one.types.includes(ahead(cursor).type),
        )
        if (found !== undefined) {
          admits(cursor, found.kind)
          take(cursor)
          node = shaped(
            found.kind, from, cursor, [node, concatenated(cursor)],
          )
        }
        return node
      }
      below = compared
    }
  }
  return below(cursor)
}

/**
 * A single expression: one of the four that bind loosest of all, or the ladder
 * when none of them opens.
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const single = function(cursor) {
  let node = undefined
  if (spells(cursor, 'for')) {
    node = iterated(cursor, 'for')
  } else if (spells(cursor, 'let') && reaches(cursor, TOKENS.DOLLAR)) {
    node = iterated(cursor, 'let')
  } else if (spells(cursor, 'some') && reaches(cursor, TOKENS.DOLLAR)) {
    node = quantified(cursor, 'some')
  } else if (spells(cursor, 'every') && reaches(cursor, TOKENS.DOLLAR)) {
    node = quantified(cursor, 'every')
  } else if (spells(cursor, 'if') && reserves(cursor, 'if') &&
    reaches(cursor, TOKENS.LPAREN)) {
    node = conditional(cursor)
  } else {
    node = laddered(cursor)
  }
  return node
}

/**
 * A sequence: single expressions separated by commas, which is what the `Expr`
 * production is and what stands inside every bracket.
 * @param {object} cursor - The cursor
 * @return {object} - The `sequence` node, or the lone expression in it
 */
const sequence = function(cursor) {
  const from = significant(cursor)
  const parts = [single(cursor)]
  while (sees(cursor, TOKENS.COMMA)) {
    take(cursor)
    parts.push(single(cursor))
  }
  let node = parts[0]
  if (parts.length > 1) {
    node = shaped('sequence', from, cursor, parts)
  }
  return node
}

/**
 * Parse an XPath expression into a position-preserving tree.
 *
 * Every node carries the range of tokens it spans rather than a pair of
 * character offsets, so a position is never computed from text — it is carried
 * from the lexer, which had it. The tokens themselves come back with the tree,
 * trivia and all, so the text of any node is the tokens of its span joined
 * together and the whole stream joined together is the expression as it was
 * written. That is what keeps a fix a span replacement over raw source rather
 * than a re-serialisation of a tree that lost the author's spacing.
 *
 * The version in force is a parameter rather than a lookup, because the same
 * text is a different language under a different one: `a to b` is a range in
 * 2.0 and two steps around a name in 1.0, and modern syntax in a 1.0
 * stylesheet is a parse failure rather than an entry on a list of spellings
 * somebody has to keep current (#652).
 *
 * A refusal is an answer, not an exception, since a corpus asks about thousands
 * of expressions and most callers want a verdict. It names what the grammar
 * expected and the offset it stood at, so a report can point at the fault
 * rather than at the attribute holding it.
 * @param {string} xpath - The expression
 * @param {string} version - The XSLT version in force where it sits
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} -
 *   The tokens, the tree when it parsed, and the complaint when it did not
 */
const parsed = function(xpath, version) {
  let tokens = []
  let tree = null
  let fault = ''
  let at = 0
  try {
    tokens = tokenized(xpath)
    const cursor = cursorOf(tokens, version)
    tree = sequence(cursor)
    if (ahead(cursor) !== END) {
      refuse(cursor, 'the end of the expression')
    }
  } catch (err) {
    if (!err.fault) {
      throw err
    }
    tree = null
    fault = err.message
    at = err.at
  }
  return {tokens: tokens, tree: tree, fault: fault, at: at}
}


/**
 * The version that rewrote the pattern grammar around the expression one, and
 * so the floor every production below belongs to.
 * @type {string}
 */
const REWRITE = '3.0'

/**
 * Refuse a pattern production an older XSLT does not have. 3.0 rebuilt the
 * grammar on top of the expression one and brought `intersect` and `except`
 * between two branches, `union` spelled as a word, a variable or three more
 * functions rooting a path, a branch in brackets, and `.` for the context node.
 * 1.0 and 2.0 have a union of paths and nothing else, so admitting any of it
 * there calls a stylesheet valid that no processor of that version loads.
 * @param {object} cursor - The cursor, standing at the production
 */
const rewritten = function(cursor) {
  if (!since(cursor.version, REWRITE)) {
    refuse(cursor, `a construct an XSLT ${cursor.version} pattern has`)
  }
}

/**
 * The functions a pattern may root a path on, which no other call may stand in
 * front of a path there. They name their nodes outright rather than reaching
 * them from a context, so a pattern beginning with one is anchored the way an
 * absolute path is. 1.0 and 2.0 have the two of `IdKeyPattern`; 3.0's
 * `OuterFunctionName` adds three more.
 * @param {object} cursor - The cursor
 * @return {Array.<string>} - The names it may open with
 */
const anchors = function(cursor) {
  let names = ['id', 'key']
  if (since(cursor.version, REWRITE)) {
    names = ['doc', 'element-with-id', 'id', 'key', 'root']
  }
  return names
}

/**
 * The axes a step of a pattern may name. A pattern is matched by walking up
 * from a node rather than evaluated forwards, so the axes it admits are the
 * ones such a walk can answer. 1.0 and 2.0 spell that
 * `ChildOrAttributeAxisSpecifier` and admit exactly the two it is named after;
 * 3.0 rebuilt the grammar and its `ForwardAxisP` admits six, adding `self`,
 * `descendant`, `descendant-or-self` and `namespace`. Neither admits the four
 * reverse axes, `following`, `following-sibling` or `preceding-sibling`.
 * @param {object} cursor - The cursor
 * @return {Array.<string>} - The axis kinds a step may open with
 */
const treads = function(cursor) {
  let axes = [TOKENS.CHILD, TOKENS.ATTRIBUTE]
  if (since(cursor.version, REWRITE)) {
    axes = [
      TOKENS.CHILD, TOKENS.ATTRIBUTE, TOKENS.SELF, TOKENS.DESCENDANT,
      TOKENS.DESCENDANT_OR_SELF, TOKENS.NAMESPACE,
    ]
  }
  return axes
}

/**
 * One step of a pattern's path, which is narrower than a step of an
 * expression's at every version. A pattern is matched by walking *up* from a
 * node, so a step it cannot walk back along is refused rather than evaluated:
 * that is what the two lists have in common, and the seven axes no version
 * admits — the four reverse ones, `following`, `following-sibling` and
 * `preceding-sibling` — are the ones an ancestor walk cannot answer. `..` is
 * refused everywhere for the same reason, while `.` is a step from 3.0.
 * @param {object} cursor - The cursor
 * @return {object} - The `step` node
 */
const treaded = function(cursor) {
  const token = ahead(cursor)
  if ((AXES.includes(token.type) && !treads(cursor).includes(token.type)) ||
    token.type === TOKENS.DOUBLE_DOT ||
    (token.type === TOKENS.DOT && !since(cursor.version, REWRITE))
  ) {
    refuse(cursor, `an axis an XSLT ${cursor.version} pattern may name`)
  }
  return stepped(cursor)
}

/**
 * One step of a pattern's path. It is an axis step, or a branch in brackets,
 * which 3.0's `StepExprP` admits at *any* position in a path and not only where
 * one opens — so `a/(b|c)` is a pattern as much as `(b|c)/a` is. That is where
 * a pattern parts from an expression, whose own parenthesized step may only
 * open a path (#711), and reading the two alike refused a pattern XSLT admits.
 * @param {object} cursor - The cursor
 * @return {object} - The `step`, or what the brackets hold
 */
const paced = function(cursor) {
  let node = null
  if (sees(cursor, TOKENS.LPAREN)) {
    rewritten(cursor)
    node = bracketed(cursor)
  } else {
    node = treaded(cursor)
  }
  return node
}

/**
 * One argument of the call a pattern anchors on. XSLT narrows `FunctionCallP`
 * to a literal or a variable reference, which the expression grammar's argument
 * list does not: a path, a call, a comparison or a bracket there is XTSE0340,
 * and `key("k", a/b)`, `id("x" | "y")` and `doc(concat("a", "b"))/x` parsed as
 * patterns until this stood in the way. A variable is 3.0's, as it is wherever
 * else a pattern names one.
 *
 * A numeric literal is a literal, so `key("k", 1)` is a pattern. `id(1)` is not
 * accepted by a processor either, but for `XPTY0004` rather than `XTSE0340` —
 * that is `id`'s signature and not the pattern grammar, so it is none of this
 * function's business.
 * @param {object} cursor - The cursor
 * @return {object} - The literal or variable reference
 */
const literal = function(cursor) {
  let node = null
  if (sees(cursor, TOKENS.DOLLAR)) {
    rewritten(cursor)
    node = primary(cursor)
  } else if (sees(cursor, TOKENS.STRING) || sees(cursor, TOKENS.NUMBER)) {
    node = primary(cursor)
  } else {
    refuse(cursor, 'a literal or a variable reference')
  }
  return node
}

/**
 * The call a pattern anchors a path on, which {@link anchors} names. Its
 * arguments are narrower than a call's anywhere else, and `root` takes none at
 * all — `root($v)` is XTSE0340 where `root()` is a pattern.
 * @param {object} cursor - The cursor, standing at the name
 * @return {object} - The `call` node, with any predicates behind it
 */
const anchored = function(cursor) {
  const from = significant(cursor)
  const name = ahead(cursor).value
  take(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  const args = []
  if (!sees(cursor, TOKENS.RPAREN)) {
    if (name === 'root') {
      refuse(cursor, 'no argument, which is all a pattern gives root()')
    }
    do {
      args.push(literal(cursor))
    } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  return shaped('call', from, cursor, args.concat(filtered(cursor)))
}

/**
 * A branch in brackets, which is `ParenthesizedExprP` and holds a *pattern*
 * rather than whatever an expression may hold: `(a | b)/c` is a pattern and
 * `(1 + 1)/a`, `(a = b)/c`, `("s")/a` and `(a, b)/c` are not, though every one
 * of them is a fine expression. Reading it through the expression grammar's own
 * parenthesized primary admitted all four.
 *
 * What it holds is optional, as it is in the expression grammar's own
 * parenthesized primary: `()` matches nothing and is a pattern all the same, so
 * `()/a` and `() | a` parse. Requiring a pattern inside refused all eight
 * spellings of it, and an under-acceptance is the direction that invents a
 * defect against working code.
 * @param {object} cursor - The cursor, standing at the `(`
 * @return {object} - The `parenthesized` node, with any predicates behind it
 */
const bracketed = function(cursor) {
  const from = significant(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  const parts = []
  if (!sees(cursor, TOKENS.RPAREN)) {
    parts.push(unioned(cursor))
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  return shaped(
    'parenthesized', from, cursor, parts.concat(filtered(cursor)),
  )
}

/**
 * The step a path opens with, which is every step but `.`. A context step is
 * reached rather than named: `b/.`, `/.` and `//.` are patterns because a
 * separator stands in front of the dot, while `(.)`, `a/(.)` and the `.` of
 * `a | .` open one and are refused. Standing alone it is not a step at all but
 * the whole of `PredicatePattern`, which {@link whole} reads before a union.
 * @param {object} cursor - The cursor
 * @return {object} - The step
 */
const entered = function(cursor) {
  if (sees(cursor, TOKENS.DOT)) {
    refuse(cursor, 'a step a pattern may open a path with')
  }
  return paced(cursor)
}

/**
 * One branch of a pattern: an optional root, then steps. It is the expression
 * grammar's own path production with the operators taken away — a pattern has
 * no arithmetic, no comparison and no call but the anchors, so what is left is
 * the steps and what hangs off them.
 *
 * A `/` may stand alone, and a `//` may not: the step after it is what a
 * descent descends to, and every version spells that `'//' RelativePathExprP`
 * with nothing optional about it. Accepting a bare `//` reported as valid a
 * `match` that Saxon rejects with XTSE0340 and xsltproc refuses outright.
 * @param {object} cursor - The cursor
 * @return {object} - The `branch` node
 */
const branched = function(cursor) {
  const from = significant(cursor)
  const parts = []
  if (sees(cursor, TOKENS.SLASH)) {
    take(cursor)
    if (steps(cursor)) {
      parts.push(paced(cursor))
    }
  } else if (sees(cursor, TOKENS.DOUBLE_SLASH)) {
    take(cursor)
    parts.push(paced(cursor))
  } else if (sees(cursor, TOKENS.DOLLAR)) {
    rewritten(cursor)
    parts.push(postfixed(cursor))
  } else if (anchors(cursor).includes(ahead(cursor).value) &&
    reaches(cursor, TOKENS.LPAREN)) {
    parts.push(anchored(cursor))
  } else {
    parts.push(entered(cursor))
  }
  while (sees(cursor, TOKENS.SLASH) || sees(cursor, TOKENS.DOUBLE_SLASH)) {
    take(cursor)
    parts.push(paced(cursor))
  }
  return shaped('branch', from, cursor, parts)
}

/**
 * A branch, and the set operators 3.0 lets stand between two of them. They bind
 * tighter than the union does, which is why they sit between it and a branch
 * rather than beside either.
 * @param {object} cursor - The cursor
 * @return {object} - The `branch`, or the `crossing` around two of them
 */
const crossed = function(cursor) {
  const from = significant(cursor)
  let node = branched(cursor)
  while (sees(cursor, TOKENS.INTERSECT) || sees(cursor, TOKENS.EXCEPT)) {
    rewritten(cursor)
    take(cursor)
    node = shaped('crossing', from, cursor, [node, branched(cursor)])
  }
  return node
}

/**
 * A union of pattern branches, which is `UnionExprP` and what both a whole
 * pattern and a bracketed one are made of. It is one production rather than a
 * loop written twice, because a bracket admits exactly what the top level does
 * — `(a | b)/c` is a pattern for the same reason `a | b` is.
 * @param {object} cursor - The cursor
 * @return {object} - The `pattern` node, or the lone branch when there is one
 */
const unioned = function(cursor) {
  const from = significant(cursor)
  const branches = [crossed(cursor)]
  while (sees(cursor, TOKENS.PIPE) || sees(cursor, TOKENS.UNION)) {
    if (sees(cursor, TOKENS.UNION)) {
      rewritten(cursor)
    }
    take(cursor)
    branches.push(crossed(cursor))
  }
  let node = branches[0]
  if (branches.length > 1) {
    node = shaped('pattern', from, cursor, branches)
  }
  return node
}

/**
 * The whole pattern: a `PredicatePattern` or a union of branches. The first is
 * `.` and its predicates and nothing else, so it stands alone or not at all —
 * `a | .`, `. | a` and `.[@x] | a` are refused — while a `.` reached across a
 * separator, as in `b/.`, is a step and not this production.
 * @param {object} cursor - The cursor
 * @return {object} - The tree the pattern comes out as
 */
const whole = function(cursor) {
  const from = significant(cursor)
  let node = null
  if (sees(cursor, TOKENS.DOT)) {
    rewritten(cursor)
    node = shaped('branch', from, cursor, [stepped(cursor)])
  } else {
    node = unioned(cursor)
  }
  return node
}

/**
 * Parse an XSLT pattern, which is a different language from an XPath
 * expression and needs a grammar of its own.
 *
 * A pattern says which nodes a rule matches, not what to select, so its shape
 * is a union of paths and nothing else: no arithmetic, no comparison, no call
 * but the anchors. Reading one with the expression grammar accepts what XSLT
 * refuses — `1 + 1` and `@a = "b"` and `a, b` are fine expressions and no
 * pattern at all — and refuses what it admits. Nothing parsed a pattern before
 * this, so a malformed `match="foo["` was silent, which is #589 (#678).
 *
 * The version in force decides which language this is, and by more than a
 * detail: 3.0 rebuilt the pattern grammar on the expression one, so
 * `a intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`,
 * `(self::node())`, `.` and the word `union` are all patterns there and none of
 * them is one in 1.0 or 2.0, whose whole grammar is `IdKeyPattern` and a union
 * of relative paths. Every one of those is gated on {@link REWRITE} rather than
 * admitted everywhere, because a pattern accepted under a version that has no
 * production for it is a stylesheet called valid that no processor loads.
 *
 * What it does *not* yet do is refuse the productions a pattern has no room
 * for. The steps come from the expression grammar whole, so an axis a pattern
 * may not name is accepted here, as is a `.` standing as one branch of a union
 * where 3.0 admits it only as the whole pattern, and a bracket holds whatever
 * an expression may hold rather than the `Pattern` its own production names —
 * `a/(1 + 1)` parses. Narrowing that to the restricted set each version admits
 * is #679. That direction is the cheap one to defer — an over-acceptance leaves
 * a defect unreported, while refusing a pattern XSLT admits invents one against
 * working code.
 * @param {string} pattern - The pattern
 * @param {string} version - The XSLT version in force where it sits
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} -
 *   The tokens, the tree when it parsed, and the complaint when it did not
 */
const matched = function(pattern, version) {
  let tokens = []
  let tree = null
  let fault = ''
  let at = 0
  try {
    tokens = tokenized(pattern)
    const cursor = cursorOf(tokens, version)
    tree = whole(cursor)
    if (ahead(cursor) !== END) {
      refuse(cursor, 'the end of the pattern')
    }
  } catch (err) {
    if (!err.fault) {
      throw err
    }
    tree = null
    fault = err.message
    at = err.at
  }
  return {tokens: tokens, tree: tree, fault: fault, at: at}
}

module.exports = {
  parsed,
  matched,
}
