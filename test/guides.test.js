/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The guides themselves, the one gate whose subject is this repository's own
 * documentation: `CLAUDE.md` as nothing but the import of `AGENTS.md`, no guide
 * below the root, each guide within its cap, the index held to the tree from
 * both sides, and the counts a guide states of a list held to that list
 * (#825, #895, #1168).
 */

const {allFilesFrom} = require('../src/helpers')
const {ATTRIBUTES, PATTERNS} = require('../src/attributes')
const {kinds} = require('../src/resources/checks.json')
const {splitOf} = require('../src/selectors')
const {GAP} = require('../src/tokens')
const {
  ROOT, NESTED, CAPS, IMPORTED, DOCUMENTS, NEARBY, slashed,
  worded, indexed, globbed,
} = require('./guides')
const path = require('path')
const fs = require('fs')
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
 * The words a unit and a teen are spelled with, in the order they count.
 * @type {Array.<string>}
 */
const UNITS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]

/**
 * The words a ten is spelled with, which is where the vocabulary used to stop
 * short: it reached twenty-three, so the one claim in the tree counting checks
 * rather than list entries — sixty-eight of them — was read as a word that is
 * no number and asserted against nothing (#895).
 * @type {Array.<string>}
 */
const TENS = [
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]

/**
 * The words a count is spelled with, paired with what each counts to, from
 * none to ninety-nine. A `Map` and not an object, because membership is the
 * whole of what is asked of it and `'constructor' in {}` answers true: an
 * object reads the prototype chain where the prose says "the constructor
 * names", so a word that is no number decides what a claim is about.
 * @type {Map.<string, number>}
 */
const NUMBERS = new Map([['no', 0]].concat(
  UNITS.map((word, index) => [word, index + 1]),
  TENS.flatMap((ten, index) => [[ten, (index + 2) * 10]].concat(
    UNITS.slice(0, 9).map(
      (unit, over) => [`${ten}-${unit}`, (index + 2) * 10 + over + 1],
    ),
  )),
))

describe('guides', function() {
  it('holds nothing in CLAUDE.md but the import of AGENTS.md', function() {
    assert.equal(
      fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8'),
      IMPORTED,
      [
        'CLAUDE.md holds more than the import of AGENTS.md, so a Claude Code',
        'session reads a rule no other agent sees — a rule goes in AGENTS.md',
      ].join(' '),
    )
  })
  it('stands no guide below the root', function() {
    assert.deepEqual(
      NESTED,
      [],
      [
        'cannot keep a guide below the root, what is true of one module being',
        'the note that module opens with and the map being ARCHITECTURE.md',
      ].join(' '),
    )
  })
  it('keeps every guide within its cap', function() {
    assert.deepEqual(
      [...CAPS].filter(
        ([named, cap]) => fs.readFileSync(path.join(ROOT, named), 'utf-8')
          .split('\n').length - 1 > cap,
      ).map(([named, cap]) => `${named} past ${cap} lines`),
      [],
      [
        'a guide stands past its cap, and what answers it is history cut to',
        'the ticket that holds it, never a cap widened to fit',
      ].join(' '),
    )
  })
  it('names in its index only files the tree holds', function() {
    for (const row of indexed()) {
      assert.ok(
        allFilesFrom(path.join(ROOT, path.dirname(row)))
          .map(slashed).some((one) => globbed(row).test(one)),
        [
          `the index names ${row}, which the tree holds nothing of — a path`,
          'that has moved or gone takes its reader nowhere, and the index is',
          'the whole of what the map keeps in place of the notes',
        ].join(' '),
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
      [
        'cannot leave a module out of the index, one line naming what it is',
        'being the whole of what the map says about it — a module',
        'named nowhere is one a reader meets first in the code',
      ].join(' '),
    )
  })
  it('counts the attribute lists as long as they are, where it counts them', function() {
    const claimed = new RegExp(
      [
        `(?:the|those|these|its|of)${GAP}+([a-z-]+)${GAP}+`,
        `(?:names|attributes|descendant scans)`,
      ].join(''), 'g',
    )
    const lengths = new Set(LENGTHS.values())
    for (const file of PROSE) {
      for (const [claim, word] of worded(file).matchAll(claimed)) {
        if (NUMBERS.has(word)) {
          assert.ok(
            lengths.has(NUMBERS.get(word)),
            [
              `${file} says "${claim}", and neither ATTRIBUTES nor PATTERNS`,
              `holds ${NUMBERS.get(word)} — say what the list holds, or make`,
              'the claim about something a reader can count',
            ].join(' '),
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
      [
        `([a-z-]+)${GAP}+`,
        '(?:names|attributes|descendant scans|selectors|XSLT elements|checks)',
      ].join(''),
    )
    for (const file of DOCUMENTS) {
      for (const [, list, after] of worded(file).matchAll(near)) {
        const claim = after.match(counted)
        if (claim && NUMBERS.has(claim[1])) {
          assert.equal(
            NUMBERS.get(claim[1]), LENGTHS.get(list),
            [
              `${file} names ${list} and calls it "${claim[0]}", where it holds`,
              `${LENGTHS.get(list)} — the count beside a list is the one thing`,
              'a reader takes on trust, so it answers to the list',
            ].join(' '),
          )
        }
      }
    }
  })
})
