/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `predicateOf(text)` — what one predicate of a served selector answers of
 * one candidate off the walk, or `undefined` where the engine must answer it,
 * a fontoxpath call costing about 7 us for what a property read answers in
 * nanoseconds once #811 made the tail the whole cost. Off the parse, each of
 * the 56 distinct predicates in the tree is compiled once a run; 43 of them
 * answer off the walk. Over-acceptance is a wrong report where
 * under-acceptance is only the engine call it was, so a regex, a bare
 * `normalize-space` (#881), an absolute path and an element's string value
 * are refused, and no JavaScript built-in is taken for XPath's notion (#643).
 */

const {PREFIXES} = require('./xpath')
const {TOKENS, TRIVIA, normalized, unquoted} = require('./tokens')
const {parsed} = require('./grammar')
const {ASSUMED} = require('./syntax')
const {saidOf} = require('./expressions')

/**
 * A compiled predicate for each text it was asked of, built once and kept for
 * the run. There are some thirty distinct predicate texts across every check,
 * so the map is small and the parse behind each entry is paid once.
 * @type {Map}
 */
const COMPILED = new Map()

/**
 * The node kinds a walk is filtered to where a name test stands on it, a name
 * being a question only an element answers.
 * @type {Array.<number>}
 */
const ELEMENTS = [1]

/**
 * The node kinds a `text()` test admits. XPath's data model holds one text
 * node where the DOM holds two types, a CDATA section being a spelling of
 * text and not a kind of its own, so a walk blind to the second reads a
 * `<![CDATA[x]]>` as no text at all.
 * @type {Array.<number>}
 */
const TEXTUAL = [3, 4]

/**
 * The node kinds an attribute axis reaches, which is the axis itself: nothing
 * else hangs off `attributes`, so the walk below is handed this and narrows
 * by nothing.
 * @type {Array.<number>}
 */
const ATTRIBUTES = [2]

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
  [TOKENS.DESCENDANT]: 'descendant',
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
 * What a node test admits: the kinds it reaches, and a wildcard or a
 * qualified name among those. An unprefixed element name is refused for the
 * reason `bucketed` refuses one — a default namespace reaches an element —
 * where an unprefixed attribute stands in none. `text()` is admitted on the
 * child axis alone, the only one walked for anything but elements (#811).
 * @param {Array} carried - The solid tokens of the node test
 * @param {string} axis - The axis it stands on, as `AXES` names it
 * @return {?object} - What the test admits, or undefined where it is refused
 */
const admitted = function(carried, axis) {
  let answer = undefined
  if (carried.length === 1 && carried[0].type === TOKENS.MULTI) {
    answer = {
      kinds: ELEMENTS, uri: '', local: '', every: true, whole: false,
    }
  } else if (carried.length === 3 && carried[0].type === TOKENS.NAME &&
    carried[1].type === TOKENS.COLON && carried[2].type === TOKENS.MULTI &&
    namespaced(carried[0].value) !== '') {
    answer = {
      kinds: ELEMENTS, uri: namespaced(carried[0].value), local: '',
      every: false, whole: true,
    }
  } else if (carried.map((one) => one.value).join('') === 'text()' &&
    axis === 'child') {
    answer = {
      kinds: TEXTUAL, uri: '', local: '', every: true, whole: false,
    }
  } else if (carried.length === 1 && carried[0].type === TOKENS.NAME) {
    const parts = carried[0].value.split(':')
    if (parts.length === 1 && axis === 'attribute') {
      answer = {
        kinds: ATTRIBUTES, uri: '', local: parts[0], every: false, whole: false,
      }
    } else if (parts.length === 2 && namespaced(parts[0]) !== '') {
      answer = {
        kinds: ELEMENTS, uri: namespaced(parts[0]), local: parts[1],
        every: false, whole: false,
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
 * The nodes of the kinds asked for that a chain of links yields, walked from
 * where it opens and taken one link at a time. Four axes are that walk with a
 * different link, and a node of another kind on the way is stepped over
 * rather than stopping it — a comment standing between two siblings ends
 * neither the sibling axis.
 * @param {?Node} standing - Where the walk starts, or null
 * @param {string} link - The property each step of the walk follows
 * @param {Array.<number>} kinds - The node types it keeps
 * @return {Array.<Node>} - The nodes it reaches
 */
const linked = function(standing, link, kinds) {
  let found = []
  for (let walk = standing; walk !== null; walk = walk[link]) {
    if (kinds.includes(walk.nodeType)) {
      found = found.concat([walk])
    }
  }
  return found
}

/**
 * Every element standing below a node, in document order. The descendant axis
 * is the one axis of this vocabulary that no chain of links walks, so it is
 * gathered rather than followed — and gathered by pushing, a walk growing an
 * array by `concat` as `elements` does costing the square of a subtree that a
 * count is asked the size of.
 * @param {Node} node - The context node
 * @return {Array.<Node>} - The elements below it, in document order
 */
const below = function(node) {
  const found = []
  /**
   * Take a node's own elements and then each of theirs, which is the order a
   * document is written in.
   * @param {Node} standing - The node to descend from
   */
  const visit = function(standing) {
    for (const one of linked(standing.firstChild, 'nextSibling', ELEMENTS)) {
      found.push(one)
      visit(one)
    }
  }
  visit(node)
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
 * The nodes of the kinds a test admits that an axis reaches from one context
 * node, before the name test narrows them further. An attribute axis answers
 * the attributes a node carries, that being every node it reaches, and a
 * descendant axis answers elements alone — which is why `text()` is admitted
 * on the child axis and nowhere else.
 * @param {Node} node - The context node
 * @param {string} axis - The axis, as `AXES` names it
 * @param {Array.<number>} kinds - The node types the test admits
 * @return {Array.<Node>} - What it reaches
 */
const reached = function(node, axis, kinds) {
  let found = []
  if (axis === 'attribute') {
    found = Array.from(node.attributes || [])
  } else if (axis === 'self') {
    found = [node]
  } else if (axis === 'parent') {
    found = linked(above(node), 'parentNode', kinds).slice(0, 1)
  } else if (axis === 'child') {
    found = linked(node.firstChild, 'nextSibling', kinds)
  } else if (axis === 'preceding-sibling') {
    found = linked(node.previousSibling, 'previousSibling', kinds)
  } else if (axis === 'following-sibling') {
    found = linked(node.nextSibling, 'nextSibling', kinds)
  } else if (axis === 'ancestor') {
    found = linked(above(node), 'parentNode', kinds)
  } else if (axis === 'descendant') {
    found = below(node)
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
    answer = {value: unquoted(carried[0]), numeric: false}
  }
  return answer
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
 * @param {string} [under] - An axis the path around it puts the step on,
 *  which only a step spelling none of its own may be moved to
 * @return {(function(Node): Array.<Node>|undefined)} - What it selects from
 *  a node, or undefined
 */
const stepped = function(tokens, node, under = undefined) {
  let answer = undefined
  if (node.kind === 'step' &&
    node.children.every(
      (kid) => kid.kind === 'predicate' && kid.children.length === 1,
    )) {
    const {axis, named} = opening(tokens, node)
    const test = admitted(named, under ?? axis)
    if (test !== undefined && (under === undefined || axis === 'child')) {
      const inner = node.children.map(
        (kid) => tested(tokens, kid.children[0], test.kinds),
      )
      if (inner.every((one) => one !== undefined)) {
        answer = (context) => inner.reduce(
          (kept, one) => kept.filter(one),
          reached(context, under ?? axis, test.kinds).filter(
            (found) => admits(found, test),
          ),
        )
      }
    }
  }
  return answer
}

/**
 * What `xslint:attribute(., 'x')` says of an element, or undefined where the
 * call is spelled any other way: it must be handed the element itself and a
 * name a literal spells, the function reading an element's attributes and an
 * attribute carrying none (#997).
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node of its tree
 * @param {Array} kinds - The node kinds the context yields
 * @return {(function(Node): Array.<string>|undefined)} - What it says of an
 *  element, in either spelling, or undefined
 */
const said = function(tokens, node, kinds) {
  let answer = undefined
  if (calling(tokens, node, 'xslint:attribute') &&
    node.children.length === 2 && node.children[0].kind === 'context' &&
    kinds === ELEMENTS) {
    const literal = held(tokens, node.children[1])
    if (literal !== undefined && !literal.numeric) {
      answer = (context) => saidOf(context, literal.value)
    }
  }
  return answer
}

/**
 * What `xslint:attribute` says of each element a path of steps reaches, or
 * undefined where a step is outside the vocabulary or reaches anything but
 * elements, the one kind the function reads.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree
 * @return {(function(Node): Array.<string>|undefined)} - What it says of the
 *  elements the path reaches, or undefined
 */
const saying = function(tokens, node) {
  const steps = node.children.slice(0, -1)
  const selects = steps.map((kid) => stepped(tokens, kid))
  const says = said(tokens, node.children[node.children.length - 1], ELEMENTS)
  let answer = undefined
  if (steps.length > 0 && says !== undefined && slashed(tokens, node) &&
    selects.every((one) => one !== undefined) &&
    steps.every((kid) => !carrying(tokens, kid) &&
      admitted(opening(tokens, kid).named, 'child').kinds === ELEMENTS)) {
    answer = (context) => selects.reduce(
      (standing, one) => standing.flatMap((where) => one(where)),
      [context],
    ).flatMap((where) => says(where))
  }
  return answer
}

/**
 * The strings an operand of a comparison carries, or undefined where it is
 * outside the vocabulary. An attribute step answers the values it selects and
 * `xslint:normalize-space` a single string, empty where what it reads is
 * absent — XPath's two different answers — `local-name()` the candidate's own
 * name, and `.` its string value, which the DOM spells `textContent`.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node standing as one side of a comparison
 * @param {Array} kinds - The node kinds the axis yields, since `.` is a
 *  property read on a text node and a whole subtree on an element
 * @return {(function(Node): Array.<string>|undefined)} - The strings it
 *  carries, or undefined
 */
const worded = function(tokens, node, kinds = ELEMENTS) {
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
    const parts = node.children.map((kid) => worded(tokens, kid, kinds))
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
    const parts = node.children.map((kid) => worded(tokens, kid, kinds))
    if (parts.every((one) => one !== undefined)) {
      answer = (context) => {
        const mark = parts[1](context)[0] ?? ''
        return [
          (parts[0](context)[0] ?? '').split(mark).slice(1).join(mark),
        ]
      }
    }
  } else if (calling(tokens, node, 'xslint:normalize-space') &&
    node.children.length === 1) {
    const carries = worded(tokens, node.children[0], kinds)
    if (carries !== undefined) {
      answer = (context) => [normalized(carries(context)[0] ?? '')]
    }
  } else if (calling(tokens, node, 'xslint:attribute')) {
    answer = said(tokens, node, kinds)
  } else if (node.kind === 'path' && node.children.length > 1 &&
    calling(tokens, node.children[node.children.length - 1],
      'xslint:attribute')) {
    answer = saying(tokens, node)
  } else if (calling(tokens, node, 'local-name') &&
    node.children.length === 0) {
    answer = (context) => [context.localName]
  } else if (node.kind === 'context' &&
    kinds.every((one) => TEXTUAL.includes(one))) {
    answer = (context) => [context.nodeValue]
  }
  return answer
}

/**
 * The separator standing between two adjacent steps of a path, read off the
 * solid tokens the grammar consumed without a node of its own — a path holds
 * its steps and not the slashes between them, the way a comparison holds its
 * operands and not the sign.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree
 * @param {number} index - Which child to read the separator in front of
 * @return {string} - The separator's token type, or an empty string
 */
const parted = function(tokens, node, index) {
  const between = solid(
    tokens, node.children[index - 1].to, node.children[index].from,
  )
  let sign = ''
  if (between.length === 1) {
    sign = between[0].type
  }
  return sign
}

/**
 * Whether a path opens with a separator of its own, which makes it absolute.
 * `//x` and `/x` ask the document a candidate stands in rather than the
 * candidate, and hold one step apiece where `a/x` holds two, so a reader
 * counting children alone answers `child::x` to a question about the root.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree, holding a child
 * @return {boolean} - True where a separator stands in front of its first step
 */
const rooted = function(tokens, node) {
  return solid(tokens, node.from, node.children[0].from).length > 0
}

/**
 * Whether a path is a chain of single slashes and nothing else. The separator
 * is the whole of what tells `a/b` from `a//b`, and a reader blind to it
 * answers the second as the first — an answer given wrongly rather than one
 * withheld, which is the one failure a split may not commit.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree
 * @return {boolean} - True where every step of it stands one slash on
 */
const slashed = function(tokens, node) {
  return node.children.length > 0 && !rooted(tokens, node) &&
    node.children.slice(1).every(
      (kid, index) => parted(tokens, node, index + 1) === TOKENS.SLASH,
    )
}

/**
 * The elements a descending path selects from a context node, or undefined
 * where the path is not one: `.//x` is `descendant::x`, whose double slash is
 * a token between two children rather than a node of the tree. Only that
 * spelling is served — `./x` names an axis a step already carries, and an
 * absolute one asks the document rather than the candidate.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A path node of its tree
 * @return {(function(Node): Array.<Node>|undefined)} - What it selects from
 *  a node, or undefined
 */
const descending = function(tokens, node) {
  let answer = undefined
  if (node.children.length === 2 && node.children[0].kind === 'context' &&
    !rooted(tokens, node) &&
    parted(tokens, node, 1) === TOKENS.DOUBLE_SLASH) {
    answer = stepped(tokens, node.children[1], 'descendant')
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
  let answer = descending(tokens, node)
  if (answer === undefined && slashed(tokens, node) &&
    steps.every((one) => one !== undefined)) {
    answer = (context) => steps.reduce(
      (standing, one) => standing.flatMap((where) => one(where)),
      [context],
    )
  }
  return answer
}

/**
 * Whether the node calls that function by the name it is asked for, spelled
 * that way: another prefix or a `Q{...}` is refused rather than resolved, a
 * function of somebody else's carrying a standard name being no standard one
 * (#557). A prefixed name with no hyphen lexes as a user function rather
 * than a name, which is how `xslint:attribute` reads (#997).
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node of its tree
 * @param {string} name - The function's name
 * @return {boolean} - True when the node calls it
 */
const calling = function(tokens, node, name) {
  return node.kind === 'call' &&
    [TOKENS.NAME, TOKENS.USER_FUNCTION].includes(tokens[node.from].type) &&
    tokens[node.from].value === name
}

/**
 * The number an operand of a comparison carries, or undefined where it is
 * outside the vocabulary: a numeric literal, a `count` of what a step selects,
 * or the `string-length` of an attribute, which is zero where none is there.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - A node standing as one side of a comparison
 * @param {Array} kinds - The node kinds the axis yields, since `.` is a
 *  property read on a text node and a whole subtree on an element
 * @return {(function(Node): number|undefined)} - The number it carries, or
 *  undefined
 */
const counted = function(tokens, node, kinds = ELEMENTS) {
  let answer = undefined
  if (node.kind === 'literal') {
    const literal = held(tokens, node)
    if (literal !== undefined && literal.numeric) {
      answer = () => literal.value
    }
  } else if (calling(tokens, node, 'count') && node.children.length === 1) {
    const selects = stepped(tokens, node.children[0]) ??
      descending(tokens, node.children[0])
    if (selects !== undefined) {
      answer = (context) => selects(context).length
    }
  } else if (calling(tokens, node, 'string-length') &&
    node.children.length === 1) {
    const carries = worded(tokens, node.children[0], kinds)
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
 * @param {Array} kinds - The node kinds the axis yields, since `.` is a
 *  property read on a text node and a whole subtree on an element
 * @return {(function(Node): boolean|undefined)} - What it answers of a node,
 *  or undefined
 */
const compared = function(tokens, node, kinds = ELEMENTS) {
  const sign = signed(tokens, node)
  const numbers = node.children.map((kid) => counted(tokens, kid, kinds))
  const strings = node.children.map((kid) => worded(tokens, kid, kinds))
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
 * @param {Array} kinds - The node kinds the axis yields, since `.` is a
 *  property read on a text node and a whole subtree on an element
 * @return {(function(Node): boolean|undefined)} - What it answers of a node,
 *  or undefined
 */
const tested = function(tokens, node, kinds = ELEMENTS) {
  let answer = undefined
  if (node.kind === 'step') {
    const selects = stepped(tokens, node)
    if (selects !== undefined) {
      answer = (context) => selects(context).length > 0
    }
  } else if (node.kind === 'and' || node.kind === 'or') {
    const parts = node.children.map((kid) => tested(tokens, kid, kinds))
    if (parts.length === 2 && parts.every((one) => one !== undefined)) {
      answer = (context) => parts[0](context) && parts[1](context)
      if (node.kind === 'or') {
        answer = (context) => parts[0](context) || parts[1](context)
      }
    }
  } else if (node.kind === 'parenthesized' && node.children.length === 1) {
    answer = tested(tokens, node.children[0], kinds)
  } else if (node.kind === 'comparison') {
    answer = compared(tokens, node, kinds)
  } else if (calling(tokens, node, 'not') && node.children.length === 1) {
    const inner = tested(tokens, node.children[0], kinds)
    if (inner !== undefined) {
      answer = (context) => !inner(context)
    }
  } else if (calling(tokens, node, 'contains') &&
    node.children.length === 2) {
    const parts = node.children.map((kid) => worded(tokens, kid, kinds))
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
  } else if (calling(tokens, node, 'xslint:normalize-space')) {
    const carries = worded(tokens, node, kinds)
    if (carries !== undefined) {
      answer = (context) => carries(context)[0] !== ''
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

/**
 * Every clause an `and` joins, gathered into the list handed in rather than
 * answered, a chain of them parsing left-nested: `a and b and c` is an `and`
 * of an `and` and a step. Each leaf comes back as the parse read it, gaps and
 * all, so a clause is the text its author wrote and never a respelling of it.
 * @param {Array} tokens - The tokens the tree was parsed from
 * @param {object} node - One node of it
 * @param {Array.<string>} clauses - Where the text of each is put
 */
const joined = function(tokens, node, clauses) {
  if (node.kind === 'and' && node.children.length === 2) {
    node.children.forEach((kid) => joined(tokens, kid, clauses))
  } else {
    clauses.push(
      tokens.slice(node.from, node.to).map((one) => one.value).join(''),
    )
  }
}

/**
 * The clauses one predicate joins with `and`, or the whole of it where it
 * joins none, each written as the parse read it. A clause the vocabulary
 * answers prunes the sequence the rest of the conjunction is asked of, which
 * is what a bracket outside the vocabulary cost until #811: a fontoxpath call
 * on every candidate its cheapest clause would have refused.
 * @param {string} text - What one predicate holds, its brackets off, which
 *  parses by the time it is here: a split reading over its own quotes yields
 *  the predicates of a selector and never a fragment of one
 * @return {Array.<string>} - Each clause, in the order it stands
 */
const conjunctsOf = function(text) {
  const {tokens, tree} = parsed(text, ASSUMED)
  const clauses = []
  joined(tokens, tree, clauses)
  return clauses
}

module.exports = {
  conjunctsOf,
  predicateOf,
}
