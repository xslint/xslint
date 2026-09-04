/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {ranScript} = require('./helpers')
const {UNANSWERED} = require('../scripts/audit')
const assert = require('assert')

/**
 * What the nightly step reads off the script: a status, which is the whole of
 * what arms the gate, and a line for whoever opens the run. Three statuses and
 * not two, since a broken audit and an unreachable registry are one exit code
 * to npm and only one may be forgiven — a tree unaudited every night while the
 * job stays green is #645 one tier out (#884).
 * @type {Array.<{name: string, reading: string, code: number, said: string}>}
 */
const RUNS = [
  {
    name: 'reddens the night over a report that names an advisory',
    reading: 'findings', code: 1,
    said: '::error::npm audit found 4 advisories: minimist critical, ' +
      'qs high, semver high, cookie low\n',
  },
  {
    name: 'passes a report that names none in silence',
    reading: 'clean', code: 0, said: '',
  },
  {
    name: 'warns rather than reddens where the registry answered nothing',
    reading: 'unanswered', code: UNANSWERED,
    said: '::warning::npm audit read no report from the registry, so ' +
      'nothing was audited: 503 Service Unavailable - POST ' +
      'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - ' +
      'Service Unavailable\n',
  },
  {
    name: 'reddens the night where npm itself refused to audit the tree',
    reading: 'unusable', code: 1,
    said: '::error::npm audit could not run over this tree, so nothing was ' +
      'audited: ENOLOCK, This command requires an existing lockfile\n',
  },
]

describe('audit', function() {
  RUNS.forEach((row) => {
    it(row.name, function() {
      assert.deepEqual(
        ranScript('scripts/audit.js', [`test/resources/audit/${
          row.reading}.json`]),
        {code: row.code, said: row.said},
        'the nightly step cannot read off scripts/audit.js what npm audit ' +
          'found and whether to fail the night for it',
      )
    })
  })
})
