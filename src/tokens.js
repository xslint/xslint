/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * Token types a lexed expression is made of. Every piece of XPath punctuation
 * carries a kind of its own — the `/` and `//` between steps, the `@` and `$`
 * opening an abbreviated attribute axis and a variable, the `,` of an argument
 * list, the `.` and `..` naming the context item and its parent, the `::` no
 * axis name claimed, and the operators XPath 3.1 added — `=>`, `:=`, `!`, `#`,
 * `?`, and the braces and `:` a map constructor is spelled with — so `OTHER`
 * holds the characters XPath has no token for at all rather than an undivided
 * run of punctuation no grammar can be written against: a `/../` arriving as
 * one string is not two steps of a path (#676), and a `}?` is not one operator
 * (#685).
 *
 * The arrow was the sharper half of the two. Absent from `DOUBLE` where `>=`
 * already sat, it lexed as `=` then `>` — not a stream a parser cannot read but
 * one it reads wrongly, `a => f()` arriving spelled exactly like
 * `a = (> f())`. A missing kind announces itself as `OTHER`; a kind read
 * wrongly has nothing to announce.
 * @type {{[type: string]: string}}
 */
const TOKENS = {
  STRING: 'string',
  UNCLOSED: 'unclosed',
  URI: 'uri',
  COMMENT: 'comment',
  WHITESPACE: 'whitespace',
  NUMBER: 'number',
  OPERATOR: 'operator',
  LPAREN: '(',
  RPAREN: ')',
  LBRACKET: '[',
  RBRACKET: ']',
  MULTI: '*',
  PLUS: '+',
  MINUS: '-',
  DIV: 'div',
  MOD: 'mod',
  PIPE: 'pipe',
  EQ: 'eq',
  NE: 'ne',
  LT: 'lt',
  GT: 'gt',
  LE: 'le',
  GE: 'ge',
  OR: 'or',
  LESS: '<',
  GREATER: '>',
  EQUAL: '=',
  NOT_EQUAL: '!=',
  LESS_EQUAL: '<=',
  GREAT_EQUAL: '>=',
  IS: 'is',
  PRECEDES: '<<',
  FOLLOWS: '>>',
  AND: 'and',
  IDIV: 'idiv',
  UNION: 'union',
  INTERSECT: 'intersect',
  EXCEPT: 'except',
  CHILD: 'child',
  PARENT: 'parent',
  SELF: 'self',
  ATTRIBUTE: 'attribute',
  DESCENDANT: 'descendant',
  DESCENDANT_OR_SELF: 'descendant-or-self',
  FOLLOWING: 'following',
  FOLLOWING_SIBLING: 'following-sibling',
  PRECEDING: 'preceding',
  PRECEDING_SIBLING: 'preceding-sibling',
  ANCESTOR: 'ancestor',
  ANCESTOR_OR_SELF: 'ancestor-or-self',
  NAMESPACE: 'namespace',
  SLASH: '/',
  DOUBLE_SLASH: '//',
  AT: '@',
  DOLLAR: '$',
  COMMA: ',',
  DOT: '.',
  DOUBLE_DOT: '..',
  COLONS: '::',
  COLON: ':',
  ARROW: '=>',
  ASSIGN: ':=',
  SIMPLE_MAP: '!',
  HASH: '#',
  LOOKUP: '?',
  LBRACE: '{',
  RBRACE: '}',
  NAME: 'name',
  USER_FUNCTION: 'user_function',
  CONCAT: '||',
  FUNCTION: 'function',
  OTHER: 'other',
}

/**
 * Characters XPath treats as insignificant whitespace: XML's `S` production,
 * which ExprWhitespace is spelled with, and no others.
 * @type {string}
 */
const WHITESPACE = ' \t\r\n'

/**
 * The same characters as a regular-expression class, so a scan that reads a gap
 * out of expression text spells it the one way the grammar does. JavaScript's
 * `\s` is wider — it also takes a no-break space, a vertical tab, a form feed,
 * the Unicode spaces and U+FEFF — and a scan spelling its gap that way reads a
 * call in `boolean\u00a0(a)`, where no processor sees one (#643).
 * @type {string}
 */
const GAP = `[${WHITESPACE}]`

/**
 * A run of one or more of them, ready to split a whitespace-separated list on —
 * the rule names of an inline directive, or the prefixes of an
 * `exclude-result-prefixes`. Built once here rather than per call, and carrying
 * no `g` flag, so it holds no `lastIndex` for a caller to trip over.
 * @type {RegExp}
 */
const GAPS = new RegExp(`${GAP}+`)

/**
 * Quote characters that open a string literal.
 * @type {string}
 */
const QUOTES = '"\''

/**
 * Numeric characters that are included in the numeric literal.
 * @type {string}
 */
const DIGIT = '0123456789'

/**
 * Map axes to a token.
 * @type {{[key: string]: string}}
 */
const AXES = {
  'child::': TOKENS.CHILD,
  'parent::': TOKENS.PARENT,
  'self::': TOKENS.SELF,
  'attribute::': TOKENS.ATTRIBUTE,
  'descendant::': TOKENS.DESCENDANT,
  'descendant-or-self::': TOKENS.DESCENDANT_OR_SELF,
  'following::': TOKENS.FOLLOWING,
  'following-sibling::': TOKENS.FOLLOWING_SIBLING,
  'preceding::': TOKENS.PRECEDING,
  'preceding-sibling::': TOKENS.PRECEDING_SIBLING,
  'ancestor::': TOKENS.ANCESTOR,
  'ancestor-or-self::': TOKENS.ANCESTOR_OR_SELF,
  'namespace::': TOKENS.NAMESPACE,
}

/**
 * Map single characters to a token. The number branch is tried before this one,
 * so a `.` reaches it only where no digit follows: the `.` of `.5` opens a
 * number, the `.` of `a[.]` is the context item.
 * @type {{[key: string]: string}}
 */
const SINGLE = {
  '(': TOKENS.LPAREN,
  ')': TOKENS.RPAREN,
  '[': TOKENS.LBRACKET,
  ']': TOKENS.RBRACKET,
  '+': TOKENS.PLUS,
  '-': TOKENS.MINUS,
  '*': TOKENS.MULTI,
  '=': TOKENS.EQUAL,
  '<': TOKENS.LESS,
  '>': TOKENS.GREATER,
  '|': TOKENS.PIPE,
  '/': TOKENS.SLASH,
  '@': TOKENS.AT,
  '$': TOKENS.DOLLAR,
  ',': TOKENS.COMMA,
  '.': TOKENS.DOT,
  '!': TOKENS.SIMPLE_MAP,
  '#': TOKENS.HASH,
  '?': TOKENS.LOOKUP,
  '{': TOKENS.LBRACE,
  '}': TOKENS.RBRACE,
  ':': TOKENS.COLON,
}

/**
 * Map double characters to a token. Two characters are tried before one, so the
 * longer of an overlapping pair wins: `//` is one separator and not two `/`,
 * `..` is the parent and not two context items, `::` stands whole wherever an
 * axis name did not already take it, and `=>` is the arrow rather than the `=`
 * and `>` it is spelled from. Nothing orders `=>` against `>=` either: they
 * are two keys, and the lookup asks for the two characters standing there.
 * @type {{[key: string]: string}}
 */
const DOUBLE = {
  '!=': TOKENS.NOT_EQUAL,
  '<=': TOKENS.LESS_EQUAL,
  '>=': TOKENS.GREAT_EQUAL,
  'eq': TOKENS.EQ,
  'ne': TOKENS.NE,
  'lt': TOKENS.LT,
  'le': TOKENS.LE,
  'gt': TOKENS.GT,
  'ge': TOKENS.GE,
  '||': TOKENS.CONCAT,
  '//': TOKENS.DOUBLE_SLASH,
  '..': TOKENS.DOUBLE_DOT,
  '::': TOKENS.COLONS,
  '=>': TOKENS.ARROW,
  ':=': TOKENS.ASSIGN,
  '<<': TOKENS.PRECEDES,
  '>>': TOKENS.FOLLOWS,
  'or': TOKENS.OR,
  'is': TOKENS.IS,
}

/**
 * Map triple characters to a token.
 * @type {{[key: string]: string}}
 */
const TRIPLE = {
  'and': TOKENS.AND,
  'div': TOKENS.DIV,
  'mod': TOKENS.MOD,
}

/**
 * Map characters with more than 3 symbols to a token. Every one of them is a
 * single word, which is what lets a name scan reach them at all — `instance
 * of` sat here until #742 and was the whole reason the lexer had to match
 * across a gap, and it is read by the grammar now, one keyword after another,
 * the way `cast as`, `castable as` and `treat as` always were.
 * @type {{[key: string]: string}}
 */
const MORE = {
  'intersect': TOKENS.INTERSECT,
  'except': TOKENS.EXCEPT,
  'union': TOKENS.UNION,
  'idiv': TOKENS.IDIV,
}

/**
 * The word operators, one word each, taken from the maps that already spell
 * them rather than listed a fourth time. One word each is what they are now:
 * `instance of` was two with a gap between them, which a name scan cannot
 * reach past, so the lexer carried a branch of its own to match it and every
 * name it read had to ask whether a longer spelling stood there. The grammar
 * reads that one by value instead (#742).
 * @type {Array.<string>}
 */
const WORDS = Object.keys({...DOUBLE, ...TRIPLE, ...MORE})
  .filter((word) => /^[a-z]+$/.test(word))

/**
 * The operators spelled with symbols rather than letters, so they are the
 * complement of `WORDS` in the same maps and cannot drift from them. A word is
 * an operator only by position; a symbol always is one, and `!=` has no name it
 * could belong to.
 * @type {{[key: string]: string}}
 */
const SYMBOLS = Object.fromEntries(
  Object.entries({...DOUBLE, ...TRIPLE, ...MORE})
    .filter(([key]) => !/^[a-z]/.test(key)),
)

/**
 * Token types a value ends with, so that a word standing after one of them is
 * an operator rather than a name. XPath decides this by position, not by
 * spelling: an NCName is an OperatorName only where an operator may stand,
 * which is why `border` is one name and not `b`, `or`, `der` (#617), and why
 * the `or` of `or/border` is a node test. The context item and its parent end a
 * value the way a name does, so the `or` of `. or x` is an operator, while the
 * `/`, `@`, `$` and `,` end nothing and the word behind one of them is a name.
 * A map or array constructor ends one as well, so the `instance of` behind the
 * `}` of `map{"aa":1}` is the operator it spells, the way it is behind the `]`
 * of a predicate.
 * @type {Array.<string>}
 */
const ENDS = [
  TOKENS.NAME, TOKENS.NUMBER, TOKENS.STRING, TOKENS.RPAREN, TOKENS.RBRACKET,
  TOKENS.MULTI, TOKENS.DOT, TOKENS.DOUBLE_DOT, TOKENS.RBRACE,
]

/**
 * The kinds that cannot delimit what stands behind them, so XPath makes a gap
 * stand between one of them and a word: whitespace or a comment is required
 * between two terminals neither of which ends at a character the other cannot
 * hold, and a numeric literal beside an operator name is that pair. `1div 2`
 * and `1eq 2` are syntax errors and `1 div 2` and `1(: c :)div 2` are not
 * (#742).
 *
 * A name is here for the same reason and is never reached: a word run against
 * one is absorbed into it, `adiv` arriving as the single name it spells. Which
 * is the whole of the list — every other kind `ENDS` names closes at a
 * character no name can hold, so `count(a)div 2`, `"s"and b` and `a[1]union b`
 * need no gap and are valid XPath as they stand.
 * @type {Array.<string>}
 */
const GLUES = [TOKENS.NAME, TOKENS.NUMBER]

/**
 * The kinds whose text is not expression text, so a scan looking for a
 * construct must not look inside one: it would read a call, an axis or a
 * comparison that no processor ever evaluates. `UNCLOSED` belongs here for the
 * same reason `STRING` does — the author opened a literal, and what follows the
 * quote is its content whether or not the quote ever came back. Leaving it out
 * made `redundant-double-negation` and `count-compared-to-zero` report inside
 * `select="'not(not(x))"`, defects in text nobody reads (#708).
 *
 * It is one list rather than one per reader, because two readers of the same
 * question drift: `masked` in `src/expressions.js` and `inside` in
 * `src/linters/xpath-format-linter.js` each spelled it out, so a kind added to
 * either was a kind missing from the other.
 * @type {Array.<string>}
 */
const OPAQUE = [TOKENS.STRING, TOKENS.UNCLOSED, TOKENS.COMMENT]

/**
 * The kinds that carry no meaning to a grammar and every meaning to the source:
 * a gap and a comment. They stay in the stream rather than being filtered out
 * of it, because a span is a range of token indexes and the text of a span is
 * the tokens in it joined back together — drop the trivia and a tree stops
 * reproducing what it was built from. One list, for the same reason `OPAQUE` is
 * one: four readers spelled it themselves — `TRIVIA` in `src/grammar.js`, the
 * solid-token test in `tokenized` below, the predicate-position scan, and the
 * emptiness test in the `lone` that counted a call's arguments before the parse
 * did. Three of the four are gone, the two scans onto the tree and `lone` with
 * them (#575, #596, #561), and the list stays one because a reader added back
 * is a copy nobody would notice.
 * @type {Array.<string>}
 */
const TRIVIA = [TOKENS.WHITESPACE, TOKENS.COMMENT]

/**
 * The kind each axis is lexed as, which is what makes one recognisable behind
 * another. Derived from {@link AXES} rather than written out again, and derived
 * once: the question is asked of every token, so building the list per token
 * put an array per token behind a scan that allocates none. Exported for
 * `test/strictness.js`, which reads a spaced separator off the same list rather
 * than keeping a second one of the thirteen axes.
 * @type {Array.<string>}
 */
const AXIS_KINDS = Object.values(AXES)

/**
 * Whether a comment opens at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {boolean} - True when "(:" starts here
 */
const opensComment = function(xpath, at) {
  return xpath[at] === '(' && xpath[at + 1] === ':'
}

/**
 * Characters a name is spelled with. XML names reach well past ASCII, so a
 * letter is any letter, not `\w`'s twenty-six. Its `NameChar` also admits the
 * three extenders no category here covers — the middle dot and the two ties,
 * `\p{M}` already holding the combining marks of `[#x300-#x36F]` — and leaving
 * them out refused eight spellings the engine accepts, `a·b` among them (#731).
 * They are name characters and no more than that: none may open a name, which
 * is `STARTS`'s answer and stays as it was.
 * @type {RegExp}
 */
const NAMED = /[\p{L}\p{N}\p{M}_.:·‿⁀-]/u

/**
 * Characters a name may begin with.
 * @type {RegExp}
 */
const STARTS = /[\p{L}_]/u

/**
 * Whether one part of a name is an NCName: it holds something, opens the way a
 * name may, and carries name characters the rest of the way. The colon that
 * split the parts is the one `NAMED` character a part cannot hold, and it is
 * gone by construction.
 * @param {string} part - One colon-separated part of a name
 * @return {boolean} - True when XML can spell it
 */
const single = function(part) {
  return part.length > 0 && STARTS.test(part[0]) &&
    [...part].every((one) => NAMED.test(one))
}

/**
 * Whether a name is one XML can spell: an NCName, or two of them joined by a
 * single colon. Both parts have to hold something, a prefix naming nothing on
 * its own: `$my:` and `my:(1)` are refused by every engine, and it was this
 * answer that let them through, permitting a trailing colon because the `my:`
 * of `my:*` arrives spelled that way — the `*` being the wildcard's own token.
 * A wildcard is `tested`'s business and it consumes both tokens itself now, so
 * a name reaching here always spells its local part (#731).
 *
 * The lexer takes a name whole and greedily and never asks how it is spelled,
 * so `my:25l`, `my:-x` and `my:a:b` each arrive as one `NAME` and read as an
 * ordinary step, which is the one place the grammar was the lenient side of the
 * engine (#708). What a part may hold is `NAMED` less the colon that split it,
 * and what it may open with is `STARTS` — the classes the lexer spells a name
 * with already, rather than a second opinion about what a letter is.
 * @param {string} name - The name to weigh
 * @return {boolean} - True when XML can spell it
 */
const qualified = function(name) {
  const parts = name.split(':')
  return parts.length <= 2 && parts.every((one) => single(one))
}

/**
 * Whether a name is still being spelled just before the given offset. The run
 * of name characters behind the offset is walked back to its beginning, and it
 * is a name only if it begins the way a name may: `grandchild::` carries the
 * `child::` of a name, and so does `a-child::`, because a `-` continues a name
 * that a letter started. A run that opens with anything else is not a name and
 * the characters behind belong to something else — the `-` of
 * `count(a)-child::b` subtracts, and the one in `1-child::b` subtracts from a
 * number, neither of which a name may begin with.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {boolean} - True when a name runs up to the offset
 */
const spelling = function(xpath, at) {
  let start = at
  while (start > 0 && NAMED.test(xpath[start - 1])) {
    start -= 1
  }
  return start < at && STARTS.test(xpath[start])
}

/**
 * Whether the colon at an offset joins the name behind it to a part in front.
 * A QName is two NCNames and one colon, so a colon runs a name on only where
 * the name so far holds none and an NCName can start behind it — which is
 * `STARTS`, the class the lexer already spells a name's first character with.
 *
 * That is the whole rule, and the axis separator is it answered twice: a colon
 * opens no NCName either, so a `::` ends a name without a clause of its own
 * (#703). The `:` of a map entry ends one for the same reason, a space and a
 * digit opening no name — where taking every colon swallowed the separator into
 * the key and refused `map{a: 1}`, which every engine reads (#746).
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset of the colon
 * @param {number} from - Offset the name started at
 * @return {boolean} - True when the name runs on through it
 */
const joins = function(xpath, at, from) {
  return !xpath.slice(from, at).includes(':') && at + 1 < xpath.length &&
    STARTS.test(xpath[at + 1])
}

/**
 * Offset just past the name spelled at the given offset. A name is taken whole
 * and greedily, so an operator's letters inside one — the `or` of `border`, the
 * `and` of `grandchild`, the `union` of `unionist` — stay part of the name they
 * belong to. A colon is the one character it does not take on sight: `joins`
 * says whether the name runs on through it.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the first character
 * @return {number} - Offset just past the name
 */
const afterName = function(xpath, start) {
  let at = start
  while (
    at < xpath.length && NAMED.test(xpath[at]) &&
    (xpath[at] !== ':' || joins(xpath, at, start))
  ) {
    at += 1
  }
  return at
}

/**
 * Whether an operator may stand at the end of what has been lexed, which is
 * what makes a word an operator rather than a name. The kind of the last solid
 * token settles it. Until #676 the punctuation arrived as one undivided `OTHER`
 * and this had to read the last character of it to guess what had ended — a
 * guess only `.` and `..` ever needed, and neither needs it now that each has a
 * kind `ENDS` can name.
 *
 * Whether a gap stood in front of the word is the one thing about it a kind
 * cannot say, and XPath asks: a word run against a terminal that cannot
 * delimit it is no operator, since the two need whitespace or a comment
 * between them and the author wrote neither. It is the single place a gap
 * decides what an expression is made of rather than merely how it is written,
 * which is why the other reader of this plumbing, {@link separates}, is handed
 * the token alone (#742).
 * @param {?{type: string, value: string}} last - The last solid token
 * @param {boolean} spaced - Whether trivia stood between it and the word
 * @return {boolean} - True when an operator may stand here
 */
const operates = function(last, spaced) {
  return last !== undefined && ENDS.includes(last.type) &&
    (spaced || !GLUES.includes(last.type))
}

/**
 * The operator a word spells, or `undefined` where it spells none, read off
 * the same maps the lexer kinds one from rather than a list of its own. The
 * multi-word operators answer nothing here: `instance of` is one token holding
 * a gap, so no name a scan takes ever carries its value.
 *
 * It is exported for `src/grammar.js`, which settles the one question this
 * file cannot: whether the `?` of `xs:integer?` ends a type or opens a lookup
 * key, and so whether the word behind it is `div` the operator or `div` the
 * key. XPath gives its own lexer a stack of states for that (A.2.4); ours is a
 * pass that finishes before the grammar starts, so the grammar corrects the
 * guess where it alone knows better (#742).
 * @param {string} word - The text of a name
 * @return {?string} - The operator kind it spells, or undefined
 */
const worded = function(word) {
  return {...DOUBLE, ...TRIPLE, ...MORE}[word]
}

/**
 * Whether an axis separator is the last thing lexed, so what stands next is a
 * node test and cannot open an axis of its own. After a separator the grammar
 * admits a NodeTest and nothing else, so a name there is the element it names
 * however it is spelled — `child` behind one is the element `child`.
 *
 * The character walk in {@link opensAxis} cannot answer this, and answered it
 * by accident: it asked `spelling` whether a name was already in progress,
 * which counts a `:` as a name character, so `child::child::b` walked back over
 * the separator and got the right stream for the wrong reason while
 * `child:: child::b` stopped at the gap and opened a second axis. One
 * expression arrived as two streams, told apart by a space (#709). The question
 * is about what precedes rather than about characters, which is `operates`'s
 * question, so it is answered the same way, in the same place, and from the
 * same value — the token itself rather than the list it came from, since the
 * question is asked of every token and deriving the last one from the whole
 * list each time is an array per token (#709).
 * @param {?{type: string, value: string}} last - The last solid token
 * @return {boolean} - True when it is an axis
 */
const separates = function(last) {
  return last !== undefined && AXIS_KINDS.includes(last.type)
}

/**
 * The axis opening at the given offset, or null when none does. XPath allows
 * whitespace between the axis name and its `::`, so `child ::` names the same
 * axis as `child::`; the name and the colons are matched across that gap and
 * the length spans it, while the two colons themselves stay adjacent. An axis
 * name only ever opens a step, so one reached with a name already in progress
 * is the tail of that name rather than an axis of its own, however the
 * characters in front of it happened to be tokenized.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {?{name: string, length: number}} - The axis name and matched length
 */
const opensAxis = function(xpath, at) {
  let end = at
  while (end < xpath.length && xpath[end].match(/[a-zA-Z-]/)) {
    end += 1
  }
  let colons = end
  while (colons < xpath.length && WHITESPACE.includes(xpath[colons])) {
    colons += 1
  }
  const name = `${xpath.slice(at, end)}::`
  let opened = null
  if (end !== at && xpath[colons] === ':' && xpath[colons + 1] === ':' &&
    AXES[name] && !spelling(xpath, at)) {
    opened = {name: name, length: colons + 2 - at}
  }
  return opened
}

/**
 * Whether a number opens at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {boolean} - True when digit or "." with digit starts here
 */
const opensNumber = function(xpath, at) {
  return DIGIT.includes(xpath[at]) || (xpath[at] === '.' && DIGIT.includes(xpath[at + 1]))
}

/**
 * Whether a user function opens at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {string} - User function
 */
const opensUserFunction = function(xpath, at) {
  let func = ''
  let colon = 0
  if (at < xpath.length && xpath[at].match(/[a-zA-Z]/)) {
    func += xpath[at]
    at++
    while (at < xpath.length && xpath[at].match(/[a-zA-Z0-9_:]/)) {
      if (xpath[at].match(/[a-zA-Z0-9_]/)) {
        func = func + xpath[at]
        at++
      } else {
        if (colon === 0) {
          func += xpath[at]
          at++
          colon++
        } else {
          func = ''
          break
        }
      }
    }
    if (xpath[at - 1] === ':' || xpath[at] !== '(' || colon !== 1) func = ''
  }
  return func
}

/**
 * Offset just past the string literal opening at given quote, and whether the
 * quote that opened it ever came back. A doubled quote inside the literal
 * escapes the quote and does not end it.
 *
 * The second half is what tells a `STRING` from an `UNCLOSED`. The walk ran off
 * the end and said nothing about it until #708, so `'unclosed` arrived as a
 * finished literal and the grammar accepted an expression that has no closing
 * quote — the lexer inventing the character the author did not write, which is
 * the same fault as reading `=>` as two operators (#685): a stream read wrongly
 * rather than not at all, with nothing to announce.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the opening quote
 * @return {{at: number, closed: boolean}} - Offset just past the literal, and
 *  whether a closing quote stood there
 */
const afterString = function(xpath, start) {
  const quote = xpath[start]
  let at = start + 1
  let closed = false
  while (!closed && at < xpath.length) {
    if (xpath[at] === quote && xpath[at + 1] === quote) {
      at += 2
    } else if (xpath[at] === quote) {
      at += 1
      closed = true
    } else {
      at += 1
    }
  }
  return {at: at, closed: closed}
}

/**
 * Offset just past the braced URI literal opening at given offset, or that
 * offset itself where none is spelled there. XPath 3.0 writes a name's
 * namespace inline as `Q{uri}local`, and `BracedURILiteral` is a terminal of
 * the grammar rather than a `Q` standing beside a brace, which is why the whole
 * of it is lexed here and not assembled above.
 *
 * The content is every character up to the closing brace with a brace itself
 * excluded, so `Q{a{b}c` spells no literal at all and neither does one that
 * never closes. Both answer the offset they were handed and lex on as the `Q`
 * and the brace they were before: a malformed literal is not a kind of
 * literal, and the grammar already refuses what those tokens make.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the "Q"
 * @return {number} - Offset just past the closing brace, or `start` for none
 */
const afterUri = function(xpath, start) {
  let at = start
  if (xpath[start] === 'Q' && xpath[start + 1] === '{') {
    const closes = xpath.indexOf('}', start + 2)
    const opens = xpath.indexOf('{', start + 2)
    if (closes > 0 && (opens === -1 || opens > closes)) {
      at = closes + 1
    }
  }
  return at
}

/**
 * Offset just past the comment opening at given offset, and whether the ":)"
 * that ends one ever stood there. Comments nest, so an inner "(:" must be
 * balanced by its own ":)".
 *
 * The second half is what tells a `COMMENT` from an `UNCLOSED`, and it is the
 * defect #708 closed for the literal directly above, left standing here for one
 * ticket longer (#752). The walk ran off the end and said nothing about it, so
 * `a (: b` came back as a step and a finished comment: a comment is trivia, so
 * the grammar read over the whole tail and had nothing left to object to, and
 * the six linters scanning tokens saw nothing after the `(:` either. One
 * mistyped `:)` and a file linted clean. `Comment ::= "(:" (CommentContents |
 * Comment)* ":)"` spells no such production and every processor answers
 * XPST0003, which since #739 is a missing `invalid-xpath-expression` on text a
 * user asked about.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the opening "(:"
 * @return {{at: number, closed: boolean}} - Offset just past the comment, and
 *  whether the ":)" that closes one stood there
 */
const afterComment = function(xpath, start) {
  let at = start + 2
  let depth = 1
  while (at < xpath.length && depth > 0) {
    if (opensComment(xpath, at)) {
      depth += 1
      at += 2
    } else if (xpath[at] === ':' && xpath[at + 1] === ')') {
      depth -= 1
      at += 2
    } else {
      at += 1
    }
  }
  return {at: at, closed: depth === 0}
}

/**
 * Offset just past the number literal opening at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the first character of the number literal
 * @return {number} - Offset just past the closing digit
 */
const afterNumber = function(xpath, start) {
  let at = start + 1
  let point = 0
  let exponent = 0
  while (at < xpath.length) {
    if (xpath[at] === '.' && point === 0 && exponent === 0 ) {
      point += 1
      at += 1
    } else if (DIGIT.includes(xpath[at])) {
      at += 1
    } else if ((xpath[at] === 'e' || xpath[at] === 'E') && exponent === 0) {
      exponent += 1
      if (DIGIT.includes(xpath[at + 1])) {
        at += 2
      } else if (xpath[at + 1] === '+' || xpath[at + 1] === '-') {
        if (DIGIT.includes(xpath[at + 2])) {
          at += 3
        } else {
          break
        }
      } else {
        break
      }
    } else {
      break
    }
  }
  return at
}

/**
 * Offset just past the run of non-delimiter characters at given offset. The run
 * stops at a quote, whitespace, or comment opener so those start their own
 * token.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the first character
 * @return {number} - Offset just past the run
 */
const afterOther = function(xpath, start) {
  let at = start
  while (
    at < xpath.length &&
    !(at > start && STARTS.test(xpath[at])) &&
    !QUOTES.includes(xpath[at]) &&
    !WHITESPACE.includes(xpath[at]) &&
    !SINGLE[xpath[at]] &&
    !DOUBLE[xpath.slice(at, at + 2)] &&
    !TRIPLE[xpath.slice(at, at + 3)] &&
    !opensComment(xpath, at) &&
    !opensUserFunction(xpath, at) &&
    !opensNumber(xpath, at) &&
    !opensAxis(xpath, at)
  ) {
    at += 1
  }
  return at
}

/**
 * Offset just past the whitespace run at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the first whitespace character
 * @return {number} - Offset just past the run
 */
const afterWhitespace = function(xpath, start) {
  let at = start
  while (at < xpath.length && WHITESPACE.includes(xpath[at])) {
    at += 1
  }
  return at
}

/**
 * Split an XPath expression into positioned tokens, preserving whitespace and
 * comments so formatting checks can reason over the original text. Each token
 * carries its type, raw value, and the offset where it starts.
 *
 * Two of the decisions read what came before rather than what stands here —
 * whether a word is an operator, and whether a name may open an axis — and both
 * want the last token that is not trivia. It is carried forward as the tokens
 * are pushed, because whitespace and comments are what they must not see and
 * the scan already knows which it just emitted.
 * @param {string} xpath - Xpath expression
 * @return {Array.<{type: string, value: string, start: number}>} - Tokens
 */
const tokenized = function(xpath) {
  const tokens = []
  let last
  let spaced = false
  let at = 0
  while (at < xpath.length) {
    const start = at
    const axis = !separates(last) && opensAxis(xpath, at)
    const func = opensUserFunction(xpath, at)
    const uri = afterUri(xpath, at)
    let type
    if (QUOTES.includes(xpath[at])) {
      const literal = afterString(xpath, at)
      type = TOKENS.UNCLOSED
      if (literal.closed) {
        type = TOKENS.STRING
      }
      at = literal.at
    } else if (opensComment(xpath, at)) {
      const comment = afterComment(xpath, at)
      type = TOKENS.UNCLOSED
      if (comment.closed) {
        type = TOKENS.COMMENT
      }
      at = comment.at
    } else if (WHITESPACE.includes(xpath[at])) {
      type = TOKENS.WHITESPACE
      at = afterWhitespace(xpath, at)
    } else if (axis) {
      type = AXES[axis.name]
      at += axis.length
    } else if (opensNumber(xpath, at)) {
      type = TOKENS.NUMBER
      at = afterNumber(xpath, at)
    } else if (func) {
      type = TOKENS.USER_FUNCTION
      at += func.length
    } else if (uri > at) {
      type = TOKENS.URI
      at = uri
    } else if (STARTS.test(xpath[at])) {
      const name = xpath.slice(at, afterName(xpath, at))
      type = TOKENS.NAME
      if (WORDS.includes(name) && operates(last, spaced)) {
        type = worded(name)
      }
      at += name.length
    } else if (SYMBOLS[xpath.slice(at, at + 2)]) {
      type = SYMBOLS[xpath.slice(at, at + 2)]
      at += 2
    } else if (SINGLE[xpath[at]]) {
      type = SINGLE[xpath[at]]
      at++
    } else {
      type = TOKENS.OTHER
      at = afterOther(xpath, at)
    }
    const token = {type: type, value: xpath.slice(start, at), start: start}
    tokens.push(token)
    spaced = TRIVIA.includes(type)
    if (!spaced) {
      last = token
    }
  }
  return tokens
}

module.exports = {
  tokenized,
  qualified,
  worded,
  WORDS,
  GLUES,
  TOKENS,
  NAMED,
  OPAQUE,
  TRIVIA,
  AXIS_KINDS,
  WHITESPACE,
  GAP,
  GAPS,
}
