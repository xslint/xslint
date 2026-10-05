/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The size and the shape of the guides themselves (#821). A turn loads a
 * chain, the root guide with what it imports and the guide of every directory
 * down to the file it touches, so the dearest chain is weighed against
 * `LOADED` less `ROOM` (#844) and what a turn starts with against `BRIEF`, the
 * map standing in `ARCHITECTURE.md` instead (#1168). What answers a bar is a
 * derivation cut to its ticket, never a bar widened to fit (#1147). The index
 * answers to the tree from both sides, a note answers to the index and to its
 * own directory, and the counts a document states of a list in the code are
 * held to that list (#825, #895).
 */

const {allFilesFrom} = require('../src/helpers')
const {ATTRIBUTES, PATTERNS} = require('../src/attributes')
const {kinds} = require('../src/resources/checks.json')
const {splitOf} = require('../src/selectors')
const {GAP} = require('../src/tokens')
const {
  ROOT, ENTRY, ARCHITECTURE, GUIDES, DOCUMENTS, LOADED, BRIEF, ROOM, NEARBY,
  slashed, sized, lined, worded, imports, chained, loaded, indexed, noted,
  globbed,
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
 * The most a day of ordinary work has added to the dearest chain since #823
 * gave that chain its room back, read over the 45 merges between then and #844.
 * A day is the unit because a relocation lands in about one, this tree taking
 * three to eight merges a day, so it is what a chain has to survive between
 * turning red and being answered.
 * @type {number}
 */
const GROWN = 5298

/**
 * The file the rules stand in, which the root guide imports and every other
 * agent reads of its own accord (#1168).
 * @type {string}
 */
const RULES = 'AGENTS.md'

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
  it('walks the tree for the guides standing beside the code', function() {
    assert.ok(
      GUIDES.length > 1,
      [
        'cannot find a guide beside the code it is about, this walk having',
        `found ${GUIDES.join(', ')} and nothing else — the derivation behind`,
        'a module lives in the CLAUDE.md of its own directory since #821, so',
        'a walk reaching only the root one leaves every claim in the others',
        'judged by nobody',
      ].join(' '),
    )
  })
  it('cannot come within reach of what a turn may load', function() {
    assert.deepEqual(
      GUIDES.filter((one) => loaded(one) > LOADED - ROOM).map(
        (one) => `${one} loads ${loaded(one)} in ${
          chained(one).map((each) => `${each} at ${sized(each)}`).join(' + ')}`,
      ),
      [],
      [
        `cannot load a chain of guides within ${ROOM} characters of the`,
        `${LOADED} the harness warns at, a turn touching a file loading the`,
        'root guide and the guide of every directory over it — the bar',
        `stands at ${LOADED - ROOM} so that it reddens with room still left`,
        'to answer it, what answers it being a derivation cut to the ticket',
        'that derived it, and never a bar widened to fit what has grown past it',
      ].join(' '),
    )
  })
  it('keeps every guide a turn starts with to the rules', function() {
    assert.deepEqual(
      chained(ENTRY).filter((one) => lined(one) > BRIEF)
        .map((one) => `${one} holds ${lined(one)} lines`),
      [],
      [
        `cannot start a turn with a guide past ${BRIEF} lines, the length`,
        'past which Claude Code follows a file less closely — a guide every',
        'turn loads holds the rules, and the map and the derivation behind',
        `them go to ${ARCHITECTURE}, which no turn loads`,
      ].join(' '),
    )
  })
  it('says nothing in the root guide but the import of the rules', function() {
    assert.deepEqual(
      fs.readFileSync(path.join(ROOT, ENTRY), 'utf-8').split('\n')
        .filter((line) => line.trim() !== '' && !line.startsWith('# ')),
      [`@${RULES}`],
      [
        `cannot say anything in ${ENTRY} but the import of ${RULES}: every`,
        'other agent reads that file and never this one, so a rule written',
        'here is a rule only one of them follows',
      ].join(' '),
    )
  })
  it('imports only files the tree holds', function() {
    assert.deepEqual(
      GUIDES.flatMap(
        (guide) => imports(guide)
          .filter((one) => !fs.existsSync(path.join(ROOT, one)))
          .map((one) => `${guide} imports ${one}`),
      ),
      [],
      [
        'a guide imports a file the tree does not hold — an at-sign standing',
        'bare in prose is an import Claude Code tries and drops, so a name a',
        'guide only mentions goes in backticks',
      ].join(' '),
    )
  })
  it('keeps room enough to answer a chain that has reached the bar', function() {
    assert.ok(
      ROOM >= GROWN * 1.5 && ROOM <= GROWN * 2,
      [
        `cannot keep ${ROOM} characters under the bar against a dearest day`,
        `of ${GROWN}: a margin under half again of it is one a single day of`,
        'work crosses without warning, and one past twice it reddens a tree',
        'that has room to spare, both of which are a bar that has stopped',
        'being one',
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
          `the whole of what ${ARCHITECTURE} keeps in place of the notes`,
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
        `being the whole of what ${ARCHITECTURE} says about it — a module`,
        'named nowhere is one a reader meets first in the code',
      ].join(' '),
    )
  })
  it('holds every note a guide carries to a row of the index', function() {
    const rows = indexed()
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !rows.some((row) => globbed(row).test(one))),
        [],
        [
          `${guide} notes a file the index does not name — the two are one map,`,
          'so a note reachable only by opening the guide it sits in is a',
          'derivation the index has stopped pointing at',
        ].join(' '),
      )
    }
  })
  it('cannot note a file the guide does not stand above', function() {
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !one.startsWith(`${path.dirname(guide)}/`)),
        [],
        [
          `${guide} notes a file outside its own directory, where a reader`,
          'opening that file loads some other guide — a note arrives with',
          'the directory it sits in, so it goes where its own code goes',
        ].join(' '),
      )
    }
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
