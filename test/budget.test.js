/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {verdict} = require('../scripts/budget')
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
 * The dearest each corpus has read on the runner the nightly tier runs on,
 * over six runs of it on the tree #784 left. A budget answers to this and not
 * to a developer machine, a share cancelling a machine's speed where a wall
 * clock carries it: those readings have a runner disagreeing with itself about
 * one tree by half as much again, which is why the window below is two-sided.
 * @type {{[name: string]: number}}
 */
const RUNS = {docbook: 20, tei: 11, ditaot: 5}

/**
 * The cheapest of those same readings, which is the side a ratchet can turn
 * red from. A budget of `SLACK` times a reading fires on everything below a
 * quarter of it, so a budget must stand above the dearest night and stay quiet
 * on the cheapest, or a fast night reddens a build on a tree nobody has
 * touched.
 * @type {{[name: string]: number}}
 */
const CHEAPEST = {docbook: 13, tei: 8, ditaot: 3}

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
    spent: 41, budget: 40,
    said: 'linting docbook took 41s, past its 40s budget',
  },
  {
    name: 'says nothing about a run standing exactly at its budget',
    spent: 40, budget: 40, said: '',
  },
  {
    name: 'says nothing about a run one second inside its budget',
    spent: 39, budget: 40, said: '',
  },
  {
    name: 'reports a budget standing further than SLACK above its run',
    spent: 9, budget: 40,
    said: 'linting docbook took 9s where its budget allows 40s, which is ' +
      'over 4 times the run: the budget has stopped being a bar and wants ' +
      're-cutting from a measurement',
  },
  {
    name: 'says nothing about a budget standing exactly SLACK above it',
    spent: 10, budget: 40, said: '',
  },
  {
    name: 'says nothing about a reading of no seconds at all',
    spent: 0, budget: 40, said: '',
  },
]

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
    it(`stays quiet on the cheapest ${one.name} the runner has given`,
      function() {
        assert.equal(
          verdict(one.name, CHEAPEST[one.name], one.budget),
          '',
          'a nightly budget fires its own ratchet on a reading its corpus ' +
            'has already given, so a fast night reddens a build on a tree ' +
            'nobody has touched',
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
  it('judges each budget through the script the workflow calls', function() {
    assert.ok(
      fs.readFileSync(WORKFLOW, 'utf-8').includes('node scripts/budget.js'),
      'the nightly step judges what it measured on its own rather than ' +
        'through scripts/budget.js, so the ratchet it holds is bypassed',
    )
  })
})
