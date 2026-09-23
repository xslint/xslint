/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `xmlFromString` reads a document the way a processor does where
 * `@xmldom/xmldom` will not. It resolves no entity at all, leaving every
 * `&name;` literal in the value it parsed, so `expand` puts what each one
 * stands for where the reference stands — and until #984 it put the
 * replacement text in as *characters*, whatever that text spelled. An entity
 * whose replacement is markup is the elements it spells: DocBook-XSL declares
 * `&lf;` as an `xsl:text` carrying a newline, and nine references to it were
 * reported as literal text inside an instruction, each offered a fix that
 * would have wrapped the ampersand in one more `xsl:text`. The other half of
 * the same reading is what no check saw at all: the expression such an
 * instruction carries reached no scanner, so a `//` standing inside one was a
 * scan of the whole document that nothing reported.
 *
 * So a text node holding a reference is rebuilt as markup and read by a parse
 * of its own — `markup`, then `grafted` — and what comes back is adopted into
 * the document where the reference stood. The rebuild escapes what stood
 * *around* the references, `nodeValue` being decoded already, so a `&lt;`
 * beside an entity is read as text a second time rather than as a tag. That
 * parse happens in the namespaces the reference point binds, `scoped`
 * gathering them off the ancestors, a replacement text naming its prefixes as
 * the document that holds it does. A replacement of characters alone comes
 * back as one text node, and the node keeps its own place rather than being
 * swapped for an equal.
 *
 * A reference this run reached no declaration for stands for content nobody
 * read, so it is dropped rather than left to be reported as the characters
 * spelling its own name: DocBook's `&setup-language-variable;` comes from a
 * subset behind a parameter entity, and twelve references to it drew that
 * same wrapping advice. Dropping one means telling `&name;` from the
 * `&amp;name;` that is literal text, and a parsed value spells both the same
 * way; `spelled` reads the raw source for the names a reference there really
 * opens, XML's own five aside, `&lt;` written out being the spelling common
 * enough to matter. An instruction whose whole content was such a reference
 * now reads as empty rather than as loose text, which is one report traded
 * for another — and the one it gives up carried a fix where
 * `empty-content-in-instructions` carries none. No stylesheet of the three
 * corpora holds that shape; twenty-one hold the two shapes this cures, and
 * the reports over all three are otherwise identical.
 *
 * Nothing an entity brought is written anywhere in the file holding it, so
 * `unwritten` says so and two things answer to it. A defect stands at the
 * reference, rather than at an offset walked forward through raw text that
 * spells something else entirely. And no fix is offered on such a node at
 * all: a declarative fixer reads that raw source itself to find the attribute
 * it deletes, and what it finds there is an ampersand —
 * `using-disable-output-escaping` built a zero-width edit on a line belonging
 * to another element.
 *
 * That same reading refuses what `@xmldom/xmldom` would repair rather than
 * reject: the level of a diagnostic is not consulted, since an attribute
 * written without quotes arrives a mere `warning` and is then invented into a
 * value (#574). Which sequences a document may not hold is `forbidden`'s
 * question rather than the parser's, `ENTITIES` naming the three complaints
 * it lets stand: xmldom resolves no entity for us either way, and its
 * pre-scan reads a name as `\w+` where XML's `Name` admits a dot, so a
 * DocBook module declaring `&sc.name;` in its internal subset and using it
 * correctly earned `entity not found`, six of that corpus's stylesheets
 * reported as malformed on it (#877). What stands in their place is
 * `entitled`: a name resolves when it is one of XML's five, one the internal
 * subset declares, or anything at all where an external subset nobody read is
 * in play.
 *
 * Beside it are the two sequences the parser accepts in silence, at no level
 * — an `&` that opens no reference, which it rewrites to `&amp;`, and a `]]>`
 * that closes no section, which it keeps as it stands (#691). The runs come
 * from the tree and not from a scan of the source, because both are legal in
 * a comment and a processing instruction, and inside a CDATA section an `&`
 * is text while a `]]>` is the close — a text node cannot be any of the
 * three, so those are excluded by construction rather than by finding them.
 * An attribute value is a run too since #877, `strayed` taking the `]]>` rule
 * from its caller: such a value is not character data, so it holds a `]]>`
 * legally and a bare `&` no more legally than text does. That pass is
 * `forbidden`'s own and not `walked`'s XPath-shaped one, well-formedness
 * being a lexical question about every attribute the source spells:
 * borrowing that sequence kept an `xmlns:q="urn:x&y"` out of the report and a
 * namespace URI no conformant parser produces in the tree.
 */

const fs = require('fs')
const path = require('path')
const {DOMParser} = require('@xmldom/xmldom')
const {GAP} = require('./tokens')
const {NAMED, parted, offsetAt, placeAt} = require('./source')
const {delimited, escaped} = require('./fixes')

/**
 * A reference to a general entity, `&name;`, as it survives in a parsed value.
 * @type {RegExp}
 */
const REFERENCE = /&([A-Za-z_][\w.-]*);/g

/**
 * The general entities the given source declares inline in its internal DTD
 * subset, mapped to their replacement text. `@xmldom/xmldom` never expands
 * them, so a reference surfaces as an "entity not found" error though the
 * entity is well declared — DocBook and TEI rely on this — and stays literal
 * in the parsed value.
 * @param {string} str - XML source
 * @return {Map.<string, string>} - Declared entity names to their values
 */
const declaredEntities = function(str) {
  const entities = new Map()
  for (const match of str.matchAll(
    new RegExp(
      `<!ENTITY${GAP}+([A-Za-z_][\\w.-]*)${GAP}+` +
      `(?:"([^"]*)"|'([^']*)')`, 'g'))) {
    entities.set(match[1], match[2] ?? match[3])
  }
  return entities
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
 * XML parser. Its error handler raises on any well-formedness problem the
 * parser reports, the recoverable ones included, so a not-well-formed document
 * never parses: the level is not consulted, `@xmldom/xmldom` grading an
 * unquoted attribute a `warning` and then repairing it (#574). An entity
 * complaint is the exception, `ENTITIES` saying why.
 * @return {DOMParser} - Configured parser
 */
const parserFor = function() {
  return new DOMParser({
    onError: (level, message) => {
      const text = message.trim()
      if (!ENTITIES.some((one) => text.startsWith(one))) {
        throw new Error(text)
      }
    },
  })
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
 * The text a node holds as a parser must read it: a declared entity stands for
 * its replacement text, which is markup where it spells one, a reference this
 * run reached no declaration for stands for the content nobody read, and every
 * character around them is escaped rather than parsed a second time.
 * @param {string} value - The node's parsed value
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} bare - Names the source spells as a reference
 * @return {string} - The value as markup
 */
const markup = function(value, entities, bare) {
  let built = ''
  let at = 0
  for (const match of value.matchAll(REFERENCE)) {
    built += escaped(value.slice(at, match.index))
    if (entities.has(match[1])) {
      built += entities.get(match[1])
    } else if (!bare.has(match[1])) {
      built += escaped(match[0])
    }
    at = match.index + match[0].length
  }
  return `${built}${escaped(value.slice(at))}`
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
 * Whether a node is one no line of its file spells, an entity having brought
 * it. Its place is where the reference stands, and that is the whole of what
 * the source says about it.
 * @param {Node} node - Node to weigh
 * @return {boolean} - True when an entity brought it
 */
const unwritten = function(node) {
  return BROUGHT.has(node)
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
  const doc = parserFor().parseFromString(
    `<${HOST}${scoped(at)}>${text}</${HOST}>`, 'text/xml')
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
 */
const standing = function(text, entities, bare) {
  const nodes = grafted(markup(text.nodeValue, entities, bare), text)
  if (nodes.length === 1 && nodes[0].nodeType === 3) {
    text.nodeValue = nodes[0].nodeValue
  } else {
    for (const node of nodes) {
      text.parentNode.insertBefore(node, text)
    }
    text.parentNode.removeChild(text)
  }
}

/**
 * Replace every reference to a declared entity in the subtree with what it
 * stands for, in place. `@xmldom/xmldom` leaves the reference literal, so an
 * expression or text that uses one would otherwise read `&lowercase;` rather
 * than its replacement, and what an entity brings takes the place of the
 * reference that brought it.
 * @param {Node} node - Node whose subtree to repair
 * @param {Map.<string, string>} entities - Declared entity values
 * @param {Set.<string>} bare - Names the source spells as a reference
 */
const expand = function(node, entities, bare) {
  if (node.nodeType === 2 && node.nodeValue.includes('&')) {
    const value = node.nodeValue.replace(REFERENCE,
      (whole, name) => entities.get(name) ?? whole)
    node.nodeValue = value
    node.value = value
  }
  if (node.attributes) {
    for (let index = 0; index < node.attributes.length; index++) {
      expand(node.attributes.item(index), entities, bare)
    }
  }
  const kids = []
  for (let kid = node.firstChild; kid; kid = kid.nextSibling) {
    kids.push(kid)
  }
  for (const kid of kids) {
    if (kid.nodeType === 3 && kid.nodeValue.includes('&')) {
      standing(kid, entities, bare)
    } else if (kid.nodeType === 1) {
      expand(kid, entities, bare)
    }
  }
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
 * @return {string} - The one-sentence complaint
 */
const complaint = function(str, at, what, why) {
  const {line, pos} = placeAt(str, at)
  return `the ${what} at ${line}:${pos} ${why}`
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
 * The complaint the sequence standing at that offset earns, or an empty string
 * when it earns none. `@xmldom/xmldom` lets three stand: a bare `&`, which it
 * rewrites to `&amp;` (#574), a reference to an entity nothing declares, and a
 * `]]>` closing no section (#691) — that last one content's alone, an
 * attribute value holding one legally, not being character data.
 * @param {string} str - XML source
 * @param {number} at - Offset to weigh
 * @param {boolean} data - Whether the run is character data
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {string} - The complaint, or an empty string when there is none
 */
const amiss = function(str, at, data, reaches) {
  let found = ''
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
 * @return {string} - The complaint, or an empty string when there is none
 */
const strayed = function(str, node, data, reaches) {
  const opening = offsetAt(str, node.lineNumber, node.columnNumber)
  let stop = '<'
  let at = opening
  if (!data) {
    stop = str[opening]
    at = opening + 1
  }
  let found = ''
  while (!found && at < str.length && str[at] !== stop) {
    found = amiss(str, at, data, reaches)
    at += 1
  }
  return found
}

/**
 * The complaint the first sequence a document must not hold earns, or an empty
 * string when it holds none. The runs are reached through the tree rather than
 * scanned out of the source, and by a pass of this function's own rather than
 * `walked`'s, which drops the namespace declarations (#691, #877).
 * @param {string} str - XML source
 * @param {Node} node - The document, or a node within it
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {string} - The complaint, or an empty string when there is none
 */
const forbidden = function(str, node, reaches) {
  let found = ''
  if (node.attributes) {
    for (let index = 0; !found && index < node.attributes.length; index++) {
      found = strayed(str, node.attributes.item(index), false, reaches)
    }
  }
  for (let kid = node.firstChild; !found && kid; kid = kid.nextSibling) {
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
 * rather than parsed, `parted` saying why.
 * @param {string} str - XML as string
 * @return {Document} - Parsed XML as Document
 */
const xmlFromString = function(str) {
  const {text} = parted(str)
  const entities = declaredEntities(text)
  const loose = external(text)
  try {
    const doc = parserFor().parseFromString(text, 'text/xml')
    const refused = forbidden(
      text, doc, (name) => entitled(name, entities, loose))
    if (refused) {
      throw new Error(refused)
    }
    if (entities.size || loose) {
      expand(doc.documentElement, entities, spelled(text))
    }
    return doc
  } catch (err) {
    throw new Error(
      `Couldn't parse XML:\n${text}\n\nCause: ${err.message}`, {cause: err},
    )
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

module.exports = {
  allFilesFrom,
  SEALED,
  slashed,
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
