/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The figures the README states of this repository, held to what the tree
 * reads off the committed corpus reports and off `checks.json`. Nothing
 * weighed them before, and the four in the Proven section drifted between
 * two-fold and twelve-fold under eighteen green jobs (#896). `npx grunt
 * readme` is the rewrite and this file the refusal, a figure refreshed only
 * at a release standing wrong for the whole cycle behind it. Every figure
 * agrees with the tree, is found in the README exactly once, since a pattern
 * matching nothing enforces nothing, and names a check the tree still holds.
 * The prose is the anchor and the digits the capture, so rewording a sentence
 * around a figure reddens while a reflow of the paragraph does not.
 */

const {
  FIGURES, NAMED, README, generate, rendered, spelled, verdict,
} = require('../scripts/readme')
const {kinds} = require('../src/resources/checks.json')
const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

/**
 * The README as the tree holds it.
 * @return {string} - Its whole text
 */
const document = function() {
  return fs.readFileSync(README, 'utf-8')
}

/**
 * Every check the tree holds, of whichever kind, since a figure may name one
 * of any and the kinds are the loader's business rather than this file's.
 * @return {Array.<string>} - The names
 */
const held = function() {
  return Object.values(kinds).flatMap((kind) => Object.keys(kind))
}

/**
 * How often a figure's own pattern finds it in a document.
 * @param {RegExp} pattern - The figure's pattern
 * @param {string} text - The document
 * @return {number} - How many times it matches
 */
const times = function(pattern, text) {
  return (text.match(new RegExp(pattern.source, 'g')) ?? []).length
}

/**
 * How a number reads once a hand has moved it, which is the whole of the
 * fault: the figure the README carried while the reports held five times it.
 * @type {string}
 */
const MOVED = '1,974'

describe('readme', function() {
  it('states every figure as the tree reads it', function() {
    assert.equal(
      verdict(document()),
      '',
      [
        'the README states a figure of this repository that nothing in the',
        'tree reads, which is how four numbers in one sentence came to be',
        'understated between two-fold and twelve-fold under eighteen green',
        'jobs (#896)',
      ].join(' '),
    )
  })
  it('finds every figure in the README exactly once', function() {
    assert.deepEqual(
      FIGURES
        .filter((figure) => times(figure.pattern, document()) !== 1)
        .map((figure) => figure.what),
      [],
      [
        'a figure is anchored on prose the README no longer holds, or holds',
        'twice, so the gate beside this one is judging nothing where it',
        'reads nothing and cannot say which of two it kept',
      ].join(' '),
    )
  })
  it('names only checks the tree still holds', function() {
    assert.deepEqual(
      Object.keys(NAMED).filter((name) => !held().includes(name)),
      [],
      [
        'a figure names a check this tree does not hold, so it counts the',
        'defects of a renamed check and reads as one that has stopped firing',
      ].join(' '),
    )
  })
  it('restates a figure a hand has moved', function() {
    assert.equal(
      rendered(document().replace(spelled(FIGURES[0].reads), MOVED)),
      document(),
      [
        'a figure moved by hand is not written back from the tree, so the',
        'task that is meant to end this drift cannot correct it',
      ].join(' '),
    )
  })
  it('says which figure the README has stopped stating', function() {
    assert.match(
      verdict(document().replace(/\*\*[0-9,]+ findings/, '**many findings')),
      /no longer holds the sentence stating it/,
      [
        'a figure whose prose is gone reads as a number somebody mistyped,',
        'where the two want different hands: one is a reflow and the other',
        'is the task',
      ].join(' '),
    )
  })
  it('writes the figures into the file it is handed', function() {
    const copy = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-readme-')), 'README.md',
    )
    fs.writeFileSync(
      copy, document().replace(spelled(FIGURES[0].reads), MOVED),
    )
    generate(copy)
    assert.equal(
      fs.readFileSync(copy, 'utf-8'),
      document(),
      [
        'the task rewrites something other than the figures the tree reads,',
        'so running it either leaves the drift or writes a document nobody',
        'asked for',
      ].join(' '),
    )
  })
  it('groups a number the way the README writes one', function() {
    assert.deepEqual(
      [0, 43, 867, 1000, 10488, 1234567].map(spelled),
      ['0', '43', '867', '1,000', '10,488', '1,234,567'],
      [
        'a figure is written in a grouping the README does not use, so the',
        'task rewrites a number that was already right',
      ].join(' '),
    )
  })
})
