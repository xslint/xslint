/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {GAP, WHITESPACE} = require('../src/tokens')
const path = require('path')
const fs = require('fs')

/**
 * Directory the repository stands at.
 * @type {string}
 */
const ROOT = path.resolve(__dirname, '..')

/**
 * A path as a guide spells one: from the repository root, and with the
 * separator a guide writes rather than the one the platform walks in, since the
 * suite runs on Windows as well.
 * @param {string} whole - Absolute path of the file
 * @return {string} - The path from the root, slashed
 */
const slashed = function(whole) {
  return path.relative(ROOT, whole).split(path.sep).join('/')
}

/**
 * The guide every turn loads first. It is one import of `AGENTS.md`, the file
 * the rules stand in, so that every other agent reads them too (#1168).
 * @type {string}
 */
const ENTRY = 'CLAUDE.md'

/**
 * The document holding the map of the code: the `Key files` index, and the
 * derivation behind every rule `AGENTS.md` states. No turn loads it, so it
 * costs a turn nothing until a change asks for it (#1168).
 * @type {string}
 */
const ARCHITECTURE = 'ARCHITECTURE.md'

/**
 * How many hops of import Claude Code follows out of a guide, the number its
 * own documentation gives.
 * @type {number}
 */
const HOPS = 4

/**
 * An import as Claude Code reads one: an at-sign opening a line or standing
 * behind a gap, and the path running from it to the next gap.
 * @type {RegExp}
 */
const IMPORT = new RegExp(`(?:^|${GAP})@([^${WHITESPACE}]+)`, 'g')

/**
 * Directories the walk below leaves alone: the dependencies and the two
 * generated trees, plus every dotted name — `.claude/worktrees` among them,
 * which holds whole copies of this tree and would count every guide in it a
 * second time.
 * @type {Array.<string>}
 */
const OUTSIDE = ['node_modules', 'coverage', 'docs']

/**
 * The paths a guide imports, read the way Claude Code reads them: outside a
 * fenced block and outside a code span, and resolved against the directory of
 * the guide spelling them rather than against the root.
 * @param {string} named - Path of the guide from the repository root
 * @return {Array.<string>} - The paths it imports, from the root
 */
const imports = function(named) {
  let fenced = false
  const prose = []
  for (const line of fs.readFileSync(
    path.join(ROOT, named), 'utf-8').split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced
    } else if (!fenced) {
      prose.push(line.replace(/`[^`]*`/g, ''))
    }
  }
  return prose.flatMap((line) => Array.from(line.matchAll(IMPORT)))
    .map((found) => slashed(path.join(ROOT, path.dirname(named), found[1])))
}

/**
 * A guide and every file it brings into a turn with it: what it imports, and
 * what those import, as many hops deep as the harness follows, each once. An
 * import naming no file brings nothing, which a gate of its own refuses.
 * @param {string} named - Path of the guide from the repository root
 * @param {number} hops - How many imports deep the guide itself was reached
 * @return {Array.<string>} - The guide first, then what it brings
 */
const expanded = function(named, hops = 0) {
  let brought = []
  if (hops < HOPS) {
    brought = imports(named)
      .filter((one) => fs.existsSync(path.join(ROOT, one)))
      .flatMap((one) => expanded(one, hops + 1))
  }
  return Array.from(new Set([named].concat(brought)))
}

/**
 * Every guide the tree holds, walked rather than written down: the root one,
 * the `CLAUDE.md` of each directory carrying the derivation behind its own
 * modules (#821), and what any of them imports (#1168). Walked, because a
 * guide left off a hand-written list would take its claims out of every gate
 * reading this one (#645).
 * @type {Array.<string>}
 */
const GUIDES = Array.from(new Set([ENTRY].concat(
  fs.readdirSync(ROOT, {withFileTypes: true})
    .filter((one) => one.isDirectory())
    .filter((one) => !one.name.startsWith('.') && !OUTSIDE.includes(one.name))
    .flatMap((one) => allFilesFrom(path.join(ROOT, one.name)))
    .filter((one) => path.basename(one) === 'CLAUDE.md')
    .map(slashed),
).flatMap((one) => expanded(one))))

/**
 * How much a document holds, in the characters a reader of it is charged —
 * characters and not bytes, an em dash costing three of the second and one of
 * the first.
 * @param {string} named - Path of the document from the repository root
 * @return {number} - Its length
 */
const sized = function(named) {
  return fs.readFileSync(path.join(ROOT, named), 'utf-8').length
}

/**
 * The prose of a file as one line, so a claim that wraps mid-sentence reads
 * as the one claim it is: two of the three counts #654 corrected wrapped
 * between the number and its noun, where a gate reading line by line saw
 * neither. A continuation asterisk goes with the indent in front of it.
 * @param {string} named - Path of the file from the repository root
 * @return {string} - Its prose, joined
 */
const worded = function(named) {
  return fs.readFileSync(path.resolve(__dirname, '..', named), 'utf-8')
    .split('\n').map((line) => line.replace(/^ *\* ?/, '')).join(' ')
}

/**
 * The documents a claim of ours may stand in: every guide the tree holds, the
 * map no turn loads, the README the user reads, and the notes a release cuts
 * from. Each is read where its prose *names* what it counts, so a claim that
 * moves out of a guide is judged where it went (#821, #1168).
 * @type {Array.<string>}
 */
const DOCUMENTS = GUIDES.concat([ARCHITECTURE, 'README.md', 'CHANGELOG.md'])

/**
 * How far past the name of a thing a number may stand and still be a claim
 * about it, a list and a file alike: one clause, the five claims in the tree
 * standing 3 to 39 characters off their name, so the bar is about twice the
 * dearest of them, where a number further away belongs to a sentence about
 * something else — which is the whole of what anchoring buys.
 * @type {number}
 */
const NEARBY = 80

/**
 * What a turn may load in guides, which is the harness's own number rather
 * than one of ours: Claude Code warns past 150,000 characters of them. What
 * arrives against it is a chain and not a pair — the root guide, and the
 * guide of every directory down to the file a turn touches, each injected
 * once; what the dearest weighs is the gate's to say (#750, #825, #1055).
 * @type {number}
 */
const LOADED = 150000

/**
 * The most lines a guide a turn starts with may hold, which is the harness's
 * own number again: Claude Code's documentation names 200 as the length past
 * which a file is followed less closely, so the map and the derivations stand
 * in `ARCHITECTURE`, which no turn loads (#1168).
 * @type {number}
 */
const BRIEF = 200

/**
 * The characters of headroom the bar keeps under `LOADED`, so a chain reddens
 * while there is still room to answer it rather than at the breach, where a
 * relocation no longer fits. It stands at 1.89 of the most a day of work has
 * added to the dearest chain, `GROWN` in `test/guides.test.js` holding it to
 * that band from both sides (#844).
 * @type {number}
 */
const ROOM = 10000

/**
 * The guides a turn loads on its way to one file: the root, one for each
 * directory standing over it that carries a guide of its own, and what each of
 * them imports, behind the guide importing it. So a chain is what the
 * directory of the guide named costs a turn.
 * @param {string} named - Path of a guide from the repository root
 * @return {Array.<string>} - The guides loaded with it, the root first
 */
const chained = function(named) {
  const directories = path.dirname(named).split('/')
  return Array.from(new Set([ENTRY].concat(
    directories.filter((one) => one !== '.')
      .map(
        (one, index) => `${directories.slice(0, index + 1).join('/')}/CLAUDE.md`,
      )
      .filter((one) => GUIDES.includes(one)),
  ).flatMap((one) => expanded(one))))
}

/**
 * What a turn touching one directory is charged in guides, the whole chain
 * summed.
 * @param {string} named - Path of a guide from the repository root
 * @return {number} - Characters of guide that arrive with it
 */
const loaded = function(named) {
  return chained(named).reduce((total, one) => total + sized(one), 0)
}

/**
 * The paths the index names, read out of the `Key files` section of
 * `ARCHITECTURE` alone: the four kinds of check are tabulated in the same
 * shape a few sections up, so a sweep over every row of every table would
 * read `xpath` and `corpus` as files of ours.
 * @return {Array.<string>} - The paths, as the index spells them
 */
const indexed = function() {
  const rows = []
  let inside = false
  for (const line of fs.readFileSync(
    path.join(ROOT, ARCHITECTURE), 'utf-8').split('\n')) {
    if (line.startsWith('## ')) {
      inside = line === '## Key files'
    }
    const named = line.match(/^\| `([^`]+)` \|/)
    if (inside && named !== null) {
      rows.push(named[1])
    }
  }
  return rows
}

/**
 * How many lines a document holds, the newline it ends with opening none.
 * @param {string} named - Path of the document from the repository root
 * @return {number} - Its lines
 */
const lined = function(named) {
  return fs.readFileSync(path.join(ROOT, named), 'utf-8')
    .replace(/\n$/, '').split('\n').length
}

/**
 * The files a guide holds a note about, one heading naming one path.
 * @param {string} named - Path of the guide from the repository root
 * @return {Array.<string>} - The paths it notes
 */
const noted = function(named) {
  return fs.readFileSync(path.join(ROOT, named), 'utf-8').split('\n')
    .map((line) => line.match(/^## `([^`]+)`$/))
    .filter((found) => found !== null)
    .map((found) => found[1])
}

/**
 * An index row as the pattern it is, a row being allowed one `*` where a family
 * of modules shares a shape: the twenty-one linters are one row rather than
 * twenty-one, and the star stands for a name and never for a directory.
 * @param {string} row - The path an index row names
 * @return {RegExp} - What that row matches
 */
const globbed = function(row) {
  return new RegExp(`^${row.replace(/\./g, '\\.').split('*').join('[^/]*')}$`)
}

module.exports = {
  ROOT, ENTRY, ARCHITECTURE, GUIDES, DOCUMENTS, LOADED, BRIEF, ROOM, NEARBY,
  slashed, sized, lined, worded, imports, chained, loaded, indexed, noted,
  globbed,
}
