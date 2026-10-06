/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {gitted, repository, runXslint, xslintStreams} = require('./helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Directory the two states of the seeded repository live in.
 * @type {string}
 */
const SINCE = path.resolve(__dirname, 'resources', 'since')

/**
 * The flags that make git commit in a scratch repository whatever the
 * machine's own configuration asks for.
 * @type {Array.<string>}
 */
const IDENTITY = [
  '-c', 'user.name=xslint', '-c', 'user.email=xslint@example.com',
  '-c', 'commit.gpgsign=false',
]

/**
 * Every sheet of one state of the repository written into a directory, by
 * hand: a copy keeps the source's time on Windows, and git takes a sheet of
 * the same size and time for one it need not read.
 * @param {string} state - `before` or `after`
 * @param {string} yard - Directory they are copied into
 */
const seeded = function(state, yard) {
  fs.readdirSync(path.join(SINCE, state)).forEach(
    (name) => fs.writeFileSync(
      path.join(yard, name), fs.readFileSync(path.join(SINCE, state, name)),
    ),
  )
}

/**
 * One committed fixture written into a directory of the repository, which is
 * made first.
 * @param {string} name - Fixture under the since resources
 * @param {string} dir - Directory it is written into
 */
const placed = function(name, dir) {
  fs.mkdirSync(dir, {recursive: true})
  fs.writeFileSync(
    path.join(dir, path.basename(name)),
    fs.readFileSync(path.join(SINCE, name)),
  )
}

/**
 * A repository whose commit holds the `before` sheets, a repository of its
 * own in `vendor`, and a `node_modules` sheet calling `kept.xsl`, its working
 * tree changed to the `after` sheets, and its git config merging hunks and
 * diffing every sheet through a driver that drops its first line.
 * @return {string} - The directory of the repository
 */
const changed = function() {
  const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-'))
  seeded('before', yard)
  placed('nested/vendored.xsl', path.join(yard, 'vendor'))
  repository(path.join(yard, 'vendor'), ['.'])
  gitted(
    path.join(yard, 'vendor'),
    IDENTITY.concat(['commit', '--quiet', '-m', 'vendor']),
  )
  placed('sealed/caller.xsl', path.join(yard, 'node_modules', 'kit'))
  fs.writeFileSync(path.join(yard, '.gitattributes'), '*.xsl diff=shifted\npasted.xsl -diff\n')
  repository(yard, ['.'])
  gitted(yard, ['config', 'diff.interHunkContext', '5'])
  gitted(yard, ['config', 'diff.shifted.textconv', 'sed 1d'])
  gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
  gitted(yard, ['mv', 'moving.xsl', 'moved.xsl'])
  seeded('after', yard)
  return yard
}

/**
 * A scratch directory, made a repository with nothing committed where asked.
 * @param {boolean} init - Whether git is to init it
 * @return {string} - The directory
 */
const scratch = function(init) {
  const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-'))
  if (init) {
    gitted(yard, ['init', '--quiet'])
  }
  return yard
}

/**
 * A run `--since` refuses, and what its refusal says.
 * @type {Array.<{name: string, args: function(): Array, says: RegExp}>}
 */
const REFUSED = [
  {
    name: 'refuses a revision git does not know',
    args: () => ['--since', 'no-such-revision', scratch(true)],
    says: /no-such-revision/,
  },
  {
    name: 'refuses a path outside the repository',
    args: () => ['--since', 'HEAD', scratch(true), scratch(false)],
    says: /outside/,
  },
  {
    name: 'refuses a path with no repository, giving the reason git gives',
    args: () => ['--since', 'HEAD', scratch(false)],
    says: /not a git repository/,
  },
  {
    name: 'refuses to run with a baseline',
    args: () => ['--since', 'HEAD', '--baseline', 'xslint.json'],
    says: /cannot be used with/,
  },
]

describe('since', function() {
  it('reports only the defects the change introduced', function() {
    const yard = changed()
    assert.deepStrictEqual(
      JSON.parse(
        xslintStreams(
          [
            '--preset', 'all', '--only', 'short-names',
            '--only', 'unused-named-template', '--format', 'json',
            '--since', 'HEAD', yard,
          ],
          {
            GIT_DIR: path.join(yard, 'vendor', '.git'),
            GIT_DIFF_OPTS: '--unified=3',
          },
        ).stdout,
      ).map((defect) => [
        `${path.relative(yard, path.resolve(defect.file))}:${defect.line}`,
        defect.rule,
      ].join(' ')),
      [
        'edited.xsl:7 short-names',
        'fresh.xsl:7 short-names',
        'lib.xsl:7 unused-named-template',
        'pasted.xsl:7 short-names',
        'swapped.xsl:8 short-names',
      ],
      'reported a defect the commit drew too, or missed one the change added',
    )
  })
  it('judges the one sheet it is named', function() {
    const yard = changed()
    assert.deepStrictEqual(
      JSON.parse(
        xslintStreams([
          '--preset', 'all', '--only', 'short-names', '--format', 'json',
          '--since', 'HEAD', path.join(yard, 'moved.xsl'),
          path.join(yard, 'edited.xsl'),
        ]).stdout,
      ).map((defect) => path.relative(yard, path.resolve(defect.file))),
      ['edited.xsl'],
      'judged a named sheet against a commit it was not read from',
    )
  })
  it('calls old a defect of a sheet reached through a link', function() {
    if (process.platform === 'win32') {
      this.skip()
    }
    const yard = scratch(false)
    placed('before/edited.xsl', path.join(yard, 'shared'))
    fs.mkdirSync(path.join(yard, 'src'))
    fs.symlinkSync(
      path.join('..', 'shared', 'edited.xsl'),
      path.join(yard, 'src', 'edited.xsl'),
    )
    repository(yard, ['.'])
    gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
    assert.deepStrictEqual(
      JSON.parse(
        xslintStreams([
          '--preset', 'all', '--only', 'short-names', '--format', 'json',
          '--since', 'HEAD', path.join(yard, 'src'),
        ]).stdout,
      ),
      [],
      'judged a linked sheet by the name of the sheet it links to',
    )
  })
  REFUSED.forEach((row) => {
    it(row.name, function() {
      assert.match(
        runXslint(row.args()), row.says,
        `ran where --since cannot judge the change, as in ${row.name}`,
      )
    })
  })
})
