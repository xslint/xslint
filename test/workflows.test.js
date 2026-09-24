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
 *
 * The `up` job is a reporter of the same kind, one document out. It rewrites
 * the version references in `README.md` on every tag, and it anchored on the
 * npm coordinate alone: `xslint@[0-9.]+` reaches the two `@maxonfjvipon/xslint`
 * pins and walks past the pre-commit `rev:`, which carries no `xslint@` in
 * front of it. So the job rewrote two of three and reported success — `sed`
 * says nothing about matching nothing, and `create-pull-request` opens nothing
 * where the tree is unchanged, which is a pin the job cannot reach reading
 * exactly like a pin already current. The `rev:` stood at `0.0.11` for three
 * releases and 735 commits, and anybody who copied that block got July's hook
 * (#897).
 *
 * The gate asks four questions of the job, and none of them is the tag — which
 * a checkout fetching one commit does not carry, and which a release would
 * redden master over until the job's own pull request merged. Every version the
 * README states of this repository agrees with every other, every one of them
 * is reached by a pattern the job actually spells, no pattern reaches a version
 * somebody else releases, and no pattern reaches nothing at all. `FOREIGN` is
 * the table holding the last two apart, and the fifth question is asked of it:
 * red from both sides like every exemption list here, an entry naming a version
 * the README has stopped stating fails as loudly as an unreached pin.
 *
 * The `release` job writes two things nothing weighed, and both were wrong at
 * 0.1.0. It **stamps** the version by replacing the string `0.0.0` wherever it
 * stands, and `package.json` holds that string three times: the version field,
 * and the two `@stryker-mutator/*` pins at `^10.0.0`, which contain it. `sed`
 * without `/g` still rewrites the first match on every line, so all three
 * moved, and the 0.1.0 tarball on npm names a stryker version nobody has
 * published. Nothing failed, which is why it shipped: the stamp runs after `npm
 * install`, so no resolution is attempted against the rewritten pins, `npm
 * publish` installs no devDependencies, and a consumer reads none. The field is
 * `npm version`'s to write now, that command knowing which key it owns, and
 * what is left of the stamp is two substitutions over `src/version.js`, each
 * held to reaching **one** place in the file it rewrites. That is the whole of
 * the defect, a pattern being wrong here by reaching more than the field it
 * means, and it is asked of what the workflow spells rather than of a copy —
 * `STAMPS` reads the patterns out of the step, so a third one added answers to
 * it too, and one spelled as anything but a literal is refused rather than read
 * as a regular expression whose dialect this gate would be guessing at. Both of
 * those weigh the substitutions they find and neither asks that any were found,
 * which is the counter-defect of #917's own in the file #917 is about: `STAMPS`
 * comes off the workflow, so deleting both `sed` lines — or writing them with
 * `perl -pi -e` — empties the list and passes both gates while `src/version.js`
 * ships `0.0.0` and `0000-00-00` to npm. So the placeholders are read off that
 * module, a quoted number being the only thing it holds of the kind, and each
 * is held to exactly one stamp reaching it — `UNIMPORTED`'s assertion in
 * `test/manifest.test.js` one file over, a table holding a sweep to having
 * found something, and what makes the two gates beside it say anything at all
 * (#917).
 *
 * It also writes the **notes**, and so does rultor, and neither waits for the
 * other. The step ran at 08:40:38 on the day 0.1.0 was cut and succeeded — its
 * log prints the release URL, which is what `gh release edit` prints on success
 * — and the release then read `See #876, release log:` over a commit list, 2058
 * characters where the changelog section is 35014. Rultor publishes the release
 * a minute before its build ends and writes the body again at the end, so a
 * step bound to the tag push loses, and so does one bound to `published` alone.
 * The last four releases split evenly: 0.0.13 and 0.0.14 carried the changelog,
 * 0.0.12 and 0.1.0 rultor's log — 0.1.0 until it was set right by hand, so
 * three of the four still read that way. The title never survived at all,
 * `--title` riding the `create` fallback alone, so every release here is named
 * after whichever issue rultor was asked in — 0.1.0 read "Sequence a stable
 * release around what the corpora say, not around an audit", and 0.0.13 and
 * 0.0.14 both read "Audit: three checks are not genuine best practices". So
 * `notes.yml` re-asserts both on the `release` event with `edited` among its
 * types, the one trigger that fires *after* rultor's last write — `published`
 * standing beside it for the release rultor publishes and never edits again —
 * and only where the sender is rultor, so an edit of the owner's own is left
 * where they made it. Nothing re-triggers it: a write through `GITHUB_TOKEN`
 * raises no event, which is also why the tag-push path keeps a writer of its
 * own — a release that path creates itself fires no `release` event for the
 * other to answer. Two questions are asked here and neither is the outcome,
 * which only a real release shows: every release-notes command names a title,
 * and the notes are re-asserted on an event that fires after the race (#919).
 *
 * Both of the stamp gates read `src/version.js` off the working tree, and the
 * job they guard rewrote it first: the stamp stood in front of `npm test`, so
 * by the time either ran the placeholders were the stamped values and the
 * patterns reached nothing. They pass on master and on every pull request and
 * can only fail inside the one job they are about, which is where they did —
 * 0.2.0 stopped at `npm test`, npm was never published, and the dispatch that
 * releases `xslint-lsp` and `xslint-action` never fired. 0.1.0 was spared by a
 * day, #917 having merged after that release ran. The suite belongs over the
 * tree as it was committed, so the stamp moves behind it — and since the trap
 * is re-armable by whoever reorders the job next, the order is a gate of its
 * own: no step spending a script of ours may stand after one that rewrites the
 * checkout, which is the two substitutions above and the `npm version` writing
 * the manifest beside them (#946).
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
