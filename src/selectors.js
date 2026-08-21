/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {GAP, WHITESPACE} = require('./tokens')
const {PREFIXES, nodes, satisfies, strings} = require('./xpath')
const {attributed, named} = require('./tree')
const {parsed} = require('./grammar')
const {ASSUMED, filters} = require('./syntax')

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
 * prefix nothing binds are refusals rather than shapes. A gap is spelled
 * `WHITESPACE` inside the character class and `GAP` outside one, those being
 * the same four characters written the two ways a regular expression needs
 * them.
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
 * The branches a selector unions, which is one branch for a selector that
 * unions nothing. XPath's `|` takes a path on either side and answers both in
 * document order, so each side carries an axis of its own and a tail of its
 * own and neither can stand for the other:
 * `//xsl:when[not(parent::xsl:choose)] | //xsl:otherwise[...]` is two sweeps
 * the engine pays for separately and two buckets the walk already holds.
 *
 * A `|` the selector did not union with is left where it stands — inside
 * brackets it parts the names of one axis, `//(xsl:variable | xsl:template)`,
 * and inside a literal it is a character, `contains(@match, '|')` — so the scan
 * walks characters and counts depth rather than splitting on the symbol, for
 * the reason `predicated` does one bracket over.
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
 * first `//` outside brackets and quotes, and the sweep from that `//` on. What
 * stands in front is the **anchor**, and it is one question the engine answers
 * once for a document where the sweep behind it is a traversal per check: a
 * selector reads `P//X` as every `X` standing below a node `P` chose, so the
 * anchor is asked whole and the candidates are those with one of its answers
 * above them.
 *
 * Nothing is asked of the anchor's own shape. A path holding no `//` outside
 * brackets reaches a bounded depth from wherever it starts, which is what makes
 * it cheap, and it is handed to the engine exactly as the selector spelled it —
 * where a rule admitting only `/name` or `/*[guard]` would be a second opinion
 * about which shapes those are. A `//` standing inside a predicate stays in the
 * anchor with it, so `/*[count(//xsl:template) >= 10]` is one anchor and not
 * two halves of a sweep.
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
 * project binds no such prefix. The prefixes are the ones `src/xpath.js` binds
 * for every expression it issues, borrowed rather than written down again: the
 * index has to mean by `xsl:` exactly what the engine means by it, and a second
 * copy of that table is the shape `TRIVIA` and `OPAQUE` each have a selector
 * against. A name carrying no prefix is refused rather than read as the empty
 * namespace, no selector spelling one and a refusal costing only the run that
 * is already there.
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
 * attribute stands in no namespace, which is XPath's own answer rather than the
 * refusal an unprefixed *element* name earns: a default namespace reaches an
 * element and never an attribute, so there is nothing here to guess at. A
 * wildcard is refused, no selector spelling one behind an element name and the
 * order fontoxpath yields an element's attributes in being a thing `walked`
 * answers for a document rather than for one element.
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
 * attribute to take off each of them. Two shapes carry an attribute — every
 * attribute of a document, which no element name narrows, and one named
 * attribute of named elements — and a third is refused outright: an attribute
 * spelled in a way `pointed` cannot read clears the names with it, since
 * answering the elements alone would be answering a different selector.
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
    if (attributes.length === 0) {
      names = []
    }
  }
  return {names: names, attributes: attributes}
}

/**
 * Whether the predicate filters the sequence rather than picking a position in
 * it, which is the whole of what one candidate at a time can be asked. The
 * verdict is `src/syntax.js`'s, taken off the parse and never off the text,
 * because a number wears more spellings than a digit: `[2 - 1]`, `[1.0]`, `[-
 * 1]`, `[number("2")]` and `[count(@name)]` are every bit as positional as
 * `[1]`, and a scan for a digit catches the last of them alone (#784). A
 * predicate that does not parse is refused with them, the grammar being the
 * only thing that could have said what it holds. A path is a number as much
 * as a call is, from XPath 2.0 on: `[a/count(.)]` picks the first candidate
 * where `[a/b]` filters, so what answers for a path is its last step and not
 * its kind. The version is the one a
 * selector of ours is read at: it carries no `version` of its own and
 * fontoxpath answers it at 3.1, which is the case `ASSUMED` is for.
 * @param {string} text - What one predicate holds, its brackets off
 * @return {boolean} - Whether the split may serve it
 */
const filtered = function(text) {
  const {tokens, tree} = parsed(text, ASSUMED)
  return tree !== null && filters(tokens, tree)
}

/**
 * A selector split into the axis an index can answer and the tail a predicate
 * still has to. `//(xsl:variable | xsl:template)[P]` is every element of two
 * buckets filtered by `P`; the buckets come from one walk of the document that
 * every check shares, where the selector as a whole costs fontoxpath a
 * descendant traversal of its own — 50 times what the walk costs over
 * DocBook-XSL, the descendant axis over an xmldom tree being what #635 is
 * about.
 *
 * What is refused is refused on purpose. The tail is evaluated against one
 * candidate at a time, so a predicate reading the position of the sequence it
 * came from cannot be served — `//x[1]`, `//x[1][@a]` and `//x[@a][1]` alike,
 * a number picking one node out of the sequence wherever it stands among the
 * predicates — and neither can an axis naming no single bucket —
 * a wildcard, an attribute, or a prefix this project does
 * not bind. A step standing behind the tail reaches past what the axis
 * answered. Every refusal leaves the selector exactly as it was, going whole to
 * the engine, so the cost of not recognising a shape is the run that is already
 * there and the cost of recognising one wrongly would be a report that changed.
 *
 * An **attribute** axis is refused where an anchor stands in front of it, which
 * is a refusal about the walk rather than about the shape: an anchor keeps the
 * candidates standing below it, and the walk climbs to a node's parent to
 * answer that, where an attribute has none — its element is not its parent.
 * No selector spells one, and a wrong answer here would be a report that
 * changed rather than a run that stayed as it was.
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
        },
      ]
    }
  }
  return branch
}

/**
 * Every branch of a selector split, or nothing to serve where any one of them
 * is a shape the walk cannot answer. A union is served whole or not at all: a
 * branch left to the engine would need the two answers merged in document order
 * across a sequence one side of the merge never enumerated, where refusing
 * leaves the selector exactly as it was.
 *
 * A union of **attribute** axes is refused for a reason of that kind rather
 * than of shape. Two branches are merged by the document-order rank `named`
 * remembers, and that rank covers elements: an attribute has none, so
 * `(//@version | //@xsl:version)` — the one selector spelling it — stays with
 * the engine until the walk ranks an attribute too. One branch carrying an
 * attribute needs no merge and is served as it was (#811).
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
  }
  return split
}

/**
 * The split of a selector, taken once and remembered against its text.
 * @param {string} xpath - The selector a declarative check is written in
 * @return {Array.<{names: Array.<{uri: string, local: string}>,
 *  attributes: Array.<{uri: string, local: string}>, tail: string}>} - The
 *  buckets each branch reads, the attribute they carry, and the tail, or
 *  nothing to serve
 */
const splitOf = function(xpath) {
  if (!SPLITS.has(xpath)) {
    SPLITS.set(xpath, parted(xpath))
  }
  return SPLITS.get(xpath)
}

/**
 * The nodes an axis answers, before any predicate narrows them: every attribute
 * of the document where no name stands in front of one, otherwise the elements
 * of each bucket merged by document-order rank — which is what a union needs,
 * XPath answering a path in document order where concatenating one bucket onto
 * another would answer every `xsl:variable` ahead of every `xsl:template` — and
 * then the named attribute of each, where the selector asked for one.
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
 * The candidates standing below one of the anchor's answers, which is what a
 * `//` between them means: every node the sweep found that has one of those
 * nodes above it, and never one of them itself. The walk climbs to a parent
 * rather than descending from the anchor, so an anchor that answered nothing
 * keeps nothing — the direction that matters, since the other way round would
 * report the whole sweep wherever a guard failed.
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
 * What one branch answers: the nodes its axis yields, kept to those standing
 * below the anchor it carries, and narrowed by the tail, asked of one candidate
 * at a time as `self::node()` plus what the branch spelled. The anchor is asked
 * first because the walk answers it and the engine answers the tail, which is
 * the same order the cross-file linter learned to put its two tests in.
 * @param {Document} xsl - Parsed stylesheet
 * @param {object} branch - One branch of what `splitOf` made of the selector
 * @return {Array.<Node>} - The nodes it selects, in document order
 */
const narrowed = function(xsl, branch) {
  let found = axised(xsl, branch)
  if (branch.anchor !== '') {
    found = descended(found, new Set(nodes(xsl, branch.anchor)))
  }
  if (branch.tail !== '') {
    found = found.filter(
      (node) => satisfies(node, `self::node()${branch.tail}`),
    )
  }
  return found
}

/**
 * What a union of branches answers: every branch's nodes, deduplicated and put
 * back into document order. Both halves of that are XPath's own answer rather
 * than a convenience — a union is a set, so a node standing in two branches is
 * selected once, and a path answers in document order, so the branches are
 * merged by the rank `named` remembers rather than appended one to the other.
 * Appending would report every `xsl:otherwise` after every `xsl:when`, which
 * is the same defect two buckets of one axis had before they were merged this
 * way, one union further out (#784, #811).
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
 * The nodes a selector chooses in a document. Where it opens with a descendant
 * sweep the walk can serve, the axis comes off that walk and only the predicate
 * reaches the engine, asked of one candidate at a time as `self::node()` plus
 * the tail the selector spelled; where it is any other shape the whole selector
 * goes to the engine exactly as before.
 *
 * The two answers are the same nodes in the same order, which is the whole
 * requirement: `splitOf` refuses every shape it cannot promise that for. This
 * is the one door onto that promise, and it is here rather than inside a linter
 * because both the per-file and the cross-file kind ask it — no linter may
 * import another, and a selector is what this module is about.
 *
 * The engine is asked inside the branch that needs it rather than as the
 * binding's initial value, though a value that branches is initialised to its
 * fallback everywhere else in this project: the fallback here is the very
 * traversal being avoided, so spelling it that way asked fontoxpath for every
 * served selector as well and then dropped the answer — `xpath-linter` read
 * 50.78% of its run against master's 31.64% before this was seen, the whole
 * saving spent twice over.
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
  valued,
  splitOf,
}
