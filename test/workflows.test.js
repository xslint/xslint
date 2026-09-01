/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Where the workflows stand. Every convention here is machine-enforced, and
 * the jobs enforcing them were the ones nothing enforced anything about.
 * @type {string}
 */
const WORKFLOWS = path.resolve(__dirname, '..', '.github', 'workflows')

/**
 * Each action that writes to this repository rather than reading it, against
 * the scope GitHub's own token needs before it can. A token is granted `read`
 * unless a workflow says otherwise, so such an action either carries a
 * `permissions` block or dies on `Resource not accessible by integration` —
 * a step failing inside a job only a failure runs, quiet outside it (#826).
 * @type {{[action: string]: string}}
 */
const WRITES = {
  'jayqi/failed-build-issue-action': 'issues',
  'maxonfjvipon/deps-sentinel-action': 'pull-requests',
}

/**
 * Each action that reads this repository through the same token, against the
 * scope it needs. A job declaring nothing is granted every scope at `read` and
 * needs no entry; one declaring a block is granted nothing but what it names,
 * so a scope written for one step revokes what another was reading with (#856).
 * @type {{[action: string]: string}}
 */
const READS = {'actions/checkout': 'contents'}

/**
 * What a job may do with one scope — `write`, `read` or `none`. A job
 * declaring none of its own stands under the workflow's, one standing under
 * neither is granted `read` on everything, and a `write-all` grants every
 * scope there is, which is why the answer is a question about one name rather
 * than a list to compare a name against.
 * @param {object} workflow - The whole workflow, parsed
 * @param {object} job - One job standing in it
 * @return {function(string): string} - What that scope is granted at
 */
const granting = function(workflow, job) {
  let permissions = workflow.permissions
  if ('permissions' in job) {
    permissions = job.permissions
  }
  let granted = (scope) => permissions?.[scope] ?? 'none'
  if (permissions === undefined) {
    granted = () => 'read'
  }
  if (permissions === 'write-all') {
    granted = () => 'write'
  }
  return granted
}

/**
 * Every job of every workflow, each knowing where it stands, which actions its
 * steps run and what it may write. A permission is granted to a job and needed
 * by a step, so neither half answers on its own.
 * @type {Array.<{where: string, uses: Array.<string>,
 *   granted: function(string): string}>}
 */
const JOBS = allFilesFrom(WORKFLOWS)
  .filter((file) => file.endsWith('.yml'))
  .flatMap((file) => {
    const workflow = yaml.parsedFromFile(file)
    return Object.entries(workflow.jobs).map((entry) => ({
      where: `${path.basename(file)}:${entry[0]}`,
      uses: (entry[1].steps ?? [])
        .map((step) => step.uses)
        .filter((action) => action !== undefined)
        .map((action) => action.split('@')[0]),
      granted: granting(workflow, entry[1]),
    }))
  })

describe('workflows', function() {
  it('grants every job the scope its own steps write with', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.uses.some(
        (action) => action in WRITES && job.granted(WRITES[action]) !== 'write',
      )).map((job) => job.where),
      [],
      'a job runs an action that writes to this repository and is granted ' +
        'no scope to write with, so the step dies where it tries and ' +
        'whatever it stood there to report goes unreported',
    )
  })
  it('leaves every job the scope its own steps read with', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.uses.some(
        (action) => action in READS && job.granted(READS[action]) === 'none',
      )).map((job) => job.where),
      [],
      'a job narrows itself to a block naming nothing about a scope one of ' +
        'its own steps reads with, so a step that asked for nothing loses ' +
        'what a job declaring no block at all would have been granted',
    )
  })
  it('holds no action the tree has stopped running', function() {
    assert.deepEqual(
      Object.keys(WRITES).concat(Object.keys(READS)).filter(
        (action) => !JOBS.some((job) => job.uses.includes(action)),
      ),
      [],
      'an action named here is run by no job, so the scope it is held to ' +
        'stands for nothing and this list reads like a rule in force',
    )
  })
})
