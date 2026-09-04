/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs')
const path = require('path')
const {DOMParser} = require('@xmldom/xmldom')
const {GAP} = require('./tokens')
const {NAMED, parted, offsetAt, placeAt} = require('./source')
const {walked} = require('./tree')

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
 * Replace every reference to a declared entity in the subtree with its value,
 * in place. `@xmldom/xmldom` leaves the reference literal, so an expression or
 * text that uses one would otherwise read `&lowercase;` rather than its
 * replacement. Positions are untouched: the parser fixed line and column from
 * the original source, and only in-memory values change.
 * @param {Node} node - Node whose subtree to repair
 * @param {Map.<string, string>} entities - Declared entity values
 */
const expand = function(node, entities) {
  if ((node.nodeType === 2 || node.nodeType === 3) &&
    node.nodeValue.includes('&')) {
    const value = node.nodeValue.replace(REFERENCE,
      (whole, name) => entities.get(name) ?? whole)
    node.nodeValue = value
    if (node.nodeType === 2) {
      node.value = value
    }
  }
  if (node.attributes) {
    for (let index = 0; index < node.attributes.length; index++) {
      expand(node.attributes.item(index), entities)
    }
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    expand(child, entities)
  }
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
 * Every file under a directory, recursively, in the order the entries are read
 * and with each directory's own files standing where the directory does. The
 * subtree is joined on with `flatMap` rather than spread into a `push`, a
 * spread handing each path over as an argument and V8 capping those, which
 * killed a run over 768,731 files (#758).
 * @param {string} dir - Directory path
 * @return {Array.<string>} - Every file it holds, at any depth
 */
const allFilesFrom = function(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    let found = [path.resolve(dir, entry.name)]
    if (entry.isDirectory()) {
      found = allFilesFrom(path.join(dir, entry.name))
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
 * The complaint the first sequence a document must not hold earns, or an empty
 * string when it holds none. The runs are reached through the tree rather than
 * scanned out of the source: an `&` is text inside a CDATA section and legal
 * in a comment, a `]]>` closes the one and stands legally in the other, and an
 * attribute value is neither (#691, #877).
 * @param {string} str - XML source
 * @param {Document} doc - The document the parser built from it
 * @param {function(string): boolean} reaches - Whether a name resolves
 * @return {string} - The complaint, or an empty string when there is none
 */
const forbidden = function(str, doc, reaches) {
  let found = ''
  for (const node of walked(doc)) {
    if (!found && (node.nodeType === 2 || node.nodeType === 3)) {
      const opening = offsetAt(str, node.lineNumber, node.columnNumber)
      let stop = '<'
      let at = opening
      if (node.nodeType === 2) {
        stop = str[opening]
        at = opening + 1
      }
      while (!found && at < str.length && str[at] !== stop) {
        found = amiss(str, at, node.nodeType === 3, reaches)
        at += 1
      }
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
    if (entities.size) {
      expand(doc.documentElement, entities)
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

module.exports = {
  allFilesFrom,
  xml: {
    parsedFromFile: fromFile('XML', xmlFromString),
    parsedFromString: xmlFromString,
  },
  yaml: {
    parsedFromFile: fromFile('YAML', yamlFromString),
    parsedFromString: yamlFromString,
  },
}
