/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, TOKENS} = require('./tokens')
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
 * The floor each construct's version gate compares against, keyed by the kind
 * of node it builds. XSLT's version is what a stylesheet declares and what
 * `versionOf` hands back, so these are XSLT versions rather than XPath's: 1.0
 * carries XPath 1.0, 2.0 carries XPath 2.0, and 3.0 carries XPath 3.1. A
 * construct absent from this table is in every version, `1.0` included.
 * @type {{[kind: string]: string}}
 */
const SINCE = {
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
  'instance': '2.0',
  'intersect': '2.0',
  'let': '3.0',
  'lookup': '3.0',
  'map': '3.0',
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
 * The kind tests a node test may be written as, each a name the grammar spells
 * followed by a bracket. They are names to the lexer, so the parser tells one
 * from a function call by what stands in front of it: a node test stands where
 * a step does, a call where a value does.
 * @type {Array.<string>}
 */
const KINDS = [
  'node', 'text', 'comment', 'processing-instruction', 'element', 'attribute',
  'document-node', 'schema-element', 'schema-attribute', 'namespace-node',
  'item', 'empty-sequence', 'function', 'map', 'array',
]

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
  if (!sees(cursor, TOKENS.USER_FUNCTION)) {
    expect(cursor, TOKENS.NAME, 'a name')
  } else {
    take(cursor)
  }
  return shaped('name', from, cursor, [])
}

/**
 * A sequence type: a name or a kind test, then an optional occurrence
 * indicator. It is thinner than the full `SequenceType` production, which
 * `xslint:` has no use for yet — what a check asks of a type is which name it
 * mentions, and the shape of an item type is #679's business.
 * @param {object} cursor - The cursor
 * @return {object} - The `type` node
 */
const typed = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.NAME) && KINDS.includes(ahead(cursor).value)) {
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
  } else {
    named(cursor)
  }
  if (sees(cursor, TOKENS.LOOKUP) || sees(cursor, TOKENS.MULTI) ||
    sees(cursor, TOKENS.PLUS)) {
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
 * A node test: a name, a wildcard in any of its three spellings, or a kind test
 * such as `text()`. A wildcard's parts arrive as separate tokens, since `*` is
 * an operator elsewhere and a prefix is a name, so the three are read here
 * rather than asked of the lexer.
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
  } else if (sees(cursor, TOKENS.NAME) && KINDS.includes(ahead(cursor).value) &&
    reaches(cursor, TOKENS.LPAREN)) {
    typed(cursor)
  } else {
    const prefixed = ahead(cursor).value.endsWith(':')
    named(cursor)
    if (prefixed) {
      expect(cursor, TOKENS.MULTI, '"*" after the prefix')
    }
  }
  return shaped('test', from, cursor, [])
}

/**
 * Whether the token after the next one is of the given kind, which is the one
 * place the grammar needs to see past what it is standing on: `text` is a name
 * until a bracket follows it, and then it is a kind test.
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
 * @param {object} cursor - The cursor
 * @return {boolean} - True when a step stands there
 */
const steps = function(cursor) {
  const token = ahead(cursor)
  return AXES.includes(token.type) || token.type === TOKENS.AT ||
    token.type === TOKENS.DOUBLE_DOT || token.type === TOKENS.DOT ||
    token.type === TOKENS.MULTI ||
    (token.type === TOKENS.NAME && !KEYWORDS.includes(token.value)) ||
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
 * the first step is asked for rather than assumed.
 * @param {object} cursor - The cursor
 * @return {object} - The `path` node
 */
const walked = function(cursor) {
  const from = significant(cursor)
  const parts = []
  let opened = false
  if (sees(cursor, TOKENS.SLASH) || sees(cursor, TOKENS.DOUBLE_SLASH)) {
    opened = true
    take(cursor)
    if (steps(cursor)) {
      parts.push(parted(cursor))
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
        typed(cursor)
      }
    } while (sees(cursor, TOKENS.COMMA) && take(cursor))
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  if (spells(cursor, 'as')) {
    take(cursor)
    typed(cursor)
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
  } else if (token.value === 'function' && reaches(cursor, TOKENS.LPAREN)) {
    node = inlined(cursor)
  } else if (called(cursor)) {
    named(cursor)
    node = shaped('call', from, cursor, arguments_(cursor))
  } else {
    node = stepped(cursor)
  }
  return node
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
  return (token.type === TOKENS.NAME || token.type === TOKENS.USER_FUNCTION) &&
    !KINDS.includes(token.value) && reaches(cursor, TOKENS.LPAREN)
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
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const postfixed = function(cursor) {
  const from = significant(cursor)
  let node = primary(cursor)
  if (sees(cursor, TOKENS.HASH)) {
    admits(cursor, 'reference')
    take(cursor)
    expect(cursor, TOKENS.NUMBER, 'the arity of the function')
    node = shaped('reference', from, cursor, [node])
  }
  while (sees(cursor, TOKENS.LBRACKET) || sees(cursor, TOKENS.LPAREN) ||
    sees(cursor, TOKENS.LOOKUP)) {
    if (sees(cursor, TOKENS.LBRACKET)) {
      node = shaped('filter', from, cursor, [node].concat(filtered(cursor)))
    } else if (sees(cursor, TOKENS.LPAREN)) {
      node = shaped('apply', from, cursor, [node].concat(arguments_(cursor)))
    } else {
      admits(cursor, 'lookup')
      take(cursor)
      node = shaped('lookup', from, cursor, [node, keyed(cursor)])
    }
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
    node = walked(cursor)
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
  const words = {cast: 'cast', castable: 'castable', treat: 'treat'}
  for (const word of Object.keys(words)) {
    if (spells(cursor, word)) {
      admits(cursor, word)
      take(cursor)
      keyword(cursor, 'as')
      node = shaped(word, from, cursor, [node, typed(cursor)])
    }
  }
  if (sees(cursor, TOKENS.INSTANCE_OF)) {
    admits(cursor, 'instance')
    take(cursor)
    node = shaped('instance', from, cursor, [node, typed(cursor)])
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
  {types: [TOKENS.SIMPLE_MAP], kind: 'simple-map'},
  {types: [TOKENS.INTERSECT], kind: 'intersect'},
  {types: [TOKENS.EXCEPT], kind: 'except'},
  {types: [TOKENS.PIPE], kind: 'union'},
  {types: [TOKENS.UNION], kind: 'intersect'},
  {types: [TOKENS.MULTI, TOKENS.DIV, TOKENS.MOD], kind: 'product'},
  {types: [TOKENS.IDIV], kind: 'idiv'},
  {types: [TOKENS.PLUS, TOKENS.MINUS], kind: 'sum'},
  {types: [TOKENS.CONCAT], kind: 'concat'},
  {types: GENERALS, kind: 'comparison'},
  {types: VALUES, kind: 'value-comparison'},
  {types: [TOKENS.AND], kind: 'and'},
  {types: [TOKENS.OR], kind: 'or'},
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
 * The range operator sits between the sums and the comparisons and takes one
 * operand rather than a run of them, so it is spelled out rather than folded.
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
  } else if (spells(cursor, 'if') && reaches(cursor, TOKENS.LPAREN)) {
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
    node = postfixed(cursor)
  } else {
    node = stepped(cursor)
  }
  return node
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
  } else if (sees(cursor, TOKENS.DOT)) {
    rewritten(cursor)
    parts.push(stepped(cursor))
  } else if (anchors(cursor).includes(ahead(cursor).value) &&
    reaches(cursor, TOKENS.LPAREN)) {
    parts.push(postfixed(cursor))
  } else {
    parts.push(paced(cursor))
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
    const from = significant(cursor)
    const branches = [crossed(cursor)]
    while (sees(cursor, TOKENS.PIPE) || sees(cursor, TOKENS.UNION)) {
      if (sees(cursor, TOKENS.UNION)) {
        rewritten(cursor)
      }
      take(cursor)
      branches.push(crossed(cursor))
    }
    tree = branches[0]
    if (branches.length > 1) {
      tree = shaped('pattern', from, cursor, branches)
    }
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
