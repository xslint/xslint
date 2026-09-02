/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `parsed(xpath, version)` — the XPath 3.1 expression grammar as recursive
 * descent over `tokenized`, one function per production. A node's span is a
 * range of *token indexes*, never a pair of character offsets, so a position
 * is carried from the lexer rather than computed from text, and the text of a
 * node is the tokens of its span joined back together. The whole stream comes
 * back with the tree, trivia and all, so joining it reproduces the expression
 * as written — which is what keeps a fix a span replacement over raw source.
 * The version in force is a parameter rather than a lookup, because the same
 * text is a different language under a different one: `a to b` is a range in
 * 2.0 and two steps around a name in 1.0, so modern syntax in a 1.0 stylesheet
 * is a parse failure rather than an entry on a list somebody has to keep
 * current (#652). The node comparisons are gated that way too: `is`, `<<` and
 * `>>` stand beside the value and general comparisons and are refused below
 * 2.0, the version that added them, so one selector of this project's own —
 * the `$var << .` of `confusing-variable-and-node` — stopped being valid XPath
 * our own parser refuses (#724). Beside them, and not below them: the three
 * classes are one level of the ladder rather than three, because
 * `ComparisonExpr` takes an operand from either side of one operator and
 * admits no run of them (#726). Two levels of the ladder are spelled out
 * rather than folded for that reason — the range between the sums and the
 * comparisons, and the comparison between the concatenations and the `and` —
 * since a `folded` run is left-associative and takes as many operands as it is
 * offered. That associativity is why one production is one rung of `LADDER`
 * and every spelling it takes stands on that rung: three of them were two
 * rungs apiece until #764, split so a spelling could carry a kind or a floor
 * the other had not got — the word `union` above `|`, `idiv` above the other
 * multiplicatives, `except` above `intersect` — and a rung is what decides how
 * tightly an operator binds, so the split made the second of each pair the
 * looser and nested a mixed run to the right. `9 idiv 2 * 3` came back `9 idiv
 * (2 * 3)`, which is 1 where XPath computes 12, and `a except b intersect c`
 * selected what `a except (b intersect c)` selects; a `RUNS` row in
 * `test/grammar.test.js` now asks of every mixed pair that its left operand
 * covers the first operator. The kind names the production, as `sum` has
 * always covered a `-`, and a spelling younger than its rung carries its floor
 * in `SPELLS` — asked of the operator ahead rather than of the node about to
 * be built, since both spellings of a union build a `union` and `SINCE`, keyed
 * on the kind, can only speak for the rung as a whole. Three rungs let a
 * comparison chain onto another, so `a = b eq c` and `a < b < c` parsed; over
 * the 225 pairs fifteen comparison operators spell, the engine accepts none
 * and the grammar accepted 144. The node comparisons would have taken that to
 * 225, which is how the defect surfaced: the 81 pairs holding one were refused
 * because the lexer did not know the operator, not because the grammar was
 * right, and fixing the lexer took the accidental cover off. No committed
 * expression chains comparisons, so the corpus gate cannot see any of it and
 * four `REFUSES` rows pin it instead, one per class and one crossing two. A
 * name with a bracket behind it is read off one table, `RESERVED`, which maps
 * each name XPath has taken to the version that took it, what it was taken
 * for, and the production that reads its brackets — a `test` (a kind test,
 * standing where a node test stands), an `item` (an item type, standing in a
 * sequence type and nowhere a node test does) or a `keyword` (`if`, and the
 * `switch` and `typeswitch` this grammar has no production of). 1.0 takes the
 * four node types alone, 2.0 adds its kind tests with `empty-sequence`, `if`,
 * `item` and `typeswitch`, and 3.0 adds `array`, `function`, `map`,
 * `namespace-node` and `switch`. `reserves` asks whether the version has taken
 * the name at all, which is the whole of what a *call* needs to know, and
 * `taken` asks whether it was taken for one of the kinds a particular
 * production will accept. The brackets themselves were *counted* rather than
 * read until #753 — `kinded` walked to the matching `)` and let anything at
 * all stand inside — so `text(a)`, `node($v)`, `element(1)`, `element(a b)`
 * and `element(a, xs:string*)` all parsed, in a pattern as much as in an
 * expression, where every processor answers XPST0003 and since #739 that is a
 * missing `invalid-xpath-expression` on a `match="text(a)"` no processor
 * loads. Each name reads its own now, one production per shape XPath spells:
 * `closes` for the six that take an empty bracket, `instructed` for a
 * processing-instruction test, `elemented` and `attributed` for the two that
 * name a node and optionally its type, `declared` for the two `schema-*` that
 * require a declaration, `documented` for a document test's
 * element-or-schema-element, and `paired`, `listed` and `returned` for the
 * map, array and function tests. The count hid an *under*-acceptance too,
 * which is the direction that invents a defect against working code: a
 * function test's return type stands behind its closing bracket,
 * `TypedFunctionTest` requiring an `as` where `AnyFunctionTest` refuses one,
 * so the walk swallowed the arguments and `$v instance of function() as
 * xs:integer` was refused for text left over at the end. Which production
 * reads which name is the table's third field rather than a `switch` beside
 * it, which is why the table sits below those productions instead of among the
 * version tables it began in: a name taken for a test or an item type cannot
 * lack the production that reads it, and a keyword has no such field. The
 * arbitration is worth recording because a single engine could not have
 * settled it — fontoxpath refuses `element(a, xs:string?)`, which Saxon-HE
 * 12.5 accepts and the specification spells, and it accepts a nillable
 * `attribute(a, xs:string?)`, which Saxon refuses with XPST0003 and the
 * specification has no production for. Reading the arbiter's *code* rather
 * than its exit status is what tells the two apart from the eight rows where
 * Saxon answers XPST0008 or XPST0051 — a missing schema or an unknown type,
 * static errors against text it parsed — and xsltproc settles the one place
 * the versions differ, XPath 1.0's `NodeTest` taking `'processing-instruction'
 * '(' Literal ')'` where 2.0's `PITest` adds the NCName, so
 * `processing-instruction(a)` is a syntax error in a 1.0 stylesheet and a name
 * in a 2.0 one. The floor is half of what a name means, because below it the
 * same characters are an ordinary call to a function so called — unregistered,
 * which is #576's question and not the parser's, and exactly what xsltproc
 * answers at 1.0 about every name in the table: it parses the expression and
 * then goes looking for the function. Two version-blind lists sat beside the
 * floors until #728, the same fact written twice with the version in one copy
 * only, so `element(a)` came back a `step` in a 1.0 stylesheet where a 1.0
 * processor reads a call. The verdict agreed and the tree did not, which is
 * the half an acceptance diff cannot see — #708 measured against fontoxpath,
 * an XPath 3.1 engine, and every one of these agrees with it at 3.1 — and the
 * half Phase 4 of #644 walks. So a `SHAPED` row in `test/grammar.test.js`
 * asserts the *kind* on both sides of a floor where neither side is a refusal,
 * beside a `RESERVES` row, which is the mirror of a `GATED` one: a construct
 * that stops parsing from a version up rather than starting. Applying an
 * expression is gated the same way and was not gated at all: `$f(1)` is a
 * dynamic call from 3.0, when function items arrived, and before that the
 * characters are no call by another reading either, a `FilterExpr` taking
 * predicates and no argument list — which is how `child::element(b)` came back
 * an `apply` at 1.0 the moment `element` stopped being a kind test there. A
 * name is taken only where a call could stand, in front of a bracket, so
 * `//item` is the path it always was. A refusal is an answer rather than an
 * exception — a corpus asks about thousands of expressions and most callers
 * want a verdict — and it names the offset it stood at, so a report can point
 * at the fault instead of at the attribute holding it. An inline namespace is
 * gated at 3.0 along with everything else that version added, and it reaches
 * four productions rather than one, a name being spelled in more places than a
 * step: `named` composes the braced URI literal with the name behind it, so a
 * variable and a call get it for free; `tested` reads one standing in front of
 * a `*` as the fourth spelling of a wildcard, `Q{uri}*` naming every element
 * of a namespace with no prefix bound to it; `called` asks `pastName` where
 * `reaches` cannot, since a name is one token spelled as a QName and two with
 * its namespace inline, so the bracket that tells a call from a step stands
 * one token away or two; and `steps` counts it among the kinds a step may open
 * with, since a step opening `Q{uri}a` opens with a name like any other. It
 * asks that of `NAMES` rather than of one kind at a time, the lexer kinding a
 * name three ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one has
 * a bracket behind it, a `URI` where it spells its namespace inline. Asking
 * about one kind is a defect that repeated itself before the shape was seen:
 * the first draft of #708 accepted `a/Q{urn:my}b` and refused `//Q{urn:my}a`,
 * the shape the inline form exists for, and with that fixed `a/my:fn(1)` was
 * still accepted while `//my:fn(1)` was refused (#731). Every production that
 * *reads* a name knew all three kinds; the one deciding where a name may stand
 * knew them one at a time, and a path is the only place that distinction
 * shows. Under-acceptance is the direction that invents a defect against
 * working code. A reserved name is never either of those spellings, XPath
 * reserving an unprefixed one alone (#708). Beside it stands `matched(pattern,
 * version)`, because a pattern is a different language and not a second
 * reading of this one: it is a union of paths and nothing else, so `1 + 1`,
 * `@a = "b"` and `a, b` are fine expressions and no pattern at all, and
 * reading a `match` with the expression grammar admits every one of them
 * (#589, #649). The version decides which language it is, by more than a
 * detail: 3.0 rebuilt the pattern grammar on top of the expression one, so `a
 * intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`,
 * `(self::node())`, `.` and the word `union` are all patterns there and none
 * of them is one in 1.0 or 2.0, whose whole grammar is `IdKeyPattern` and a
 * union of relative paths — each is gated on `REWRITE` rather than admitted
 * everywhere, since a pattern accepted under a version with no production for
 * it is a stylesheet called valid that no processor loads. A `/` may stand
 * alone and a `//` may not, the step being what the descent descends to. A
 * bracketed branch is where a pattern parts from an expression rather than
 * borrowing it: 3.0's `StepExprP` admits one at *any* position in a path, so
 * `a/(b | c)` is a pattern as much as `(b | c)/a` is, while the expression
 * grammar's own parenthesized step may only open a path (#711) — reading the
 * two alike refused a pattern XSLT admits. Its steps are narrower than an
 * expression's at every version, because a pattern is matched by walking *up*
 * from a node rather than evaluated forwards, so an axis such a walk cannot
 * answer is a static error and not an empty match: `treads` names the two of
 * 1.0 and 2.0's `ChildOrAttributeAxisSpecifier` and the six of 3.0's
 * `ForwardAxisP`, which adds `self`, `descendant`, `descendant-or-self` and
 * `namespace`, and no version admits the four reverse axes, `following`,
 * `following-sibling` or `preceding-sibling`. A `..` never spells a step and a
 * `.` spells one from 3.0. Settling that took two processors and neither would
 * have done alone: SaxonJ-HE says what 3.0 refuses, with XTSE0340, but applies
 * its own 3.0 pattern syntax whatever the stylesheet declares — it admits
 * `self::a` and `.` at `version="1.0"` — so only xsltproc, being 1.0 only, can
 * say what an older version refuses. A processor shows that a construct is
 * admitted somewhere; only a version-aware one shows that a version refuses
 * it, which is the trap #717's arbitration fell into as well. Two more
 * borrowings from the expression grammar are paid back. A bracket is
 * `bracketed` rather than the expression grammar's parenthesized primary, so
 * it holds a `Pattern` — optionally, since `()` matches nothing and is a
 * pattern all the same — `(a | b)/c`, `(a)`, `(a[1])/b` and `(a | b)[1]` are
 * patterns and `(1 + 1)/a`, `(a = b)/c`, `("s")/a` and `(a, b)/c` are not,
 * though each of those is a fine expression. And `.` is the whole of
 * `PredicatePattern`, read by `whole` before any union, so it stands alone or
 * not at all: `a | .`, `. | a` and `.[@x] | a` are refused. It is still a
 * *step* once a separator stands in front of it, which is the distinction
 * `entered` draws — `b/.`, `/.` and `//.` are patterns while `(.)`, `(.)/a`
 * and `a/(.)` open a path with one and are not. The last borrowing goes with
 * them: `FunctionCallP` took its arguments from the expression grammar, where
 * XSLT admits a literal or a variable reference and nothing else, so `key("k",
 * a/b)`, `id("x" | "y")` and `doc(concat("a", "b"))/x` parsed as patterns;
 * `anchored` narrows them, and `root` takes no argument at all. A numeric
 * literal is a literal, so `key("k", 1)` is a pattern and `id(1)` is one too —
 * a processor refuses that second one for `XPTY0004`, which is `id`'s
 * signature rather than the pattern grammar, and reading the arbiter's *code*
 * rather than its exit status is what tells the two apart. Eight of a first
 * sweep's apparent over-acceptances were static-type, undeclared-prefix, arity
 * and classpath errors. A type is read by three productions rather than one,
 * because XPath spells three and they have three shapes: `kinded` for the kind
 * test of a `NodeTest`, `sequenced` for the `SequenceType` an `instance of`, a
 * `treat as` and a function's `as` take, and `singled` for the `SingleType` a
 * cast takes. One function served all three and took an occurrence indicator
 * wherever it was called, so a step lost the `+` of `text() + 1` to a type
 * that has none, `$v instance of (xs:integer)` was refused where a
 * `ParenthesizedItemType` stands, and `1 cast as node()` was accepted where a
 * cast makes an atomic value (#740). Two more borrowings went with it.
 * `postfixed` hung its `(`, `?` and `[` off whatever `primary` answered, and
 * `primary` answered a *step* when nothing else matched, so `a?b` came back a
 * lookup into a step and `@a(1)` a call applied to one — `StepExpr ::=
 * PostfixExpr | AxisStep` is a fork, and `opens` is now the whole of it, one
 * predicate naming the same shapes `primary` reads. A named function reference
 * is a `PrimaryExpr` of its own on that reading, not a postfix, which is what
 * `referred` says. And the simple map came off the ladder: `ValueExpr` *is* a
 * `SimpleMapExpr`, so `!` binds tighter than the unary signs and far tighter
 * than the four expressions taking a type, where a rung of the ladder put it
 * looser than all of them and `a instance of xs:integer ! b` parsed as a map
 * over a sequence type. Two questions the lexer cannot answer are answered
 * here instead, both of them about a word (#742). `counted` takes the
 * occurrence indicator a type ends with and reads the word behind it as the
 * operator it spells, since the `?` of `xs:integer?` and the `?` of `$m?div`
 * are one character with one token of lookahead behind each: the first ends a
 * value and the second opens a lookup key, so a wider `ENDS` answers for the
 * type and breaks the lookup, and only the production being read can tell them
 * apart. The `*` never needed it, `MULTI` already ending a value by spelling
 * the wildcard of `a/*` — an accident that made `item()* div 2` right for a
 * reason no rule stated. And `glued` refuses a keyword run against the
 * terminal in front of it, the same gap rule `operates` applies to the words
 * the lexer kinds, for the ones it hands over as names: `1to 3`, `1cast as
 * xs:integer` and the `1else` of `if (1) then 1else 2` are all XPST0003 and
 * every one of them parsed. `glued` is `abuts` narrowed to the kinds `GLUES`
 * names, so every question this file asks about a gap is one adjacency test
 * underneath, and `abuts` is the absence of a trivia token rather than
 * arithmetic over offsets — the stream being lossless, a gap or a comment
 * between two terminals is a token of its own. `welded` is the same question
 * one token further out, `reaches` with adjacency required, and the pair is
 * what a *terminal spelled out of several tokens* needs: a wildcard is the
 * only one XPath has, `Wildcard` being marked `ws: explicit`, so `my: *`, `*
 * :a`, `*: a`, `* : a`, `Q{urn:my} *` and `a/my: *` are not loose spellings of
 * one but XPST0003 in Saxon-HE 12.5, and `tested` read all six as wildcards
 * because `take` and `expect` skip trivia everywhere else, rightly (#736).
 * Each of the three composite spellings asks for adjacency in its own
 * condition and none refuses on its own account, a `*` being a whole wildcard
 * already: what a gap parts from it is the next production's business, which
 * is what leaves the `:` of `map {* : 1}` to the map constructor it separates.
 * Both are read by `isValid` since #732, which is Phase 3 of #644 opening — in
 * `src/xpath.js` then and in `src/syntax.js` now, where the parse is kept
 * rather than thrown away once its verdict is read (#577): a run's verdict on
 * whether an expression is valid is this file's, taken behind the two gates of
 * #680 that `test/grammar-corpus.test.js` holds `parsed` to, and the shape
 * sweep of `test/grammar-shapes.test.js` beside them.
 */

const {
  tokenized, qualified, worded, GLUES, TOKENS, TRIVIA,
} = require('./tokens')
const {since, MODERN} = require('./xsl-version')

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
 * their own. These are XSLT versions rather than XPath's, being what
 * `versionOf` hands back: 1.0 carries XPath 1.0, 2.0 XPath 2.0, 3.0 XPath 3.1.
 * A construct absent from this table is in every version.
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
  'for': '2.0',
  'inline-namespace': '3.0',
  'instance': '2.0',
  'instruction-name': '2.0',
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
 * The floor an *operator* stands from, for the two whose own vintage is
 * younger than the rung they stand on. A rung is one production and builds one
 * kind of node, so a floor carried on that kind speaks for every spelling the
 * rung takes: `union` and `|` are one `UnionExpr`. Both words arrived in 2.0
 * where their rung is as old as XPath, which the kind cannot say (#764).
 * @type {{[type: string]: string}}
 */
const SPELLS = {
  [TOKENS.IDIV]: '2.0',
  [TOKENS.UNION]: '2.0',
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
 * Whether the token ahead stands directly against the one in front of it, with
 * no gap or comment between them. The stream is lossless, so trivia is a token
 * of its own and adjacency is the absence of one rather than offset
 * arithmetic: it reads the token before by index rather than by significance,
 * which steps over exactly what this has to see (#742).
 * @param {object} cursor - The cursor
 * @return {boolean} - True when nothing stands between the two
 */
const abuts = function(cursor) {
  const before = cursor.tokens[significant(cursor) - 1]
  return before !== undefined && !TRIVIA.includes(before.type)
}

/**
 * Whether the token ahead abuts one XPath requires a gap after. Two terminals
 * neither of which ends at a character the other cannot hold need whitespace or
 * a comment between them, and `GLUES` names the kinds on the near side of that
 * pair — so this is `abuts` narrowed to them, and every question about a gap in
 * this file is one adjacency test underneath (#742).
 * @param {object} cursor - The cursor
 * @return {boolean} - True when no gap stands in front of it
 */
const glued = function(cursor) {
  return abuts(cursor) &&
    GLUES.includes(cursor.tokens[significant(cursor) - 1].type)
}

/**
 * Whether the next token is a name spelled the given way, which is how the
 * parser reads the words the lexer leaves as names because only the grammar
 * knows they are operators there. A word run against a terminal that cannot
 * delimit it is no keyword: `1to 3` and the `1else` of `if (1) then 1else 2`
 * are XPST0003, and both were read here as the keyword they spell (#742).
 * @param {object} cursor - The cursor
 * @param {string} value - The spelling to look for
 * @return {boolean} - True when it is
 */
const spells = function(cursor, value) {
  const token = ahead(cursor)
  return token.type === TOKENS.NAME && token.value === value &&
    !glued(cursor)
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
 * Refuse a construct whose floor the version in force stands below. A gate is a
 * lower bound, so a construct 2.0 introduced is in 3.0 too, and no floor at all
 * stands in every version.
 * @param {object} cursor - The cursor, standing at the construct
 * @param {?string} floor - The version it stands from, if any
 */
const floored = function(cursor, floor) {
  if (floor && !since(cursor.version, floor)) {
    refuse(cursor, `a construct XPath ${cursor.version} has`)
  }
}

/**
 * Refuse a construct the version in force does not have, by the kind of node it
 * builds. One absent from `SINCE` stands in every version.
 * @param {object} cursor - The cursor, standing at the construct
 * @param {string} kind - The kind of node about to be built
 */
const admits = function(cursor, kind) {
  floored(cursor, SINCE[kind])
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
 * Parse a run of one production separated by tokens of the given kinds,
 * folding each operator into a node of the given kind. Every binary level of
 * XPath's ladder is this shape. Two gates stand over the operator, a level's
 * vintage and a spelling's being different questions: splitting a level in two
 * to ask the second nested a mixed run the wrong way round (#764).
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
    floored(cursor, SPELLS[ahead(cursor).type])
    take(cursor)
    node = shaped(kind, from, cursor, [node, below(cursor)])
  }
  return node
}

/**
 * A name, wherever a QName may stand: a node test, a variable, a type, a call.
 * The lexer hands one over whole, colon and all. What `qualified` is still
 * asked about is the `USER_FUNCTION` kind, whose scan takes an ASCII run and a
 * bracket and weighs neither as an NCName, so `my:25l(3)` arrives whole; a
 * bare `NAME` is a QName since #746.
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
 * The occurrence indicator a type ends with, and the word behind it read as
 * the operator it spells. The lexer settles operator-hood from the last solid
 * token, which cannot tell the `?` of `xs:integer?` from the `?` of `$m?div`,
 * so the correction belongs here, having just read a type, rather than in a
 * wider `ENDS` that would answer for the type and break the lookup (#742).
 * @param {object} cursor - The cursor
 * @param {Array.<string>} kinds - The indicators this type admits
 */
const counted = function(cursor, kinds) {
  if (kinds.some((kind) => sees(cursor, kind))) {
    take(cursor)
    const word = worded(ahead(cursor).value)
    if (sees(cursor, TOKENS.NAME) && word !== undefined) {
      const at = significant(cursor)
      cursor.tokens[at] = {...cursor.tokens[at], type: word}
    }
  }
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
    taken(cursor, ahead(cursor).value, ['test', 'item']) &&
    reaches(cursor, TOKENS.LPAREN)) {
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
  if (!empty) {
    counted(cursor, [TOKENS.LOOKUP, TOKENS.MULTI, TOKENS.PLUS])
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
  atomic(cursor)
  counted(cursor, [TOKENS.LOOKUP])
  return shaped('type', from, cursor, [])
}

/**
 * The name of an atomic or union type, which a cast takes and a map keys on:
 * an `AtomicOrUnionType` is an `EQName` and a kind test is not one. A reserved
 * name is reserved *in front of a bracket* and nowhere else, so refusing it on
 * sight invented a defect on `1 cast as node` and `map(text, xs:integer)`,
 * which Saxon parses and fontoxpath accepts (#753).
 * @param {object} cursor - The cursor
 */
const atomic = function(cursor) {
  if (sees(cursor, TOKENS.NAME) &&
    taken(cursor, ahead(cursor).value, ['test', 'item']) &&
    reaches(cursor, TOKENS.LPAREN)) {
    refuse(cursor, 'the name of an atomic type')
  }
  named(cursor)
}

/**
 * The empty bracket, which is the whole of what six of the reserved names
 * take — `node`, `text`, `comment`, `namespace-node`, `item` and
 * `empty-sequence`. `TextTest ::= "text" "(" ")"` spells no argument, so
 * `text(a)` and `comment("x")` are XPST0003 in every processor and were parsed
 * here as a step until the brackets were read rather than counted (#753).
 * @param {object} cursor - The cursor
 */
const closes = function(cursor) {
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * The name or the wildcard an element or attribute test names its node with,
 * `ElementNameOrWildcard` and `AttribNameOrWildcard` being one shape twice. A
 * number, a lookup or a variable is none of it: `element(1)` and `element(?)`
 * are XPST0003.
 * @param {object} cursor - The cursor
 */
const wildcarded = function(cursor) {
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
  } else {
    named(cursor)
  }
}

/**
 * What a processing-instruction test takes: nothing, an NCName, or a string
 * literal. The name is where the versions part — XPath 1.0 admits a Literal
 * and nothing else, so `processing-instruction(a)` is a syntax error there,
 * while 2.0's `PITest` adds the NCName. A prefix is refused at every version,
 * an NCName carrying no colon.
 * @param {object} cursor - The cursor
 */
const instructed = function(cursor) {
  if (sees(cursor, TOKENS.STRING)) {
    take(cursor)
  } else if (!sees(cursor, TOKENS.RPAREN)) {
    admits(cursor, 'instruction-name')
    if (!sees(cursor, TOKENS.NAME) || ahead(cursor).value.includes(':')) {
      refuse(cursor, 'a name with no prefix, or a string literal')
    }
    take(cursor)
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What an element test takes: nothing, a name or wildcard, and behind a comma
 * a type with an optional `?` for whether the element may be nillable. One
 * type and no more, and no occurrence indicator on it — both `element(a,
 * xs:string, xs:integer)` and `element(a, xs:string*)` are XPST0003 — and that
 * type is a name rather than a wildcard.
 * @param {object} cursor - The cursor
 */
const elemented = function(cursor) {
  if (!sees(cursor, TOKENS.RPAREN)) {
    wildcarded(cursor)
    if (sees(cursor, TOKENS.COMMA)) {
      take(cursor)
      named(cursor)
      counted(cursor, [TOKENS.LOOKUP])
    }
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What an attribute test takes, which is an element test's shape less the `?`:
 * an attribute cannot be nillable, so `attribute(a, xs:string?)` is XPST0003
 * where `element(a, xs:string?)` is the spelling that carries the question.
 * @param {object} cursor - The cursor
 */
const attributed = function(cursor) {
  if (!sees(cursor, TOKENS.RPAREN)) {
    wildcarded(cursor)
    if (sees(cursor, TOKENS.COMMA)) {
      take(cursor)
      named(cursor)
    }
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * The one name a schema element or schema attribute test takes, and takes
 * always: `ElementDeclaration` is an EQName, so a wildcard is not one and
 * neither is nothing at all. Saxon answers XPST0008 to a well-spelled one,
 * having no schema to look the declaration up in, which is a static error
 * against an expression it parsed.
 * @param {object} cursor - The cursor
 */
const declared = function(cursor) {
  named(cursor)
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What a document test takes: nothing, or the one element test or schema
 * element test that says what stands under the root. A text test is not one and
 * neither is a bare name, both of them XPST0003.
 * @param {object} cursor - The cursor
 */
const documented = function(cursor) {
  if (!sees(cursor, TOKENS.RPAREN)) {
    if (!sees(cursor, TOKENS.NAME) ||
      !DOCUMENTED.includes(ahead(cursor).value)) {
      refuse(cursor, 'an element test or a schema element test')
    }
    kinded(cursor)
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What a map test takes: the `*` that stands for any map, or a key type and a
 * value type with a comma between them. The key is an `AtomicOrUnionType`, so
 * it takes no occurrence indicator and no kind test, while the value is a whole
 * `SequenceType` and takes both.
 * @param {object} cursor - The cursor
 */
const paired = function(cursor) {
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
  } else {
    atomic(cursor)
    expect(cursor, TOKENS.COMMA, '","')
    sequenced(cursor)
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What an array test takes: the `*` that stands for any array, or the one
 * sequence type its members have. Two is one too many, `array(xs:integer,
 * xs:string)` being XPST0003, and the `*` of `array(xs:integer*)` is that one
 * type's occurrence indicator rather than the wildcard, which is why the
 * wildcard is read from the front.
 * @param {object} cursor - The cursor
 */
const listed = function(cursor) {
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
  } else {
    sequenced(cursor)
  }
  expect(cursor, TOKENS.RPAREN, '")"')
}

/**
 * What a function test takes, the one kind test whose shape reaches past its
 * own closing bracket: `AnyFunctionTest` is `function(*)` and stops there,
 * while `TypedFunctionTest` takes a sequence type per argument and then an
 * `as` and the type it returns. Both halves were missing, so the `as` of one
 * Saxon accepts was text left over at the end.
 * @param {object} cursor - The cursor
 */
const returned = function(cursor) {
  let any = false
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
    any = true
  } else if (!sees(cursor, TOKENS.RPAREN)) {
    sequenced(cursor)
    while (sees(cursor, TOKENS.COMMA)) {
      take(cursor)
      sequenced(cursor)
    }
  }
  expect(cursor, TOKENS.RPAREN, '")"')
  if (!any) {
    keyword(cursor, 'as')
    sequenced(cursor)
  }
}

/**
 * The names XPath has taken for itself, each with the version that took it,
 * what it took it for, and the production that reads its brackets. A `test` is
 * a kind test, an `item` an item type, a `keyword` neither. The floor is half
 * of what a name means: below it the same characters are a call, `element(a)`
 * being a kind test from 2.0 and a call at 1.0 (#728, #753).
 * @type {{[name: string]: {from: string, kind: string,
 *   reads?: function(object): void}}}
 */
const RESERVED = {
  'array': {from: '3.0', kind: 'item', reads: listed},
  'attribute': {from: '2.0', kind: 'test', reads: attributed},
  'comment': {from: '1.0', kind: 'test', reads: closes},
  'document-node': {from: '2.0', kind: 'test', reads: documented},
  'element': {from: '2.0', kind: 'test', reads: elemented},
  'empty-sequence': {from: '2.0', kind: 'item', reads: closes},
  'function': {from: '3.0', kind: 'item', reads: returned},
  'if': {from: '2.0', kind: 'keyword'},
  'item': {from: '2.0', kind: 'item', reads: closes},
  'map': {from: '3.0', kind: 'item', reads: paired},
  'namespace-node': {from: '3.0', kind: 'test', reads: closes},
  'node': {from: '1.0', kind: 'test', reads: closes},
  'processing-instruction': {from: '1.0', kind: 'test', reads: instructed},
  'schema-attribute': {from: '2.0', kind: 'test', reads: declared},
  'schema-element': {from: '2.0', kind: 'test', reads: declared},
  'switch': {from: '3.0', kind: 'keyword'},
  'text': {from: '1.0', kind: 'test', reads: closes},
  'typeswitch': {from: '2.0', kind: 'keyword'},
}

/**
 * The two tests a document test admits inside its brackets, which is the whole
 * of `DocumentTest`'s own alternation.
 * @type {Array.<string>}
 */
const DOCUMENTED = ['element', 'schema-element']

/**
 * A kind test, and the whole of one: a name XPath reserves for a test or an
 * item type, and the brackets behind it read as that name's own production,
 * which is the `reads` field of `RESERVED`. They were counted rather than read
 * until #753, so `text(a)` and `element(a b)` parsed. It takes no occurrence
 * indicator, `text() + 1` having lost its `+` to the type (#740).
 * @param {object} cursor - The cursor
 * @return {object} - The `type` node
 */
const kinded = function(cursor) {
  const from = significant(cursor)
  const name = ahead(cursor).value
  take(cursor)
  expect(cursor, TOKENS.LPAREN, '"("')
  RESERVED[name].reads(cursor)
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
 * such as `text()`. A wildcard's parts arrive as separate tokens, so the four
 * are read here rather than asked of the lexer, and the prefixed spelling
 * whole — the only place a name ending in a colon belongs, which lets
 * `qualified` refuse the `$my:` and `my:(1)` no engine accepts (#731).
 * @param {object} cursor - The cursor
 * @return {object} - The `test` node
 */
const tested = function(cursor) {
  const from = significant(cursor)
  if (sees(cursor, TOKENS.MULTI)) {
    take(cursor)
    if (sees(cursor, TOKENS.COLON) && abuts(cursor) &&
      welded(cursor, TOKENS.NAME)) {
      take(cursor)
      take(cursor)
    }
  } else if (sees(cursor, TOKENS.URI) && welded(cursor, TOKENS.MULTI)) {
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
  } else if (sees(cursor, TOKENS.NAME) && welded(cursor, TOKENS.COLON) &&
    welded(pastName(cursor), TOKENS.MULTI)) {
    take(cursor)
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
 * Whether the token after the next one is of the given kind *and* stands
 * against it. `reaches` is what almost every production wants, a gap between
 * two terminals being nothing to a grammar; a terminal spelled out of several
 * tokens is where that stops, and a wildcard is the only one XPath has —
 * `Wildcard` is `ws: explicit`, so `my: *` loads for nobody (#736).
 * @param {object} cursor - The cursor
 * @param {string} type - The kind to look for
 * @return {boolean} - True when it stands there with no gap in front of it
 */
const welded = function(cursor, type) {
  const beyond = cursorOf(cursor.tokens, cursor.version)
  beyond.at = significant(cursor) + 1
  return sees(beyond, type) && abuts(beyond)
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
 * is how `a[1]` ends after the predicate. The lexer kinds a name three ways,
 * so the question is asked of `NAMES` rather than one kind at a time: asking
 * about one is how `a/Q{urn:my}b` was accepted while `//Q{urn:my}a` was
 * refused (#708), and `a/my:fn(1)` while `//my:fn(1)` was (#731).
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
 * From 2.0 a step is `PostfixExpr | AxisStep`, so each of these opens a step
 * as readily as a name does. They carry no version test deliberately: gating
 * them changes no verdict, `parted` refusing them at 1.0 anyway, and only
 * moves the complaint to naming the end of the expression.
 * @type {Array.<string>}
 */
const OPENERS = [
  TOKENS.LPAREN, TOKENS.DOLLAR, TOKENS.STRING, TOKENS.NUMBER,
  TOKENS.LBRACKET, TOKENS.LOOKUP,
]

/**
 * One part of a path after the slash that opened it. XPath 1.0 admits an axis
 * step and nothing else there — its `PathExpr` lets a `FilterExpr` open a path
 * and stand nowhere after it — while 2.0 generalised the step to `PostfixExpr
 * | AxisStep`, which puts a bracket, a variable and a call at every position a
 * step may take (#711).
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const parted = function(cursor) {
  let node
  if (since(cursor.version, MODERN)) {
    node = postfixed(cursor)
  } else {
    node = stepped(cursor)
  }
  return node
}

/**
 * A path expression: an optional root, then steps separated by one slash or
 * two. A lone `/` is the document node and takes no step after it. A lone `//`
 * is not that spelled shorter, `//` abbreviating `/descendant-or-
 * self::node()/` and that trailing slash needing something behind it: reading
 * them alike accepted `//` whole, and `//-x` came back a subtraction (#731).
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
  let node
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
 * come apart. A step reaching `primary` is what let the postfixes hang off
 * one, `a?b` coming back a lookup into a step (#740).
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
 * A primary expression with whatever hangs off it: predicates, an argument
 * list that applies it, and a lookup into a map or array. Only the predicates
 * are older than 3.0 — applying an expression is what a function item is for
 * and both arrived together, so `child::element(b)` came back an `apply` at
 * 1.0 while this stood ungated (#728).
 * @param {object} cursor - The cursor
 * @return {object} - The node
 */
const postfixed = function(cursor) {
  const from = significant(cursor)
  let node
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
 * A simple map: paths chained with `!`, each evaluated with what the one
 * before it answered as its context. It stands here rather than on the ladder
 * because `ValueExpr` *is* a `SimpleMapExpr`, so a map binds tighter than the
 * four expressions taking a type on their right: as a rung, `a instance of
 * xs:integer ! b` came back a map over the `instance of` (#740).
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
  let node
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
  if (spells(cursor, 'instance')) {
    admits(cursor, 'instance')
    take(cursor)
    keyword(cursor, 'of')
    node = shaped('instance', from, cursor, [node, sequenced(cursor)])
  }
  return node
}

/**
 * The binary levels of XPath's precedence ladder, tightest first, each one
 * `folded` run. One production is one level and every spelling stands on it:
 * `union` beside `|`, `idiv` beside `div`, `except` beside `intersect`. All
 * three were two levels apiece until #764, which made the second the looser
 * and read `9 idiv 2 * 3` as 1 where XPath computes 12.
 * @type {Array.<{types: Array.<string>, kind: string}>}
 */
const LADDER = [
  {types: [TOKENS.INTERSECT, TOKENS.EXCEPT], kind: 'intersect'},
  {types: [TOKENS.PIPE, TOKENS.UNION], kind: 'union'},
  {types: [TOKENS.MULTI, TOKENS.DIV, TOKENS.MOD, TOKENS.IDIV],
    kind: 'product'},
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
  let node
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
 * Parse an XPath expression into a position-preserving tree. Every node
 * carries the range of tokens it spans and the tokens come back with it,
 * trivia and all, so a node's text is its span joined and a fix stays a span
 * replacement over raw source. The version in force is a parameter, the same
 * text being a different language under another one (#652).
 * @param {string} xpath - The expression
 * @param {string} version - The XSLT version in force where it sits
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} -
 *   The tokens, the tree when it parsed, and the complaint when it did not
 */
const parsed = function(xpath, version) {
  let tokens = []
  let tree
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
 * grammar on top of the expression one and brought `intersect` and `except`,
 * `union` spelled as a word, a variable or three more functions rooting a
 * path, a branch in brackets, and `.` for the context node. 1.0 and 2.0 have a
 * union of paths and nothing else.
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
 * from a node, so the axes it admits are the ones such a walk can answer. 1.0
 * and 2.0 spell that `ChildOrAttributeAxisSpecifier` and admit the two it is
 * named after; 3.0's `ForwardAxisP` admits six, adding `self`, `descendant`,
 * `descendant-or-self` and `namespace`.
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
 * One step of a pattern's path, narrower than a step of an expression's at
 * every version. A pattern is matched by walking *up* from a node, so a step
 * it cannot walk back along is refused: the seven axes no version admits are
 * the four reverse ones with `following`, `following-sibling` and `preceding-
 * sibling`. `..` goes with them, `.` is a step from 3.0.
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
  let node
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
 * to a literal or a variable reference, which the expression grammar's
 * argument list does not: a path, a call, a comparison or a bracket there is
 * XTSE0340, and `key("k", a/b)` parsed as a pattern until this stood in the
 * way. A variable is 3.0's, as it is wherever a pattern names one.
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
 * `(1 + 1)/a`, `(a = b)/c` and `(a, b)/c` are not, though each is a fine
 * expression. What it holds is optional, as in the expression grammar's own:
 * `()` matches nothing and `()/a` parses all the same.
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
 * One branch of a pattern: an optional root, then steps — the expression
 * grammar's own path production with the operators taken away, a pattern
 * having no arithmetic, no comparison and no call but the anchors. A `/` may
 * stand alone and a `//` may not, every version spelling that `'//'
 * RelativePathExprP`: a bare `//` is XTSE0340 in Saxon.
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
  let node
  if (sees(cursor, TOKENS.DOT)) {
    rewritten(cursor)
    node = shaped('branch', from, cursor, [stepped(cursor)])
  } else {
    node = unioned(cursor)
  }
  return node
}

/**
 * Parse an XSLT pattern, a different language from an XPath expression and so
 * a grammar of its own: a union of paths and nothing else, where reading one
 * with the expression grammar accepts `1 + 1` and `@a = "b"` and refuses what
 * XSLT admits. Nothing parsed a pattern before this, so a malformed
 * `match="foo["` was silent (#589, #678).
 * @param {string} pattern - The pattern
 * @param {string} version - The XSLT version in force where it sits
 * @return {{tokens: Array, tree: ?object, fault: string, at: number}} -
 *   The tokens, the tree when it parsed, and the complaint when it did not
 */
const matched = function(pattern, version) {
  let tokens = []
  let tree
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
