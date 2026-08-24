/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {ATTRIBUTES, PATTERNS} = require('../src/attributes')
const {GAP} = require('../src/tokens')
const {
  ROOT, GUIDES, DOCUMENTS, LOADED, NEARBY, slashed, sized, worded, chained,
  loaded, indexed, noted, globbed,
} = require('./guides')
const path = require('path')
const assert = require('assert')

/**
 * The prose read whole, every count in it being a count of one of the two
 * lists: the module holding them. A number written beside a list is a fact that
 * rots — three places said `ATTRIBUTES` held nineteen names where it has held
 * twenty since #633, one of them wrong on the day the list grew (#654).
 * @type {Array.<string>}
 */
const PROSE = ['src/attributes.js']

/**
 * Each list as a document may name it, paired with what it holds. `NAMED` is
 * `ATTRIBUTES` as a set, so it counts to the same and answers to a claim about
 * either name.
 * @type {Map.<string, number>}
 */
const LENGTHS = new Map([
  ['ATTRIBUTES', ATTRIBUTES.length],
  ['PATTERNS', PATTERNS.length],
  ['NAMED', ATTRIBUTES.length],
])

/**
 * The words a count is spelled with, paired with what each counts to. A `Map`
 * and not an object, because membership is the whole of what is asked of it and
 * `'constructor' in {}` answers true: an object judges a claim about "the
 * constructor names" against `Object` itself rather than reading past a word
 * that is no number, so the prototype chain decides what the prose is about.
 * @type {Map.<string, number>}
 */
const NUMBERS = new Map([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two',
  'twenty-three',
].map((word, index) => [word, index + 1]))

describe('guides', function() {
  it('walks the tree for the guides standing beside the code', function() {
    assert.ok(
      GUIDES.length > 1,
      'cannot find a guide beside the code it is about, this walk having ' +
        `found ${GUIDES.join(', ')} and nothing else — the derivation behind ` +
        'a module lives in the CLAUDE.md of its own directory since #821, so ' +
        'a walk reaching only the root one leaves every claim in the others ' +
        'judged by nobody',
    )
  })
  it('cannot fill a turn with the guides one directory loads', function() {
    assert.deepEqual(
      GUIDES.filter((one) => loaded(one) > LOADED).map(
        (one) => `${one} loads ${loaded(one)} in ${
          chained(one).map((each) => `${each} at ${sized(each)}`).join(' + ')}`,
      ),
      [],
      `cannot load a chain of guides past the ${LOADED} characters the ` +
        'harness warns at, a turn touching a file loading the root guide and ' +
        'the guide of every directory over it — what answers this is the ' +
        'derivation moving one directory further down, into the docblocks of ' +
        'the module it is about, and never a bar widened to fit what has ' +
        'grown past it',
    )
  })
  it('names in its index only files the tree holds', function() {
    for (const row of indexed()) {
      assert.ok(
        allFilesFrom(path.join(ROOT, path.dirname(row)))
          .map(slashed).some((one) => globbed(row).test(one)),
        `the index names ${row}, which the tree holds nothing of — a path ` +
          'that has moved or gone takes its reader nowhere, and the index is ' +
          'the whole of what the root guide keeps in place of the notes',
      )
    }
  })
  it('names every module of src somewhere in its index', function() {
    const rows = indexed()
    assert.deepEqual(
      allFilesFrom(path.join(ROOT, 'src')).map(slashed)
        .filter((one) => /\.m?js$/.test(one))
        .filter((one) => !rows.some((row) => globbed(row).test(one))),
      [],
      'cannot leave a module out of the index, one line naming what it is ' +
        'being the whole of what the root guide says about it — a module ' +
        'named nowhere is one a reader meets first in the code',
    )
  })
  it('holds every note a guide carries to a row of the index', function() {
    const rows = indexed()
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !rows.some((row) => globbed(row).test(one))),
        [],
        `${guide} notes a file the index does not name — the two are one map, ` +
          'so a note reachable only by opening the guide it sits in is a ' +
          'derivation the root has stopped pointing at',
      )
    }
  })
  it('cannot note a file the guide does not stand above', function() {
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !one.startsWith(`${path.dirname(guide)}/`)),
        [],
        `${guide} notes a file outside its own directory, where a reader ` +
          'opening that file loads some other guide — a note arrives with ' +
          'the directory it sits in, so it goes where its own code goes',
      )
    }
  })
  it('counts the attribute lists as long as they are, where it counts them', function() {
    const claimed = new RegExp(
      `(?:the|those|these|its|of)${GAP}+([a-z-]+)${GAP}+` +
      `(?:names|attributes|descendant scans)`, 'g',
    )
    const lengths = new Set(LENGTHS.values())
    for (const file of PROSE) {
      for (const [claim, word] of worded(file).matchAll(claimed)) {
        if (NUMBERS.has(word)) {
          assert.ok(
            lengths.has(NUMBERS.get(word)),
            `${file} says "${claim}", and neither ATTRIBUTES nor PATTERNS ` +
              `holds ${NUMBERS.get(word)} — say what the list holds, or make ` +
              'the claim about something a reader can count',
          )
        }
      }
    }
  })
  it('counts a list a document names against that very list', function() {
    const near = new RegExp(
      `(${[...LENGTHS.keys()].join('|')})(?=(.{0,${NEARBY}}))`, 'g',
    )
    const counted = new RegExp(
      `([a-z-]+)${GAP}+(?:names|attributes|descendant scans)`,
    )
    for (const file of DOCUMENTS) {
      for (const [, list, after] of worded(file).matchAll(near)) {
        const claim = after.match(counted)
        if (claim && NUMBERS.has(claim[1])) {
          assert.equal(
            NUMBERS.get(claim[1]), LENGTHS.get(list),
            `${file} names ${list} and calls it "${claim[0]}", where it holds ` +
              `${LENGTHS.get(list)} — the count beside a list is the one thing ` +
              'a reader takes on trust, so it answers to the list',
          )
        }
      }
    }
  })
})
