/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The tier as data: `fix:` in a check's YAML is what grades every fix that
 * check offers, `src/xslint.js` reading it so that no linter spells a tier a
 * second time, and this is where the declaration is held to a real run over
 * `test/resources/fix` — the corpus the **Fix in the same change** rule
 * already obliges every fixable check to stand a pair in, which is why it is
 * the one asked here.
 * Which half of that each side pins is worth saying, one of them being a
 * tautology and the other not. That a check declaring a tier offers a fix, and
 * that one offering a fix declares a tier, is real: a fixer deleted, or a
 * check that grows one and forgets to say so, turns this file red where
 * nothing else asks. *Which* tier a single-tier check offers is not — the run
 * reads the declaration, so it can answer with nothing else — and what pins
 * that is `test/fixer.deep.test.js`, whose `APPLIED` rows run a plain `--fix`
 * against a committed `.fixed.xsl` and whose `UNCHANGED` rows prove the same
 * flag leaves a suggestion where it stands. Re-grading a check breaks a file
 * comparison there, which no edit to a declaration can satisfy.
 * Where the set equality carries its own weight is the check declaring both,
 * the tier being a property of the place a defect stands rather than of the
 * check: `starts-with-double-slash` is a suggestion on an `xsl:template`,
 * whose priority a dropped `//` shifts, and on any 2.0+ pattern but a key's,
 * which a parentless tree matches without it (#583, #899, #1015).
 * The third question is the other side of the same key: nobody but the check's
 * own page says what a check corrects. `README.md` spent 42% of itself
 * teaching the twenty-three of them, one bullet each and two for the check
 * that grades per defect, and the audit behind this gate found the motive
 * already carrying twenty-three of those twenty-four at five times the
 * length. The one it did not — the brackets `use-node-set-extension` keeps
 * around an argument binding looser than a step, which a reader unwrapping by
 * hand drops to select something else — is a hazard of the construct, so it
 * moved into the motive rather than dying with the prose. What the section
 * owns is the two flags and the guarantees that hold whatever the check: the
 * exact span, the skip on a mismatch, the wider of two overlaps. It names no
 * check at all, the gate below failing the moment a bullet comes back (#898).
 */

const {lint, suffixed} = require('../src/xslint')
const {SAFE, SUGGESTION, TIERS} = require('../src/checks')
const {kinds} = require('../src/resources/checks.json')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * Where a fixable check stands its fixtures: one stylesheet per case, beside
 * the fixed one a fixing run is expected to leave behind.
 * @type {string}
 */
const FIXTURES = path.resolve(__dirname, 'resources', 'fix')

/**
 * What marks the stylesheet a fixing run is expected to write, rather than the
 * one it is given. It stands in front of the suffix rather than being one, so
 * it is read where it is written and holds under either spelling of a name.
 * @type {string}
 */
const FIXED = '.fixed.'

/**
 * Every check carrying a `fix:`, whichever of the four kinds declares it.
 * @return {Array.<Array>} - Each check's name beside its entry
 */
const fixable = function() {
  return Object.values(kinds).flatMap((kind) => Object.entries(kind))
    .filter(([, check]) => Object.hasOwn(check, 'fix'))
}

/**
 * The tiers each check declares, one name or two, as a sorted list so that a
 * set reads the way the run's answer does.
 * @return {object} - Check name to the tiers it declares
 */
const declared = function() {
  return Object.fromEntries(
    fixable().map(([name, check]) => [name, [check.fix].flat().sort()]),
  )
}

/**
 * The tier one fix stands in, read off the fix itself.
 * @param {object} fix - The fix a defect carries
 * @return {string} - Its tier
 */
const tierOf = function(fix) {
  let tier = SAFE
  if (fix.suggestion) {
    tier = SUGGESTION
  }
  return tier
}

/**
 * The tiers each check offers, read off a real run over every fixture. Each
 * stylesheet is linted alone, so a cross-file check answers for the fixture
 * standing it rather than for a neighbour that happens to sit beside it.
 * @return {object} - Check name to the tiers it offers
 */
const offered = function() {
  const found = new Map()
  for (const named of fs.readdirSync(FIXTURES)) {
    if (suffixed(named) && !named.includes(FIXED)) {
      const file = path.join(FIXTURES, named)
      const defects = lint([
        {file: file, content: fs.readFileSync(file, 'utf-8')},
      ])
      for (const defect of defects.filter((one) => one.fix)) {
        if (!found.has(defect.name)) {
          found.set(defect.name, new Set())
        }
        found.get(defect.name).add(tierOf(defect.fix))
      }
    }
  }
  return Object.fromEntries(
    [...found].sort().map(([name, tiers]) => [name, [...tiers].sort()]),
  )
}

/**
 * Whether a check spells its tier the one way the key is read: a single tier
 * as its own name, and the two of a check grading per defect as a list holding
 * each of them once.
 * @param {string|Array.<string>} fix - What the check declares
 * @return {boolean} - Whether it is spelled that way
 */
const spelled = function(fix) {
  let sound = TIERS.includes(fix)
  if (Array.isArray(fix)) {
    sound = fix.length === TIERS.length &&
      TIERS.every((tier) => fix.includes(tier))
  }
  return sound
}

/**
 * What stands under the README's `Fixing` heading, up to the next one.
 * @return {string} - The section's own text
 */
const fixing = function() {
  return fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf-8')
    .split(/^## /m).find((part) => part.startsWith('Fixing\n'))
}

describe('tiers', function() {
  it('declares the tiers every check offers, and only those', function() {
    assert.deepStrictEqual(
      declared(), offered(),
      [
        'the tiers the checks declare under `fix:` are not the tiers a run',
        'offers over test/resources/fix. A check that grows a fix and',
        'declares none is graded by nobody, and one declaring a fix it no',
        'longer offers tells the docs site and README that a defect can be',
        'fixed when nothing fixes it (#899)',
      ].join(' '),
    )
  })
  it('spells one tier as a name and two as a list', function() {
    assert.deepStrictEqual(
      fixable().filter(([, check]) => !spelled(check.fix))
        .map(([name]) => name),
      [],
      [
        `a check spells its tier as something other than ${TIERS.join(' or ')},`,
        'or lists one tier where the name alone says it, so what a run reads',
        'and what the docs site renders come off two shapes of one key',
      ].join(' '),
    )
  })
  it('names no fixable check where the catalog teaches them', function() {
    assert.deepStrictEqual(
      fixable().map(([name]) => name).filter((name) => fixing().includes(name)),
      [],
      [
        'the README `Fixing` section names a check whose page already teaches',
        'the construct, so one reader is told the same thing twice and the',
        'two spellings drift apart. That section owns the flags and the',
        'guarantees; which check fixes itself is the catalog\'s (#898)',
      ].join(' '),
    )
  })
})
