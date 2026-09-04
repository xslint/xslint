/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {ATTRIBUTES, PATTERNS} = require('../src/attributes')
const {kinds} = require('../src/resources/checks.json')
const {splitOf} = require('../src/selectors')
const {GAP} = require('../src/tokens')
const {
  ROOT, GUIDES, DOCUMENTS, DERIVED, LOADED, ROOM, NEARBY, carries, slashed,
  sized, worded, chained, loaded, indexed, noted, globbed,
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
 * Where a figure derived from what the guides weigh may stand: the documents,
 * and the module doing the weighing.
 * @type {Array.<string>}
 */
const MEASURED = DOCUMENTS.concat(['test/guides.js'])

/**
 * The most a day of ordinary work has added to the dearest chain since #823
 * gave that chain its room back, read over the 45 merges between then and #844.
 * A day is the unit because a relocation lands in about one, this tree taking
 * three to eight merges a day, so it is what a chain has to survive between
 * turning red and being answered.
 * @type {number}
 */
const GROWN = 5298

/**
 * The selectors a shared walk cannot serve as an axis, which is what
 * `UNINDEXED` in `test/conformance.test.js` lists and what a guide counts
 * beside that name. Read off the checks rather than off the table, the table
 * answering to the same checks one gate over, so prose, code and table are one
 * chain rather than two claims about each other.
 * @return {number} - How many of them there are
 */
const unindexed = function() {
  return Object.values(kinds.xpath).filter(
    (check) => splitOf(check.xpath).length === 0,
  ).length
}

/**
 * The XSLT elements one check's selector names, off the selector itself rather
 * than off a list written beside it, so prose counting them answers to what the
 * check reads. A union arm names a subset — the missing-attribute arm of this
 * one names fewer, `xsl:with-param` going to a check of its own — so what is
 * counted is the names the whole selector holds (#838).
 * @param {string} check - Name of the check, as its own YAML spells it
 * @return {number} - How many XSLT elements it names
 */
const elements = function(check) {
  return new Set(kinds.xpath[check].xpath.match(/xsl:[a-z-]+/g)).size
}

/**
 * Each list as a document may name it, paired with what it holds — a constant
 * of ours, or a check, whose list is the elements its own selector names.
 * `NAMED` is `ATTRIBUTES` as a set, so it counts to the same and answers to a
 * claim about either name.
 * @type {Map.<string, number>}
 */
const LENGTHS = new Map([
  ['ATTRIBUTES', ATTRIBUTES.length],
  ['PATTERNS', PATTERNS.length],
  ['NAMED', ATTRIBUTES.length],
  ['UNINDEXED', unindexed()],
  ['missing-or-empty-name', elements('missing-or-empty-name')],
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
  it('cannot come within reach of what a turn may load', function() {
    assert.deepEqual(
      GUIDES.filter((one) => loaded(one) > LOADED - ROOM).map(
        (one) => `${one} loads ${loaded(one)} in ${
          chained(one).map((each) => `${each} at ${sized(each)}`).join(' + ')}`,
      ),
      [],
      `cannot load a chain of guides within ${ROOM} characters of the ` +
        `${LOADED} the harness warns at, a turn touching a file loading the ` +
        'root guide and the guide of every directory over it — the bar ' +
        `stands at ${LOADED - ROOM} so that a derivation still has somewhere ` +
        'to go when it fires, what answers it being that derivation moving ' +
        'one directory further down, into the file-header note of the module ' +
        'it is about, and never a bar widened to fit what has grown past it',
    )
  })
  it('keeps room enough to answer a chain that has reached the bar', function() {
    assert.ok(
      ROOM >= GROWN * 1.5 && ROOM <= GROWN * 2,
      `cannot keep ${ROOM} characters under the bar against a dearest day ` +
        `of ${GROWN}: a margin under half again of it is one a single day of ` +
        'work crosses without warning, and one past twice it reddens a tree ' +
        'that has room to spare, both of which are a bar that has stopped ' +
        'being one',
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
  DERIVED.forEach((one) => {
    it(`states ${one.truth().join(' and ')} where the chain says so`,
      function() {
        assert.deepEqual(
          MEASURED.flatMap((file) => Array.from(
            worded(file).matchAll(one.claim),
            (hit) => `${file}: ${hit.slice(1).join(' and ')}`,
          )).filter(
            (said) => said.split(': ')[1] !== one.truth().join(' and '),
          ),
          [],
          `a figure derived from what the guides weigh says something the ` +
            `tree does not: ${one.truth().join(' and ')} is what the chain ` +
            'reads here, and the bar stays quiet until ' + LOADED +
            ', so nothing else catches this',
        )
      })
  })
  DERIVED.forEach((one) => {
    it(`reads ${one.truth().join(' and ')} in every file that states it`,
      function() {
        assert.deepEqual(
          MEASURED.filter((file) => carries(one.claim, worded(file))).sort(),
          one.carriers.slice().sort(),
          'the files carrying this figure are not the files it is watched ' +
            'in: a sentence reworded past the phrase drops out of the gate ' +
            'above while its figure stays wrong, and one written into a new ' +
            'document is watched nowhere — asking whether *some* file still ' +
            'matches would answer yes to both',
        )
      })
  })
  it('counts a list a document names against that very list', function() {
    const near = new RegExp(
      `(${[...LENGTHS.keys()].join('|')})(?=(.{0,${NEARBY}}))`, 'g',
    )
    const counted = new RegExp(
      `([a-z-]+)${GAP}+` +
        '(?:names|attributes|descendant scans|selectors|XSLT elements)',
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
