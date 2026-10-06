/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `xmlFromString` reads a document the way a processor does where
 * `@xmldom/xmldom` will not. That parser resolves no entity, so `expand` puts
 * each one's replacement where the reference stands, parsed as the markup it
 * spells in the namespaces in scope there (#984); a reference no declaration
 * was reached for is dropped rather than reported as its own name. Nothing an
 * entity brought is written in the file, so `unwritten` places its defect at
 * the reference and withholds every fix on it (#1010). Well-formedness is
 * `forbidden`'s question rather than the parser's: xmldom repairs an unquoted
 * attribute (#574), misreads a dotted entity name (#877), and accepts a stray
 * `&` or `]]>` in silence (#691).
 */

const fs = require('fs')
const path = require('path')
const {DOMParser} = require('@xmldom/xmldom')
const {GAP, WHITESPACE} = require('./tokens')
const {staticOf} = require('./expressions')
const {NAMED, parted, offsetAt, placeAt} = require('./source')
const {delimited, escaped} = require('./fixes')

/**
 * A reference to a general entity, `&name;`, as it survives in a parsed value.
 * @type {RegExp}
 */
const REFERENCE = /&([A-Za-z_][\w.-]*);/g

/**
 * The names of the general entities a text references.
 * @param {string} text - Replacement text, or any value spelling references
 * @return {Array.<string>} - Every name referenced, in order
 */
const referenced = function(text) {
  return Array.from(text.matchAll(REFERENCE), (match) => match[1])
}

/**
 * Whether a declared entity reaches itself through the replacement texts of
 * the entities it names, which XML forbids and no expansion ever finishes.
 * @param {string} name - Declared entity name
 * @param {Map.<string, string>} entities - Declared entity values
 * @return {boolean} - True when a chain of its references comes back to it
 */
const circular = function(name, entities) {
  const seen = new Set()
  let pending = referenced(entities.get(name))
  while (pending.length > 0 && !seen.has(name)) {
    const next = pending.pop()
    if (entities.has(next) && !seen.has(next)) {
      seen.add(next)
      pending = pending.concat(referenced(entities.get(next)))
    }
  }
  return seen.has(name)
}

/**
 * The most characters a resolved entity value may hold. DocBook-XSL's largest
 * is `lowercase` at 3720, and TEI and DITA-OT declare none, so this stands
 * some seventeen times above any value the corpora hold, while ten entities
 * each naming the one before ten times stop here and not at 10^9 (#1044).
 * @type {number}
 */
const CEILING = 65536

/**
 * The most characters the entities of one document may add to it. DocBook's
 * `fo/autoidx.xsl` gains 189,859 from 270 references, the most any stylesheet
 * of the corpora gains, so this stands five times above it, while two thousand
 * references each resolving near `CEILING` stop here rather than at 10^8
 * (#1044).
 * @type {number}
 */
const DOCUMENT = 2 ** 20

/**
 * What one declared entity resolves to, each reference to another declared
 * entity replaced by that one's resolution, remembered in `done`. A reference
 * to a name in `cyclic` stays standing, so the walk never comes back round,
 * and a name whose resolution would pass `CEILING` resolves to its own
 * reference, measured before a character of it is joined.
 * @param {string} name - Declared entity name
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} cyclic - Names reaching themselves
 * @param {Map.<string, string>} done - Resolutions already taken
 * @return {string} - Its replacement text with nothing left to expand
 */
const resolution = function(name, entities, cyclic, done) {
  if (!done.has(name)) {
    const pieces = entities.get(name).split(REFERENCE).map((piece, index) => {
      let text = piece
      if (index % 2 === 1) {
        text = `&${piece};`
      }
      if (index % 2 === 1 && entities.has(piece) && !cyclic.has(piece)) {
        text = resolution(piece, entities, cyclic, done)
      }
      return text
    })
    let text = `&${name};`
    if (pieces.reduce((sum, piece) => sum + piece.length, 0) <= CEILING) {
      text = pieces.join('')
    }
    done.set(name, text)
  }
  return done.get(name)
}

/**
 * The declared values with every reference to another declared entity
 * replaced by what that one resolves to, until nothing is left to expand, the
 * way XML reads a replacement text again (#1044). A name reaching itself is
 * unresolved: its references stay standing, so the rest form no cycle.
 * @param {Map.<string, string>} entities - Declared entity values
 * @return {Map.<string, string>} - The same names, their values resolved
 */
const resolved = function(entities) {
  const cyclic = new Set(
    [...entities.keys()].filter((name) => circular(name, entities)))
  const done = new Map()
  return new Map([...entities.keys()].map(
    (name) => [name, resolution(name, entities, cyclic, done)]))
}

/**
 * The general entities the given source declares in its internal DTD subset,
 * mapped to their replacement text, resolved. `@xmldom/xmldom` never expands
 * them, so a reference stays literal in the parsed value. XML binds the first
 * of two declarations of a name, so a later one — inline behind a subset a
 * parameter entity brought, most often — is ignored rather than winning.
 * @param {string} str - XML source
 * @return {Map.<string, string>} - Declared entity names to their values
 */
const declaredEntities = function(str) {
  const entities = new Map()
  for (const match of str.matchAll(
    new RegExp(
      [
        `<!ENTITY${GAP}+([A-Za-z_][\\w.-]*)${GAP}+`,
        `(?:"([^"]*)"|'([^']*)')`,
      ].join(''), 'g'))) {
    if (!entities.has(match[1])) {
      entities.set(match[1], match[2] ?? match[3])
    }
  }
  return resolved(entities)
}

/**
 * A parameter entity declared external, `<!ENTITY % name SYSTEM "file">` or
 * its `PUBLIC` spelling, capturing the name and the system literal.
 * @type {RegExp}
 */
const PARAMETER = new RegExp(
  [
    `<!ENTITY${GAP}+%${GAP}+([A-Za-z_][\\w.-]*)${GAP}+`,
    `(?:SYSTEM|PUBLIC${GAP}+(?:"[^"]*"|'[^']*'))${GAP}+`,
    `(?:"([^"]*)"|'([^']*)')`,
  ].join(''), 'g')

/**
 * The external parameter entities the source declares, by name, each mapped
 * to the system literal naming the file its declarations stand in.
 * @param {string} str - XML source
 * @return {Map.<string, string>} - Parameter entity names to system literals
 */
const parametersOf = function(str) {
  return new Map([...str.matchAll(PARAMETER)]
    .map((match) => [match[1], match[2] ?? match[3]]))
}

/**
 * The files the external parameter entities of a stylesheet name, read
 * relative to it wherever one is there to read, by the system literal naming
 * each. DocBook-XSL takes the entities of its index stylesheets from a
 * `../common/entities.ent`, which a processor reads and the parser does not,
 * so 211 of its expressions reached no check at all (#1010).
 * @param {string} file - Path of the stylesheet
 * @param {string} str - XML source
 * @return {Map.<string, string>} - System literals to the text they name
 */
const subsetsOf = function(file, str) {
  return new Map(
    [...parametersOf(str).values()]
      .map((literal) => [literal, path.resolve(path.dirname(file), literal)])
      .filter(([, whole]) => fs.existsSync(whole) &&
        fs.statSync(whole).isFile())
      .map(([literal, whole]) => [literal, fs.readFileSync(whole, 'utf-8')]),
  )
}

/**
 * An `href` or `_href` attribute, capturing the underscore a shadow carries
 * and the value either quote holds.
 * @type {RegExp}
 */
const HREF = new RegExp(
  [
    `(?<![\\w:.-])(_?)href${GAP}*=${GAP}*`,
    `(?:"([^"]*)"|'([^']*)')`,
  ].join(''), 'g')

/**
 * An href this run can resolve alone: no scheme, no leading slash, and none
 * of the characters a URI escapes or a catalog or processor reads its own way.
 * @type {RegExp}
 */
const RELATIVE = new RegExp(
  `^(?![A-Za-z][A-Za-z0-9+.-]*:)[^/?#%\\\\${WHITESPACE}][^?#%\\\\${WHITESPACE}]*$`,
)

/**
 * The relative hrefs a stylesheet writes that no file stands behind, read
 * relative to it, by the value as written, or the literal a shadow quotes. A
 * URL, an absolute path and a `plugin:` URI are a catalog's to resolve and
 * never named here, and a value spelled otherwise than it parses matches no
 * href a check reads (#209).
 * @param {string} file - Path of the stylesheet
 * @param {string} str - XML source
 * @return {Set.<string>} - The hrefs naming no file
 */
const absentOf = function(file, str) {
  return new Set(
    [...str.matchAll(HREF)]
      .map((match) => {
        let href = match[2] ?? match[3]
        if (match[1]) {
          href = staticOf(href)
        }
        return href
      })
      .filter((href) => RELATIVE.test(href))
      .filter((href) => {
        const whole = path.resolve(path.dirname(file), href)
        return !fs.existsSync(whole) || !fs.statSync(whole).isFile()
      }),
  )
}

/**
 * The source with every reference to an external parameter entity replaced by
 * the declarations the file it names holds, where that file was read, so the
 * entities it declares are the document's as much as the inline ones are.
 * @param {string} str - XML source
 * @param {Map.<string, string>} subsets - System literals to the text they name
 * @return {string} - The source, its parameter entities read in
 */
const inlined = function(str, subsets) {
  const parameters = parametersOf(str)
  return str.replace(/%([A-Za-z_][\w.-]*);/g,
    (whole, name) => subsets.get(parameters.get(name)) ?? whole)
}

/**
 * Whether the source reaches for an external DTD — a `SYSTEM` or `PUBLIC`
 * identifier, or a parameter entity — whose entity declarations we never read.
 * When it does, an unresolved entity is not evidence of a malformed document:
 * the entity may well be declared in the DTD we did not load.
 * @param {string} str - XML source
 * @return {boolean} - True when an external subset is in play
 */
const external = function(str) {
  return new RegExp(`<!ENTITY${GAP}+%`).test(str) ||
    /<!DOCTYPE[^>[]*\b(?:SYSTEM|PUBLIC)\b/.test(str)
}

/**
 * Every complaint `@xmldom/xmldom` raises about an entity reference, none of
 * which it repairs. Its pre-scan reads a name as `\w+`, narrower than XML's
 * `Name`, so a well declared `&sc.name;` earns the second of these — and it
 * resolves no entity for us either way, so whether a reference is legal is
 * `forbidden`'s question rather than its (#877).
 * @type {Array.<string>}
 */
const ENTITIES = [
  'entity not found:',
  'EntityRef: expecting ;',
  'entity not matching Reference production:',
]

/**
 * The refusal `@xmldom/xmldom` raises for a prefix no declaration in scope
 * binds, `xmlns` on an element among them. Its other namespace refusals are
 * a declaration binding a reserved prefix wrongly, which declaring more
 * cannot repair, so they stay syntax faults (#1019).
 * @type {string}
 */
const UNBOUND = 'NamespaceError: prefix is non-null and namespace is null'

/**
 * What a document nothing is wrong with earns: no reason at all.
 * @type {{reason: string, line: number, pos: number, namespace: boolean}}
 */
const SOUND = {reason: '', line: 1, pos: 1, namespace: false}

/**
 * A refusal of a document, carrying where it stands and whether the fault is a
 * prefix nothing binds rather than a syntax error, so a report names the place
 * and the remedy the parser saw rather than the opening of the file (#1019).
 * @param {object} fault - Why the document is refused, where, and whether the
 *  fault is a namespace one
 * @return {Error} - The refusal to throw
 */
const refusal = function(fault) {
  return Object.assign(new Error(fault.reason), fault)
}

/**
 * Where the parser stands when it complains. `@xmldom/xmldom` counts a
 * document holding no element as line zero with no column, and a report
 * stands on a line and column that exist.
 * @param {{lineNumber: number, columnNumber: number}} locator - Parser position
 * @return {{line: number, pos: number}} - Where the complaint stands
 */
const located = function(locator) {
  return {line: locator.lineNumber || 1, pos: locator.columnNumber || 1}
}

/**
 * The document XML text spells, refusing it on any complaint the parser makes,
 * the recoverable ones included and the level not consulted (#574), an entity
 * complaint excepted as `ENTITIES` says. The parser rethrows what its handler
 * raises as a message of its own, so the first complaint is kept aside and
 * thrown once the parse gives up, where it stood (#1019).
 * @param {string} text - XML as string
 * @param {function(object): {line: number, pos: number}} where - Where a
 *  complaint stands, given the parser's locator
 * @return {Document} - Parsed XML as Document
 */
const documentOf = function(text, where = located) {
  let fault = SOUND
  let doc
  try {
    doc = new DOMParser({
      onError: (level, message, context) => {
        const reason = message.trim()
        if (!ENTITIES.some((one) => reason.startsWith(one))) {
          fault = {
            reason: reason, ...where(context.locator),
            namespace: reason.includes(UNBOUND),
          }
          throw new Error(reason)
        }
      },
    }).parseFromString(text, 'text/xml')
  } catch {
    throw refusal(fault)
  }
  return doc
}

/**
 * The entity names the source spells as a reference of its own, XML's five
 * predefined ones aside. A `&name;` nobody declared and the `&amp;name;` that
 * is literal text reach a parsed value as the same characters, so what tells
 * them apart is whether the source spells that name bare anywhere (#984).
 * @param {string} str - XML source
 * @return {Set.<string>} - Names a reference in the source spells
 */
const spelled = function(str) {
  return new Set(
    [...str.matchAll(REFERENCE)]
      .map((match) => match[1])
      .filter((name) => !Object.hasOwn(NAMED, name)),
  )
}

/**
 * An attribute declaring a namespace, in either spelling XML gives it.
 * @type {RegExp}
 */
const BINDS = /^xmlns(?::|$)/

/**
 * The element an entity's replacement text is read inside, whose name may
 * stand nowhere in what comes out of it.
 * @type {string}
 */
const HOST = 'xslint'

/**
 * The namespace declarations in force at a node, spelled as the attributes an
 * element carries. An entity's replacement text names its prefixes as the
 * point referencing it binds them, so markup read without those is markup in
 * the wrong namespace or in none.
 * @param {Node} node - Node the replacement text stands at
 * @return {string} - Declarations, each ready to follow an element name
 */
const scoped = function(node) {
  const seen = new Map()
  for (let up = node; up; up = up.parentNode) {
    for (let at = 0; up.attributes && at < up.attributes.length; at++) {
      const one = up.attributes.item(at)
      if (BINDS.test(one.name) && !seen.has(one.name)) {
        seen.set(one.name, one.value)
      }
    }
  }
  return [...seen]
    .map(([name, value]) => ` ${name}="${delimited(value, '"')}"`)
    .join('')
}

/**
 * Whether a value may grow by so many characters, neither passing `CEILING`
 * itself nor taking the document past what it may still gain. A reference
 * whose replacement would pass either stays standing, the way one whose
 * resolution passes `CEILING` does, so the bound stands where the text is
 * built rather than on each resolution alone (#1044).
 * @param {number} growth - Characters the value would gain
 * @param {number} left - Characters the document may still gain
 * @return {boolean} - True when neither bound is passed
 */
const affordable = function(growth, left) {
  return growth <= Math.min(CEILING, left)
}

/**
 * The text a node holds as a parser must read it: a declared entity stands for
 * its replacement text, which is markup where it spells one, a reference this
 * run reached no declaration for stands for the content nobody read, and every
 * character around them is escaped rather than parsed a second time.
 * @param {string} value - The node's parsed value
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} bare - Names the source spells as a reference
 * @param {number} left - Characters the document may still gain
 * @return {{text: string, grown: number}} - The value as markup, and what the
 *   replacements added to it
 */
const markup = function(value, entities, bare, left) {
  let built = ''
  let at = 0
  let grown = 0
  for (const match of value.matchAll(REFERENCE)) {
    built += escaped(value.slice(at, match.index))
    const growth = (entities.get(match[1]) ?? '').length - match[0].length
    if (entities.has(match[1]) && affordable(grown + growth, left)) {
      built += entities.get(match[1])
      grown += growth
    } else if (entities.has(match[1]) || !bare.has(match[1])) {
      built += escaped(match[0])
    }
    at = match.index + match[0].length
  }
  return {text: `${built}${escaped(value.slice(at))}`, grown: grown}
}

/**
 * Every node an entity reference brought, which is every node standing
 * nowhere in the file that holds it: the reference is what the source spells
 * there, so a walk over the raw text answers about the reference and a fix
 * written at that place would put the replacement where the `&` stands (#984).
 * @type {WeakSet.<Node>}
 */
const BROUGHT = new WeakSet()

/**
 * Every attribute an entity wrote part of the value of, mapped to the spans of
 * that value each replacement text fills, as an offset and a width. The rest
 * of the value is what the source spells, so an offset outside every span
 * still has a place in the file, where one inside a span has only the `&`.
 * @type {WeakMap.<Node, Array.<Array.<number>>>}
 */
const WRITTEN = new WeakMap()

/**
 * Whether an entity brought the node whole, so that no line of its file spells
 * any of it and its place is where the reference stands.
 * @param {Node} node - Node to weigh
 * @return {boolean} - True when an entity's markup made it
 */
const brought = function(node) {
  return BROUGHT.has(node)
}

/**
 * Whether a node is one no line of its file spells whole, an entity having
 * brought it or written part of its value, or an element carrying such an
 * attribute. A fix computed from its value would be written where the source
 * spells a reference, so none is offered on it.
 * @param {Node} node - Node to weigh
 * @return {boolean} - True when an entity brought it or wrote into it
 */
const unwritten = function(node) {
  return brought(node) || WRITTEN.has(node) ||
    Array.from(node.attributes ?? []).some((one) => WRITTEN.has(one))
}

/**
 * The offset into a node's value, counted the way the source spells it: each
 * reference an entity replaced is one character there, however wide its
 * replacement, and an offset inside a replacement stands at its `&` (#1010).
 * @param {Node} node - Node whose value the offset is into
 * @param {number} offset - Offset into the parsed value
 * @return {number} - Decoded characters the source spells before that point
 */
const spelledAt = function(node, offset) {
  let at = offset
  for (const [from, width] of WRITTEN.get(node) ?? []) {
    if (from < offset) {
      at -= Math.min(width - 1, offset - from)
    }
  }
  return at
}

/**
 * The node, and everything under it, standing where the reference stood. An
 * entity's markup has one place in the file whatever it spells, so the nodes
 * it makes answer for that place rather than for an offset into a replacement
 * text no line of the document holds.
 * @param {Node} node - Node to place
 * @param {Node} at - Node whose place it takes
 * @return {Node} - The same node, placed
 */
const placed = function(node, at) {
  BROUGHT.add(node)
  node.lineNumber = at.lineNumber
  node.columnNumber = at.columnNumber
  for (let index = 0; node.attributes && index < node.attributes.length;
    index++) {
    placed(node.attributes.item(index), at)
  }
  for (let kid = node.firstChild; kid; kid = kid.nextSibling) {
    placed(kid, at)
  }
  return node
}

/**
 * The nodes a text node's markup spells, adopted into the document standing
 * around it. Reading them is a parse of its own, so a replacement text that is
 * not well-formed content faults here as it would have faulted in place.
 * @param {string} text - The value as markup
 * @param {Node} at - Text node the markup stands at
 * @return {Array.<Node>} - What stands there once it is read
 */
const grafted = function(text, at) {
  const nodes = []
  const doc = documentOf(
    `<${HOST}${scoped(at)}>${text}</${HOST}>`,
    () => ({line: at.lineNumber, pos: at.columnNumber}),
  )
  for (let kid = doc.documentElement.firstChild; kid; kid = kid.nextSibling) {
    nodes.push(placed(at.ownerDocument.importNode(kid, true), at))
  }
  return nodes
}

/**
 * Put what a text node's references stand for where the text node stands. A
 * replacement text of characters alone leaves one text node, which keeps its
 * own place rather than being swapped for an equal; anything else is markup,
 * and a node reading as nothing at all leaves no text behind to be reported as
 * loose.
 * @param {Node} text - Text node holding at least one reference
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} bare - Names the source spells as a reference
 * @param {number} left - Characters the document may still gain
 * @return {number} - Characters the document may gain after it
 */
const standing = function(text, entities, bare, left) {
  const {text: built, grown} = markup(text.nodeValue, entities, bare, left)
  const nodes = grafted(built, text)
  if (nodes.length === 1 && nodes[0].nodeType === 3) {
    text.nodeValue = nodes[0].nodeValue
  } else {
    for (const node of nodes) {
      text.parentNode.insertBefore(node, text)
    }
    text.parentNode.removeChild(text)
  }
  return left - grown
}

/**
 * Replace every reference to a declared entity in the subtree with what it
 * stands for, in place. `@xmldom/xmldom` leaves the reference literal, so an
 * expression or text that uses one would otherwise read `&lowercase;` rather
 * than its replacement, and what an entity brings takes the place of the
 * reference that brought it, unless `affordable` leaves it standing.
 * @param {Node} node - Node whose subtree to repair
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} bare - Names the source spells as a reference
 * @param {number} left - Characters the document may still gain
 * @return {number} - Characters the document may gain after this subtree
 */
const expand = function(node, entities, bare, left) {
  let rest = left
  if (node.nodeType === 2 && node.nodeValue.includes('&')) {
    const spans = []
    let grown = 0
    const value = node.nodeValue.replace(REFERENCE, (whole, name, index) => {
      let text = whole
      const growth = (entities.get(name) ?? whole).length - whole.length
      if (entities.has(name) && affordable(grown + growth, rest)) {
        text = entities.get(name)
        spans.push([index + grown, text.length])
        grown += growth
      }
      return text
    })
    if (spans.length > 0) {
      WRITTEN.set(node, spans)
    }
    node.nodeValue = value
    node.value = value
    rest -= grown
  }
  if (node.attributes) {
    for (let index = 0; index < node.attributes.length; index++) {
      rest = expand(node.attributes.item(index), entities, bare, rest)
    }
  }
  const kids = []
  for (let kid = node.firstChild; kid; kid = kid.nextSibling) {
    kids.push(kid)
  }
  for (const kid of kids) {
    if (kid.nodeType === 3 && kid.nodeValue.includes('&')) {
      rest = standing(kid, entities, bare, rest)
    } else if (kid.nodeType === 1) {
      rest = expand(kid, entities, bare, rest)
    }
  }
  return rest
}

/**
 * The directories a walk never opens, whatever it was asked for. Neither holds
 * a stylesheet anybody wrote and between them they hold 445,643 of the 482,562
 * entries a walk over this repository's own checkout visits, so the floor is
 * the walk's own rather than a question every caller has to remember to put
 * (#923).
 * @type {Array.<string>}
 */
const SEALED = ['.git', 'node_modules']

/**
 * What a walk refuses when its caller names nothing.
 * @return {boolean} - False, no directory being refused
 */
const none = function() {
  return false
}

/**
 * Whether a directory is one the walk leaves shut: named on the floor it keeps
 * whatever it was asked, or turned down by the caller's own question.
 * @param {string} dir - Absolute path of a directory
 * @param {function(string): boolean} refuses - What the caller turns down
 * @return {boolean} - True when it must not be opened
 */
const sealed = function(dir, refuses) {
  return SEALED.includes(path.basename(dir)) || refuses(dir)
}

/**
 * Every file under a directory, recursively, in the order the entries are read
 * and with each directory's own files standing where the directory does. The
 * subtree is joined on with `flatMap` rather than spread into a `push`, which
 * killed a run over 768,731 files (#758), and a sealed directory is never
 * opened at all rather than read and dropped after (#923).
 * @param {string} dir - Directory path
 * @param {function(string): boolean} refuses - Whether a directory is one this
 *  caller wants left shut, asked of its absolute path before it is opened
 * @return {Array.<string>} - Every file it holds, at any depth
 */
const allFilesFrom = function(dir, refuses = none) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const whole = path.resolve(dir, entry.name)
    let found = [whole]
    if (entry.isDirectory() && sealed(whole, refuses)) {
      found = []
    } else if (entry.isDirectory()) {
      found = allFilesFrom(whole, refuses)
    }
    return found
  })
}

/**
 * Read file content and parse it.
 * @param {string} type - Type of document
 * @param {function(string): *} fromString - Parser from string
 * @return {function(string): *} - Function that checks file and parses it
 */
const fromFile = function(type, fromString) {
  return function(path) {
    if (!fs.existsSync(path)) {
      throw new Error(`${type} file ${path} does not exist, can't parse`)
    }
    if (fs.statSync(path).isDirectory()) {
      throw new Error(`${type} file ${path} is directory, can't parse`)
    }
    return fromString(fs.readFileSync(path, 'utf-8'))
  }
}

/**
 * A reference as it must be spelled where one opens: a named entity, whose
 * name is captured, a decimal character reference, or a hexadecimal one. An
 * `&` may stand nowhere else, so one this does not match at is a well-
 * formedness error, and a name it captures is one the document must reach an
 * entity by.
 * @type {RegExp}
 */
const OPENS = /^&(?:#[0-9]+|#x[0-9A-Fa-f]+|([A-Za-z_][\w.-]*));/

/**
 * The one string XML reserves outright: `]]>` marks the end of a CDATA section
 * and may stand nowhere else in character data, however the author meant it.
 * @type {string}
 */
const CLOSE = ']]>'

/**
 * The complaint a forbidden sequence earns, saying where in the source it
 * stands.
 * @param {string} str - XML source
 * @param {number} at - Offset the sequence begins at
 * @param {string} what - How the message should name the sequence
 * @param {string} why - What is wrong with it standing there
 * @return {{reason: string, line: number, pos: number, namespace: boolean}} -
 *  The one-sentence complaint, and where it stands
 */
const complaint = function(str, at, what, why) {
  const {line, pos} = placeAt(str, at)
  return {
    reason: `the ${what} at ${line}:${pos} ${why}`,
    line: line, pos: pos, namespace: false,
  }
}

/**
 * Whether the document reaches an entity of that name: one of XML's five
 * predefined ones, one its internal subset declares, or any name at all where
 * an external subset nobody read is in play.
 * @param {string} name - The name a reference spells
 * @param {Map.<string, string>} entities - Entities declared inline
 * @param {boolean} loose - Whether an external subset is in play
 * @return {boolean} - True when a reference by that name resolves
 */
const entitled = function(name, entities, loose) {
  return loose || entities.has(name) || Object.hasOwn(NAMED, name)
}

/**
 * The complaint the sequence standing at that offset earns, or `SOUND`
 * when it earns none. `@xmldom/xmldom` lets three stand: a bare `&`, which it
 * rewrites to `&amp;` (#574), a reference to an entity nothing declares, and a
 * `]]>` closing no section (#691) — that last one content's alone, an
 * attribute value holding one legally, not being character data.
 * @param {string} str - XML source
 * @param {number} at - Offset to weigh
 * @param {boolean} data - Whether the run is character data
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {object} - The complaint, or `SOUND` when there is none
 */
const amiss = function(str, at, data, reaches) {
  let found = SOUND
  if (str[at] === '&') {
    const opens = OPENS.exec(str.slice(at))
    if (!opens) {
      found = complaint(
        str, at, 'ampersand', 'opens no entity or character reference')
    } else if (opens[1] && !reaches(opens[1])) {
      found = complaint(
        str, at, `entity "${opens[1]}"`,
        'is declared nowhere this document reaches')
    }
  } else if (data && str.startsWith(CLOSE, at)) {
    found = complaint(
      str, at, `"${CLOSE}"`, 'closes a CDATA section that never opened')
  }
  return found
}

/**
 * The complaint the run of source one node spans earns: an attribute value up
 * to the quote closing it, or a text node up to the `<` that ends it. Which of
 * the two decides whether a `]]>` standing there is forbidden at all, so the
 * kind is the caller's to say once rather than the loop's to ask per character.
 * @param {string} str - XML source
 * @param {Node} node - The attribute or text node spanning the run
 * @param {boolean} data - Whether the run is character data
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {object} - The complaint, or `SOUND` when there is none
 */
const strayed = function(str, node, data, reaches) {
  const opening = offsetAt(str, node.lineNumber, node.columnNumber)
  let stop = '<'
  let at = opening
  if (!data) {
    stop = str[opening]
    at = opening + 1
  }
  let found = SOUND
  while (!found.reason && at < str.length && str[at] !== stop) {
    found = amiss(str, at, data, reaches)
    at += 1
  }
  return found
}

/**
 * The complaint the first sequence a document must not hold earns, or `SOUND`
 * when it holds none. The runs are reached through the tree rather than
 * scanned out of the source, and by a pass of this function's own rather than
 * `walked`'s, which drops the namespace declarations (#691, #877).
 * @param {string} str - XML source
 * @param {Node} node - The document, or a node within it
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {object} - The complaint, or `SOUND` when there is none
 */
const forbidden = function(str, node, reaches) {
  let found = SOUND
  if (node.attributes) {
    for (let index = 0; !found.reason && index < node.attributes.length;
      index++) {
      found = strayed(str, node.attributes.item(index), false, reaches)
    }
  }
  for (let kid = node.firstChild; !found.reason && kid; kid = kid.nextSibling) {
    if (kid.nodeType === 3) {
      found = strayed(str, kid, true, reaches)
    } else if (kid.nodeType === 1) {
      found = forbidden(str, kid, reaches)
    }
  }
  return found
}

/**
 * Parse XML from string. A byte order mark the text opens with is held aside
 * rather than parsed, `parted` saying why. The entities it declares are the
 * inline ones and those the files its external parameter entities name hold,
 * wherever the caller read one (#1010).
 * @param {string} str - XML as string
 * @param {Map.<string, string>} subsets - System literals to the text they name
 * @return {Document} - Parsed XML as Document
 */
const xmlFromString = function(str, subsets = new Map()) {
  const {text} = parted(str)
  const entities = declaredEntities(inlined(text, subsets))
  const loose = external(text)
  try {
    const doc = documentOf(text)
    const refused = forbidden(
      text, doc, (name) => entitled(name, entities, loose))
    if (refused.reason) {
      throw refusal(refused)
    }
    if (entities.size || loose) {
      expand(doc.documentElement, entities, spelled(text), DOCUMENT)
    }
    return doc
  } catch (err) {
    throw refusal({
      reason: `Couldn't parse XML:\n${text}\n\nCause: ${err.reason}`,
      line: err.line, pos: err.pos, namespace: err.namespace,
    })
  }
}

/**
 * Parse YAML from string. The parser is required here rather than at the top,
 * because nothing on the linting path reads YAML any more — the checks arrive
 * as JSON — and loading it cost every run 17 ms for the sake of a config file
 * most runs do not have (#689).
 * @param {string} str - YAML as string
 * @return {any} - Parses YAML
 */
const yamlFromString = function(str) {
  let parsed
  try {
    parsed = require('yaml').parse(str)
  } catch (err) {
    throw new Error(
      `Couldn't parse YAML:\n${str}\n\nCause: ${err.message}`, {cause: err},
    )
  }
  return parsed
}

/**
 * A path as a glob reads it: relative to the directory the patterns resolve
 * against and in posix form, so what a pattern is matched against says the
 * same thing on every platform.
 * @param {string} pth - Absolute path of a file or a directory
 * @param {string} base - Directory the globs resolve against
 * @return {string} - What a pattern is matched against
 */
const slashed = function(pth, base) {
  return path.relative(base, pth).split(path.sep).join('/')
}

/**
 * Two strings ranked by code unit, the order `Array.prototype.sort` gives with
 * no comparator at all, rather than `localeCompare`, whose answer belongs to
 * the machine's locale and so cannot underlie a report committed once and
 * diffed on every runner (#638).
 * @param {string} one - A string
 * @param {string} two - Another string
 * @return {number} - Negative, zero or positive, as a comparator answers
 */
const compared = function(one, two) {
  return Number(one > two) - Number(one < two)
}

module.exports = {
  absentOf,
  compared,
  allFilesFrom,
  brought,
  SEALED,
  slashed,
  spelledAt,
  subsetsOf,
  unwritten,
  xml: {
    parsedFromFile: fromFile('XML', xmlFromString),
    parsedFromString: xmlFromString,
  },
  yaml: {
    parsedFromFile: fromFile('YAML', yamlFromString),
    parsedFromString: yamlFromString,
  },
}
