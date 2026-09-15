/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `ignoring(start)` — what the `.gitignore` files standing over a directory
 * say about the paths below it, asked as the two questions a walk puts:
 * whether to descend a directory, and whether to keep a file.
 *
 * A walk opened every directory it was handed, so a tree the project itself
 * does not track was read, linted and reported like source. Over the eo
 * repository a run reported 5,031 stylesheets, of which 123 are the
 * checkout's own and 4,908 stand under a gitignored `.claude/worktrees` — 52
 * worktrees of the same checkout, reducing to 143 distinct paths, with every
 * tracked defect printed up to thirty-four times. Neither half of the refusal
 * in front of this reaches that: `SEALED` in `src/helpers.js` names two
 * directories and nothing else, and the configuration's `exclude:` waits for
 * a line somebody writes about a tree git is already told to forget (#929).
 *
 * Where it is asked is the seam #928 opened: a caller says, per directory,
 * whether to descend it, before it is opened. So the rules are read as the
 * walk passes each directory — one file per directory, remembered, however
 * many paths are asked about below it — rather than by asking
 * `git check-ignore` about every entry, which spends a process a path and
 * answers nothing where git is absent or the tree is no repository at all.
 * What a directory answers is asked before it is opened and what a file
 * answers only once its name says it is a stylesheet, so nothing the run
 * would not have read pays for the question.
 *
 * Every rule is matched by `Minimatch` with braces and extglobs switched off,
 * git's format having no word for either: `{one,two}` and `one+(two)` name
 * the characters they spell. That is the direction the whole translation errs
 * in. Over-acceptance here is a stylesheet somebody asked for and never got
 * linted, which no report mentions; under-acceptance is only the directory
 * the walk still pays for, which is what it paid before — the asymmetry
 * `src/predicates.js` answers to, one question over. A trailing `/` leaves a
 * rule naming directories alone, a `/` surviving that anchors it at its own
 * file's directory, and a rule holding none matches at any depth, which is
 * the double star written in front of it. A `!` takes a name back, the last
 * rule matching a path decides it, and an outer file's rules stand in front
 * of an inner one's.
 *
 * It climbs no higher than the repository the walk starts inside — the
 * nearest ancestor holding a `.git`, a directory in a checkout and a file in
 * a worktree linking one — and reads nothing at all above a directory no
 * repository stands over, so what a temporary yard answers comes out of what
 * that yard holds rather than out of whatever a home directory carries. What
 * stays outside it is the rest of what git would consult: `.git/info/exclude`
 * and the `core.excludesFile` a user configures, neither of them a file this
 * reads. A path named on the command line is read whatever the project
 * ignores, too — these rules answer for the walk below an argument and never
 * for the argument itself, so `xslint build` lints the directory a `build/`
 * line keeps out of `xslint .`.
 */

const fs = require('fs')
const path = require('path')
const {Minimatch} = require('minimatch')
const {slashed} = require('./helpers')

/**
 * The file a directory names what it ignores in.
 * @type {string}
 */
const IGNORE = '.gitignore'

/**
 * What marks the top of a repository: a directory in a checkout, a file in a
 * worktree linking one.
 * @type {string}
 */
const REPOSITORY = '.git'

/**
 * How a rule is matched: a dotted name is a directory like any other here,
 * and the two extensions git has no word for are off, a brace or a bracket
 * standing for the characters it spells.
 * @type {object}
 */
const GLOB = {
  dot: true,
  nobrace: true,
  noext: true,
  nocomment: true,
  nonegate: true,
}

/**
 * One line of an ignore file as a rule: what it matches, where it matches
 * from, whether it takes a name back, and whether it names directories alone.
 * @param {string} line - The line, with the gap behind it already dropped
 * @param {string} base - Directory the ignore file stands in
 * @return {object} - The rule the line spells
 */
const patterned = function(line, base) {
  let spelled = line
  const negated = spelled.startsWith('!')
  if (negated) {
    spelled = spelled.slice(1)
  }
  const directory = spelled.endsWith('/')
  if (directory) {
    spelled = spelled.slice(0, -1)
  }
  if (spelled.startsWith('/')) {
    spelled = spelled.slice(1)
  } else if (!spelled.includes('/')) {
    spelled = `**/${spelled}`
  }
  return {glob: new Minimatch(spelled, GLOB), base, negated, directory}
}

/**
 * The rule one line holds: one, or none where the line names no path at all,
 * being blank or a comment.
 * @param {string} line - The line as the ignore file spells it
 * @param {string} base - Directory the ignore file stands in
 * @return {Array.<object>} - The rule it holds, or nothing
 */
const ruled = function(line, base) {
  let rules = []
  const spelled = line.trimEnd()
  if (spelled !== '' && !spelled.startsWith('#')) {
    rules = [patterned(spelled, base)]
  }
  return rules
}

/**
 * Every rule the ignore file of one directory holds, in the order it spells
 * them.
 * @param {string} dir - Absolute path of the directory
 * @return {Array.<object>} - Its rules, or nothing where it names no file
 */
const rulesOf = function(dir) {
  let rules = []
  const file = path.join(dir, IGNORE)
  if (fs.existsSync(file)) {
    rules = fs.readFileSync(file, 'utf-8').split('\n')
      .flatMap((line) => ruled(line, dir))
  }
  return rules
}

/**
 * The highest directory a rule is read from: the repository the walk starts
 * inside, or the directory itself where none stands over it.
 * @param {string} start - Absolute path the walk begins at
 * @return {string} - Where the climb stops
 */
const toppedAt = function(start) {
  let top = start
  let dir = start
  let climbing = true
  while (climbing) {
    if (fs.existsSync(path.join(dir, REPOSITORY))) {
      top = dir
      climbing = false
    } else if (path.dirname(dir) === dir) {
      climbing = false
    } else {
      dir = path.dirname(dir)
    }
  }
  return top
}

/**
 * Every rule standing over one directory, an outer file's in front of an
 * inner file's, remembered so that a directory is read once however many
 * paths below it are asked about.
 * @param {string} dir - Absolute path of a directory, at `top` or below it
 * @param {string} top - Where the climb stops
 * @param {Map} memo - What the directories already read answered
 * @return {Array.<object>} - The rules, in the order they are read
 */
const stacked = function(dir, top, memo) {
  if (!memo.has(dir)) {
    let above = []
    if (dir !== top) {
      above = stacked(path.dirname(dir), top, memo)
    }
    memo.set(dir, above.concat(rulesOf(dir)))
  }
  return memo.get(dir)
}

/**
 * Whether one rule names a path.
 * @param {object} rule - A rule, as `patterned` reads one
 * @param {string} pth - Absolute path of a file or a directory
 * @param {boolean} directory - Whether the path is a directory
 * @return {boolean} - True where the rule names it
 */
const matches = function(rule, pth, directory) {
  return (directory || !rule.directory) &&
    rule.glob.match(slashed(pth, rule.base))
}

/**
 * Whether the rules standing over a path ignore it, the last one naming it
 * deciding.
 * @param {string} pth - Absolute path of a file or a directory
 * @param {boolean} directory - Whether the path is a directory
 * @param {string} top - Where the climb stops
 * @param {Map} memo - What the directories already read answered
 * @return {boolean} - True where the project ignores it
 */
const ignores = function(pth, directory, top, memo) {
  let ignored = false
  stacked(path.dirname(pth), top, memo).forEach(function(rule) {
    if (matches(rule, pth, directory)) {
      ignored = !rule.negated
    }
  })
  return ignored
}

/**
 * What the ignore files over a directory say about the paths below it.
 * @param {string} start - Absolute path the walk begins at
 * @return {object} - `directory(pth)` and `file(pth)`, each answering a
 *   boolean
 */
const ignoring = function(start) {
  const top = toppedAt(start)
  const memo = new Map()
  return {
    directory: (dir) => ignores(dir, true, top, memo),
    file: (file) => ignores(file, false, top, memo),
  }
}

module.exports = {ignoring}
