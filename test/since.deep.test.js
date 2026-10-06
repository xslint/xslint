/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {gitted, repository, runXslint, xslintStreams} = require('./helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {pathToFileURL} = require('url')
const {slashed} = require('../src/helpers')

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
 * A repository in a directory whose configuration excludes its `gen`: its
 * commit holds the `before` sheets, a nested repository, and a `node_modules`
 * and a `gen` sheet calling `kept.xsl`, its working tree the `after` sheets,
 * a branch off it edits `kept.xsl`, and its config merges hunks and diffs
 * sheets through a driver dropping a line, all but one marked binary.
 * @return {string} - The directory of the repository
 */
const changed = function() {
  const yard = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-')), 'repo',
  )
  fs.mkdirSync(yard)
  placed('workspace.yml', path.dirname(yard))
  seeded('before', yard)
  placed('nested/vendored.xsl', path.join(yard, 'vendor'))
  repository(path.join(yard, 'vendor'), ['.'])
  gitted(
    path.join(yard, 'vendor'),
    IDENTITY.concat(['commit', '--quiet', '-m', 'vendor']),
  )
  placed('sealed/caller.xsl', path.join(yard, 'node_modules', 'kit'))
  placed('sealed/caller.xsl', path.join(yard, 'gen'))
  fs.writeFileSync(
    path.join(yard, '.gitattributes'), '*.xsl diff=shifted\npasted.xsl -diff\n',
  )
  repository(yard, ['.'])
  gitted(yard, ['config', 'diff.interHunkContext', '5'])
  gitted(yard, ['config', 'diff.shifted.textconv', 'sed 1d'])
  gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
  gitted(yard, ['checkout', '--quiet', '-b', 'ahead'])
  seeded('ahead', yard)
  gitted(yard, IDENTITY.concat(['commit', '--quiet', '-am', 'ahead']))
  gitted(yard, ['checkout', '--quiet', '-'])
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
 * A clone one commit deep of a branch off a repository's first commit, with
 * the tip of the branch it left fetched one commit deep beside it, so the
 * clone holds no commit the two share.
 * @return {string} - The directory of the clone
 */
const shallow = function() {
  const yard = scratch(true)
  placed('before/kept.xsl', yard)
  repository(yard, ['.'])
  gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
  gitted(yard, ['branch', 'ahead'])
  gitted(
    yard, IDENTITY.concat(['commit', '--quiet', '--allow-empty', '-m', 'one']),
  )
  gitted(
    yard, IDENTITY.concat(['commit', '--quiet', '--allow-empty', '-m', 'two']),
  )
  gitted(yard, ['checkout', '--quiet', 'ahead'])
  gitted(
    yard, IDENTITY.concat(['commit', '--quiet', '--allow-empty', '-m', 'side']),
  )
  gitted(yard, ['checkout', '--quiet', '-'])
  const clone = scratch(false)
  gitted(
    clone,
    [
      'clone', '--quiet', '--depth', '1', '--branch', 'ahead',
      pathToFileURL(yard).href, '.',
    ],
  )
  gitted(clone, ['fetch', '--quiet', '--depth', '1', 'origin', 'HEAD:trunk'])
  return clone
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
    name: 'refuses a revision no history leads to, asking for a deeper fetch',
    args: () => ['--since', 'trunk', shallow()],
    says: /shallow/,
  },
  {
    name: 'refuses an empty revision',
    args: () => ['--since', '', scratch(true)],
    says: /which git does not resolve/,
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
            '--config', path.join(path.dirname(yard), 'workspace.yml'),
            '--since', 'ahead', yard,
          ],
          {
            GIT_DIR: path.join(yard, 'vendor', '.git'),
            GIT_DIFF_OPTS: '--unified=3',
            GIT_LITERAL_PATHSPECS: '1',
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
        'wrapped.xsl:7 short-names',
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
  it('judges a linked sheet by its own name, and not one linked out of the repository', function() {
    if (process.platform === 'win32') {
      this.skip()
    }
    const yard = path.join(scratch(false), 'repo')
    placed('before/edited.xsl', path.join(path.dirname(yard), 'common'))
    placed('before/edited.xsl', path.join(yard, 'shared'))
    placed('before/edited.xsl', path.join(yard, 'vendor'))
    repository(path.join(yard, 'vendor'), ['.'])
    gitted(
      path.join(yard, 'vendor'),
      IDENTITY.concat(['commit', '--quiet', '-m', 'vendor']),
    )
    fs.mkdirSync(path.join(yard, 'src'))
    fs.mkdirSync(path.join(yard, 'lib'))
    fs.symlinkSync(
      path.join('..', 'shared', 'edited.xsl'),
      path.join(yard, 'src', 'edited.xsl'),
    )
    fs.symlinkSync(
      path.join('..', 'shared', 'edited.xsl'),
      path.join(yard, 'lib', 'linked.xsl'),
    )
    fs.symlinkSync(
      path.join('..', '..', 'common', 'edited.xsl'),
      path.join(yard, 'lib', 'outer.xsl'),
    )
    fs.symlinkSync(
      path.join('..', 'vendor', 'edited.xsl'),
      path.join(yard, 'lib', 'vendored.xsl'),
    )
    repository(yard, ['.'])
    gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
    placed('after/edited.xsl', path.join(yard, 'shared'))
    assert.deepStrictEqual(
      JSON.parse(
        xslintStreams([
          '--preset', 'all', '--only', 'short-names', '--format', 'json',
          '--since', 'HEAD', path.join(yard, 'src', 'edited.xsl'),
          path.join(yard, 'lib'),
        ]).stdout,
      ).map(
        (defect) => `${slashed(path.resolve(defect.file), yard)}:${defect.line}`,
      ).sort(),
      ['lib/linked.xsl:7', 'src/edited.xsl:7'],
      'judged a linked sheet apart from the edits of its target, or by a commit that holds no target',
    )
  })
  it('logs what a run without it logs, and nothing of the commit', function() {
    const yard = scratch(true)
    placed(path.join('..', 'directives', 'unused.xsl'), yard)
    placed(path.join('..', 'entities', 'self-reaching.xsl'), yard)
    repository(yard, ['.'])
    gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
    const args = ['--only', 'short-names', '--only', 'no-such-check', yard]
    assert.deepStrictEqual(
      xslintStreams(['--since', 'HEAD'].concat(args)).stderr,
      xslintStreams(args).stderr,
      'logged the commit it judged by, its scratch copy, or a choice twice',
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
