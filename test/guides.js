/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
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
 * Directories the walk below leaves alone: the dependencies and the two
 * generated trees, plus every dotted name — `.claude/worktrees` among them,
 * which holds whole copies of this tree and would count every guide in it a
 * second time.
 * @type {Array.<string>}
 */
const OUTSIDE = ['node_modules', 'coverage', 'docs']

/**
 * Every guide the tree holds, walked rather than written down: the root one,
 * and the `CLAUDE.md` of each directory carrying the derivation behind its own
 * modules (#821). Walked, because the gates reading this judge what it holds
 * and nothing else, so a guide relocated into a directory and left off a
 * hand-written list would take its claims out of every one of them — a suite
 * asserting nothing reading exactly like one that passed (#645).
 * @type {Array.<string>}
 */
const GUIDES = ['CLAUDE.md'].concat(
  fs.readdirSync(ROOT, {withFileTypes: true})
    .filter((one) => one.isDirectory())
    .filter((one) => !one.name.startsWith('.') && !OUTSIDE.includes(one.name))
    .flatMap((one) => allFilesFrom(path.join(ROOT, one.name)))
    .filter((one) => path.basename(one) === 'CLAUDE.md')
    .map(slashed),
)

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
 * What a turn may load in guides, which is the harness's own number rather than
 * one of ours: Claude Code warns past 150,000 characters of them, and a turn
 * that opens a module loads the root guide and the guide beside that module.
 * The pair reads 129,750 here — 63,352 for the root and 66,398 for
 * `src/CLAUDE.md`, dearest of the five — which is 0.86 of it. How fast that
 * moves is worth knowing beside the bar: #818, the change that landed while
 * this one was being written, spent 4,382 characters in one sitting, of which
 * the root took 721 and the module guides the rest.
 * @type {number}
 */
const LOADED = 150000

/**
 * What one guide may hold, which is half of what a turn loads, a turn loading
 * two of them. The two dearest stand at 0.84 and 0.89 of it, thinner than every
 * other bar in this suite and deliberately so: what answers a guide reaching
 * this is the same move one directory down — a module's derivation into that
 * module's own docblocks — and never a ceiling widened to fit what has grown
 * past it, which is how the root came to hold 202,584 characters with the one
 * gate that reads it saying nothing about size (#821).
 * @type {number}
 */
const CEILING = LOADED / 2

/**
 * The paths the root guide's index names, read out of its `Key files` section
 * alone: the four kinds of check are tabulated in the same shape a few sections
 * up, so a sweep over every row of every table would read `xpath` and `corpus`
 * as files of ours.
 * @return {Array.<string>} - The paths, as the index spells them
 */
const indexed = function() {
  const rows = []
  let inside = false
  for (const line of fs.readFileSync(
    path.join(ROOT, 'CLAUDE.md'), 'utf-8').split('\n')) {
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
  ROOT, GUIDES, CEILING, LOADED, slashed, sized, indexed, noted, globbed,
}
