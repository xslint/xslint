/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * `ignoring(start)` — what the `.gitignore` files standing over a directory
 * say about the paths below it, asked as the two questions a walk puts:
 * whether to descend a directory, and whether to keep a file. Without it a
 * tree the project does not track was linted like source (#929). The rules
 * are read once per directory as the walk passes it, rather than by a
 * `git check-ignore` per path, and git's index outranks them, asked once per
 * repository the walk meets. Matching errs toward reading too much, a
 * stylesheet silently dropped being the worse failure. Every repository
 * answers for its own subtree, and a path named on the command line is read
 * whatever the project ignores.
 */

const fs = require('fs')
const path = require('path')
const {execFileSync} = require('child_process')
const {Minimatch} = require('minimatch')
const {slashed} = require('./helpers')
const {logger} = require('./logger')

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
 * What git is asked for: every path its index holds that its own ignore files
 * name, `-z` so that a name holding a newline arrives whole.
 * @type {Array.<string>}
 */
const TRACKED = ['ls-files', '-z', '--cached', '--ignored', '--exclude-standard']

/**
 * The index of a tree no repository stands over, which holds nothing.
 * @type {object}
 */
const NOTHING = {has: () => false}

/**
 * The index a repository git cannot read stands for, which holds everything:
 * nothing is ignored, and the walk reads what it read before.
 * @type {object}
 */
const EVERY = {has: () => true}

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
 * Whether a repository stands at a directory, which is what makes it a top:
 * the rules below it are its own and so is the index that outranks them.
 * @param {string} dir - Absolute path of the directory
 * @return {boolean} - True where one stands there
 */
const rooted = function(dir) {
  return fs.existsSync(path.join(dir, REPOSITORY))
}

/**
 * The highest directory a rule is read from: the nearest ancestor holding a
 * `.git`, or the directory itself where none does.
 * @param {string} start - Absolute path the walk begins at
 * @return {string} - Where the climb stops
 */
const toppedAt = function(start) {
  let top = start
  let dir = start
  let climbing = true
  while (climbing) {
    if (rooted(dir)) {
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
 * One path the index holds, and every directory standing over it up to the
 * top, since a walk reaches a tracked file only by descending to it.
 * @param {string} top - Where the climb stops
 * @param {string} name - The path, as the index spells it
 * @return {Array.<string>} - The path and its ancestors, absolute
 */
const below = function(top, name) {
  const paths = []
  let pth = path.join(top, name)
  while (pth.length > top.length) {
    paths.push(pth)
    pth = path.dirname(pth)
  }
  return paths
}

/**
 * What the index of one repository holds that its own ignore files name,
 * which is the one answer no reading of those files supplies; `EVERY` where
 * git stands over the tree and cannot say, so nothing is ignored at all.
 * @param {string} top - Where a repository stands, or a tree holding none
 * @return {object} - Every such path and the directories above it, or `EVERY`
 */
const trackedIn = function(top) {
  let paths = NOTHING
  if (rooted(top)) {
    try {
      paths = new Set(
        execFileSync('git', TRACKED, {
          cwd: top,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 30000,
          maxBuffer: 64 * 1024 * 1024,
          windowsHide: true,
        }).split('\0')
          .filter((name) => name !== '')
          .flatMap((name) => below(top, name)),
      )
    } catch {
      logger.debug(
        [
          'Git said nothing about the index of "%s",',
          'so no line of its own is read as ignoring anything',
        ].join(' '),
        top,
      )
      paths = EVERY
    }
  }
  return paths
}

/**
 * What one repository's index holds, asked of it once however many paths
 * below it are judged, and never at all where none of them is.
 * @param {string} top - Where the repository stands
 * @param {object} yard - What the tree answers, and what it has answered
 * @return {object} - Every path its own ignore files name that it tracks
 */
const indexed = function(top, yard) {
  if (!yard.indexes.has(top)) {
    yard.indexes.set(top, trackedIn(top))
  }
  return yard.indexes.get(top)
}

/**
 * The rules one directory's own ignore file holds, as the group they are
 * matched in: one relative name per group rather than one per rule.
 * @param {string} dir - Absolute path of the directory
 * @return {Array.<object>} - The group it holds, or nothing where it has none
 */
const grouped = function(dir) {
  let groups = []
  const rules = rulesOf(dir)
  if (rules.length > 0) {
    groups = [{base: dir, rules}]
  }
  return groups
}

/**
 * Every group standing over one directory, an outer file's in front of an
 * inner file's, beside the repository they belong to; remembered so that a
 * directory is read once however many paths below it are asked about.
 * @param {string} dir - Absolute path of a directory, at the top or below it
 * @param {object} yard - What the tree answers, and what it has answered
 * @return {{top: string, groups: Array.<object>}} - The stack over it
 */
const stacked = function(dir, yard) {
  if (!yard.rules.has(dir)) {
    let stack = {top: dir, groups: grouped(dir)}
    if (dir !== yard.top && !rooted(dir)) {
      const above = stacked(path.dirname(dir), yard)
      stack = {top: above.top, groups: above.groups.concat(grouped(dir))}
    }
    yard.rules.set(dir, stack)
  }
  return yard.rules.get(dir)
}

/**
 * Whether one rule names a path.
 * @param {object} rule - A rule, as `patterned` reads one
 * @param {string} name - The path, relative to the rule's own base
 * @param {boolean} directory - Whether the path is a directory
 * @return {boolean} - True where the rule names it
 */
const names = function(rule, name, directory) {
  return (directory || !rule.directory) && rule.glob.match(name)
}

/**
 * Whether the rules standing over a path deny it, the last one naming it
 * deciding.
 * @param {string} pth - Absolute path of a file or a directory
 * @param {boolean} directory - Whether the path is a directory
 * @param {object} yard - What the tree answers, and what it has answered
 * @return {boolean} - True where they deny it
 */
const denied = function(pth, directory, yard) {
  let ignored = false
  stacked(path.dirname(pth), yard).groups.forEach(function(group) {
    const name = slashed(pth, group.base)
    group.rules.forEach(function(rule) {
      if (names(rule, name, directory)) {
        ignored = !rule.negated
      }
    })
  })
  return ignored
}

/**
 * Whether the rules put a directory out of reach, which settles everything
 * below it: git re-includes nothing standing under a directory it excludes.
 * The walk's own start is never out of reach, a path named outright being
 * what the run was asked for.
 * @param {string} dir - Absolute path of a directory, at the start or below
 * @param {object} yard - What the tree answers, and what it has answered
 * @return {boolean} - True where it, or a directory above it, is denied
 */
const covered = function(dir, yard) {
  if (!yard.covers.has(dir)) {
    let ignored = false
    if (dir !== yard.start) {
      ignored = covered(path.dirname(dir), yard) || denied(dir, true, yard)
    }
    yard.covers.set(dir, ignored)
  }
  return yard.covers.get(dir)
}

/**
 * Whether the project ignores a path: never one the index of the repository
 * owning it holds, and otherwise whatever the rules say of it and of the
 * directories over it.
 * @param {string} pth - Absolute path of a file or a directory
 * @param {boolean} directory - Whether the path is a directory
 * @param {object} yard - What the tree answers, and what it has answered
 * @return {boolean} - True where the project ignores it
 */
const ignores = function(pth, directory, yard) {
  let ignored = false
  if (!indexed(stacked(path.dirname(pth), yard).top, yard).has(pth)) {
    if (directory) {
      ignored = covered(pth, yard)
    } else {
      ignored = covered(path.dirname(pth), yard) || denied(pth, false, yard)
    }
  }
  return ignored
}

/**
 * What the ignore files over a directory, and the index of every repository
 * standing over or under it, say about the paths below it.
 * @param {string} start - Absolute path the walk begins at
 * @return {object} - `directory(pth)` and `file(pth)`, each answering a
 *   boolean
 */
const ignoring = function(start) {
  if (!path.isAbsolute(start)) {
    throw new Error(`a walk starts at an absolute path, not "${start}"`)
  }
  const yard = {
    top: toppedAt(start),
    start,
    indexes: new Map(),
    rules: new Map(),
    covers: new Map(),
  }
  return {
    directory: (dir) => ignores(dir, true, yard),
    file: (file) => ignores(file, false, yard),
  }
}

module.exports = {ignoring}
