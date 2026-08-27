/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `predicateOf(text)` — what one predicate of a served selector answers of
 * one candidate, without the engine, or `undefined` where the engine must
 * answer it after all. #811's axis phases left the tail as the whole of the
 * cost: 31 of the 37 per-file selectors are served and spent 1,010-1,047 ms
 * of a 4,919-5,094 ms DocBook-XSL run inside `satisfies`, one fontoxpath
 * call per candidate over 144,427 of them, about 7.3 us each for questions a
 * property read answers in tens of nanoseconds. Serving an axis *without*
 * its predicate is a loss, which is what sizes the phase:
 * `text-outside-xsl-text` reads 206-219 ms whole from the engine, 233-239
 * with the walk's axis and the tail asked per candidate, and 27-28 with the
 * predicate answered here.
 *
 * The compile is off the parse and never the text, kept against the text, so
 * each of the 37 distinct predicates in the tree is compiled once a run; 27
 * of them are. What refuses is as deliberate as what serves — a regex, whose
 * XPath flavour is not JavaScript's; a descending axis, wanting subtree
 * extents the walk does not keep; the `text()` composite whose meaning
 * `xml:space` decides; a conditional; an unprefixed element name, the
 * refusal `bucketed` already makes. **Over-acceptance is a wrong report**
 * where under-acceptance is only the engine call it was, so every branch
 * narrows rather than guesses and a comparison serves two numbers on any
 * sign but strings on `=` alone, a negated existential being the shape
 * easiest to answer wrongly.
 *
 * Three of those narrowings were bought by review, and each is a JavaScript
 * built-in whose notion is not XPath's — the genre of #643's `\s`.
 * `string-length` counts **characters** where `.length` counts UTF-16 code
 * units, so a name outside the Basic Multilingual Plane, which XML admits
 * and Saxon compiles as the one character it is, measured two and
 * `short-names` fell silent on a shipped check: `Array.from` counts what
 * XPath counts. An **attribute** has no parent in the DOM at all, only an
 * `ownerElement`, so a climb reading `parentNode` answered
 * `//@*[parent::xsl:stylesheet]` empty and its negation whole — the
 * over-acceptance the paragraph above forbids — and the same climb handed a
 * root element's **document** to a wildcard, where `*` selects elements
 * alone. An **element** carries no `value`, its string value being the text
 * of its whole subtree, so a comparison reading one off a step answered
 * `undefined` against every element there is; `carrying` refuses a step in
 * a value position unless it names the attribute axis, which costs nothing
 * the tree spells — 27 of the 37 compile either way.
 *
 * None of the three was the oracle's fault and all three were its blind
 * spot: `CANDIDATES` asks the engine what a spelling selects, so what it
 * cannot ask about is what the fixture does not hold and what no head hands
 * it. It holds a name outside the plane now, and asks a second head —
 * `//@*`, whose candidates are attributes — and a third, the root element,
 * whose parent is no element at all.
 *
 * `answered(tail)` in `src/selectors.js` parts per **predicate** and not
 * per tail, #837's lesson one level down: `predicated` already parts the
 * brackets and `filtered` guarantees none reads a position, so `[a][b]` is
 * `[a and b]`, the compiled ones run first, and what the engine is still
 * asked it is asked once, of a sequence they have pruned — a `@select`
 * presence test drops 14,756 candidates before the `text()` half nobody
 * compiles is reached, and a tail nothing compiles costs what it cost. Four
 * interleaved rounds a side, one process per reading, report byte-identical
 * at 3,626, 5,513 and 1,192 defects: the run falls 4,919-5,094 ms to
 * 4,486-4,811 over DocBook-XSL, 5,078-5,286 to 4,575-4,940 over TEI and
 * 2,521-2,681 to 2,389-2,521 over DITA-OT, `xpath-linter` down 20%, 23%
 * and 11%. Every reading stands clear of every reading on the other side
 * over DocBook-XSL and TEI; over DITA-OT the two ranges touch at one, which
 * is what a corpus reading 2.5 seconds against a 6-second budget has to
 * show.
 */

const {PREFIXES} = require('./xpath')
const {TOKENS, TRIVIA, WHITESPACE} = require('./tokens')
const {parsed} = require('./grammar')
const {ASSUMED} = require('./syntax')

/**
 * A compiled predicate for each text it was asked of, built once and kept for
 * the run. There are some thirty distinct predicate texts across every check,
 * so the map is small and the parse behind each entry is paid once.
 * @type {Map}
 */
const COMPILED = new Map()

/**
 * The element node type, the one kind a name test on a forward axis yields.
 * @type {number}
 */
const ELEMENT = 1

/**
 * The axes a step may open with, each mapped to what it reaches from one
 * context node. A step spelling anything else is refused: the vocabulary
 * grows by measurement, and an axis nobody has costed is an axis whose
 * candidates nobody has counted.
 * @type {{[key: string]: string}}
 */
const AXES = {
  [TOKENS.AT]: 'attribute',
  [TOKENS.ATTRIBUTE]: 'attribute',
  [TOKENS.SELF]: 'self',
  [TOKENS.PARENT]: 'parent',
  [TOKENS.CHILD]: 'child',
  [TOKENS.ANCESTOR]: 'ancestor',
  [TOKENS.PRECEDING_SIBLING]: 'preceding-sibling',
  [TOKENS.FOLLOWING_SIBLING]: 'following-sibling',
}

/**
 * The comparison signs a numeric operand may carry, each as the test it makes
 * of two numbers.
 * @type {{[key: string]: function(number, number): boolean}}
 */
const SIGNS = {
  [TOKENS.EQUAL]: (one, two) => one === two,
  [TOKENS.NOT_EQUAL]: (one, two) => one !== two,
  [TOKENS.LESS]: (one, two) => one < two,
  [TOKENS.GREATER]: (one, two) => one > two,
  [TOKENS.LESS_EQUAL]: (one, two) => one <= two,
  [TOKENS.GREAT_EQUAL]: (one, two) => one >= two,
}

/**
 * The tokens of a span that carry meaning, the gaps and comments dropped. A
 * span is a range of token indexes, so trivia stands inside one and a reader
 * of the span has to step over it.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {number} from - Where the span opens
 * @param {number} to - Where it closes, exclusive
 * @return {Array} - The tokens between them that mean something
 */
const solid = function(tokens, from, to) {
  return tokens.slice(from, to).filter(
    (one) => !TRIVIA.includes(one.type),
  )
}

/**
 * The namespace a prefix stands for, borrowed from the prefixes
 * `src/xpath.js` binds so the walk means by `xsl:` what the engine means.
 * @param {string} prefix - The prefix a name carries, or an empty string
 * @return {string} - The namespace URI, or an empty string
 */
const namespaced = function(prefix) {
  let uri = ''
  if (Object.hasOwn(PREFIXES, prefix)) {
    uri = PREFIXES[prefix]
  }
  return uri
}

/**
 * What a name test admits, read off the tokens standing where one does: a
 * wildcard admitting every name, or a qualified name. An unprefixed element
 * name is refused for the reason `bucketed` refuses one — a default namespace
 * reaches an element — where an unprefixed attribute stands in no namespace.
 * @param {Array} carried - The solid tokens of the name test
 * @param {boolean} attribute - Whether the axis reaches attributes
 * @return {?object} - What the test admits, or undefined where it is refused
 */
const admitted = function(carried, attribute) {
  let answer = undefined
  if (carried.length === 1 && carried[0].type === TOKENS.MULTI) {
    answer = {uri: '', local: '', every: true, whole: false}
  } else if (carried.length === 3 && carried[0].type === TOKENS.NAME &&
    carried[1].type === TOKENS.COLON && carried[2].type === TOKENS.MULTI &&
    namespaced(carried[0].value) !== '') {
    answer = {
      uri: namespaced(carried[0].value), local: '', every: false, whole: true,
    }
  } else if (carried.length === 1 && carried[0].type === TOKENS.NAME) {
    const parts = carried[0].value.split(':')
    if (parts.length === 1 && attribute) {
      answer = {uri: '', local: parts[0], every: false, whole: false}
    } else if (parts.length === 2 && namespaced(parts[0]) !== '') {
      answer = {
        uri: namespaced(parts[0]), local: parts[1], every: false, whole: false,
      }
    }
  }
  return answer
}

/**
 * Whether a node answers a name test, a wildcard admitting every name it is
 * handed and a qualified one asking the namespace and the local name apart —
 * never the prefix, which is the document's to choose.
 * @param {Node} node - The node the axis reached
 * @param {object} test - What `admitted` made of the name test
 * @return {boolean} - True when the test admits it
 */
const admits = function(node, test) {
  return test.every ||
    ((node.namespaceURI || '') === test.uri &&
      (test.whole || node.localName === test.local))
}

/**
 * The elements a chain of links yields, walked from where it opens and taken
 * one link at a time. Four axes are that walk with a different link, and a
 * non-element on the way is stepped over rather than stopping it — a comment
 * standing between two siblings ends neither the sibling axis.
 * @param {?Node} standing - Where the walk starts, or null
 * @param {string} link - The property each step of the walk follows
 * @return {Array.<Node>} - The elements it reaches
 */
const elements = function(standing, link) {
  let found = []
  for (let walk = standing; walk !== null; walk = walk[link]) {
    if (walk.nodeType === ELEMENT) {
      found = found.concat([walk])
    }
  }
  return found
}

/**
 * The node an axis climbs to from a context node: the element an attribute
 * hangs off, which the DOM answers as `ownerElement` and never as a parent,
 * or the parent of anything else. An attribute has no parent at all, so a
 * climb reading one climbed nowhere and answered every ancestor test asked of
 * an attribute wrongly, which is the one direction a split may not fail in.
 * @param {Node} node - The context node
 * @return {?Node} - What stands above it, or null
 */
const above = function(node) {
  return node.ownerElement ?? node.parentNode
}

/**
 * The nodes an axis reaches from one context node, before any name test
 * narrows them. An attribute axis answers the attributes a node carries, and
 * every other axis answers elements, which is what keeps a name test's
 * verdict about a namespace and a local name alone.
 * @param {Node} node - The context node
 * @param {string} axis - The axis, as `AXES` names it
 * @return {Array.<Node>} - What it reaches
 */
const reached = function(node, axis) {
  let found = []
  if (axis === 'attribute') {
    found = Array.from(node.attributes || [])
  } else if (axis === 'self') {
    found = [node]
  } else if (axis === 'parent') {
    found = elements(above(node), 'parentNode').slice(0, 1)
  } else if (axis === 'child') {
    found = elements(node.firstChild, 'nextSibling')
  } else if (axis === 'preceding-sibling') {
    found = elements(node.previousSibling, 'previousSibling')
  } else if (axis === 'following-sibling') {
    found = elements(node.nextSibling, 'nextSibling')
  } else if (axis === 'ancestor') {
    found = elements(above(node), 'parentNode')
  }
  return found
}

/**
 * The string a literal holds: a number as itself, a string with its
 * delimiters off and a doubled delimiter inside it read as the one character
 * XPath says it is.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A literal node of its tree
 * @return {?object} - The value and whether it is a number, or undefined
 */
const held = function(tokens, node) {
  const carried = solid(tokens, node.from, node.to)
  let answer = undefined
  if (carried.length === 1 && carried[0].type === TOKENS.NUMBER) {
    answer = {value: Number(carried[0].value), numeric: true}
  } else if (carried.length === 1 && carried[0].type === TOKENS.STRING) {
    const quote = carried[0].value.charAt(0)
    answer = {
      value: carried[0].value.slice(1, -1).replaceAll(`${quote}${quote}`, quote),
      numeric: false,
    }
  }
  return answer
}

/**
 * XPath's own `normalize-space`, which collapses runs of the four characters
 * XML calls `S` and trims the ends. JavaScript's `\s` is wider and is banned
 * here for it: a no-break space is not a gap to any processor (#643).
 * @param {string} text - The string to normalize
 * @return {string} - The same string, its gaps collapsed and its ends cut
 */
const normalized = function(text) {
  return text.split('').map(
    (character) => {
      let same = character
      if (WHITESPACE.includes(character)) {
        same = ' '
      }
      return same
    },
  ).join('').split(' ').filter((one) => one !== '').join(' ')
}

/**
 * Where a step's name test stops, which is where its first predicate opens or
 * where the step itself closes, a step being a name test and then nothing but
 * predicates.
 * @param {object} node - A step node of a tree
 * @return {number} - The token index the name test runs up to
 */
const testedTo = function(node) {
  let to = node.to
  if (node.children.length > 0) {
    to = node.children[0].from
  }
  return to
}

/**
 * The axis a step opens on and the tokens its name test is spelled with,
 * parted at the axis token where one stands. A step spelling none stands on
 * the child axis, which is what XPath reads an abbreviated step as.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A step node of its tree
 * @return {{axis: string, named: Array}} - The axis and its name test
 */
const opening = function(tokens, node) {
  const carried = solid(tokens, node.from, testedTo(node))
  let opened = {axis: 'child', named: carried}
  if (carried.length > 0 && Object.hasOwn(AXES, carried[0].type)) {
    opened = {axis: AXES[carried[0].type], named: carried.slice(1)}
  }
  return opened
}

/**
 * Whether a step names the attribute axis, the one axis of this vocabulary
 * whose nodes carry a value of their own. An element's value is the text of
 * its whole subtree, so a comparison reading `value` off one read undefined
 * and answered false against every element there is, where refusing it costs
 * the engine call it already was (#811).
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A step node of its tree
 * @return {boolean} - True when it selects nodes carrying a value
 */
const carrying = function(tokens, node) {
  return opening(tokens, node).axis === 'attribute'
}

/**
 * The nodes one step selects from a context node, or undefined where its axis
 * or its name test is outside the vocabulary. Each predicate the step carries
 * narrows what the axis answered, asked of one node at a time as the whole
 * split is.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A step node of its tree
 * @return {(function(Node): Array.<Node>|undefined)} - What it selects from
 *  a node, or undefined
 */
const stepped = function(tokens, node) {
  let answer = undefined
  if (node.kind === 'step' &&
    node.children.every(
      (kid) => kid.kind === 'predicate' && kid.children.length === 1,
    )) {
    const {axis, named} = opening(tokens, node)
    const test = admitted(named, axis === 'attribute')
    const inner = node.children.map((kid) => tested(tokens, kid.children[0]))
    if (test !== undefined && inner.every((one) => one !== undefined)) {
      answer = (context) => inner.reduce(
        (kept, one) => kept.filter(one),
        reached(context, axis).filter((found) => admits(found, test)),
      )
    }
  }
  return answer
}

/**
 * The strings an operand of a comparison carries, or undefined where it is
 * outside the vocabulary. A bare attribute step answers the values it selects,
 * empty where it selects nothing, and `normalize-space` of one answers a single
 * string, empty where the attribute is absent — XPath's two different answers.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node standing as one side of a comparison
 * @return {(function(Node): Array.<string>|undefined)} - The strings it
 *  carries, or undefined
 */
const worded = function(tokens, node) {
  let answer = undefined
  if (node.kind === 'literal') {
    const literal = held(tokens, node)
    if (literal !== undefined && !literal.numeric) {
      answer = () => [literal.value]
    }
  } else if (node.kind === 'step' && carrying(tokens, node)) {
    const selects = stepped(tokens, node)
    if (selects !== undefined) {
      answer = (context) => selects(context).map((one) => one.value)
    }
  } else if (node.kind === 'parenthesized' || node.kind === 'sequence') {
    const parts = node.children.map((kid) => worded(tokens, kid))
    if (parts.length > 0 && parts.every((one) => one !== undefined)) {
      answer = (context) => parts.flatMap((one) => one(context))
    }
  } else if (node.kind === 'path' &&
    carrying(tokens, node.children[node.children.length - 1])) {
    const walked = pathed(tokens, node)
    if (walked !== undefined) {
      answer = (context) => walked(context).map((one) => one.value)
    }
  } else if (calling(tokens, node, 'substring-after') &&
    node.children.length === 2) {
    const parts = node.children.map((kid) => worded(tokens, kid))
    if (parts.every((one) => one !== undefined)) {
      answer = (context) => {
        const mark = parts[1](context)[0] ?? ''
        return [
          (parts[0](context)[0] ?? '').split(mark).slice(1).join(mark),
        ]
      }
    }
  } else if (calling(tokens, node, 'normalize-space') &&
    node.children.length === 1 && carrying(tokens, node.children[0])) {
    const selects = stepped(tokens, node.children[0])
    if (selects !== undefined) {
      answer = (context) => [
        normalized(selects(context).map((one) => one.value)[0] ?? ''),
      ]
    }
  }
  return answer
}

/**
 * The nodes a path of steps selects from a context node, each step asked of
 * what the one before it answered, or undefined where any step is outside the
 * vocabulary. Duplicates are left as they stand: every caller reads the values
 * of what it selects existentially, where a set would cost a walk to build.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree
 * @return {(function(Node): Array.<Node>|undefined)} - What it selects from
 *  a node, or undefined
 */
const pathed = function(tokens, node) {
  const steps = node.children.map((kid) => stepped(tokens, kid))
  let answer = undefined
  if (steps.length > 0 && steps.every((one) => one !== undefined)) {
    answer = (context) => steps.reduce(
      (standing, one) => standing.flatMap((where) => one(where)),
      [context],
    )
  }
  return answer
}

/**
 * Whether the node calls that function by its bare name. A prefixed or
 * `Q{...}` spelling is refused rather than resolved: no check writes one, and
 * a function of somebody else's carrying a standard name is not the standard
 * one (#557).
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node of its tree
 * @param {string} name - The function's name
 * @return {boolean} - True when the node calls it
 */
const calling = function(tokens, node, name) {
  return node.kind === 'call' && tokens[node.from].type === TOKENS.NAME &&
    tokens[node.from].value === name
}

/**
 * The number an operand of a comparison carries, or undefined where it is
 * outside the vocabulary: a numeric literal, a `count` of what a step selects,
 * or the `string-length` of an attribute, which is zero where none is there.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node standing as one side of a comparison
 * @return {(function(Node): number|undefined)} - The number it carries, or
 *  undefined
 */
const counted = function(tokens, node) {
  let answer = undefined
  if (node.kind === 'literal') {
    const literal = held(tokens, node)
    if (literal !== undefined && literal.numeric) {
      answer = () => literal.value
    }
  } else if (calling(tokens, node, 'count') && node.children.length === 1) {
    const selects = stepped(tokens, node.children[0])
    if (selects !== undefined) {
      answer = (context) => selects(context).length
    }
  } else if (calling(tokens, node, 'string-length') &&
    node.children.length === 1) {
    const carries = worded(tokens, node.children[0])
    if (carries !== undefined) {
      answer = (context) => Array.from(carries(context)[0] ?? '').length
    }
  }
  return answer
}

/**
 * The sign standing between two operands, read off the solid tokens the
 * grammar consumed without building a node of its own — a comparison holds its
 * two operands and not the sign between them.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A comparison node of its tree
 * @return {string} - The sign's token type, or an empty string
 */
const signed = function(tokens, node) {
  let sign = ''
  if (node.children.length === 2) {
    const between = solid(
      tokens, node.children[0].to, node.children[1].from,
    )
    if (between.length === 1 && Object.hasOwn(SIGNS, between[0].type)) {
      sign = between[0].type
    }
  }
  return sign
}

/**
 * What a comparison answers, or undefined where either side is outside the
 * vocabulary. Two numbers compare on any sign; strings compare on `=` alone
 * and existentially, XPath's own answer for a sequence on either side — and on
 * `=` alone because a negated existential is the shape easiest to get wrong.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A comparison node of its tree
 * @return {(function(Node): boolean|undefined)} - What it answers of a node,
 *  or undefined
 */
const compared = function(tokens, node) {
  const sign = signed(tokens, node)
  const numbers = node.children.map((kid) => counted(tokens, kid))
  const strings = node.children.map((kid) => worded(tokens, kid))
  let answer = undefined
  if (sign !== '' && numbers.every((one) => one !== undefined)) {
    answer = (context) => SIGNS[sign](numbers[0](context), numbers[1](context))
  } else if (sign === TOKENS.EQUAL &&
    strings.every((one) => one !== undefined)) {
    answer = (context) => strings[0](context).some(
      (one) => strings[1](context).includes(one),
    )
  }
  return answer
}

/**
 * What a predicate answers of one candidate, or undefined where any part of it
 * is outside the vocabulary. Refusing is never wrong and only dearer: the
 * engine answers what this cannot, where an answer given wrongly is a wrong
 * report, which is why every branch here narrows rather than guesses.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - The node a predicate holds, whole
 * @return {(function(Node): boolean|undefined)} - What it answers of a node,
 *  or undefined
 */
const tested = function(tokens, node) {
  let answer = undefined
  if (node.kind === 'step') {
    const selects = stepped(tokens, node)
    if (selects !== undefined) {
      answer = (context) => selects(context).length > 0
    }
  } else if (node.kind === 'and' || node.kind === 'or') {
    const parts = node.children.map((kid) => tested(tokens, kid))
    if (parts.length === 2 && parts.every((one) => one !== undefined)) {
      answer = (context) => parts[0](context) && parts[1](context)
      if (node.kind === 'or') {
        answer = (context) => parts[0](context) || parts[1](context)
      }
    }
  } else if (node.kind === 'parenthesized' && node.children.length === 1) {
    answer = tested(tokens, node.children[0])
  } else if (node.kind === 'comparison') {
    answer = compared(tokens, node)
  } else if (calling(tokens, node, 'not') && node.children.length === 1) {
    const inner = tested(tokens, node.children[0])
    if (inner !== undefined) {
      answer = (context) => !inner(context)
    }
  } else if (calling(tokens, node, 'contains') &&
    node.children.length === 2) {
    const parts = node.children.map((kid) => worded(tokens, kid))
    if (parts.every((one) => one !== undefined)) {
      answer = (context) => (parts[0](context)[0] ?? '').includes(
        parts[1](context)[0] ?? '',
      )
    }
  } else if (node.kind === 'path') {
    const walked = pathed(tokens, node)
    if (walked !== undefined) {
      answer = (context) => walked(context).length > 0
    }
  }
  return answer
}

/**
 * What one predicate of a served selector answers of a candidate, without the
 * engine, or undefined where the engine must answer it after all. The parse is
 * the grammar's rather than anything read off the text, and the answer is kept
 * against the text so a selector's predicate is compiled once for a run.
 * @param {string} text - What one predicate holds, its brackets off
 * @return {(function(Node): boolean|undefined)} - What it answers of a node,
 *  or undefined
 */
const predicateOf = function(text) {
  if (!COMPILED.has(text)) {
    const {tokens, tree} = parsed(text, ASSUMED)
    let answer = undefined
    if (tree !== null) {
      answer = tested(tokens, tree)
    }
    COMPILED.set(text, answer)
  }
  return COMPILED.get(text)
}

module.exports = {
  predicateOf,
}
