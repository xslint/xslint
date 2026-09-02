/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Every job granted the scope its own steps write with. Both nightly tiers
 * end in a `report-fail` job whose only purpose is to say that they failed,
 * and for as long as either has existed neither could: a workflow token
 * here is granted `read` unless the workflow says otherwise, and neither
 * `corpora.yml` nor `daily.yml` declared a `permissions:` block, so
 * `jayqi/failed-build-issue-action` authenticated as a token that cannot
 * POST and died on `Resource not accessible by integration` — inside a job
 * that runs only when something has already failed, which is the one place
 * a failure is heard by nobody. Two nightlies went red that way in one week
 * and neither filed anything, the last `build failed` issue in the
 * repository being five months old, so a red schedule read exactly like a
 * green one unless somebody opened the Actions tab by hand (#826). It is
 * the same shape as #645 and #701 one tier out: not a suite that asserts
 * nothing, nor a checker that rewrites what it should fail on, but a gate
 * whose **reporter** is broken.
 *
 * `permissions: issues: write` on each of those two jobs is the whole of
 * the fix — on the job rather than the workflow, so the `lint` and `build`
 * jobs they depend on stay read-only — and the two workflows that already
 * needed write scope declare it the same way (`release.yml:9`,
 * `docs.yml:12`), which is why these two read as missed rather than
 * decided. What stops it going again is the gate: `WRITES` names each
 * action that writes to this repository rather than reading it, against the
 * scope its token needs, and every job of every workflow is read for the
 * actions its steps run and the permissions in force over it — its own
 * where it declares any, the workflow's otherwise, and `write-all` granting
 * whatever is asked. It is red from both sides, as every exemption table
 * here is: a job running such an action without the scope fails, and so
 * does an entry naming an action no job runs, so neither half can rot in
 * silence. Removing either `permissions:` block fails it naming that job by
 * file and name.
 *
 * What no gate covers is the write itself. Nothing in CI POSTs an issue, so
 * the token's scope is asserted where it is declared and not where it is
 * used, and an action that starts needing a second scope would break
 * exactly as quietly as this one did.
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
