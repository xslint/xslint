/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/**
 * The defects a change introduced since a commit, judged by git rather than
 * by a baseline file (#1193). The commit is written out to a scratch tree and
 * linted, and `git diff` maps every line of the working tree to the line of
 * the commit it was. A defect is old only on a line the change left alone,
 * where the commit drew the same check; one on an added or edited line is new.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const {execFileSync} = require('child_process')
const {SEALED, slashed} = require('./helpers')

/**
 * The header of a hunk `git diff -U0` prints, its counts left out where one.
 * @type {RegExp}
 */
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/**
 * The variables a hook or the user exports that point git at another
 * repository, index, or diff than the one the directory holds.
 * @type {Array.<string>}
 */
const ELSEWHERE = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
  'GIT_DIFF_OPTS', 'GIT_EXTERNAL_DIFF',
]

/**
 * What git answers in a directory, or a failure naming what was asked and the
 * first line of why git refused.
 * @param {string} dir - Directory git runs in
 * @param {Array.<string>} args - What it is asked
 * @param {string} problem - The error a failure throws
 * @param {object} env - Variables set over the environment git inherits
 * @return {string} - What it printed
 */
const gitIn = function(dir, args, problem, env = {}) {
  let printed
  try {
    printed = execFileSync('git', args, {
      cwd: dir,
      env: Object.fromEntries(
        Object.entries(process.env)
          .filter(([name]) => !ELSEWHERE.includes(name))
          .concat(Object.entries(env)),
      ),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (error) {
    throw new Error(
      `${problem}: ${[error.stderr, error.message].join('\n').split('\n')
        .map((line) => line.trim()).find((line) => line.length > 0)}`
        .replace(/\.$/, ''),
      {cause: error},
    )
  }
  return printed
}

/**
 * Where each file of the working tree came from: the path it had in the
 * commit, and the hunks that changed it, read off `git diff -M -U0`.
 * @param {string} patch - What git printed
 * @return {Map.<string, {origin: string, hunks: Array.<object>}>} - Files
 *  by their path now, every one the diff leaves out standing where it stood
 */
const moved = function(patch) {
  const files = new Map()
  let entry = {hunks: []}
  for (const line of patch.split('\n')) {
    const hunk = HUNK.exec(line)
    const header = entry.hunks.length === 0
    if (line.startsWith('diff --git ')) {
      entry = {hunks: []}
    } else if (line.startsWith('rename from ')) {
      entry.origin = line.slice('rename from '.length)
    } else if (line.startsWith('rename to ')) {
      files.set(line.slice('rename to '.length), entry)
    } else if (header && line.startsWith('--- ')) {
      entry.origin = line.slice('--- '.length).replace(/^a\//, '')
        .replace(/\t$/, '')
    } else if (header && line.startsWith('+++ b/')) {
      files.set(line.slice('+++ b/'.length).replace(/\t$/, ''), entry)
    } else if (hunk) {
      entry.hunks.push({
        newStart: Number(hunk[3]),
        newCount: Number(hunk[4] ?? 1),
        shift: Number(hunk[4] ?? 1) - Number(hunk[2] ?? 1),
      })
    }
  }
  return files
}

/**
 * The line of the commit a line of the working tree was, or zero where the
 * change added or edited it.
 * @param {Array.<object>} hunks - What changed the file
 * @param {number} line - Line of the working tree
 * @return {number} - Line of the commit, or zero
 */
const originOf = function(hunks, line) {
  let shift = 0
  let touched = false
  for (const hunk of hunks) {
    let last = hunk.newStart
    if (hunk.newCount > 0) {
      last = hunk.newStart + hunk.newCount - 1
      touched ||= hunk.newStart <= line && line <= last
    }
    if (last < line) {
      shift += hunk.shift
    }
  }
  let origin = line - shift
  if (touched) {
    origin = 0
  }
  return origin
}

/**
 * The defects of the working tree the commit did not draw on the line each
 * stood on then, a count per line and check so a second defect is new.
 * @param {Array.<object>} drawn - Defects the working tree draws
 * @param {Array.<object>} earlier - Defects the commit drew
 * @param {Map.<string, object>} moves - What `moved` answered
 * @param {Map.<string, string>} named - Each linted file by its path in the
 *  repository
 * @param {string} tree - Directory the commit was written out to
 * @return {Array.<object>} - The defects the change introduced
 */
const introduced = function(drawn, earlier, moves, named, tree) {
  const counts = new Map()
  for (const defect of earlier) {
    const key = [slashed(defect.file, tree), defect.line, defect.name].join('\0')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return drawn.filter((defect) => {
    const file = named.get(defect.file)
    const move = moves.get(file) ?? {origin: file, hunks: []}
    const key = [move.origin, originOf(move.hunks, defect.line), defect.name]
      .join('\0')
    const left = counts.get(key) ?? 0
    counts.set(key, left - 1)
    return left < 1
  })
}

/**
 * Whether a path stands at or under a directory.
 * @param {string} pth - Absolute path
 * @param {string} dir - Absolute path of the directory
 * @return {boolean} - True where it does
 */
const within = function(pth, dir) {
  const rel = slashed(pth, dir)
  return rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel)
}

/**
 * A sheet's path with its directory resolved through every link, and its own
 * name kept, so a linked sheet is judged under the name the commit holds it by.
 * @param {string} file - Absolute path of the sheet
 * @return {string} - The path, resolved
 */
const resolved = function(file) {
  return path.join(
    fs.realpathSync.native(path.dirname(file)), path.basename(file),
  )
}

/**
 * Whether a file stands in a repository nested below the top, a submodule or
 * a checkout of its own, which judges its own sheets.
 * @param {string} file - Absolute path of the file, resolved
 * @param {string} root - Top of the repository
 * @return {boolean} - True where a `.git` stands between them
 */
const nested = function(file, root) {
  let inside = false
  let dir = path.dirname(file)
  while (dir.length > root.length) {
    inside ||= fs.existsSync(path.join(dir, '.git'))
    dir = path.dirname(dir)
  }
  return inside
}

/**
 * Whether a defect stands where the commit can judge it: outside a nested
 * repository, and on a sheet whose link, if any, leads to one the repository
 * holds outside such a repository.
 * @param {string} file - Absolute path of the sheet
 * @param {string} root - Top of the repository
 * @return {boolean} - True where the commit can judge it
 */
const judged = function(file, root) {
  const real = fs.realpathSync.native(file)
  return !nested(resolved(file), root) && within(real, root) &&
    !nested(real, root)
}

/**
 * The repository the named paths stand in, and each of them as git spells
 * the top: a directory resolved through every link, a sheet keeping its own
 * name as `resolved` keeps it.
 * @param {Array.<string>} pths - Absolute paths the run was named
 * @return {{root: string, under: Array.<string>}} - Its top, and the paths
 */
const rootOf = function(pths) {
  const under = pths.filter((pth) => fs.existsSync(pth)).map((pth) => {
    let spelled = resolved(pth)
    if (fs.statSync(pth).isDirectory()) {
      spelled = fs.realpathSync.native(pth)
    }
    return spelled
  })
  let [start] = under.concat([process.cwd()])
  if (!fs.statSync(start).isDirectory()) {
    start = path.dirname(start)
  }
  const root = fs.realpathSync.native(
    gitIn(
      start, ['rev-parse', '--show-toplevel'],
      `Option --since reads git, which finds no repository at ${start}`,
    ).trim(),
  )
  const outside = under.filter((pth) => !within(pth, root))
  if (outside.length > 0) {
    throw new Error(
      `Option --since judges one repository, and ${outside[0]} lies outside ${root}`,
    )
  }
  return {root, under}
}

/**
 * The defects a change introduced since the commit HEAD left a ref at: the
 * commit written out to a scratch tree that is removed again, its sheets
 * under the named paths linted there, and every defect judged against them.
 * @param {Array.<object>} drawn - Defects the working tree draws
 * @param {string} ref - What `--since` names
 * @param {Array.<string>} pths - Absolute paths the run was named
 * @param {string} base - Directory the exclusion globs resolve against
 * @param {Array.<string>} suffixes - What a sheet's name ends in
 * @param {function(Array.<string>, function(string): string): Array} linted
 *  - What the commit's sheets draw, given how each is spelled in the working
 *  tree
 * @return {Array.<object>} - The defects the change introduced
 */
const since = function(drawn, ref, pths, base, suffixes, linted) {
  const {root, under} = rootOf(pths)
  const commit = gitIn(
    root,
    [
      'merge-base', gitIn(
        root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`],
        `Option --since names ${ref}, which git does not resolve to a commit`,
      ).trim(), 'HEAD',
    ],
    `Option --since names ${ref}, which shares no commit with HEAD`,
  ).trim()
  const moves = moved(
    gitIn(
      root,
      [
        '-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff',
        '--no-textconv', '--text', '--inter-hunk-context=0', '--src-prefix=a/',
        '--dst-prefix=b/', '-M', '-U0', commit, '--',
      ].concat(suffixes.map((suffix) => `:(glob)**/*${suffix}`)),
      `Git could not diff ${root} against commit ${commit}`,
    ),
  )
  const named = (name) => under.some(
    (pth) => within(path.join(root, name), pth) &&
      !slashed(path.join(root, name), pth).split('/')
        .some((segment) => SEALED.includes(segment)),
  )
  const origins = new Set(
    [...moves].filter(([name]) => named(name)).map(([, move]) => move.origin),
  )
  const scratch = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-')),
  )
  const tree = path.join(scratch, 'tree')
  let introducing
  try {
    const env = {GIT_INDEX_FILE: path.join(scratch, 'index')}
    const problem = `Git could not write out commit ${commit} of ${root}`
    gitIn(root, ['read-tree', commit], problem, env)
    gitIn(
      root, ['checkout-index', '--all', '--force', `--prefix=${tree}/`],
      problem, env,
    )
    introducing = introduced(
      drawn.filter((defect) => judged(defect.file, root)),
      linted(
        gitIn(
          root, ['ls-tree', '-r', '-z', '--full-tree', '--name-only', commit],
          problem,
        ).split('\0')
          .filter((name) => origins.has(name) || named(name))
          .map((name) => path.join(tree, name))
          .filter((file) => fs.existsSync(file)),
        (file) => path.join(
          base,
          path.relative(
            fs.realpathSync.native(base),
            path.join(root, slashed(file, tree)),
          ),
        ),
      ),
      moves,
      new Map(
        drawn.map((defect) => [
          defect.file, slashed(resolved(defect.file), root),
        ]),
      ),
      tree,
    )
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true})
  }
  return introducing
}

module.exports = {moved, introduced, since}
