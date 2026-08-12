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
 * Every file under a directory, recursively, in the order the entries are read
 * and with each directory's own files standing where the directory does.
 *
 * The subtree is joined on with `flatMap` rather than spread into a `push`,
 * because a spread hands each path over as a separate argument and V8 caps
 * those at roughly 125 per kilobyte of stack: this repository's own checkout
 * grew to 768,731 files and every run over it died with a `RangeError` before a
 * byte of XSL was read (#758). The walk is the wrong place to learn that a tree
 * is large — it is asked before anything is filtered for `.xsl`, so a
 * dependency directory nobody wants linted counts toward the cap as much as a
 * stylesheet does.
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
 * The complaint the first sequence character data must not hold earns, or an
 * empty string when it holds neither. There are two of them, and
 * `@xmldom/xmldom` accepts both without a word at any level: a bare `&`, which
 * it rewrites to `&amp;` (#574), and a `]]>` that closes no section, which it
 * keeps as it stands (#691). Either way a document no processor would load is
 * handed on as a tree, and every check downstream reasons about content that
 * does not exist.
 *
 * The character data is reached through the tree rather than by scanning the
 * source, because both sequences are *legal* in a comment and in a processing
 * instruction, and an `&` is legal inside a CDATA section as well, where a
 * `]]>` is the close rather than an error. A scan reading the source as text
 * would have to find all three regions to stay quiet in them. A text node
 * cannot be any of the three, so taking only those excludes them by
 * construction, and each one's own run of source ends at the next `<` — a raw
 * `<` in character data being an error the parser does report. Attribute values
 * are outside the walk for the same reason: `]]>` is forbidden in content, and
 * an attribute is not content.
 * @param {string} str - XML source
 * @param {Document} doc - The document the parser built from it
 * @return {string} - The complaint, or an empty string when there is none
 */
const forbidden = function(str, doc) {
  let found = ''
  for (const node of walked(doc)) {
    if (!found && node.nodeType === 3) {
      let at = offsetAt(str, node.lineNumber, node.columnNumber)
      while (!found && at < str.length && str[at] !== '<') {
        if (str[at] === '&' && !OPENS.test(str.slice(at))) {
          found = complaint(
            str, at, 'ampersand', 'opens no entity or character reference')
        } else if (str.startsWith(CLOSE, at)) {
          found = complaint(
            str, at, `"${CLOSE}"`, 'closes a CDATA section that never opened')
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
    const refused = forbidden(str, doc)
    if (refused) {
      throw new Error(refused)
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
