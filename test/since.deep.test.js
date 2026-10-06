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
 * Every sheet of one state of the repository copied into a directory.
 * @param {string} state - `before` or `after`
 * @param {string} yard - Directory they are copied into
 */
const seeded = function(state, yard) {
  fs.readdirSync(path.join(SINCE, state)).forEach(
    (name) => fs.copyFileSync(
      path.join(SINCE, state, name), path.join(yard, name),
    ),
  )
}

/**
 * A repository whose one commit holds the `before` sheets, its working tree
 * changed to the `after` ones: `moving.xsl` renamed, `fresh.xsl` left
 * untracked, and the call to the template of `lib.xsl` taken out of
 * `main.xsl`.
 * @return {string} - The directory of the repository
 */
const changed = function() {
  const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-'))
  seeded('before', yard)
  repository(yard, ['.'])
  gitted(yard, IDENTITY.concat(['commit', '--quiet', '-m', 'base']))
  gitted(yard, ['mv', 'moving.xsl', 'moved.xsl'])
  seeded('after', yard)
  return yard
}

describe('since', function() {
  it('reports only the defects the change introduced', function() {
    const yard = changed()
    assert.deepStrictEqual(
      JSON.parse(
        xslintStreams([
          '--preset', 'all', '--only', 'short-names',
          '--only', 'unused-named-template', '--format', 'json',
          '--since', 'HEAD', yard,
        ]).stdout,
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
  it('refuses a revision git does not know', function() {
    assert.match(
      runXslint(['--since', 'no-such-revision', changed()]),
      /no-such-revision/,
      'ran against a revision git cannot resolve to a commit',
    )
  })
  it('refuses a path outside the repository', function() {
    assert.match(
      runXslint([
        '--since', 'HEAD', changed(),
        fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-since-')),
      ]),
      /outside/,
      'judged a path the repository does not hold against its commit',
    )
  })
  it('refuses to run with a baseline', function() {
    assert.match(
      runXslint(['--since', 'HEAD', '--baseline', 'xslint.json', changed()]),
      /cannot be used with/,
      'ran a change against both its commit and a baseline',
    )
  })
})
