/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {verdict, TICK} = require('../scripts/budget')
const {yaml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The nightly workflow, read as data: the budgets live in its matrix because
 * the budget is a number to tune and the judging is code, the way a check's
 * YAML carries a severity and its detection lives in a linter.
 * @type {string}
 */
const WORKFLOW = path.resolve(
  __dirname, '..', '.github', 'workflows', 'corpora.yml',
)

/**
 * What each corpus is allowed, by name, off that matrix.
 * @type {Array.<{name: string, budget: number}>}
 */
const CORPORA = yaml.parsedFromFile(WORKFLOW).jobs.lint.strategy.matrix.include

/**
 * The dearest milliseconds each corpus has read on the runner the nightly tier
 * runs on, over six runs dispatched on the tree #872 left and the night that
 * ran one merge behind it. A budget answers to this and not to a developer
 * machine, a share cancelling a machine's speed where a wall clock carries it,
 * and each stands at the middle of the window its own two ends leave (#811).
 * @type {{[name: string]: number}}
 */
const RUNS = {docbook: 5459, tei: 5656, ditaot: 2636}

/**
 * The cheapest of those same readings, which is the side a ratchet can turn red
 * from. A budget of `SLACK` times a reading fires on everything below a quarter
 * of it, so one must stand above the dearest night and leave `MARGIN` under the
 * cheapest, or a fast night reddens a tree nobody has touched (#827, #811).
 * @type {{[name: string]: number}}
 */
const CHEAPEST = {docbook: 3296, tei: 2846, ditaot: 1424}

/**
 * What a verdict has to say about a reading, one row per side of the window and
 * one for each edge of it. The message is pinned rather than merely its
 * presence, because a gate that fails has to say what it measured: the reading,
 * the bar, and which way it went wrong.
 * @type {Array.<{name: string, spent: number, budget: number, said: string}>}
 */
const CASES = [
  {
    name: 'reports a run that has passed its budget',
    spent: 41000, budget: 40000,
    said: 'linting docbook took 41000ms, past its 40000ms budget',
  },
  {
    name: 'says nothing about a run standing exactly at its budget',
    spent: 40000, budget: 40000, said: '',
  },
  {
    name: 'says nothing about a run one tick inside its budget',
    spent: 39999, budget: 40000, said: '',
  },
  {
    name: 'reports a budget standing further than SLACK above its run',
    spent: 9000, budget: 40000,
    said: 'linting docbook took 9000ms where its budget allows 40000ms, ' +
      'which is over 4 times the run: the budget has stopped being a bar ' +
      'and wants re-cutting from a measurement',
  },
  {
    name: 'says nothing about a budget standing exactly SLACK above it',
    spent: 10000, budget: 40000, said: '',
  },
  {
    name: 'says nothing about a reading of no milliseconds at all',
    spent: 0, budget: 40000, said: '',
  },
]

/**
 * The largest share of a corpus's own reading one tick of the tier's clock may
 * stand at. A reading is true to within a tick, so a clock coarse beside what
 * it times spends the window on quantisation before the runner's own variance
 * is paid for: whole seconds put a tick at half of what DITA-OT costs where
 * milliseconds put it at a 2830th, and this is the middle of the two (#827).
 * @type {number}
 */
const RESOLUTION = 0.013

/**
 * How much faster than the cheapest night on record a run may be before the
 * ratchet under it fires. Whole seconds left DocBook-XSL none at all — the
 * budget fired at the cheapest reading itself, so what stood under it was the
 * clock and not a margin — where milliseconds leave 1.44 (#827).
 * @type {number}
 */
const MARGIN = 1.2

/**
 * The `date` format the tier's step has to time with, so that `TICK` states the
 * clock the workflow keeps rather than one this suite believes it does.
 * @type {string}
 */
const CLOCK = '%s%3N'

describe('budget', function() {
  CORPORA.forEach((one) => {
    it(`allows ${one.name} what the runner spends on it, and no more`,
      function() {
        assert.equal(
          verdict(one.name, RUNS[one.name], one.budget),
          '',
          'a nightly budget no longer stands between what the runner spends ' +
            'on a corpus and a regression in it',
        )
      })
  })
  CASES.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        verdict('docbook', row.spent, row.budget),
        row.said,
        'a budget verdict does not say what it measured and which way the ' +
          'reading went wrong',
      )
    })
  })
  it('gives every corpus of the tier a budget to answer to', function() {
    assert.deepEqual(
      CORPORA.filter((one) => !Number.isInteger(one.budget)).map(
        (one) => one.name,
      ),
      [],
      'a corpus the nightly tier lints carries no budget, so the run it ' +
        'times is timed against nothing',
    )
  })
  CORPORA.forEach((one) => {
    it(`keeps a margin under the cheapest ${one.name} on record`, function() {
      assert.equal(
        verdict(one.name, CHEAPEST[one.name] / MARGIN, one.budget),
        '',
        'a nightly budget fires its own ratchet a margin under a reading its ' +
          'corpus has already given, so a fast night reddens a build on a ' +
          'tree nobody has touched',
      )
    })
  })
  it('gives every budget a reading of the runner to answer to', function() {
    assert.deepEqual(
      CORPORA.map((one) => one.name).filter(
        (name) => !(name in RUNS) || !(name in CHEAPEST),
      ),
      [],
      'a budget stands over a corpus this suite holds no runner reading ' +
        'for, so nothing says the budget is still a bar',
    )
  })
  CORPORA.forEach((one) => {
    it(`resolves ${one.name} finely enough to measure it`, function() {
      assert.ok(
        TICK / CHEAPEST[one.name] <= RESOLUTION,
        'the tier times a corpus with a clock too coarse to resolve it, so a ' +
          'reading of it is quantisation before it is a measurement',
      )
    })
  })
  it('times each corpus with the clock a tick is written in', function() {
    assert.ok(
      fs.readFileSync(WORKFLOW, 'utf-8').includes(`date +${CLOCK}`),
      'the nightly step times its run with a clock other than the one ' +
        'scripts/budget.js states a tick of, so every bar written in ticks ' +
        'stands on a unit nothing holds it to',
    )
  })
  it('judges each budget through the script the workflow calls', function() {
    assert.ok(
      fs.readFileSync(WORKFLOW, 'utf-8').includes('node scripts/budget.js'),
      'the nightly step judges what it measured on its own rather than ' +
        'through scripts/budget.js, so the ratchet it holds is bypassed',
    )
  })
})
