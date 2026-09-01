/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {GAP, WHITESPACE} = require('./tokens')
const {PREFIXES, nodes, satisfies, strings} = require('./xpath')
const {attributed, named} = require('./tree')
const {parsed} = require('./grammar')
const {ASSUMED, filters} = require('./syntax')
const {predicateOf} = require('./predicates')

/**
 * The answer for a selector no index can serve: no branch at all. An empty list
 * rather than a null, so a caller reads one shape whichever way the question
 * went, and the whole selector goes to the engine as before.
 * @type {Array}
 */
const NOTHING = Object.freeze([])

/**
 * How a selector spells every name there is, which is a shape of axis rather
 * than a name to bucket: `@*` behind a descendant step is every attribute of a
 * document, and that is a sequence one walk answers whole.
 * @type {string}
 */
const EVERY = '*'

/**
 * The splits already taken. A selector is one string and its split one answer,
 * where the question is put once for each document a cross-file check reads and
 * a predicate costs a parse to weigh.
 * @type {Map.<string, object>}
 */
const SPLITS = new Map()

/**
 * What a descendant sweep looks like: `//` then either one name or a union of
 * them in brackets, then an optional attribute the elements carry, then
 * whatever is left. Each name is weighed separately, since a wildcard and a
 * prefix nothing binds are refusals rather than shapes. A gap is `WHITESPACE`
 * inside the character class and `GAP` outside one.
 * @type {RegExp}
 */
const SWEEP = new RegExp(
  '^//(?:\\(' + GAP + '*([^()\\[\\]]+?)' + GAP + '*\\)' +
    '|([^()\\[\\]|/' + WHITESPACE + ']+))' +
    '(?:/@([^()\\[\\]|/' + WHITESPACE + ']+))?([^]*)$',
)

/**
 * A name an axis may yield: an NCName, or two joined by one colon. Deliberately
 * narrower than XPath's own, because what cannot be recognised here is served
 * by the engine instead — over-acceptance would hand the index a selector it
 * answers wrongly, where under-acceptance only leaves the run as it was.
 * @type {RegExp}
 */
const QUALIFIED =
  /^(?:([\p{L}_][\p{L}\p{N}\p{M}_.-]*):)?([\p{L}_][\p{L}\p{N}\p{M}_.-]*)$/u

/**
 * The top-level predicates a tail holds, or none at all where it is not a chain
 * of them — a step behind the brackets reaches past what the axis answered. A
 * quote carries its own brackets — `contains(@match, '[')` is one predicate
 * holding one bracket — so the scan reads over a literal rather than counting
 * inside it, which is the same reason `OPAQUE` exists one module over.
 * @param {string} text - What followed the axis
 * @return {Array.<string>} - What each predicate holds, outermost brackets off
 */
const predicated = function(text) {
  const parts = []
  let depth = 0
  let quote = ''
  let opened = 0
  let sound = text.length > 0
  for (let at = 0; at < text.length; at++) {
    const character = text.charAt(at)
    if (quote !== '') {
      if (character === quote) {
        quote = ''
      }
    } else if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '[') {
      if (depth === 0) {
        opened = at + 1
      }
      depth++
    } else if (character === ']') {
      depth--
      if (depth === 0) {
        parts.push(text.slice(opened, at))
      }
    } else if (depth === 0) {
      sound = false
    }
  }
  let answer = []
  if (sound && depth === 0 && quote === '') {
    answer = parts
  }
  return answer
}

/**
 * The branches a selector unions, one of them where it unions nothing. XPath's
 * `|` takes a path on either side, so each carries an axis and a tail of its
 * own. A `|` the selector did not union with is left where it stands — inside
 * brackets it parts the names of one axis, inside a literal it is a character
 * — so the scan counts depth rather than splitting on the symbol.
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<string>} - What each branch holds, the unions off
 */
const branched = function(xpath) {
  const parts = []
  let depth = 0
  let quote = ''
  let opened = 0
  for (let at = 0; at < xpath.length; at++) {
    const character = xpath.charAt(at)
    if (quote !== '') {
      if (character === quote) {
        quote = ''
      }
    } else if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '(' || character === '[') {
      depth++
    } else if (character === ')' || character === ']') {
      depth--
    } else if (character === '|' && depth === 0) {
      parts.push(xpath.slice(opened, at))
      opened = at + 1
    }
  }
  return parts.concat([xpath.slice(opened)])
}

/**
 * A selector parted at its descendant step: whatever stands in front of the
 * first `//` outside brackets and quotes, and the sweep from it on. What
 * stands in front is the **anchor**, one question the engine answers once for
 * a document where the sweep behind it is a traversal per check. A path
 * holding no `//` outside brackets reaches a bounded depth, and is cheap.
 * @param {string} xpath - One branch of a selector, its unions already parted
 * @return {{anchor: string, sweep: string}} - What to ask once, and what to
 *  serve
 */
const anchored = function(xpath) {
  let depth = 0
  let quote = ''
  let at = 0
  let opens = -1
  while (at < xpath.length && opens < 0) {
    const character = xpath.charAt(at)
    if (quote !== '') {
      if (character === quote) {
        quote = ''
      }
    } else if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '(' || character === '[') {
      depth++
    } else if (character === ')' || character === ']') {
      depth--
    } else if (character === '/' && depth === 0 &&
      xpath.charAt(at + 1) === '/') {
      opens = at
    }
    at++
  }
  let anchor = ''
  let sweep = xpath
  if (opens > 0) {
    anchor = xpath.slice(0, opens)
    sweep = xpath.slice(opens)
  }
  return {anchor: anchor, sweep: sweep}
}

/**
 * The namespace a name on the axis stands in, or an empty string where this
 * project binds no such prefix. They are the prefixes `src/xpath.js` binds for
 * every expression it issues, borrowed rather than written down again: the
 * index must mean by `xsl:` what the engine means by it. A name carrying no
 * prefix is refused rather than read as the empty namespace.
 * @param {string} prefix - The prefix, or undefined where the name carries none
 * @return {string} - The namespace URI, or an empty string
 */
const namespaced = function(prefix) {
  let uri = ''
  if (prefix !== undefined && Object.hasOwn(PREFIXES, prefix)) {
    uri = PREFIXES[prefix]
  }
  return uri
}

/**
 * The names one axis yields, or an empty list where any of them is a shape an
 * index cannot bucket.
 * @param {string} listed - The names as the selector spells them
 * @return {Array.<{uri: string, local: string}>} - The buckets to read
 */
const bucketed = function(listed) {
  const names = []
  let sound = true
  for (const spelled of listed.split('|').map((one) => one.trim())) {
    const hit = QUALIFIED.exec(spelled)
    let uri = ''
    if (hit !== null) {
      uri = namespaced(hit[1])
    }
    if (uri === '') {
      sound = false
    } else {
      names.push({uri: uri, local: hit[2]})
    }
  }
  let answer = []
  if (sound && names.length > 0) {
    answer = names
  }
  return answer
}

/**
 * The attribute one axis takes off each element it named, or an empty list
 * where the selector spells a shape the walk cannot answer. An unprefixed
 * attribute stands in no namespace, XPath's own answer rather than the refusal
 * an unprefixed *element* name earns: a default namespace reaches an element
 * and never an attribute. A wildcard is refused, no selector spelling one.
 * @param {string} marked - The attribute name, its `@` off
 * @return {Array.<{uri: string, local: string}>} - The attribute to take
 */
const pointed = function(marked) {
  const hit = QUALIFIED.exec(marked)
  const answer = []
  if (hit !== null && (hit[1] === undefined || namespaced(hit[1]) !== '')) {
    answer.push({uri: namespaced(hit[1]), local: hit[2]})
  }
  return answer
}

/**
 * The axis a selector opens with: the element buckets to read, and the
 * attribute to take off each. Two shapes carry one — every attribute of a
 * document, which no element name narrows, and one named attribute of named
 * elements — and the second wants both halves or neither, either alone being
 * another selector (#839).
 * @param {string} listed - The names as the selector spells them
 * @param {string} marked - The attribute behind them, or undefined
 * @return {{names: Array, attributes: Array}} - What the walk is asked for
 */
const opened = function(listed, marked) {
  let names = bucketed(listed)
  let attributes = []
  if (marked === undefined && names.length === 0 && listed === `@${EVERY}`) {
    attributes = [{uri: '', local: EVERY}]
  } else if (marked !== undefined) {
    attributes = pointed(marked)
    if (attributes.length === 0 || names.length === 0) {
      names = []
      attributes = []
    }
  }
  return {names: names, attributes: attributes}
}

/**
 * Whether the predicate filters the sequence rather than picking a position in
 * it, all one candidate at a time can answer. `src/syntax.js` answers, off the
 * parse and never the text, a number wearing more spellings than a digit: `[2
 * - 1]`, `[number("2")]` and `[count(@name)]` pick a position as `[1]` does
 * (#784). A path is one from 2.0 on, so its last step answers.
 * @param {string} text - What one predicate holds, its brackets off
 * @return {boolean} - Whether the split may serve it
 */
const filtered = function(text) {
  const {tokens, tree} = parsed(text, ASSUMED)
  return tree !== null && filters(tokens, tree)
}

/**
 * A name test one step of a path may spell, and the whole of what may stand as
 * an arm of a union the sweep parts: a qualified name, a prefixed wildcard, or
 * a bare one. Narrower than XPath's own on purpose, as `QUALIFIED` is — an arm
 * selecting anything but an element would hand `merged` a node the walk keeps
 * no rank for, where one this refuses leaves the union whole.
 * @type {RegExp}
 */
const STEP = new RegExp(
  '^(?:([\\p{L}_][\\p{L}\\p{N}\\p{M}_.-]*):)?' +
    '(?:[\\p{L}_][\\p{L}\\p{N}\\p{M}_.-]*|\\*)$',
  'u',
)

/**
 * Whether one arm of a union is a single element step, which is a name test
 * and then nothing but predicates. A path is refused though its last step
 * would yield elements too, since what stands in front of that step decides
 * what the arm reaches and the arms are distributed over a `//` that is not
 * theirs.
 * @param {string} arm - One arm of a union, its gaps already trimmed
 * @return {boolean} - Whether the arm is one element step
 */
const stepped = function(arm) {
  const opens = arm.indexOf('[')
  let head = arm
  let rest = ''
  if (opens >= 0) {
    head = arm.slice(0, opens)
    rest = arm.slice(opens)
  }
  return STEP.test(head.trim()) && (rest === '' || predicated(rest).length > 0)
}

/**
 * Where the bracket a text opens with is shut, or below zero where it is not.
 * A quote carries its own brackets, so the scan reads over a literal rather
 * than counting what it holds, for the reason `predicated` and `branched` do.
 * @param {string} text - A text opening with a bracket
 * @return {number} - Where the matching bracket stands
 */
const closed = function(text) {
  let depth = 0
  let quote = ''
  let shut = -1
  for (let at = 0; at < text.length && shut < 0; at++) {
    const character = text.charAt(at)
    if (quote !== '') {
      if (character === quote) {
        quote = ''
      }
    } else if (character === '\'' || character === '"') {
      quote = character
    } else if (character === '(' || character === '[') {
      depth++
    } else if (character === ')' || character === ']') {
      depth--
      if (depth === 0) {
        shut = at
      }
    }
  }
  return shut
}

/**
 * A bracketed union in the sweep position, spelled out as one whole selector
 * per arm: `P//(a | b)[Q]` is `P//a[Q] | P//b[Q]`, a union being a set and the
 * tail already asked one candidate at a time. Every arm must be one element
 * step, a refused arm going to the engine and coming back to be merged by a
 * rank the walk keeps for elements alone (#811).
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<string>} - One whole selector an arm, or nothing to spread
 */
const spread = function(xpath) {
  const {anchor, sweep} = anchored(xpath)
  let arms = NOTHING
  if (sweep.startsWith('//(')) {
    const shut = closed(sweep.slice(2))
    const inside = sweep.slice(3, 2 + shut)
    const tail = sweep.slice(3 + shut)
    const parts = branched(inside).map((one) => one.trim())
    if (shut > 0 && parts.length > 1 && parts.every((one) => stepped(one))) {
      arms = parts.map((one) => `${anchor}//${one}${tail}`)
    }
  }
  return arms
}

/**
 * A selector split into the axis an index can answer and the tail a predicate
 * must: `//(xsl:variable | xsl:template)[P]` is two buckets off the shared
 * walk, where the whole costs fontoxpath a descendant traversal, 50 times that
 * walk (#635). Refused: a positional predicate, an axis naming no bucket, a
 * step behind the tail, an attribute axis under an anchor.
 * @param {string} xpath - The selector a declarative check is written in
 * @return {{names: Array.<{uri: string, local: string}>, anchor: string,
 *  tail: string}} - The buckets, the anchor and the tail, or no names at all
 *  where the engine must answer
 */
const swept = function(xpath) {
  const {anchor, sweep} = anchored(xpath.trim())
  const hit = SWEEP.exec(sweep)
  let branch = NOTHING
  if (hit !== null) {
    const tail = hit[4]
    let listed = hit[1]
    if (listed === undefined) {
      listed = hit[2]
    }
    const axis = opened(listed, hit[3])
    const parts = predicated(tail)
    if (axis.names.length + axis.attributes.length > 0 &&
      (anchor === '' || axis.attributes.length === 0) &&
      (tail === '' || parts.length > 0) &&
      parts.every((one) => filtered(one))) {
      branch = [
        {
          names: axis.names,
          attributes: axis.attributes,
          anchor: anchor,
          tail: tail,
          refused: '',
        },
      ]
    }
  }
  return branch
}

/**
 * The arms of one bracketed union, each served where the walk can serve it and
 * swept where it cannot. Safe because `spread` admits element steps alone, so
 * an arm the engine answers comes back as elements `named` already ranks.
 * Refused outright where no arm can be served, and where a served arm carries
 * an attribute, an attribute holding no rank to merge on (#811).
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<object>} - A branch an arm, or nothing to serve
 */
const apart = function(xpath) {
  const arms = spread(xpath)
  const served = arms.map((one) => swept(one))
  let split = NOTHING
  if (served.some((one) => one.length > 0) &&
    served.every((one) => one.length === 0 || one[0].attributes.length === 0)) {
    split = arms.map((one, at) => served[at][0] ?? {
      names: [],
      attributes: [],
      anchor: '',
      tail: '',
      refused: one,
    })
  }
  return split
}

/**
 * Every branch of a split, or nothing where the walk cannot answer one. A
 * union of whole paths is served whole or not at all, a branch left to the
 * engine needing answers merged across a sequence one side never enumerated;
 * one spelled inside a sweep is parted arm by arm by `apart`. A union of
 * **attribute** axes is refused for another: the merge wants a rank (#811).
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<{names: Array.<{uri: string, local: string}>,
 *  attributes: Array.<{uri: string, local: string}>, tail: string}>} - A branch
 *  apiece, or nothing where the engine must answer
 */
const parted = function(xpath) {
  const spelled = branched(xpath.trim())
  const branches = spelled.flatMap((one) => swept(one))
  let split = NOTHING
  if (branches.length === spelled.length &&
    (branches.length === 1 ||
      branches.every((one) => one.attributes.length === 0))) {
    split = branches
  } else if (spelled.length === 1) {
    split = apart(xpath.trim())
  }
  return split
}

/**
 * The split of a selector, taken once and remembered against its text.
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<{names: Array.<{uri: string, local: string}>,
 *  attributes: Array.<{uri: string, local: string}>, tail: string}>} - Each
 *  branch's split, or nothing to serve
 */
const splitOf = function(xpath) {
  if (!SPLITS.has(xpath)) {
    SPLITS.set(xpath, parted(xpath))
  }
  return SPLITS.get(xpath)
}

/**
 * The nodes an axis answers, before any predicate narrows them: every
 * attribute of the document where no name stands in front of one, otherwise
 * the elements of each bucket merged by document-order rank — which is what a
 * union needs, XPath answering a path in document order — and then the named
 * attribute of each, where the selector asked for one.
 * @param {Document} xsl - Parsed stylesheet
 * @param {object} split - One branch of what `splitOf` made of the selector
 * @return {Array.<Node>} - What the axis yields, in document order
 */
const axised = function(xsl, split) {
  let found = attributed(xsl)
  if (split.names.length > 0) {
    const {buckets, rank} = named(xsl)
    found = split.names.flatMap(
      (name) => buckets.get(`${name.uri} ${name.local}`) ?? [],
    )
    if (split.names.length > 1) {
      found.sort((one, two) => rank.get(one) - rank.get(two))
    }
    if (split.attributes.length > 0) {
      found = found.flatMap((node) => Array.from(node.attributes).filter(
        (one) => one.localName === split.attributes[0].local &&
          (one.namespaceURI ?? '') === split.attributes[0].uri,
      ))
    }
  }
  return found
}

/**
 * What each anchor has chosen in each document, so that an anchor is one
 * question however many branches carry it. Spreading a union hands every arm
 * the same anchor, and asking the engine once an arm would pay over and over
 * for the very traversal the split exists to avoid — 4.4 ms over the whole of
 * DocBook-XSL is cheap once and is not cheap ten times (#811).
 * @type {WeakMap.<Document, Map.<string, Set.<Node>>>}
 */
const ROOTS = new WeakMap()

/**
 * The nodes an anchor chooses in a document, taken once and remembered against
 * the two. A set rather than a list, since `descended` asks it whether a node
 * stands in it and never what stands where.
 * @param {Document} xsl - Parsed stylesheet
 * @param {string} anchor - What the branch spelled in front of its sweep
 * @return {Set.<Node>} - What the anchor chose
 */
const rooted = function(xsl, anchor) {
  if (!ROOTS.has(xsl)) {
    ROOTS.set(xsl, new Map())
  }
  const held = ROOTS.get(xsl)
  if (!held.has(anchor)) {
    held.set(anchor, new Set(nodes(xsl, anchor)))
  }
  return held.get(anchor)
}

/**
 * The candidates standing below one of the anchor's answers, which is what a
 * `//` between them means: every node the sweep found that has one of those
 * nodes above it, and never one of them itself. The walk climbs to a parent
 * rather than descending from the anchor, so an anchor that answered nothing
 * keeps nothing.
 * @param {Array.<Node>} found - What the sweep yielded
 * @param {Set.<Node>} roots - What the anchor chose
 * @return {Array.<Node>} - Those of them standing below one of the roots
 */
const descended = function(found, roots) {
  return found.filter((node) => {
    let up = node.parentNode
    let below = false
    while (up !== null && !below) {
      below = roots.has(up)
      up = up.parentNode
    }
    return below
  })
}

/**
 * What each tail was parted into, kept against its text.
 * @type {Map}
 */
const ANSWERS = new Map()

/**
 * A tail parted into the predicates the walk answers and the text of those it
 * does not, taken once and remembered against the tail. The compiled ones run
 * first, so what the engine is still asked it is asked of a pruned sequence —
 * and it is asked once for the rest rather than once per predicate, which is
 * what keeps a tail no part of compiles exactly as dear as it was (#811).
 * @param {string} tail - The predicates a branch carries, brackets and all
 * @return {{served: Array.<function(Node): boolean>, asked: string}} - What
 *  the walk answers, and what is left for the engine
 */
const answered = function(tail) {
  if (!ANSWERS.has(tail)) {
    const parts = predicated(tail)
    const compiled = parts.map((one) => predicateOf(one))
    ANSWERS.set(tail, {
      served: compiled.filter((one) => one !== undefined),
      asked: parts.filter(
        (one, at) => compiled[at] === undefined,
      ).map((one) => `[${one}]`).join(''),
    })
  }
  return ANSWERS.get(tail)
}

/**
 * What one branch answers: the nodes its axis yields, kept to those below the
 * anchor it carries, narrowed by each predicate of its tail — off the walk
 * where the vocabulary reaches one, and off the engine for the rest, asked of
 * a sequence the served ones have already pruned. A branch `apart` refused
 * carries the whole selector its arm spells and goes to the engine as it is.
 * @param {Document} xsl - Parsed stylesheet
 * @param {object} branch - One branch of what `splitOf` made of the selector
 * @return {Array.<Node>} - The nodes it selects, in document order
 */
const narrowed = function(xsl, branch) {
  let found = []
  if (branch.refused === '') {
    found = axised(xsl, branch)
    if (branch.anchor !== '') {
      found = descended(found, rooted(xsl, branch.anchor))
    }
    if (branch.tail !== '') {
      const {served, asked} = answered(branch.tail)
      for (const one of served) {
        found = found.filter(one)
      }
      if (asked !== '') {
        found = found.filter(
          (node) => satisfies(node, `self::node()${asked}`),
        )
      }
    }
  } else {
    found = nodes(xsl, branch.refused)
  }
  return found
}

/**
 * What a union of branches answers: every branch's nodes, deduplicated and put
 * back into document order. Both halves are XPath's own answer rather than a
 * convenience — a union is a set, and a path answers in document order, so the
 * branches are merged by the rank `named` remembers. Appending would report
 * every `xsl:otherwise` after every `xsl:when` (#784, #811).
 * @param {Document} xsl - Parsed stylesheet
 * @param {Array.<object>} branches - What `splitOf` made of the selector
 * @return {Array.<Node>} - What they select between them, in document order
 */
const merged = function(xsl, branches) {
  const {rank} = named(xsl)
  return Array.from(
    new Set(branches.flatMap((branch) => narrowed(xsl, branch))),
  ).sort((one, two) => rank.get(one) - rank.get(two))
}

/**
 * The nodes a selector chooses. Where it opens with a descendant sweep the
 * walk serves, the axis comes off that walk and only the predicate reaches the
 * engine, as `self::node()` plus the tail; any other shape goes whole. The
 * engine is asked inside the branch needing it, never as its initial value,
 * the fallback being the traversal avoided: 50.78% against 31.64%.
 * @param {Document} xsl - Parsed stylesheet
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<Node>} - The nodes it selects, in document order
 */
const chosen = function(xsl, xpath) {
  const branches = splitOf(xpath)
  let found = []
  if (branches.length === 0) {
    found = nodes(xsl, xpath)
  } else if (branches.length === 1) {
    found = narrowed(xsl, branches[0])
  } else {
    found = merged(xsl, branches)
  }
  return found
}

/**
 * The string values a selector chooses, served the same way `chosen` is where
 * the axis it opens with carries an **attribute**: the string value of an
 * attribute is the value it holds, which is the whole of what an XPath asks of
 * one. An element's is the text of everything below it, and no usage selector
 * asks for that, so nothing here answers it and the engine keeps the question.
 * @param {Document} xsl - Parsed stylesheet
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<string>} - The values it selects, in document order
 */
const valued = function(xsl, xpath) {
  const branches = splitOf(xpath)
  let found = []
  if (branches.length === 1 && branches[0].attributes.length > 0) {
    found = chosen(xsl, xpath).map((node) => node.value)
  } else {
    found = strings(xsl, xpath)
  }
  return found
}

module.exports = {
  EVERY,
  chosen,
  predicated,
  valued,
  splitOf,
}
