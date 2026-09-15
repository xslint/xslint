/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {ignoring} = require('../src/gitignore')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * What the ignore files a tree carries say about one path. Each row writes
 * the files it names into a yard of its own, asks `ignoring` about `ask` as a
 * file or as a directory, and pins the answer (#929).
 * @type {Array.<{name: string, files: object, from: string, ask: string,
 *   kind: string, ignored: boolean}>}
 */
const IGNORING = [
  {
    name: 'ignores a directory a trailing slash names',
    files: {'.gitignore': 'build/\n'},
    ask: 'build',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'keeps a file whose name a trailing slash reserves for a directory',
    files: {'.gitignore': 'build/\n'},
    ask: 'build',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'ignores a directory of that name at any depth',
    files: {'.gitignore': 'build/\n'},
    ask: 'one/two/build',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'ignores a name the leading slash anchors where it stands',
    files: {'.gitignore': '/target\n'},
    ask: 'target',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'keeps a name the leading slash anchors above where it stands',
    files: {'.gitignore': '/target\n'},
    ask: 'one/target',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'ignores an unanchored name wherever it stands',
    files: {'.gitignore': 'target\n'},
    ask: 'one/target',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'anchors a name a slash of its own stands inside',
    files: {'.gitignore': 'doc/gen\n'},
    ask: 'doc/gen',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'keeps a path deeper than the slash inside the name anchors it',
    files: {'.gitignore': 'doc/gen\n'},
    ask: 'one/doc/gen',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'ignores a file a suffix names',
    files: {'.gitignore': '*.gen.xsl\n'},
    ask: 'one/two/sheet.gen.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'ignores what a double star reaches over any depth',
    files: {'.gitignore': 'one/**/sheet.xsl\n'},
    ask: 'one/two/three/sheet.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'ignores a name opening with a dot',
    files: {'.gitignore': '.hidden/\n'},
    ask: '.hidden',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'keeps what a later negation takes back',
    files: {'.gitignore': '*.xsl\n!keep.xsl\n'},
    ask: 'keep.xsl',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'ignores what stands beside the name a negation takes back',
    files: {'.gitignore': '*.xsl\n!keep.xsl\n'},
    ask: 'other.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'reads the last rule matching a path and not the first',
    files: {'.gitignore': '!keep.xsl\n*.xsl\n'},
    ask: 'keep.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'names nothing in a line a hash opens',
    files: {'.gitignore': '#build\n'},
    ask: 'build',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'reads a hash a backslash escapes as the character it spells',
    files: {'.gitignore': '\\#build\n'},
    ask: '#build',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'names nothing in a blank line',
    files: {'.gitignore': '\n\nbuild\n'},
    ask: 'other',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'drops the gap standing behind a name',
    files: {'.gitignore': 'build  \n'},
    ask: 'build',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'drops the carriage return a windows line ending leaves behind',
    files: {'.gitignore': 'build\r\n'},
    ask: 'build',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'reads a brace as the character it spells',
    files: {'.gitignore': '{one,two}\n'},
    ask: 'one',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'ignores the name a brace spells outright',
    files: {'.gitignore': '{one,two}\n'},
    ask: '{one,two}',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'reads a plus in front of a bracket as the character it spells',
    files: {'.gitignore': 'one+(two)\n'},
    ask: 'onetwotwo',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'keeps every path where the tree names no ignore file at all',
    files: {},
    ask: 'build',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'reads an ignore file standing deeper than the one above it',
    files: {'.gitignore': '*.xsl\n', 'one/.gitignore': '!keep.xsl\n'},
    ask: 'one/keep.xsl',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'leaves a deeper ignore file unread above the directory it sits in',
    files: {'.gitignore': '*.xsl\n', 'one/.gitignore': '!keep.xsl\n'},
    ask: 'keep.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'anchors a rule at the directory its own ignore file sits in',
    files: {'one/.gitignore': '/sheet.xsl\n'},
    ask: 'one/sheet.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'reads an ignore file above the directory a walk starts at',
    files: {'.gitignore': '*.gen.xsl\n', '.git/HEAD': 'ref: refs/heads/master'},
    from: 'one',
    ask: 'sheet.gen.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'climbs no higher than the repository a walk starts inside',
    files: {
      '.gitignore': '*.gen.xsl\n',
      'one/.git/HEAD': 'ref: refs/heads/master',
    },
    from: 'one',
    ask: 'sheet.gen.xsl',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'reads nothing above a directory no repository stands over',
    files: {'.gitignore': '*.gen.xsl\n'},
    from: 'one',
    ask: 'sheet.gen.xsl',
    kind: 'file',
    ignored: false,
  },
]

/**
 * Writes the files a row names into a yard of its own.
 * @param {object} files - Each path under the yard, and what stands in it
 * @param {string} yard - The directory they are written under
 * @return {undefined} - Nothing
 */
const seeded = function(files, yard) {
  return Object.entries(files).forEach(function(entry) {
    const file = path.join(yard, entry[0])
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, entry[1])
  })
}

describe('gitignore', function() {
  IGNORING.forEach(function(row) {
    it(row.name, function() {
      const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-ignore-'))
      seeded(row.files, yard)
      const from = path.join(yard, row.from ?? '.')
      fs.mkdirSync(from, {recursive: true})
      const ignored = ignoring(from)[row.kind](path.join(from, row.ask))
      fs.rmSync(yard, {recursive: true, force: true})
      assert.equal(
        ignored,
        row.ignored,
        `"${row.name}" does not hold for ${row.ask} (#929)`,
      )
    })
  })
  it('answers about one directory as often as it is asked', function() {
    const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-ignore-'))
    seeded({'.gitignore': 'build/\n'}, yard)
    const ignores = ignoring(yard)
    const answers = [
      ignores.directory(path.join(yard, 'one', 'build')),
      ignores.directory(path.join(yard, 'one', 'build')),
      ignores.directory(path.join(yard, 'one', 'kept')),
    ]
    fs.rmSync(yard, {recursive: true, force: true})
    assert.deepEqual(
      answers,
      [true, true, false],
      'a rule read once answers differently the second time (#929)',
    )
  })
})
