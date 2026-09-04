/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Every job granted the scope its own steps write with, and left the scope
 * they read with. Both nightly tiers end in a `report-fail` job whose only
 * purpose is to say that they failed, and for as long as either has
 * existed neither could: a workflow token here is granted `read` unless
 * the workflow says otherwise, and neither `corpora.yml` nor `daily.yml`
 * declared a `permissions:` block, so `jayqi/failed-build-issue-action`
 * authenticated as a token that cannot POST and died on `Resource not
 * accessible by integration` — inside a job that runs only when something
 * has already failed, which is the one place a failure is heard by nobody.
 * Two nightlies went red that way in one week and neither filed anything,
 * the last `build failed` issue in the repository being five months old,
 * so a red schedule read exactly like a green one unless somebody opened
 * the Actions tab by hand (#826). It is the same shape as #645 and #701
 * one tier out: not a suite that asserts nothing, nor a checker that
 * rewrites what it should fail on, but a gate whose **reporter** is
 * broken.
 *
 * `deps-sentinel.yml` is the third, and it went the same way hourly with
 * that gate standing beside it (#856). It comments on a bot pull request
 * whose CI has gone red, taking a PAT for everything it does but posting
 * that one comment with `${{ github.token }}`, so the job — declaring
 * nothing — died on `addComment` every run a red pull request stood: a
 * watchdog for red pull requests, red itself, saying so nowhere.
 * `permissions:` on the job and never the workflow is the whole of all
 * three fixes, `issues: write` on the two `report-fail` jobs and
 * `pull-requests: write` on this one, so the jobs they depend on stay
 * read-only — and the two workflows that already needed write scope
 * declare it the same way (`release.yml:9`, `docs.yml:12`), which is why
 * all three read as missed rather than decided.
 *
 * What a block grants it also takes, and that is the half no row of
 * `WRITES` could hold: a job declaring one is granted **nothing else**, so
 * a scope written for one step is revoked from every other — here the
 * `contents` that the `actions/checkout` above the sentinel reads with. So
 * the gate asks twice. `WRITES` names each action that writes to this
 * repository rather than reading it and `READS` each that reads through
 * the same token, against the scope each needs, and every job of every
 * workflow is read for the actions its steps run and the permissions in
 * force over it — its own where it declares any, the workflow's otherwise,
 * `write-all` granting whatever is asked, and a job declaring none at all
 * granted `read` on everything, which is why `granting` answers a level
 * rather than a yes and why only a job narrowing itself answers to
 * `READS`. Both tables are red from both sides, as every exemption table
 * here is: a job running such an action without the scope fails, and so
 * does an entry naming an action no job runs. Removing either line of the
 * sentinel's block fails one test apiece and removing the block fails the
 * write one alone, each naming that job by file and name.
 *
 * What no gate covers is the write itself. Nothing in CI POSTs anything,
 * so a token's scope is asserted where it is declared and not where it is
 * used.
 *
 * Granting the scope only bought the reporter the right to file, and what
 * it files is one issue per **label** rather than one per failure: the
 * action lists the open issues carrying its `label-name` and comments on
 * the newest instead of opening another. Both nightlies took the default,
 * `build failed`, so whichever of the two failed first owned that label
 * and every later failure of *either* — a slowed corpus, a broken audit,
 * a platform gone red — arrived as a comment under it. One issue, two
 * schedules, and no way to close the one without losing the other's
 * thread (#884). So each names a label of its own, and the gate asks
 * twice: that a job running the reporter names one at all, the default
 * being what pooled them, and that no two name the same. Both halves
 * matter, since a third nightly copying the block would pool with
 * whichever it copied and neither the scope gates above nor a yamllint
 * pass says a word about it.
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
 * The action either nightly reports its own failure through, which files one
 * issue per label rather than one per failure — so the label is what decides
 * whether two schedules keep two threads or share one (#884).
 * @type {string}
 */
const REPORTER = 'jayqi/failed-build-issue-action'

/**
 * Each action that writes to this repository rather than reading it, against
 * the scope GitHub's own token needs before it can. A token is granted `read`
 * unless a workflow says otherwise, so such an action either carries a
 * `permissions` block or dies on `Resource not accessible by integration` —
 * a step failing inside a job only a failure runs, quiet outside it (#826).
 * @type {{[action: string]: string}}
 */
const WRITES = {
  [REPORTER]: 'issues',
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
 * steps run, what it may write and which label it reports under. A permission
 * is granted to a job and needed by a step, so neither half answers on its own.
 * @type {Array.<{where: string, uses: Array.<string>, labels: Array.<string>,
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
      labels: (entry[1].steps ?? [])
        .filter((step) => (step.uses ?? '').split('@')[0] === REPORTER)
        .map((step) => (step.with ?? {})['label-name'] ?? ''),
      granted: granting(workflow, entry[1]),
    }))
  })

/**
 * Every label a reporting job files under, the empty string standing for a job
 * that named none and so took the action's own default with every other.
 * @type {Array.<string>}
 */
const LABELS = JOBS.flatMap((job) => job.labels)

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
  it('names the label every reporting job files its own issue under',
    function() {
      assert.deepEqual(
        JOBS.filter((job) => job.labels.includes('')).map((job) => job.where),
        [],
        'a job reports its own failure under whatever label the action ' +
          'defaults to, and the action comments on the newest open issue ' +
          'carrying that label rather than opening one, so this schedule ' +
          'files under whatever else took the default first',
      )
    })
  it('leaves no two reporting jobs filing under one label', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.labels.some(
        (label) => LABELS.indexOf(label) !== LABELS.lastIndexOf(label),
      )).map((job) => job.where),
      [],
      'two jobs report their failures under one label, so the second to ' +
        'fail comments on the first one\'s issue and two schedules keep one ' +
        'thread between them — which cannot be closed for either without ' +
        'losing the other',
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
