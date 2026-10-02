/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Every job granted the scope its own steps write with, and left the scope
 * they read with. A reporter whose token cannot write is a gate heard by
 * nobody: both nightlies and `deps-sentinel.yml` died that way (#826, #856),
 * and a job's `permissions:` revokes every scope it leaves out, so `WRITES`
 * and `READS` hold each action to the scope it needs, red from both sides.
 * Each reporter names a label of its own, so two schedules never pool in one
 * issue (#884), and every gate a schedule runs reports (#1087). The `up` job
 * must reach every version the README pins (#897), each stamp one placeholder
 * in `src/version.js` (#917), every release-notes command a title (#919), and
 * the suite runs in front of the stamp, which would blind those gates (#946).
 */

const {GAP, WHITESPACE} = require('../src/tokens')
const {allFilesFrom, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')
const fs = require('fs')

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

/**
 * Each workflow a schedule starts, knowing which of its jobs report a failure
 * and which they wait on. A schedule runs with nobody watching, so a red run
 * that files nothing is a gate heard by nobody: `mutation.yml` failed seven
 * weeks in a row and the Actions tab was the only place that said so (#1087).
 * @type {Array.<{where: string, jobs: Array.<string>,
 *   reporters: Array.<{name: string, needs: Array.<string>}>}>}
 */
const SCHEDULED = allFilesFrom(WORKFLOWS)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => ({file: file, workflow: yaml.parsedFromFile(file)}))
  .filter((one) => 'schedule' in (one.workflow.on ?? {}))
  .map((one) => ({
    where: path.basename(one.file),
    jobs: Object.keys(one.workflow.jobs),
    reporters: Object.entries(one.workflow.jobs)
      .filter((entry) => (entry[1].steps ?? []).some(
        (step) => (step.uses ?? '').split('@')[0] === REPORTER,
      ))
      .map((entry) => ({
        name: entry[0],
        needs: [].concat(entry[1].needs ?? []),
      })),
  }))

/**
 * Each scheduled workflow that is no gate, against what it does instead. A
 * run of one of these opens a pull request or comments on one, and that is
 * the whole of what anybody hears of it, red or green.
 * @type {{[where: string]: string}}
 */
const UNGATED = {
  'deps-sentinel.yml': 'nudges the dependency pull requests open elsewhere',
  'up-xslint-action.yml': 'opens a pull request bumping the action version',
}

/**
 * The README as a reader copies from it, line by line. It is the one document
 * in the tree that states this repository's released version rather than
 * reading it, so nothing but a rewrite keeps it current (#897).
 * @type {Array.<string>}
 */
const README = fs.readFileSync(
  path.resolve(__dirname, '..', 'README.md'), 'utf-8',
).split('\n')

/**
 * Every three-part version the README states, beside the line carrying it.
 * @type {Array.<{line: string, where: number, version: string}>}
 */
const STATED = README.flatMap(
  (line, index) => Array.from(line.matchAll(/[0-9]+[.][0-9]+[.][0-9]+/g))
    .map((found) => ({line: line, where: index + 1, version: found[0]})),
)

/**
 * Each version the README states of somebody else, against what it is instead.
 * A version of ours and one of theirs are the same three numbers and only the
 * sentence around them says which, so an entry is a pattern over the line.
 * Every other version there is a pin of this repository's own release.
 * @type {{[carrying: string]: string}}
 */
const FOREIGN = {
  'xslint/xslint-action@': 'the tag of the action, cut beside this repository',
  'SARIF': 'the version of the log format, which OASIS sets and not us',
  '^0[.]0[.]0$': 'the placeholder src/version.js carries until a release',
}

/**
 * Whether a line of the README carries a version somebody else releases.
 * @param {string} line - One line of it
 * @return {boolean} - Whether an entry of `FOREIGN` claims that line
 */
const foreign = function(line) {
  return Object.keys(FOREIGN).some((one) => new RegExp(one).test(line))
}

/**
 * Every version the README pins of this repository's own release, which are
 * the ones a rewrite has to reach and which have to agree with each other.
 * @type {Array.<{line: string, where: number, version: string}>}
 */
const PINNED = STATED.filter((one) => !foreign(one.line))

/**
 * The job that rewrites those pins on every tag, parsed.
 * @type {object}
 */
const UP = yaml.parsedFromFile(path.join(WORKFLOWS, 'up.yml'))

/**
 * The left side of every substitution that job spends on the README, which is
 * the whole of what decides which pin it reaches. `sed` is silent about
 * matching nothing, so a pin no pattern covers and a pin already current read
 * the same from outside: the job rewrote two of three references for three
 * releases and reported success each time (#897).
 * @type {Array.<RegExp>}
 */
const REWRITES = (UP.jobs.up.steps ?? [])
  .map((step) => step.run ?? '')
  .flatMap(
    (script) => Array.from(
      script.matchAll(new RegExp('sed -E -i "s/([^/]+)/', 'g')),
    ),
  )
  .map((found) => new RegExp(found[1]))

/**
 * The workflow that runs on a tag and does everything a release does, parsed.
 * @type {object}
 */
const RELEASE = yaml.parsedFromFile(path.join(WORKFLOWS, 'release.yml'))

/**
 * One `sed` substitution, as the pattern it looks for and the file it rewrites.
 * The replacement is passed over: a stamp is wrong here by reaching more of a
 * file than the field it means, which the left side alone decides (#917).
 * @type {RegExp}
 */
const SUBSTITUTES = new RegExp(
  `sed -i "s/([^/]+)/[^/]*/"${GAP}+([^${WHITESPACE}]+)`, 'g',
)

/**
 * A pattern this gate can weigh: ordinary characters and escaped dots, which
 * is the whole of what an anchored stamp needs. Anything else is refused
 * rather than read as a regular expression whose dialect — `sed`'s, not
 * JavaScript's — this gate would be guessing at.
 * @type {RegExp}
 */
const PLAIN = /^(?:[^\\.[\]*^$]|\\\.)+$/

/**
 * What a file the stamp rewrites holds, read from the tree the workflow runs
 * over rather than from a fixture, since what a pattern reaches is a question
 * about this repository's own files (#917).
 * @param {string} named - Path of the file from the repository root
 * @return {string} - What it holds
 */
const sourced = function(named) {
  return fs.readFileSync(path.resolve(__dirname, '..', named), 'utf-8')
}

/**
 * The file whose placeholders a release stamps.
 * @type {string}
 */
const STAMPED = 'src/version.js'

/**
 * Every placeholder standing in that file — a quoted number, the module
 * holding nothing else of the kind. They are read off the file rather than
 * written down here, so a field added to it and left unstamped is a
 * placeholder nobody has answered for (#917).
 * @type {Array.<string>}
 */
const PLACEHOLDERS = Array.from(
  sourced(STAMPED).matchAll(/'([0-9][0-9.-]*)'/g),
).map((found) => found[1])

/**
 * Every substitution the release stamp spends.
 * @type {Array.<{looks: string, rewrites: string}>}
 */
const STAMPS = RELEASE.jobs.release.steps
  .map((step) => step.run ?? '')
  .flatMap((script) => Array.from(script.matchAll(SUBSTITUTES)))
  .map((found) => ({looks: found[1], rewrites: found[2]}))

/**
 * One release-notes command, whole.
 * @type {RegExp}
 */
const COMMANDS = /gh release (?:edit|create)[^\n]*/g

/**
 * Every release-notes command a step's script spends. A continuation is joined
 * first, so a `--title` wrapped onto the line behind is read as the argument it
 * is; an operator then parts what the join ran together, an `edit` falling back
 * on a `create` being two commands and each answering for itself.
 * @param {string} script - What the step runs
 * @return {Array.<string>} - The commands, whole
 */
const commanded = function(script) {
  return Array.from(
    script.replaceAll('\\\n', ' ')
      .replaceAll('||', '\n')
      .replaceAll('&&', '\n')
      .matchAll(COMMANDS),
  ).map((found) => found[0])
}

/**
 * Every workflow of the tree, each knowing where it stands, which
 * release-notes commands it spends and what triggers it.
 * @type {Array.<{where: string, notes: Array.<string>, on: object}>}
 */
const WRITTEN = allFilesFrom(WORKFLOWS)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => {
    const workflow = yaml.parsedFromFile(file)
    return {
      where: path.basename(file),
      notes: Object.values(workflow.jobs)
        .flatMap((job) => job.steps ?? [])
        .flatMap((step) => commanded(step.run ?? '')),
      on: workflow.on,
    }
  })

/**
 * What a stamp's pattern says, as the literal it is.
 * @param {string} looks - The pattern, as the workflow spells it
 * @return {string} - The text it stands for
 */
const literal = function(looks) {
  return looks.replaceAll('\\.', '.')
}

/**
 * How many places a stamp's pattern reaches, counted as the literal it is.
 * @param {string} text - What the file holds
 * @param {string} looks - The pattern, as the workflow spells it
 * @return {number} - How many times it stands there
 */
const reaching = function(text, looks) {
  return text.split(literal(looks)).length - 1
}

/**
 * Every script this repository declares, which is what tells a step running
 * the suite from one running npm's own: `install` and `publish` are npm's
 * commands and name no script of ours (#946).
 * @type {Array.<string>}
 */
const SCRIPTS = Object.keys(require('../package.json').scripts)

/**
 * How a step rewrites the checkout — a `sed` substitution, or the `npm
 * version` writing the manifest, the release stamp spending both.
 * @type {Array.<RegExp>}
 */
const STAMPING = [
  SUBSTITUTES,
  new RegExp(
    `npm${GAP}+(?:--[^${WHITESPACE}]+${GAP}+)*version(?![^${WHITESPACE}])`,
  ),
]

/**
 * Whether a step runs one of this repository's own npm scripts.
 * @param {string} script - What the step runs
 * @return {boolean} - Whether one of ours is spent there
 */
const spends = function(script) {
  return SCRIPTS.some(
    (name) => new RegExp(
      `npm${GAP}+(?:run${GAP}+)?${name}(?![^${WHITESPACE}])`,
    ).test(script),
  )
}

/**
 * Whether a step rewrites the checkout the suite reads.
 * @param {string} script - What the step runs
 * @return {boolean} - Whether it writes into the tree
 */
const stamps = function(script) {
  return STAMPING.some((looks) => script.match(looks) !== null)
}

/**
 * Every step of the release job in the order it runs, each knowing whether it
 * spends a script of ours and whether it stamps the checkout (#946).
 * @type {Array.<{where: string, spends: boolean, stamps: boolean}>}
 */
const RELEASED = RELEASE.jobs.release.steps.map((step) => ({
  where: step.name ?? step.run ?? step.uses,
  spends: spends(step.run ?? ''),
  stamps: stamps(step.run ?? ''),
}))

describe('workflows', function() {
  it('grants every job the scope its own steps write with', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.uses.some(
        (action) => action in WRITES && job.granted(WRITES[action]) !== 'write',
      )).map((job) => job.where),
      [],
      [
        'a job runs an action that writes to this repository and is granted',
        'no scope to write with, so the step dies where it tries and',
        'whatever it stood there to report goes unreported',
      ].join(' '),
    )
  })
  it('leaves every job the scope its own steps read with', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.uses.some(
        (action) => action in READS && job.granted(READS[action]) === 'none',
      )).map((job) => job.where),
      [],
      [
        'a job narrows itself to a block naming nothing about a scope one of',
        'its own steps reads with, so a step that asked for nothing loses',
        'what a job declaring no block at all would have been granted',
      ].join(' '),
    )
  })
  it('names the label every reporting job files its own issue under',
    function() {
      assert.deepEqual(
        JOBS.filter((job) => job.labels.includes('')).map((job) => job.where),
        [],
        [
          'a job reports its own failure under whatever label the action',
          'defaults to, and the action comments on the newest open issue',
          'carrying that label rather than opening one, so this schedule',
          'files under whatever else took the default first',
        ].join(' '),
      )
    })
  it('leaves no two reporting jobs filing under one label', function() {
    assert.deepEqual(
      JOBS.filter((job) => job.labels.some(
        (label) => LABELS.indexOf(label) !== LABELS.lastIndexOf(label),
      )).map((job) => job.where),
      [],
      [
        'two jobs report their failures under one label, so the second to',
        'fail comments on the first one\'s issue and two schedules keep one',
        'thread between them — which cannot be closed for either without',
        'losing the other',
      ].join(' '),
    )
  })
  it('reports the failure of every job a scheduled gate runs', function() {
    assert.deepEqual(
      SCHEDULED.filter((one) => !(one.where in UNGATED)).filter(
        (one) => !one.reporters.some((reporter) => one.jobs.every(
          (job) => job === reporter.name || reporter.needs.includes(job),
        )),
      ).map((one) => one.where),
      [],
      [
        'a schedule runs a gate whose failure files no issue, so the run goes',
        'red with nobody watching and the gate holds the tree to nothing',
      ].join(' '),
    )
  })
  it('exempts from reporting only a schedule that runs no gate', function() {
    assert.deepEqual(
      Object.keys(UNGATED).filter((where) => !SCHEDULED.some(
        (one) => one.where === where && one.reporters.length === 0,
      )),
      [],
      [
        'an exemption names a schedule that reports or runs no more, so it',
        'stands for nothing and reads like a gate left quiet on purpose',
      ].join(' '),
    )
  })
  it('holds no action the tree has stopped running', function() {
    assert.deepEqual(
      Object.keys(WRITES).concat(Object.keys(READS)).filter(
        (action) => !JOBS.some((job) => job.uses.includes(action)),
      ),
      [],
      [
        'an action named here is run by no job, so the scope it is held to',
        'stands for nothing and this list reads like a rule in force',
      ].join(' '),
    )
  })

  it('states one version wherever the README names its own release',
    function() {
      assert.deepStrictEqual(
        PINNED.filter((one) => one.version !== PINNED[0].version)
          .map((one) => `README.md:${one.where}`),
        [],
        [
          'cannot pin two versions of one repository in one README, a',
          'reader copying whichever block they land on (#897)',
        ].join(' '),
      )
    })

  it('rewrites every version the README pins of its own release', function() {
    assert.deepStrictEqual(
      PINNED.filter((one) => !REWRITES.some((rule) => rule.test(one.line)))
        .map((one) => `README.md:${one.where}`),
      [],
      [
        'cannot leave a version pin outside every pattern the up job',
        'rewrites with, a pin nothing reaches going stale in silence (#897)',
      ].join(' '),
    )
  })

  it('rewrites nothing the README states of somebody else', function() {
    assert.deepStrictEqual(
      STATED.filter((one) => foreign(one.line))
        .filter((one) => REWRITES.some((rule) => rule.test(one.line)))
        .map((one) => `README.md:${one.where}`),
      [],
      [
        'cannot rewrite a version this repository does not release to a tag',
        'of ours (#897)',
      ].join(' '),
    )
  })

  it('holds no rewrite the README has stopped carrying', function() {
    assert.deepStrictEqual(
      REWRITES.filter((rule) => !README.some((line) => rule.test(line)))
        .map((rule) => rule.source),
      [],
      [
        'cannot keep a pattern no line of the README answers, a rewrite',
        'matching nothing being the failure it was written to prevent',
        '(#897)',
      ].join(' '),
    )
  })

  it('names among the foreign versions only ones the README states',
    function() {
      assert.deepStrictEqual(
        Object.keys(FOREIGN).filter(
          (one) => !STATED.some((other) => new RegExp(one).test(other.line)),
        ),
        [],
        'cannot exempt a version the README has stopped stating (#897)',
      )
    })

  it('spends one stamp on every placeholder the stamped module carries',
    function() {
      assert.deepEqual(
        PLACEHOLDERS.filter(
          (stands) => STAMPS.filter(
            (one) => one.rewrites === STAMPED &&
              literal(one.looks).includes(stands),
          ).length !== 1,
        ),
        [],
        [
          `cannot leave a placeholder ${STAMPED} carries to no stamp of the`,
          'release\'s, the two gates below weighing the substitutions they',
          'find and neither asking that any was found, so a stamp deleted',
          'or retooled ships the placeholder to npm and reads exactly as a',
          'stamp that works (#917)',
        ].join(' '),
      )
    })
  it('reaches one place with every substitution the release stamp spends',
    function() {
      assert.deepStrictEqual(
        STAMPS.filter(
          (one) => reaching(sourced(one.rewrites), one.looks) !== 1,
        ).map((one) => `${one.rewrites}: ${one.looks}`),
        [],
        [
          'cannot stamp the version with a pattern reaching more of a file',
          'than the field it means, a placeholder standing inside a',
          'dependency of its own being rewritten along with it (#917)',
        ].join(' '),
      )
    })

  it('spells every substitution the release stamp spends as a literal',
    function() {
      assert.deepStrictEqual(
        STAMPS.filter((one) => !PLAIN.test(one.looks))
          .map((one) => `${one.rewrites}: ${one.looks}`),
        [],
        [
          'cannot weigh a stamp written as anything but ordinary characters',
          'and escaped dots, what one reaches being read here as the',
          'literal it is (#917)',
        ].join(' '),
      )
    })

  it('spends every script of its own before the release stamps the tree',
    function() {
      assert.deepStrictEqual(
        RELEASED.filter(
          (step, index) => step.spends &&
            RELEASED.slice(0, index).some((earlier) => earlier.stamps),
        ).map((step) => step.where),
        [],
        [
          'cannot run the suite over a tree the release has already stamped,',
          'the two gates above reading the stamped module off the working',
          'tree, so a placeholder rewritten in front of them reaches nothing',
          'and the release dies at a test that is green everywhere else',
          '(#946)',
        ].join(' '),
      )
    })

  it('names a title with every release-notes command any workflow spends',
    function() {
      assert.deepStrictEqual(
        WRITTEN.flatMap(
          (one) => one.notes.filter((command) => !command.includes('--title'))
            .map((command) => `${one.where}: ${command}`),
        ),
        [],
        [
          'cannot write release notes without naming the title beside them,',
          'a release left unnamed keeping the name of whatever issue rultor',
          'was asked in (#919)',
        ].join(' '),
      )
    })

  it('writes the release notes again on an event that fires after rultor',
    function() {
      assert.ok(
        WRITTEN.some(
          (one) => one.notes.length > 0 &&
            (one.on.release?.types ?? []).includes('edited'),
        ),
        [
          'cannot leave the release notes to a step bound to the tag push,',
          'rultor writing its own body over the release a minute after',
          'publishing it, so nothing but the edited event lands last (#919)',
        ].join(' '),
      )
    })
})
