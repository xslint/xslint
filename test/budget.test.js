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
 * over eight runs of it — two nightly and six dispatched — on the tree #818
 * left. A budget answers to this and not to a developer machine: a share
 * cancels a machine's speed where a wall clock carries it, so the only honest
 * measurement of a wall-clock bar is one taken where the bar is enforced. The
 * readings were 7, 6, 8, 8, 5, 8, 7 and 8 seconds over DocBook-XSL, 5, 8, 8,
 * 6, 7, 7, 7 and 7 over TEI, and 3, 2, 3, 3, 3, 3, 3 and 2 over DITA-OT, so a
 * runner disagrees with itself about the same tree by half as much again —
 * which is the reason the window below is two-sided rather than tight.
 * @type {{[name: string]: number}}
 */
const RUNS = {docbook: 8, tei: 8, ditaot: 3}

/**
 * The cheapest of those same readings, which is the side a ratchet can turn red
 * from. A budget of `SLACK` times a reading fires on everything below a quarter
 * of it, so what has to be true of a budget is not only that it stands above
 * the dearest night but that it stays quiet on the cheapest — otherwise a fast
 * night reddens a build on a tree nobody has touched. Read as whole seconds,
 * these leave the ratchet firing at 3, 3 and 1 and under, against the 5, 5 and
 * 2 below — so the two margins that were a tick when #785 cut them are two
 * ticks now, and DITA-OT's is the tick it always was.
 * @type {{[name: string]: number}}
 */
const CHEAPEST = {docbook: 5, tei: 5, ditaot: 2}

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
