/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {moved, introduced} = require('../src/since')
const {slashed} = require('../src/helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

/**
 * Directory the working tree of the change stands in.
 * @type {string}
 */
const ROOT = path.resolve('/head')

/**
 * Directory the commit the change is judged against was written out to.
 * @type {string}
 */
const TREE = path.resolve('/base')

/**
 * What git answers for a change that renames, deletes, grows, shrinks, and
 * adds files, as `git diff -M -U0` prints it.
 * @return {Map.<string, object>} - Where each changed line came from
 */
const moves = function() {
  return moved(
    fs.readFileSync(
      path.resolve(__dirname, 'resources', 'since', 'changed.txt'), 'utf-8',
    ),
  )
}

/**
 * A defect of one check on one line of a file in a tree.
 * @param {string} tree - Directory of the tree
 * @param {string} file - Path of the file under it
 * @param {number} line - Line the defect stands on
 * @param {string} name - Check that drew it
 * @return {object} - The defect, as a run reports it
 */
const drawn = function(tree, file, line, name) {
  return {file: path.join(tree, file), line: line, column: 1, name: name}
}

/**
 * What the change keeps of the defects it draws, against what the commit drew.
 * @param {Array.<object>} head - Defects the working tree draws
 * @param {Array.<object>} base - Defects the commit drew
 * @param {object} links - The sheet each linked file leads to, by its name
 * @return {Array.<object>} - The ones the change introduced
 */
const kept = function(head, base, links = {}) {
  return introduced(
    head, base, moves(),
    new Map(
      head.map((defect) => [
        defect.file,
        {
          name: slashed(defect.file, ROOT),
          real: links[slashed(defect.file, ROOT)] ?? slashed(defect.file, ROOT),
        },
      ]),
    ),
    TREE,
  )
}

/**
 * One defect the working tree draws, the one the commit drew, and whether the
 * change introduced it.
 * @type {Array.<{name: string, head: Array, base: Array, fresh: boolean,
 *  links: (object|undefined)}>}
 */
const JUDGED = [
  {
    name: 'calls old a defect a line added above moved down',
    head: ['grown.txt', 2, 'short-names'],
    base: ['grown.txt', 1, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls new a defect on a line the change edited',
    head: ['grown.txt', 4, 'short-names'],
    base: ['grown.txt', 3, 'short-names'],
    fresh: true,
  },
  {
    name: 'calls new a defect on a line the change added',
    head: ['grown.txt', 1, 'short-names'],
    base: ['grown.txt', 1, 'short-names'],
    fresh: true,
  },
  {
    name: 'calls old a defect a deletion above moved up',
    head: ['carried.txt', 2, 'short-names'],
    base: ['shrunk.txt', 4, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls old a defect of a sheet renamed and edited elsewhere',
    head: ['moved.txt', 8, 'short-names'],
    base: ['renamed.txt', 8, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls old a defect of a sheet renamed whole',
    head: ['carried/still.txt', 3, 'short-names'],
    base: ['still.txt', 3, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls new a defect of a file the change added',
    head: ['added.txt', 1, 'short-names'],
    base: ['added.txt', 1, 'short-names'],
    fresh: true,
  },
  {
    name: 'calls old a defect of a file the change leaves alone',
    head: ['other.txt', 3, 'short-names'],
    base: ['other.txt', 3, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls new a defect its untouched line did not draw before',
    head: ['other.txt', 3, 'short-names'],
    base: ['other.txt', 3, 'unused-variable'],
    fresh: true,
  },
  {
    name: 'calls new a defect whose line the commit held elsewhere',
    head: ['other.txt', 3, 'short-names'],
    base: ['other.txt', 4, 'short-names'],
    fresh: true,
  },
  {
    name: 'reads a deleted line spelled like a header as a deleted line',
    head: ['dashed.txt', 2, 'short-names'],
    base: ['dashed.txt', 3, 'short-names'],
    fresh: false,
  },
  {
    name: 'reads an added line spelled like a header as an added line',
    head: ['x', 3, 'short-names'],
    base: ['x', 3, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls old a defect a line added above moved down in a spaced name',
    head: ['my sheet.txt', 5, 'short-names'],
    base: ['my sheet.txt', 4, 'short-names'],
    fresh: false,
  },
  {
    name: 'calls new a defect on a line the change edited in a spaced name',
    head: ['my sheet.txt', 4, 'short-names'],
    base: ['my sheet.txt', 3, 'short-names'],
    fresh: true,
  },
  {
    name: 'calls old a defect a line added above its target moved down',
    head: ['linked.txt', 2, 'short-names'],
    base: ['linked.txt', 1, 'short-names'],
    fresh: false,
    links: {'linked.txt': 'grown.txt'},
  },
  {
    name: 'calls new a defect on a line the change edited in its target',
    head: ['linked.txt', 4, 'short-names'],
    base: ['linked.txt', 3, 'short-names'],
    fresh: true,
    links: {'linked.txt': 'grown.txt'},
  },
]

describe('since', function() {
  JUDGED.forEach((row) => {
    it(row.name, function() {
      const head = drawn(ROOT, ...row.head)
      assert.strictEqual(
        kept([head], [drawn(TREE, ...row.base)], row.links)
          .includes(head),
        row.fresh,
        `misjudged whether the change introduced the defect at ${row.head.join(':')}`,
      )
    })
  })
  it('calls new a second defect where the commit drew one', function() {
    assert.strictEqual(
      kept(
        [
          drawn(ROOT, 'other.txt', 3, 'short-names'),
          drawn(ROOT, 'other.txt', 3, 'short-names'),
        ],
        [drawn(TREE, 'other.txt', 3, 'short-names')],
      ).length,
      1,
      'did not count the defects one untouched line drew against the commit',
    )
  })
})
