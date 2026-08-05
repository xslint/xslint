/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * Token types a lexed expression is made of.
 * @type {{[type: string]: string}}
 */
const TOKENS = {
  STRING: 'string',
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
  AND: 'and',
  IDIV: 'idiv',
  UNION: 'union',
  INSTANCE_OF: 'instance of',
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
 * Map single characters to a token.
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
}

/**
 * Map double characters to a token.
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
  'or': TOKENS.OR,
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
 * Map characters with more than 3 symbols to a token.
 * @type {{[key: string]: string}}
 */
const MORE = {
  'instance of': TOKENS.INSTANCE_OF,
  'intersect': TOKENS.INTERSECT,
  'except': TOKENS.EXCEPT,
  'union': TOKENS.UNION,
  'idiv': TOKENS.IDIV,
}

/**
 * The word operators, one word each, taken from the maps that already spell
 * them rather than listed a fourth time. `instance of` is left out: it is two
 * words with a gap between them, which a name scan can never reach past, so the
 * `more` branch keeps it.
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
 * the `or` of `or/border` is a node test.
 * @type {Array.<string>}
 */
const ENDS = [
  TOKENS.NAME, TOKENS.NUMBER, TOKENS.STRING, TOKENS.RPAREN, TOKENS.RBRACKET,
  TOKENS.MULTI,
]

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
 * letter is any letter, not `\w`'s twenty-six.
 * @type {RegExp}
 */
const NAMED = /[\p{L}\p{N}\p{M}_.:-]/u

/**
 * Characters a name may begin with.
 * @type {RegExp}
 */
const STARTS = /[\p{L}_]/u

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
 * Offset just past the name spelled at the given offset. A name is taken whole
 * and greedily, so an operator's letters inside one — the `or` of `border`, the
 * `and` of `grandchild`, the `union` of `unionist` — stay part of the name they
 * belong to.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the first character
 * @return {number} - Offset just past the name
 */
const afterName = function(xpath, start) {
  let at = start
  while (at < xpath.length && NAMED.test(xpath[at])) {
    at += 1
  }
  return at
}

/**
 * Whether an operator may stand at the end of what has been lexed, which is
 * what makes a word an operator rather than a name. A value ends the tokens, or
 * the residue `OTHER` still carries one — `@id` and `$var` end a value where
 * `/` and `,` do not, and while `OTHER` is undivided its last character is what
 * says which it was.
 * @param {Array.<{type: string, value: string}>} tokens - Tokens so far
 * @return {boolean} - True when an operator may stand here
 */
const operates = function(tokens) {
  const solid = tokens.filter(
    (token) => token.type !== TOKENS.WHITESPACE &&
      token.type !== TOKENS.COMMENT,
  )
  const last = solid[solid.length - 1]
  return last !== undefined && (ENDS.includes(last.type) ||
    (last.type === TOKENS.OTHER && NAMED.test(last.value.slice(-1))))
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
  return end === at || xpath[colons] !== ':' || xpath[colons + 1] !== ':' ||
    !AXES[name] || spelling(xpath, at) ?
    null :
    {name: name, length: colons + 2 - at}
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
 * Whether an element opens at given offset.
 * @param {string} xpath - Xpath expression
 * @param {number} at - Offset to test
 * @return {string} - token
 */
const opensMore = function(xpath, at) {
  let token = ''
  Object.keys(MORE).forEach((elem) => {
    if (xpath.slice(at, at + elem.length) === elem) {
      token = elem
    }
  })
  return token
}

/**
 * Offset just past the string literal opening at given quote. A doubled quote
 * inside the literal escapes the quote and does not end it.
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the opening quote
 * @return {number} - Offset just past the closing quote
 */
const afterString = function(xpath, start) {
  const quote = xpath[start]
  let at = start + 1
  while (at < xpath.length) {
    if (xpath[at] === quote && xpath[at + 1] === quote) {
      at += 2
    } else if (xpath[at] === quote) {
      at += 1
      break
    } else {
      at += 1
    }
  }
  return at
}

/**
 * Offset just past the comment opening at given offset. Comments nest, so an
 * inner "(:" must be balanced by its own ":)".
 * @param {string} xpath - Xpath expression
 * @param {number} start - Offset of the opening "(:"
 * @return {number} - Offset just past the closing ":)"
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
  return at
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
    !opensMore(xpath, at) &&
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
 * @param {string} xpath - Xpath expression
 * @return {Array.<{type: string, value: string, start: number}>} - Tokens
 */
const tokenized = function(xpath) {
  const tokens = []
  let at = 0
  while (at < xpath.length) {
    const start = at
    const axis = opensAxis(xpath, at)
    const more = opensMore(xpath, at)
    const func = opensUserFunction(xpath, at)
    let type
    if (QUOTES.includes(xpath[at])) {
      type = TOKENS.STRING
      at = afterString(xpath, at)
    } else if (opensComment(xpath, at)) {
      type = TOKENS.COMMENT
      at = afterComment(xpath, at)
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
    } else if (STARTS.test(xpath[at])) {
      const name = xpath.slice(at, afterName(xpath, at))
      const spelled = more && more.split(' ')[0] === name ? more : name
      const word = WORDS.includes(name) ||
        (spelled !== name && MORE[spelled] !== undefined)
      type = word && operates(tokens) ?
        {...DOUBLE, ...TRIPLE, ...MORE}[spelled] :
        TOKENS.NAME
      at += type === TOKENS.NAME ? name.length : spelled.length
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
    tokens.push({type: type, value: xpath.slice(start, at), start: start})
  }
  return tokens
}

module.exports = {
  tokenized,
  spelling,
  TOKENS,
  WHITESPACE,
  GAP,
  GAPS,
}
