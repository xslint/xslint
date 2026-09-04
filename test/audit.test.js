/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {read, reported, unanswered, verdict, UNANSWERED} =
  require('../scripts/audit')
const {allFilesFrom, yaml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The nightly workflow, whose audit job is the one place this script runs.
 * @type {string}
 */
const WORKFLOW = path.resolve(
  __dirname, '..', '.github', 'workflows', 'daily.yml',
)

/**
 * Every line that job hands the shell, joined, so a claim about the step is
 * asked of what runs rather than of the file the job stands in.
 * @type {string}
 */
const AUDITING = yaml.parsedFromFile(WORKFLOW).jobs.audit.steps
  .map((step) => step.run ?? '').join('\n')

/**
 * Where the readings stand.
 * @type {string}
 */
const READINGS = path.resolve(__dirname, 'resources', 'audit')

/**
 * A reading as this suite reads one: the JSON a real `npm audit --json` wrote,
 * captured rather than composed, since what tells a finding from an outage is
 * which keys npm chose and no sentence of ours about them (#884).
 * @param {string} named - Name of the reading
 * @return {object} - It, parsed
 */
const reading = function(named) {
  return read(fs.readFileSync(path.join(READINGS, `${named}.json`), 'utf-8'))
}

/**
 * Every shape npm can print, against which of the three things it is and what
 * a verdict has to say about it. The sentence is pinned whole rather than its
 * presence: an annotation naming a tally and no package is the whole of what
 * #884 is about, and a tree that went unaudited must read as neither a finding
 * nor a pass.
 * @type {Array.<{name: string, reading: string, report: boolean,
 *  silent: boolean, said: string}>}
 */
const CASES = [
  {
    name: 'names every package a report found an advisory against',
    reading: 'findings', report: true, silent: false,
    said: 'npm audit found 4 advisories: minimist critical, qs high, ' +
      'semver high, cookie low',
  },
  {
    name: 'counts one advisory as the one it is',
    reading: 'single', report: true, silent: false,
    said: 'npm audit found 1 advisory: minimist critical',
  },
  {
    name: 'counts the advisories it has no room to name',
    reading: 'many', report: true, silent: false,
    said: 'npm audit found 18 advisories: lodash critical, braces high, ' +
      'gaze high, glob high, glob-stream high, glob-watcher high, ' +
      'globule high, gulp high, gulp-util high, lodash.template high, ' +
      'micromatch high, minimatch high, and 6 more',
  },
  {
    name: 'says nothing about a report that found no advisory at all',
    reading: 'clean', report: true, silent: false, said: '',
  },
  {
    name: 'reads a registry answering 503 as nothing having been audited',
    reading: 'unanswered', report: false, silent: true,
    said: 'npm audit read no report from the registry, so nothing was ' +
      'audited: 503 Service Unavailable - POST ' +
      'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - ' +
      'Service Unavailable',
  },
  {
    name: 'reads a registry whose name does not resolve the same way',
    reading: 'refused', report: false, silent: true,
    said: 'npm audit read no report from the registry, so nothing was ' +
      'audited: request to ' +
      'https://registry.npmjs.invalid/-/npm/v1/security/advisories/bulk ' +
      'failed, reason: getaddrinfo ENOTFOUND registry.npmjs.invalid',
  },
  {
    name: 'blames npm rather than the registry where npm names the fault',
    reading: 'unusable', report: false, silent: false,
    said: 'npm audit could not run over this tree, so nothing was audited: ' +
      'ENOLOCK, This command requires an existing lockfile',
  },
]

/**
 * What a verdict has to say where npm printed no JSON at all, which is a crash
 * rather than a report and stands nowhere in the readings: whatever it printed
 * carries as far as an annotation can, and a run that printed nothing leaves
 * the sentence to stand on its own.
 * @type {Array.<{name: string, text: string, said: string}>}
 */
const CRASHES = [
  {
    name: 'reads whatever npm printed in place of JSON as its cause',
    text: 'npm error code EPERM\nnpm error syscall open',
    said: 'npm audit read no report from the registry, so nothing was ' +
      'audited: npm error code EPERM',
  },
  {
    name: 'reads a run that printed nothing at all as nothing audited',
    text: '',
    said: 'npm audit read no report from the registry, so nothing was audited',
  },
]

describe('audit', function() {
  CASES.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        verdict(reading(row.reading)), row.said,
        'an audit verdict does not say what npm read, so a night that ' +
          'reddens names nothing to act on',
      )
    })
  })
  CRASHES.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        verdict(read(row.text)), row.said,
        'a run that printed no report at all is judged against a key it ' +
          'never wrote, so the verdict says nothing of what happened',
      )
    })
  })
  CASES.forEach((row) => {
    it(`reads ${row.reading} as a report or as none of one`, function() {
      assert.equal(
        reported(reading(row.reading)), row.report,
        'a reading npm printed in place of a report is judged as one, or a ' +
          'report is not read as one, so a tally nobody has stands for the ' +
          'whole verdict',
      )
    })
  })
  CASES.forEach((row) => {
    it(`tells whether ${row.reading} left the registry to blame`, function() {
      assert.equal(
        unanswered(reading(row.reading)), row.silent,
        'a verdict cannot tell a finding the nightly must redden on from an ' +
          'outage it must ask again about, so one of the two is answered as ' +
          'the other',
      )
    })
  })
  it('reads every reading this suite holds and no others', function() {
    assert.deepEqual(
      allFilesFrom(READINGS).map((one) => path.basename(one, '.json')).sort(),
      CASES.map((row) => row.reading).sort(),
      'a reading stands beside this table with no row asking anything of it, ' +
        'or a row names one the tree has stopped holding, so what npm can ' +
        'print and what this suite judges are two lists',
    )
  })
  it('judges the audit through the script the workflow calls', function() {
    assert.ok(
      AUDITING.includes('node scripts/audit.js'),
      'the nightly step reads a bare npm audit exit code rather than going ' +
        'through scripts/audit.js, so a registry outage and an advisory are ' +
        'one status to it again',
    )
  })
  it('tests the status this script leaves for an unanswered registry',
    function() {
      assert.ok(
        new RegExp(`-(?:eq|ne) ${UNANSWERED}\\b`).test(AUDITING),
        'the nightly step weighs the audit status against a number other ' +
          'than the one this script leaves for a registry that did not ' +
          'answer, so either an outage reddens the night or an unaudited ' +
          'tree passes for an audited one',
      )
    })
  it('leaves no step judging npm audit by its own exit code', function() {
    assert.deepEqual(
      yaml.parsedFromFile(WORKFLOW).jobs.audit.steps
        .filter((step) => step.run === 'npm audit'),
      [],
      'the audit job runs npm audit as the whole of its own judgement, and ' +
        'that exits 1 on a registry 503 as readily as on an advisory, which ' +
        'is what left a nightly failure saying nothing actionable',
    )
  })
})
