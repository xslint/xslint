/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs')
const path = require('path')
const {DOMParser} = require('@xmldom/xmldom')
const {GAP} = require('./tokens')
const {offsetAt, placeAt} = require('./source')
const {walked} = require('./tree')

/**
 * A reference to a general entity, `&name;`, as it survives in a parsed value.
 * @type {RegExp}
 */
const REFERENCE = /&([A-Za-z_][\w.-]*);/g

/**
 * The general entities the given source declares inline in its internal DTD
 * subset, mapped to their replacement text. `@xmldom/xmldom` never expands
 * them, so a reference to one surfaces as an "entity not found" error even
 * though the entity is perfectly well declared — DocBook and TEI stylesheets
 * rely on exactly this — and the reference is left literal in the parsed
 * value. Knowing name and value lets the parser forgive the error and lets the
 * tree be repaired afterwards.
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
 * XML parser for the given source. Its error handler raises on any
 * well-formedness problem the parser reports — not only the fatal ones it
 * throws on, but also the recoverable ones such as an undefined entity — so a
 * not-well-formed document never parses, and keeps the parser's diagnostics
 * off the console. The level a diagnostic arrives at is not consulted, because
 * `@xmldom/xmldom` grades an attribute written without quotes a mere `warning`
 * and then repairs it, so `select=$broken` parsed and every check downstream
 * read a value the parser had invented (#574). Every warning it can raise at
 * `text/xml` is either that family of attribute syntax or a replacement
 * character the bytes did not decode into, and a stylesheet whose bytes did
 * not decode is no more readable than one whose syntax does not parse. The
 * one exception is an unresolved entity the document is
 * entitled to: one it declares inline, or any at all when it pulls in an
 * external DTD we did not read. `@xmldom/xmldom` leaves such entities
 * unexpanded, and a declared-but-unexpanded entity is not malformed.
 * @param {string} str - XML source the parser will read
 * @param {Map.<string, string>} declared - Entities declared inline
 * @return {DOMParser} - Configured parser
 */
const parserFor = function(str, declared) {
  const loose = external(str)
  return new DOMParser({
    onError: (level, message) => {
      const text = message.trim()
      const missing = text.match(/^entity not found:&(.+?);/)
      if (!missing || !(loose || declared.has(missing[1]))) {
        throw new Error(text)
      }
    },
  })
}

/**
 * Get all the files recursively from given directory
 * @param {string} dir - Directory path
 * @return {Array.<string>} - Array of file in given directory
 */
const allFilesFrom = function(dir) {
  const files = fs.readdirSync(dir, {withFileTypes: true})
  const res = []
  for (const file of files) {
    if (file.isDirectory()) {
      res.push(...allFilesFrom(path.join(dir, file.name)))
    } else {
      res.push(path.resolve(dir, file.name))
    }
  }
  return res
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
 * A reference as it must be spelled where one opens: a named entity, a decimal
 * character reference, or a hexadecimal one. Character data admits an `&` only
 * here, so an `&` this does not match at is a well-formedness error. Whether
 * the name is *declared* is a separate question the parser already answers, and
 * this deliberately does not ask it — a `&primary;` from an external subset is
 * spelled like a reference and is one.
 * @type {RegExp}
 */
const OPENS = /^&(?:#[0-9]+|#x[0-9A-Fa-f]+|[A-Za-z_][\w.-]*);/

/**
 * Offset of the first `&` in character data that opens no reference, or -1 when
 * every one of them does. `@xmldom/xmldom` accepts a bare `&` in text in
 * silence — no diagnostic at any level — and rewrites it to `&amp;`, so a
 * stylesheet holding the commonest way hand-written XML stops being XML linted
 * clean while every check read the repaired document (#574).
 *
 * The character data is reached through the tree rather than by scanning the
 * source, because an `&` is *legal* in a comment, in a CDATA section and in a
 * processing instruction, and a scan that read the source as text would have to
 * find the three of them to stay quiet there. A text node cannot be any of the
 * three, so taking only those excludes them by construction, and each one's own
 * run of source ends at the next `<` — a raw `<` in character data being an
 * error the parser does report.
 * @param {string} str - XML source
 * @param {Document} doc - The document the parser built from it
 * @return {number} - Offset of the bare `&`, or -1 when there is none
 */
const unescaped = function(str, doc) {
  let found = -1
  for (const node of walked(doc)) {
    if (found < 0 && node.nodeType === 3) {
      let at = offsetAt(str, node.lineNumber, node.columnNumber)
      while (found < 0 && at < str.length && str[at] !== '<') {
        if (str[at] === '&' && !OPENS.test(str.slice(at))) {
          found = at
        }
        at += 1
      }
    }
  }
  return found
}

/**
 * Parse XML from string.
 * @param {string} str - XML as string
 * @return {Document} - Parsed XML as Document
 */
const xmlFromString = function(str) {
  const entities = declaredEntities(str)
  try {
    const doc = parserFor(str, entities).parseFromString(str, 'text/xml')
    const bare = unescaped(str, doc)
    if (bare >= 0) {
      const {line, pos} = placeAt(str, bare)
      throw new Error(
        `the ampersand at ${line}:${pos} opens no entity or character reference`,
      )
    }
    if (entities.size) {
      expand(doc.documentElement, entities)
    }
    return doc
  } catch (err) {
    throw new Error(`Couldn't parse XML:\n${str}\n\nCause: ${err.message}`)
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
    throw new Error(`Couldn't parse YAML:\n${str}\n\nCause: ${err.message}`)
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
