/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {ignoring} = require('../src/gitignore')
const {repository} = require('./helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * What a repository standing over a tree says about one path, which its
 * ignore files alone cannot: the index outranks them, so a stylesheet git
 * tracks is walked however a rule names it (#929).
 * @type {Array.<{name: string, files: object, tracked: Array.<string>,
 *   repo: string, from: string, ask: string, kind: string, ignored: boolean}>}
 */
const TRACKING = [
  {
    name: 'keeps a stylesheet the index holds though a rule names it',
    files: {'.gitignore': 'reports/\n', 'reports/kept.xsl': ''},
    tracked: ['reports/kept.xsl'],
    ask: 'reports/kept.xsl',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'opens a directory a rule names to reach what the index holds',
    files: {'.gitignore': 'reports/\n', 'reports/kept.xsl': ''},
    tracked: ['reports/kept.xsl'],
    ask: 'reports',
    kind: 'directory',
    ignored: false,
  },
  {
    name: 'ignores what stands beside the stylesheet the index holds',
    files: {
      '.gitignore': 'reports/\n',
      'reports/kept.xsl': '',
      'reports/stray.xsl': '',
    },
    tracked: ['reports/kept.xsl'],
    ask: 'reports/stray.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'ignores a directory holding nothing the index knows of',
    files: {'.gitignore': 'reports/\n', 'reports/stray.xsl': ''},
    tracked: ['.gitignore'],
    ask: 'reports',
    kind: 'directory',
    ignored: true,
  },
  {
    name: 'reads an ignore file above the directory a walk starts at',
    files: {'.gitignore': '*.gen.xsl\n'},
    tracked: ['.gitignore'],
    from: 'one',
    ask: 'sheet.gen.xsl',
    kind: 'file',
    ignored: true,
  },
  {
    name: 'climbs no higher than the repository a walk starts inside',
    files: {'.gitignore': '*.gen.xsl\n', 'one/sheet.xsl': ''},
    tracked: ['sheet.xsl'],
    repo: 'one',
    from: 'one',
    ask: 'sheet.gen.xsl',
    kind: 'file',
    ignored: false,
  },
  {
    name: 'ignores nothing where a repository stands that git cannot read',
    files: {'.gitignore': '*.gen.xsl\n', '.git/HEAD': 'ref: refs/heads/one'},
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
  TRACKING.forEach(function(row) {
    it(row.name, function() {
      const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-index-'))
      seeded(row.files, yard)
      const from = path.join(yard, row.from ?? '.')
      fs.mkdirSync(from, {recursive: true})
      let made = true
      if (row.tracked !== undefined) {
        made = repository(path.join(yard, row.repo ?? '.'), row.tracked)
      }
      let ignored = row.ignored
      if (made) {
        ignored = ignoring(from)[row.kind](path.join(from, row.ask))
      }
      fs.rmSync(yard, {recursive: true, force: true})
      if (!made) {
        this.skip()
      }
      assert.equal(
        ignored,
        row.ignored,
        `"${row.name}" does not hold for ${row.ask} (#929)`,
      )
    })
  })
})
