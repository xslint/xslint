/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {GAP} = require('../src/tokens')
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
 * and nothing else, so a guide left off a hand-written list would take its
 * claims out of every one of them (#645).
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
 * The documents a claim of ours may stand in: every guide the tree holds and
 * the README the user reads, walked rather than written down, so a claim that
 * moves out of the root is judged where it went and one written into a guide
 * nobody listed is judged nowhere. Each is read where its prose *names* what
 * it counts, reading one whole having judged four claims of fifteen (#821).
 * @type {Array.<string>}
 */
const DOCUMENTS = GUIDES.concat(['README.md'])

/**
 * How far past the name of a thing a number may stand and still be a claim
 * about it, a list and a file alike: one clause, the three claims in the tree
 * standing 3, 12 and 2 characters off their name, where a number further away
 * than this belongs to a sentence about something else — which is the whole
 * of what anchoring buys.
 * @type {number}
 */
const NEARBY = 80

/**
 * What a turn may load in guides, which is the harness's own number rather
 * than one of ours: Claude Code warns past 150,000 characters of them. What
 * arrives against it is a chain and not a pair — the root guide, and the
 * guide of every directory down to the file a turn touches, each injected
 * once — and the dearest reads 139,154, which is 0.93 (#750, #660, #825).
 * @type {number}
 */
const LOADED = 150000

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
 * The guides a turn loads on its way to one file: the root, and one for each
 * directory standing over it that carries a guide of its own. The guide named
 * is the last of them, so a chain is what its own directory costs a turn.
 * @param {string} named - Path of a guide from the repository root
 * @return {Array.<string>} - The guides loaded with it, the root first
 */
const chained = function(named) {
  const directories = path.dirname(named).split('/')
  return ['CLAUDE.md'].concat(
    directories.filter((one) => one !== '.')
      .map(
        (one, index) => `${directories.slice(0, index + 1).join('/')}/CLAUDE.md`,
      )
      .filter((one) => GUIDES.includes(one)),
  )
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
 * The dearest chain any file's turn loads, which is the reading every figure
 * below is derived from.
 * @return {number} - Characters of guide the dearest chain costs
 */
const dearest = function() {
  return GUIDES.map((one) => loaded(one)).reduce(
    (one, two) => Math.max(one, two), 0,
  )
}

/**
 * What is left of the bar once everything standing over one guide is loaded,
 * which is what the retired `CEILING` weighed a guide against.
 * @param {string} named - Path of a guide from the repository root
 * @return {number} - The bar less the chain above it
 */
const allowed = function(named) {
  return LOADED - (loaded(named) - sized(named))
}

/**
 * A number as this repository's prose writes one.
 * @param {number} count - What to spell
 * @return {string} - It, with thousands parted
 */
const thousands = function(count) {
  return count.toLocaleString('en-US')
}

/**
 * Whether a text carries a claim at all, asked through `matchAll` because
 * `test` on a global pattern leaves `lastIndex` where it stopped and answers
 * `false` to the very next asking.
 * @param {RegExp} claim - The phrase a figure stands in
 * @param {string} text - Prose to read
 * @return {boolean} - Whether it stands there
 */
const carries = function(claim, text) {
  return Array.from(text.matchAll(claim)).length > 0
}

/**
 * Every figure a guide states about the chain: the phrase carrying it, every
 * file expected to carry that phrase, and what the tree makes of its captures.
 * All five follow from three file sizes, so one guide growing moves the lot,
 * and the bar stays quiet until 140,000 — which is why they drift (#750, #825).
 * @type {Array.<{claim: RegExp, carriers: Array.<string>,
 *  truth: function(): Array.<string>}>}
 */
const DERIVED = [
  {
    claim: new RegExp(
      `the dearest (?:chain is that same one at|reads) ([\\d,]*\\d),${GAP}` +
        '+which is (0[.]\\d\\d)',
      'g',
    ),
    carriers: ['test/CLAUDE.md', 'test/guides.js'],
    truth: () => [thousands(dearest()), (dearest() / LOADED).toFixed(2)],
  },
  {
    claim: new RegExp(
      `the dearest chain of guides standing at (0[.]\\d\\d)${GAP}+of`, 'g',
    ),
    carriers: ['CLAUDE.md'],
    truth: () => [(dearest() / LOADED).toFixed(2)],
  },
  {
    claim: new RegExp('([\\d,]*\\d) for `src/linters/CLAUDE[.]md`', 'g'),
    carriers: ['test/CLAUDE.md'],
    truth: () => [thousands(allowed('src/linters/CLAUDE.md'))],
  },
  {
    claim: new RegExp(`holds the root itself to ([\\d,]*\\d)`, 'g'),
    carriers: ['test/CLAUDE.md'],
    truth: () => [thousands(LOADED - (dearest() - sized('CLAUDE.md')))],
  },
  {
    claim: new RegExp(
      `What that leaves is ([\\d,]*\\d) characters of${GAP}+headroom`, 'g',
    ),
    carriers: ['test/CLAUDE.md'],
    truth: () => [thousands(LOADED - ROOM - dearest())],
  },
]

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
  ROOT, GUIDES, DOCUMENTS, DERIVED, LOADED, ROOM, NEARBY, carries, slashed,
  sized, worded, chained, loaded, indexed, noted, globbed,
}
