/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Loads `checks/corpus/*.yaml`; cross-file rules. A cross-file check asks
 * one question of every declaration against every usage, so both sides
 * grow with the project and the work is their product; three things made
 * that product far dearer than it is. A usage selector is now evaluated
 * once for each corpus and xpath (`across`) rather than once for each
 * check naming it — three of the four checks give `//@*`, and choosing
 * every attribute of DocBook-XSL's 291 stylesheets costs 1.7 seconds, so
 * the run spent five answering one question three times over. A reference
 * string was built once for each declaration rather than once per pair,
 * and the usages holding it scanned once for each *distinct* reference,
 * DocBook-XSL declaring 3436 variables under 1207 names; and the cheap
 * test led, `within` climbing to the document root for every pair it
 * rejects where one `includes` rejects almost every pair. Together those
 * took the four checks from 35.0 to 10.2 seconds over that corpus and the
 * whole run from 40.2 to 29.8 (#755). What they left standing was the
 * product itself, the scan still being every distinct name against every
 * usage — 1207 against 72,077 attributes, 87 million substring tests, and
 * 98% of what the stage spent, `unused-variable` alone accounting for
 * 13.58 of its 13.81 seconds of scanning. The index is what retires it
 * (#783). `referencing` reads each usage value once for a template and
 * yields the names it *references*; `indexed` maps each name to the usages
 * holding it, once for a usage set and template; and a declaration is a
 * `Map.get` rather than a scan. `corpus-linter` falls from 8.52 to 2.20
 * seconds over DocBook-XSL, 6.26 to 1.21 over TEI and 1.37 to 0.56 over
 * DITA-OT, taking the staged run from 17.54 to 11.13, 14.33 to 9.34 and
 * 4.48 to 3.62, and the stage from half the run to a fifth of it. Speed is
 * the smaller half. A substring is not a reference: `includes('$row')` is
 * answered by `$rownum`, which is #776's defect on the other side of the
 * same product, so the fix and the speed-up are one edit and the report is
 * not byte-identical — four declarations that were silenced by a longer
 * name holding their characters are reported, `$page` behind `$pageid` and
 * `$target` behind `$targets` in DocBook-XSL, `$v` behind `$values` and
 * `$Heading` behind `$Heading1` in TEI, with none removed. Text is what
 * #783 read a name off, though, and text is the half that stayed wrong: it
 * found a fixed mark and took the run of characters `NAMED` in
 * `src/tokens.js` spells a name with beside it, so what stood between the
 * two was invisible. XPath lets a gap stand in front of the bracket a call
 * opens — the gap **Selector hygiene** calls part of a call, #621 being
 * the ticket where one of our own selectors spent it — so `my:spaced (1)`
 * called nothing this linter could see; a named function reference carries
 * no bracket at all, so `my:pick#1` called nothing either; and a mark
 * inside a string literal or a comment is a name no processor evaluates,
 * so `concat('$quoted', 'x')` and `1 (: $commented :)` each kept a
 * declaration alive that nothing uses. Two of those invent a defect
 * against working code and two withhold one (#498). So a reference is read
 * off the **tokens**, and one lexing answers all four: a literal, an
 * unclosed literal and a comment are one token apiece and hold no name to
 * find, a gap is `TRIVIA` and read over, and the `#` stands where the
 * bracket does. Which question is asked of a token first is part of the
 * reading: `$pick(41)` is XPath 3.1's dynamic call, a call on the
 * *variable*, so a name a `$` stands in front of is a variable however
 * tight the bracket behind it is. Asking the bracket first answered one
 * token two ways at once — the variable it uses reported dead, and a
 * function of that name marked used — so the `$` is asked before the
 * bracket, and asked of both spellings, `$my:pick(` lexing as one
 * `user_function` token where `$pick(` lexes as a name. A check names a
 * **kind** of reference rather than a template — `call` or `variable`,
 * what `REFERENCES` holds — and one this linter cannot read is refused by
 * `kinded` where the template's shape used to be, since an index built for
 * it holds no name at all and would report every declaration in the corpus
 * dead. `test/conformance.test.js` holds every check's `reference` to that
 * list, so the refusal stands in front of a check nobody has written yet.
 * The kinds cost one pass between them: `collected` builds every one of
 * them out of a single lexing of the usage set, a pass per kind lexing
 * DocBook-XSL's 72,077 attributes twice over, and a value holding none of
 * `$`, `(` or `#` is never lexed at all, most of an attribute set being no
 * expression. A value holding a brace is lexed twice, though, once whole
 * and once for each expression its braces enclose: an attribute the usage
 * selector chooses may be an XPath expression or an attribute value
 * template, and `//@*` cannot tell which. The two readings differ exactly
 * where a brace stands inside a string literal, which is where reading the
 * whole value as one expression loses a reference — DocBook-XSL's
 * `text="{$text} see '{$see}'"`, TEI's
 * `context="tei:param[parent::tei:model/@behaviour='{$B}']"` and DITA-OT's
 * `src="url('{concat($artworkPrefix, $image)}')"` each name a variable a
 * processor evaluates and the tokens of the value do not. So the names of
 * both readings are unioned, since a reading too wide withholds a report
 * where one too narrow invents one against working code (#498). What #783
 * left standing was the traversal itself, this being the one stage that
 * reached the engine directly: three of its four checks give `//@*` and
 * the fourth `//xsl:call-template/@name`, and neither is an axis a bucket
 * of elements can hold. It goes through `chosen` in
 * `src/selectors.js` since #811, which serves both of those and its three
 * element declarations besides, so the stage falls from 2.26 s to 0.11 s
 * over DocBook-XSL, 1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT —
 * a tenth to a twentieth of what it cost, taking the staged run down 25%,
 * 17% and 11% with the report byte-identical on all three. Half a run was
 * this stage over DocBook-XSL when #755 was filed and it is 1.5% to 2.3%
 * of one now, which is why its entry in `SHARES` is gone rather than re-
 * derived.
 */

const {chosen} = require('../selectors')
const {attributeOf, enclosed, staticOf} = require('../expressions')
const {expressionsOf} = require('../attributes')
const {FUNCTIONS, parseOf} = require('../syntax')
const {holding} = require('../tree')
const {XSLT} = require('../xsl-version')
const {TOKENS, TRIVIA, tokenized} = require('../tokens')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Corpus checks: the name suppressions match against, plus the
 * declaration/usage selectors and defect metadata.
 * @type {Array.<{name: string, declaration: string, usage: string,
 *  severity: string, message: string}>}
 */
const CHECKS = Object.entries(kinds.corpus).map(([name, check]) => ({
  name, ...check,
}))

/**
 * Nodes each xpath selects, per corpus, so several checks naming one selector
 * pay for it once. Weakly held, so a corpus is collected with its answers.
 * @type {WeakMap.<Array, Map.<string, Array.<Node>>>}
 */
const SELECTED = new WeakMap()

/**
 * Usages against the names they reference, by kind and per usage set, so the
 * corpus is lexed once rather than once for a declaration or for a kind.
 * @type {WeakMap.<Array, Map.<string, Map.<string, Array.<Node>>>>}
 */
const INDEXED = new WeakMap()

/**
 * The records `expressionsOf` yields for a document, by the node carrying
 * them, so a usage asks for its own expressions rather than lexing a value it
 * cannot tell an expression from (#1008).
 * @type {WeakMap.<Document, Map.<Node, Array.<object>>>}
 */
const RECORDED = new WeakMap()

/**
 * The text value templates of a corpus: every text node a record stands in,
 * which is the one kind of expression an attribute selector cannot reach.
 * @type {WeakMap.<Array, Array.<Node>>}
 */
const TEMPLATED = new WeakMap()

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = CHECKS.map((check) => check.name)

/**
 * Whether the attribute sits inside the declaration's own subtree, so a
 * function that only calls itself does not count as used.
 * @param {Node} declaration - Declaring node
 * @param {Node} attribute - Usage node, an attribute or a text node
 * @return {boolean} - True when the attribute is within the declaration
 */
const within = function(declaration, attribute) {
  let node = holding(attribute)
  while (node && node !== declaration) {
    node = node.parentNode
  }
  return node === declaration
}

/**
 * Usages against the name each one calls by exact identity, per usage set, for
 * a check reading names rather than a kind of reference: the attribute value
 * of an `xsl:call-template`, read statically where it is a shadow (#1009).
 * @type {WeakMap.<Array, Map.<string, Array.<Node>>>}
 */
const IDENTIFIED = new WeakMap()

/**
 * The usages naming each name by exact identity, built once for a usage set.
 * @param {Array.<Node>} usages - Usage attributes across the corpus
 * @return {Map.<string, Array.<Node>>} - Usages against the names they hold
 */
const identified = function(usages) {
  if (!IDENTIFIED.has(usages)) {
    const index = new Map()
    for (const usage of usages) {
      const name = staticOf(usage.value)
      if (!index.has(name)) {
        index.set(name, [])
      }
      index.get(name).push(usage)
    }
    IDENTIFIED.set(usages, index)
  }
  return IDENTIFIED.get(usages)
}

/**
 * Defects of a check matching a declaration's name against the usage values by
 * exact identity, followed through the call graph: a template only a loop of
 * its own calls never runs (#1009), while one nothing calls may be what a run
 * enters, so it is reported alone and what it calls is not. A shadow usage no
 * static reading places silences the check (#851).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply
 * @return {Array.<object>} - Defects found
 */
const byName = function(corpus, check) {
  const usages = across(corpus, check.usage)
  let defects = []
  if (!identified(usages).has('')) {
    const declarations = corpus.flatMap(({file, xsl}) =>
      chosen(xsl, check.declaration).map((node) => ({file, node})))
    const used = reachable(check, declarations, usages, new Set(declarations
      .filter(({node}) => mentioning(usages, check, node).length === 0)
      .map(({node}) => node)))
    defects = declarations
      .filter(({node}) => !used.has(node))
      .map(({file, node}) => defect(check, file, node))
  }
  return defects
}

/**
 * Whether the usage is in scope for the declaration. A `scoped` declaration —
 * a variable — is visible only within its parent's subtree, except a top-level
 * one, which an importing stylesheet in another file can also see. An unscoped
 * declaration — a function — is global, so every usage is in scope.
 * @param {object} check - The check to apply
 * @param {Node} declaration - Declaring node
 * @param {Node} usage - Usage node
 * @return {boolean} - True when the usage can see the declaration
 */
const inScope = function(check, declaration, usage) {
  return !check.scoped ||
    within(declaration.parentNode, usage) ||
    (declaration.parentNode === declaration.ownerDocument.documentElement &&
      usage.ownerDocument !== declaration.ownerDocument)
}

/**
 * The kinds of reference a check may name in its `reference`, which is what
 * `referencing` reads off the tokens: a `call` is a name a bracket or a `#`
 * stands behind, a `variable` one a `$` stands in front of.
 * @type {Array.<string>}
 */
const REFERENCES = ['call', 'variable']

/**
 * The kinds a name is lexed as, called or carried by a `$` alike — a prefixed
 * name tight against its bracket is one token of its own, and every other
 * spelling is a plain name.
 * @type {Array.<string>}
 */
const NAMES = [TOKENS.NAME, TOKENS.USER_FUNCTION]

/**
 * What may stand behind a called name: the bracket a call opens with, or the
 * `#` of the named function reference XSLT 3.0 writes instead.
 * @type {Array.<string>}
 */
const OPENS = [TOKENS.LPAREN, TOKENS.HASH]

/**
 * The characters a reference of any kind is spelled with, so a value holding
 * none of them is never lexed — most of an attribute set holds no expression.
 * @type {Array.<string>}
 */
const MARKS = ['$', '(', '#']

/**
 * The kind of reference a check names, refused here rather than obeyed where
 * this linter reads no such kind: an index built for a word no scan answers
 * holds no name at all, so every declaration in the corpus is reported dead.
 * `test/conformance.test.js` holds every check's `reference` to that list, so
 * this stands in front of a check nobody has written yet (#498).
 * @param {string} reference - What the check's `reference` names
 * @return {string} - The kind, where this linter reads one
 */
const kinded = function(reference) {
  if (!REFERENCES.includes(reference)) {
    throw new Error(
      `The reference kind "${reference}" is none of ` +
        `${REFERENCES.join(', ')}, so nothing would be read as a reference ` +
        'and every declaration would be reported as dead',
    )
  }
  return reference
}

/**
 * The records a document's expressions carry for one node, built once for the
 * document: none for an attribute holding no expression at all, such as the
 * output text of a literal result element (#1008).
 * @param {Node} node - Usage node
 * @return {Array.<object>} - Its records, as `expressionsOf` yields them
 */
const recordsOf = function(node) {
  const xsl = node.ownerDocument
  if (!RECORDED.has(xsl)) {
    const held = new Map()
    for (const found of expressionsOf(xsl)) {
      held.set(found.node, (held.get(found.node) ?? []).concat([found]))
    }
    RECORDED.set(xsl, held)
  }
  return RECORDED.get(xsl).get(node) ?? []
}

/**
 * The expressions a usage holds. A text node holds what its records say, the
 * braces of a text value template. An attribute holds its value and every
 * expression its braces enclose, since `//@*` cannot tell an expression from
 * an attribute value template and both readings are taken (#498).
 * @param {Node} usage - Usage node
 * @return {Array.<string>} - The expressions to read names off
 */
const readings = function(usage) {
  let found = recordsOf(usage).map((one) => one.expression)
  if (usage.nodeType === 2) {
    found = [usage.value]
    if (usage.value.includes('{')) {
      found = found.concat(enclosed(usage.value).map((brace) => brace.value))
    }
  }
  return found
}

/**
 * A function's name as XPath compares it, the namespace its prefix is bound
 * to at the node spelling it and the local name, so `g:twice` calls `f:twice`
 * where both prefixes name one URI. An unprefixed name is a standard one, and
 * a prefix bound nowhere stays itself rather than meeting any other (#1008).
 * @param {Node} node - The node the name is spelled at
 * @param {string} spelled - The name as written
 * @return {string} - The expanded name, `{uri}local`
 */
const expanded = function(node, spelled) {
  const colon = spelled.indexOf(':')
  let uri = FUNCTIONS
  if (colon > 0) {
    const prefix = spelled.slice(0, colon)
    uri = holding(node).lookupNamespaceURI(prefix) ?? `${prefix}:`
  }
  return `{${uri}}${spelled.slice(colon + 1)}`
}

/**
 * What stands for an arity nobody could read, where the expression holding a
 * call did not parse: such a call answers every declaration of its name.
 * @type {string}
 */
const UNREAD = 'unread'

/**
 * The spellings that make a function's parameter optional, which XSLT 4.0
 * allows and which lets one declaration answer calls of more than one arity.
 * @type {Array.<string>}
 */
const OPTIONAL = ['no', 'false', '0']

/**
 * The kinds of node a parse spells a call of a named function with: a static
 * call, and the named function reference XSLT 3.0 writes `f:x#2`.
 * @type {Array.<string>}
 */
const CALLS = ['call', 'reference']

/**
 * The significant tokens a node of a parse spans.
 * @param {{tokens: Array}} parse - What a parse answered
 * @param {object} node - A node of its tree
 * @return {Array.<object>} - The tokens, trivia left out
 */
const spelledOf = function(parse, node) {
  return parse.tokens.slice(node.from, node.to)
    .filter(({type}) => !TRIVIA.includes(type))
}

/**
 * The expanded name a run of tokens opens with, braced or prefixed.
 * @param {object} found - The record the tokens are read from
 * @param {Array.<object>} spelled - The significant tokens
 * @return {string} - The expanded name, `{uri}local`
 */
const nameOf = function(found, spelled) {
  let name = expanded(found.node, spelled[0].value)
  if (spelled[0].type === TOKENS.URI) {
    name = `{${spelled[0].value.slice(2, -1)}}${spelled[1].value}`
  }
  return name
}

/**
 * Whether an arrow applies a function named in the stylesheet, rather than
 * one a variable holds or an expression in brackets yields: the token behind
 * the arrow is then the name itself and no `$`.
 * @param {{tokens: Array}} parse - What a parse answered
 * @param {object} arrow - An arrow node of its tree
 * @return {boolean} - True when a static name stands on its right
 */
const statically = function(parse, arrow) {
  const behind = spelledOf(parse, arrow.children[0]).length + 1
  return arrow.children[1].kind === 'name' &&
    spelledOf(parse, arrow)[behind].type !== TOKENS.DOLLAR
}

/**
 * The calls one parsed record makes, each keyed by its expanded name and its
 * arity: a static call counts the arguments the parse separated, so a binding
 * clause's commas are no separators, a named reference `f:x#2` names its
 * arity outright, and an arrow counts what stands on its left as one (#1008).
 * @param {object} found - The record
 * @param {{tokens: Array, tree: object}} parse - What its parse answered
 * @return {Array.<string>} - Its calls, as `{uri}local#arity`
 */
const called = function(found, parse) {
  const calls = []
  /**
   * Key this node when it calls a function, then the nodes below it.
   * @param {object} node - A node of the tree
   */
  const visit = function(node) {
    if (CALLS.includes(node.kind)) {
      const spelled = spelledOf(parse, node)
      let arity = node.children.length
      if (node.kind === 'reference') {
        arity = Number(spelled[spelled.length - 1].value)
      }
      calls.push(`${nameOf(found, spelled)}#${arity}`)
    } else if (node.kind === 'arrow' && statically(parse, node)) {
      calls.push(`${nameOf(found, spelledOf(parse, node.children[1]))}` +
        `#${node.children.length - 1}`)
    }
    node.children.forEach(visit)
  }
  visit(parse.tree)
  return calls
}

/**
 * Whether a record may call a stylesheet function at all. XSLT refuses an
 * unprefixed name on an `xsl:function` (XTSE0740), so a call reaching one is
 * prefixed or braced, and an expression holding no colon is never walked.
 * @param {object} found - The record
 * @return {boolean} - True when a prefixed or braced name may stand in it
 */
const prefixed = function(found) {
  return found.expression.includes(':')
}

/**
 * Every name a usage references, by the kind of reference it is: a name a `$`
 * stands in front of is a variable, one a bracket or a `#` stands behind is a
 * call, and the `$` is asked first. Read off the tokens and never off the
 * text, so a name inside a string literal or a comment is none (#498). A call
 * is keyed by name and arity, off the parse wherever a record parsed (#1008).
 * @param {Node} usage - Usage node
 * @return {Map.<string, Set.<string>>} - The names it references, by kind
 */
const referencing = function(usage) {
  const names = new Map(REFERENCES.map((kind) => [kind, new Set()]))
  const records = recordsOf(usage)
  const read = readings(usage)
  let unparsed = read
  if (records.length > 0) {
    unparsed = []
    for (const found of records.filter(prefixed)) {
      const parse = parseOf(found)
      if (parse.fault === '') {
        called(found, parse).forEach((call) => names.get('call').add(call))
      } else {
        unparsed.push(found.expression)
      }
    }
  }
  for (const reading of read) {
    const tokens = tokenized(reading)
      .filter(({type}) => !TRIVIA.includes(type))
    tokens.forEach((token, at) => {
      if (NAMES.includes(token.type) && at > 0 &&
        tokens[at - 1].type === TOKENS.DOLLAR) {
        names.get('variable').add(token.value)
      } else if (NAMES.includes(token.type) && at + 1 < tokens.length &&
        OPENS.includes(tokens[at + 1].type) && unparsed.includes(reading)) {
        let name = expanded(usage, token.value)
        if (at > 0 && tokens[at - 1].type === TOKENS.URI) {
          name = `{${tokens[at - 1].value.slice(2, -1)}}${token.value}`
        }
        names.get('call').add(`${name}#${UNREAD}`)
      }
    })
  }
  return names
}

/**
 * Every kind's index out of one lexing of the usage set, the memo below being
 * per usage set: a pass for each kind would lex DocBook-XSL's 72,077
 * attributes twice over, and a value holding none of the characters a
 * reference is spelled with is never lexed at all (#498).
 * @param {Array.<Node>} usages - Usage nodes across the corpus
 * @return {Map.<string, Map.<string, Array.<Node>>>} - Usages by kind and name
 */
const collected = function(usages) {
  const index = new Map(REFERENCES.map((kind) => [kind, new Map()]))
  for (const usage of usages) {
    if (MARKS.some((mark) => usage.nodeValue.includes(mark))) {
      for (const [kind, mentioned] of referencing(usage)) {
        const held = index.get(kind)
        for (const name of mentioned) {
          if (!held.has(name)) {
            held.set(name, [])
          }
          held.get(name).push(usage)
        }
      }
    }
  }
  return index
}

/**
 * The usages referencing each name, by kind, built once for a usage set. A
 * declaration then costs a lookup rather than a scan of every usage: the scan
 * asked its question once per distinct name, which over DocBook-XSL is
 * `unused-variable` alone taking 1207 names against 72,077 attributes — 87
 * million substring tests, and 98% of what this stage spent scanning (#783).
 * @param {Array.<Node>} usages - Usage nodes across the corpus
 * @param {string} kind - Which kind of reference to look a name up under
 * @return {Map.<string, Array.<Node>>} - Usages against the names they hold
 */
const indexed = function(usages, kind) {
  if (!INDEXED.has(usages)) {
    INDEXED.set(usages, collected(usages))
  }
  return INDEXED.get(usages).get(kind)
}

/**
 * Nodes an xpath selects across the whole corpus, chosen once for each corpus
 * and xpath rather than once for each check that names it. Three of the four
 * cross-file checks give `//@*` as their usage, and choosing every attribute of
 * DocBook-XSL's 291 stylesheets costs 1.7 seconds, so asking per check spent
 * five of them answering one question three times over (#755).
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {string} xpath - The selector to apply
 * @return {Array.<Node>} - The nodes it selects
 */
const across = function(corpus, xpath) {
  if (!SELECTED.has(corpus)) {
    SELECTED.set(corpus, new Map())
  }
  const remembered = SELECTED.get(corpus)
  if (!remembered.has(xpath)) {
    remembered.set(xpath, corpus.flatMap(({xsl}) => chosen(xsl, xpath)))
  }
  return remembered.get(xpath)
}

/**
 * The usages a reference check reads: the attributes its selector chooses, and
 * every text value template of the corpus — a 3.0 text node under an on
 * `expand-text` holds expressions as surely as a `select` does, and `//@*`
 * reaches none of them (#1008). Built once for a corpus and selector.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `usage` selector
 * @return {Array.<Node>} - The usage nodes
 */
const usagesOf = function(corpus, check) {
  if (!TEMPLATED.has(corpus)) {
    TEMPLATED.set(corpus, new Map())
  }
  const remembered = TEMPLATED.get(corpus)
  if (!remembered.has(check.usage)) {
    remembered.set(check.usage, across(corpus, check.usage).concat(
      corpus.flatMap(({xsl}) => [...new Set(expressionsOf(xsl)
        .map((found) => found.node)
        .filter((node) => node.nodeType !== 2))]),
    ))
  }
  return remembered.get(check.usage)
}

/**
 * The names a declaration answers to in the index. A variable answers to its
 * name. A function answers to its expanded name at every arity its parameters
 * allow, one XSLT 4.0 marks optional lowering the floor, and to a call whose
 * arity went unread (#1008).
 * @param {object} check - The check to apply, carrying a `reference` kind
 * @param {Node} declaration - Declaring node
 * @return {Array.<string>} - The keys to look it up under
 */
const keysOf = function(check, declaration) {
  let keys = [declaration.getAttribute('name')]
  if (kinded(check.reference) === 'call') {
    const name = expanded(declaration, declaration.getAttribute('name'))
    const params = Array.from(declaration.childNodes).filter((node) =>
      node.namespaceURI === XSLT && node.localName === 'param')
    const required = params.filter((node) =>
      !OPTIONAL.includes(attributeOf(node, 'required').trim()))
    keys = [UNREAD, required.length]
      .concat(params.slice(required.length)
        .map((node, at) => required.length + at + 1))
      .map((arity) => `${name}#${arity}`)
  }
  return keys
}

/**
 * The usages referencing a declaration, looked up rather than scanned for.
 * Asking it is still how a caller asks the cheap question first: `within`
 * climbs to the document root for every pair it rejects, and almost every pair
 * is rejected, so a structural test placed ahead of this one spent a full
 * ancestor walk to learn what the index already says (#755).
 * @param {Array.<Node>} usages - Usage nodes across the corpus
 * @param {object} check - The check to apply, with or without a `reference`
 * @param {Node} declaration - Declaring node
 * @return {Array.<Node>} - The usages referencing it
 */
const mentioning = function(usages, check, declaration) {
  let found
  if (check.reference === undefined) {
    found = identified(usages).get(declaration.getAttribute('name')) ?? []
  } else {
    const index = indexed(usages, kinded(check.reference))
    found = [...new Set(keysOf(check, declaration)
      .flatMap((key) => index.get(key) ?? []))]
  }
  return found
}

/**
 * The innermost declaration whose subtree holds the usage, or null when the
 * usage sits outside every declaration — a call from a template is such a
 * root, a call from another function's body is not.
 * @param {Set.<Node>} declarations - The declaring nodes
 * @param {Node} usage - Usage node
 * @return {?Node} - Enclosing declaration, or null
 */
const enclosing = function(declarations, usage) {
  let node = holding(usage)
  while (node && !declarations.has(node)) {
    node = node.parentNode
  }
  return node
}

/**
 * The declarations reached from a root — a reference outside every
 * declaration's body, or inside one of the `entered` — by following the call
 * graph: a declaration is used when an in-scope reference to it sits in a root
 * or in another declaration itself used, so a cycle nothing enters reaches
 * nothing.
 * @param {object} check - The check to apply, with or without a `reference`
 * @param {Array.<{file: string, node: Node}>} declarations - Declaring nodes
 * @param {Array.<Node>} usages - Usage nodes across the corpus
 * @param {Set.<Node>} entered - Declarations whose calls count as roots
 * @return {Set.<Node>} - The used declarations
 */
const reachable = function(check, declarations, usages, entered) {
  const subtrees = new Set(declarations.map(({node}) => node))
  const references = declarations.map(({node}) => ({
    node,
    hosts: mentioning(usages, check, node)
      .filter((usage) =>
        !within(node, usage) && inScope(check, node, usage))
      .map((usage) => enclosing(subtrees, usage)),
  }))
  const used = new Set()
  let growing = true
  while (growing) {
    growing = false
    references
      .filter((reference) => !used.has(reference.node))
      .filter((reference) =>
        reference.hosts.some((host) =>
          host === null || entered.has(host) || used.has(host)))
      .forEach((reference) => {
        used.add(reference.node)
        growing = true
      })
  }
  return used
}

/**
 * Defects of a check that flags a declaration whose reference string appears
 * in no usage value anywhere in the corpus — a stylesheet function nothing
 * calls (`name(`), counting its own body too, so a function that only calls
 * itself is referenced and left to the reachability check instead.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byCall = function(corpus, check) {
  const usages = usagesOf(corpus, check)
  return corpus.flatMap(({file, xsl}) => chosen(xsl, check.declaration)
    .filter((node) => mentioning(usages, check, node).length === 0)
    .map((node) => defect(check, file, node)))
}

/**
 * Defects of a scoped check that flags a declaration referenced by no in-scope
 * usage — a variable read by `$name` from nowhere its scope reaches. Its own
 * subtree is excluded, so a self-reference is not use.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byScope = function(corpus, check) {
  const usages = usagesOf(corpus, check)
  return corpus.flatMap(({file, xsl}) => chosen(xsl, check.declaration)
    .filter((node) => !mentioning(usages, check, node).some((usage) =>
      !within(node, usage) && inScope(check, node, usage)))
    .map((node) => defect(check, file, node)))
}

/**
 * Defects of a reachability check that flags a declaration referenced
 * somewhere yet reached by no call from outside a function body — a function
 * called only from functions that are themselves never reached, so it never
 * runs. A function nothing references at all is left to the by-call check,
 * not double-reported here.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply, carrying a `reference` template
 * @return {Array.<object>} - Defects found
 */
const byReachability = function(corpus, check) {
  const usages = usagesOf(corpus, check)
  const declarations = corpus.flatMap(({file, xsl}) =>
    chosen(xsl, check.declaration).map((node) => ({file, node})))
  const used = reachable(check, declarations, usages, new Set())
  return declarations
    .filter(({node}) => !used.has(node))
    .filter(({node}) => mentioning(usages, check, node).length > 0)
    .map(({file, node}) => defect(check, file, node))
}

/**
 * Defects of one check, dispatched by how it defines use: a named template by
 * the exact identity of a called name, a function by whether it is called at
 * all, a function unreachable when called only from functions never reached,
 * and a variable by an in-scope reference.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {object} check - The check to apply
 * @return {Array.<object>} - Defects found
 */
const defectsOf = function(corpus, check) {
  let strategy = byCall
  if (!check.reference) {
    strategy = byName
  } else if (check.reachable) {
    strategy = byReachability
  } else if (check.scoped) {
    strategy = byScope
  }
  return strategy(corpus, check)
}

/**
 * A defect for the declaring node.
 * @param {object} check - The check that fired
 * @param {string} file - File the node belongs to
 * @param {Node} node - Declaring node
 * @return {object} - Defect
 */
const defect = function(check, file, node) {
  return {
    name: check.name,
    severity: check.severity,
    message: check.message,
    file: file,
    line: node.lineNumber,
    pos: node.columnNumber,
  }
}

/**
 * Lint the whole corpus of stylesheets by cross-file checks. A declaration is
 * a defect only when it is used by no stylesheet in the corpus — matched by
 * name for a named template, by call for a function, by reachability for a
 * function called only from dead callers, or by in-scope reference for a
 * variable — so one defined in one file but used from another is not flagged.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByCorpus = function(corpus, suppressions = []) {
  logger.debug(`Corpus linting started`)
  const defects = CHECKS
    .filter((check) => !suppressions.some((sup) => check.name.includes(sup)))
    .flatMap((check) => defectsOf(corpus, check))
  logger.debug(`Found ${defects.length} corpus defects`)
  return defects
}

module.exports = {
  REFERENCES,
  kinded,
  lintByCorpus,
  names,
}
