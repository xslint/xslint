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
 * which holds whole copies of this tree.
 * @type {Array.<string>}
 */
const OUTSIDE = ['node_modules', 'coverage', 'docs']

/**
 * Names an agent harness loads as a guide on its own, wherever it meets one.
 * @type {Array.<string>}
 */
const HARNESSED = ['CLAUDE.md', 'AGENTS.md']

/**
 * Every file below the root carrying a name a harness loads, walked rather
 * than written down, so a guide nobody listed is found all the same (#1168).
 * @type {Array.<string>}
 */
const NESTED = fs.readdirSync(ROOT, {withFileTypes: true})
  .filter((one) => one.isDirectory())
  .filter((one) => !one.name.startsWith('.') && !OUTSIDE.includes(one.name))
  .flatMap((one) => allFilesFrom(path.join(ROOT, one.name)))
  .filter((one) => HARNESSED.includes(path.basename(one)))
  .map(slashed)

/**
 * The guides and the most lines each may hold: the rules every turn loads, at
 * the size Claude Code's documentation asks of a memory file, and the map a
 * change reads when it needs one (#1168).
 * @type {Map.<string, number>}
 */
const CAPS = new Map([['AGENTS.md', 200], ['ARCHITECTURE.md', 300]])

/**
 * The guides, rules first.
 * @type {Array.<string>}
 */
const GUIDES = [...CAPS.keys()]

/**
 * What the root `CLAUDE.md` holds: a heading, and the import handing a Claude
 * Code session the rules every other agent reads in `AGENTS.md`.
 * @type {string}
 */
const IMPORTED = '# CLAUDE.md\n\n@AGENTS.md\n'

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
 * The documents a claim of ours may stand in: the guides, the README the user
 * reads, and the notes a release cuts from (#821).
 * @type {Array.<string>}
 */
const DOCUMENTS = GUIDES.concat(['README.md', 'CHANGELOG.md'])

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
 * The paths the map's index names, read out of its `Key files` section alone:
 * the four kinds of check are tabulated in the same shape a few sections up,
 * so a sweep over every row of every table would read `xpath` and `corpus` as
 * files of ours.
 * @return {Array.<string>} - The paths, as the index spells them
 */
const indexed = function() {
  const rows = []
  let inside = false
  for (const line of fs.readFileSync(
    path.join(ROOT, 'ARCHITECTURE.md'), 'utf-8').split('\n')) {
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
 * An index row as the pattern it is, a row being allowed one `*` where a family
 * of modules shares a shape: the linters are one row rather than one each, and
 * the star stands for a name and never for a directory.
 * @param {string} row - The path an index row names
 * @return {RegExp} - What that row matches
 */
const globbed = function(row) {
  return new RegExp(`^${row.replace(/\./g, '\\.').split('*').join('[^/]*')}$`)
}

module.exports = {
  ROOT, NESTED, CAPS, IMPORTED, DOCUMENTS, NEARBY, slashed,
  worded, indexed, globbed,
}
