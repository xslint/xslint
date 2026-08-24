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
 * here unless a workflow says otherwise, so an action of this kind either
 * carries a `permissions` block or dies on `Resource not accessible by
 * integration` — which is a step failing inside a job that only runs when
 * something has already failed, so nothing louder than the Actions tab ever
 * says so (#826).
 * @type {{[action: string]: string}}
 */
const WRITES = {'jayqi/failed-build-issue-action': 'issues'}

/**
 * Which scopes a job is granted at write level. A job declaring none of its
 * own inherits the workflow's, and a `write-all` grants every scope there is,
 * which is why the answer is a question about one name rather than a list to
 * compare a name against.
 * @param {object} workflow - The whole workflow, parsed
 * @param {object} job - One job standing in it
 * @return {function(string): boolean} - Whether that scope is granted to write
 */
const granting = function(workflow, job) {
  let permissions = workflow.permissions
  if ('permissions' in job) {
    permissions = job.permissions
  }
  let granted = (scope) => permissions?.[scope] === 'write'
  if (permissions === 'write-all') {
    granted = () => true
  }
  return granted
}

/**
 * Every job of every workflow, each knowing where it stands, which actions its
 * steps run and what it may write. A permission is granted to a job and needed
 * by a step, so neither half answers on its own.
 * @type {Array.<{where: string, uses: Array.<string>,
 *   granted: function(string): boolean}>}
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
        (action) => action in WRITES && !job.granted(WRITES[action]),
      )).map((job) => job.where),
      [],
      'a job runs an action that writes to this repository and is granted ' +
        'no scope to write with, so the step dies where it tries and ' +
        'whatever it stood there to report goes unreported',
    )
  })
  it('holds no action the tree has stopped running', function() {
    assert.deepEqual(
      Object.keys(WRITES).filter(
        (action) => !JOBS.some((job) => job.uses.includes(action)),
      ),
      [],
      'an action named here is run by no job, so the scope it is held to ' +
        'stands for nothing and this list reads like a rule in force',
    )
  })
})
