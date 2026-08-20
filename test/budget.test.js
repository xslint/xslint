/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {verdict, SLACK} = require('../scripts/budget')
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
 * The dearest a corpus has read on the runner the nightly tier runs on, taken
 * from the `corpora` runs of the nights this table was cut. A budget answers to
 * this and not to a developer machine: a share cancels a machine's speed where
 * a wall clock carries it, so the only honest measurement of a wall-clock bar
 * is one taken where the bar is enforced.
 * @type {{[name: string]: number}}
 */
const RUNS = {docbook: 13, tei: 9, ditaot: 5}

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
})
