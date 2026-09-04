/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The second tier is for what a corpus of our own making cannot show at all.
 * `corpora.yml` runs nightly, cloning DocBook-XSL, TEI and DITA-OT at pinned
 * commits — a branch tip would drift under the numbers — restoring them
 * through `actions/cache`, writing what it found to the job summary, and
 * failing past a per-corpus budget so `jayqi/failed-build-issue-action` opens
 * an issue the way `daily.yml` does — which neither of them could do until
 * #826, and `test/workflows.test.js` is what holds it now. Vendoring those
 * corpora instead is a trap: each carries its own licence, and `reuse`,
 * `copyrights` and `xcop` would all have to be told to look away.
 *
 * That tier asserts what it read and not only how long it took, because a
 * budget alone is blind to the failure it most wants to catch. It timed
 * `xslint … --quiet || true` at first, so a run that linted nothing passed:
 * point it at a path that does not exist and the exit code is *zero*, no code
 * distinguishing "found defects" from "died", and the whole of #758 — a walk
 * that crashes before a byte of XSL is read — would have stayed green under
 * it. So the step drops `--quiet`, keeps stderr, and compares the stylesheets
 * `find` sees on disk against the count the run reports having processed,
 * which are the same number or the run did not do its job. Past that it fails
 * on an exit code above 1, since neither a clean run nor defects found can
 * produce one, and then on the budget.
 *
 * The budget is a ratchet and not a licence, which is the half that was
 * missing for as long as the tier has existed. Cut once when it was written
 * and then left behind by #755, #770, #776, #777, #783 and #784, the three
 * stood 9, 14 and 18 times what they gated by the time #785 was filed, so
 * nothing short of a total collapse could have failed them — #755's own
 * quadratic cost DocBook-XSL 44 s against a budget of 180 and would have
 * passed it twice over. So `scripts/budget.js` judges a reading from both
 * sides, past the budget and further than `SLACK` (four, as in
 * `test/scaling.test.js` and for the same reason) under it, and the step
 * calls it rather than comparing two numbers of its own — which
 * `test/budget.test.js` asserts, a ratchet nobody has to route through being
 * one an inline comparison quietly replaces. What a budget answers to is a
 * measurement on the runner: a share cancels a machine's speed where a wall
 * clock carries it, so a developer machine cannot set this bar, and the
 * notice each run now prints is where the reading is read off. Six runs of it
 * on the tree #784 left — one nightly, five dispatched — give 13, 14, 20, 13,
 * 13 and 14 seconds over DocBook-XSL, 9, 10, 11, 10, 10 and 8 over TEI, and
 * 5, 4, 5, 4, 3 and 5 over DITA-OT, so the runner disagrees with itself about
 * one tree by half as much again and the window has to hold a slow night as
 * well as a fast one. The budgets were twice the dearest of those — 40, 22
 * and 10 — which put each budget's own quarter at 10, 5.5 and 2.5 seconds and
 * left the ratchet firing at 9, 5 and 2 and under, the clock counting in
 * whole seconds. Those three stood below the 13, 8 and 3 their corpora had
 * given, which is the property a budget has to hold and not merely a fact
 * about those numbers: `CHEAPEST` in `test/budget.test.js` asserts it, since
 * a budget wide enough to fire on a night that has already happened reddens a
 * build on a tree nobody has touched.
 *
 * That ratchet is what spoke next, and it is the first of either tier's to
 * have spoken at all. Three changes — #812, #815 and #818 — took a quarter, a
 * fifth and a tenth off the staged run over the three corpora, and two
 * nightlies went red on budgets that had stopped being bars: DocBook-XSL at 6
 * seconds against 40, DITA-OT at 2 against 10 (#827). Nine runs on the tree
 * #818 left, two nightly and seven dispatched, give 7, 6, 8, 8, 5, 8, 7, 8
 * and 4 seconds over DocBook-XSL, 5, 8, 8, 6, 7, 7, 7, 7 and 7 over TEI, and
 * 3, 2, 3, 3, 3, 3, 3, 2 and 3 over DITA-OT. Twice the dearest of those is
 * 16, 16 and 6, whose quarters are 4, 4 and 1.5, so the ratchet fires at 3, 3
 * and 1 and under against cheapest nights of 4, 5 and 2. Reverting the matrix
 * to 40, 22 and 10 fails four rows of `test/budget.test.js`, three of them
 * `CHEAPEST`'s; a budget under the dearest night fails that corpus's ceiling
 * row alone; one tick past the new cut, DocBook-XSL at 21, fails `CHEAPEST`
 * on its own, and DITA-OT does at 9.
 *
 * What is thin is the clock rather than the cut, and the ninth of those runs
 * is where that shows. It read DocBook-XSL at 4 seconds where the eight
 * before it read 5 to 8, so one corpus spans a factor of two on a tree
 * nothing has touched — and since `SLACK` is four, a window can hold a
 * fourfold span at most, which leaves that observed spread filling half of it
 * and the ratchet standing one tick under the cheapest night rather than two.
 * DITA-OT is the same thing at the clock's own edge: 2 to 3 seconds where
 * `date +%s` counts in whole ones is a third to a half of the reading in
 * quantisation alone, so a bar cut from it is cut partly from noise. Both
 * windows held — [4, 16] and [2, 6] — so that cut stood on the clock the tier
 * had, and #827 stands rescoped to the clock itself, the cut having closed
 * #826 alone.
 *
 * `date +%s%3N` is that clock, and the first thing it settles is the spread.
 * Six dispatched runs on the tree #849 left spanned 1.48, 1.34 and 1.17 over
 * DocBook-XSL, TEI and DITA-OT rather than the factor of two whole seconds
 * reported, since a true 4666 reads as 4 and a true 6923 as 6 and the grid
 * widens the pair before anything measures it. Twice the dearest of those
 * readings gave 13000, 13000 and 6000, margins of 1.44, 1.54 and 1.89 under
 * cheapest nights of 4666, 5013 and 2830.
 *
 * Serving outgrew that cut. #811 took DocBook-XSL from 5899 to 6923 ms down
 * to 4191 to 5459, and DITA-OT from 2830 to 3311 down to 1936 to 2636, so a
 * budget cut at twice the old dearest stands over four times the new
 * cheapest, and the ratchet fired on DITA-OT at 1424 against 6000 — the first
 * time the loose side of it caught anything in production. Six runs
 * dispatched on the tree #872 left, and the night one merge behind it, give
 * dearest readings of 5459, 5656 and 2636 against cheapest ones of 3296, 2846
 * and 1424. Each budget is the geometric middle of the window its own two
 * ends leave — half again to twice the dearest, capped where `SLACK` times
 * the cheapest over `MARGIN` cuts in — which is 9500, 9000 and 4500, at 1.74,
 * 1.59 and 1.71 times their dearest and leaving margins of 1.39, 1.26 and
 * 1.27. The cap is what binds for TEI and DITA-OT rather than twice the
 * dearest — TEI's window closes at 9487 and not 11312, DITA-OT's at 4747 and
 * not 5272 — and only DocBook-XSL's spread leaves it slack.
 *
 * A later six did not displace that set, and why is what makes the table a
 * record rather than a snapshot. #811's wildcard phase takes 6.7, 2.8 and
 * 2.6% off the three corpora, where one tree's own six readings span 1.68,
 * 1.47 and 1.78 — 3204 to 5389 over DocBook-XSL, 3525 to 5174 over TEI, 1453
 * to 2586 over DITA-OT — so the runner disagrees with itself by an order more
 * than a cut of this size moves, and a fresh set joins the record rather than
 * replacing it. One reading moved: DocBook-XSL's cheapest, 3296 down to 3204,
 * which closes its window at 10680 rather than 10918 and so puts the cap in
 * front of twice the dearest there too. Its middle is 9352, so the budget
 * stays 9500, quiet now on a night 1.35 times faster than the cheapest rather
 * than 1.39. Merging the two sets is safe because the ratchet polices it: a
 * record a real halving has left behind is a budget standing over four times
 * the cheapest, which is the side `scripts/budget.js` fails from.
 *
 * That margin is the bar the tick used to stand in for. `MARGIN` in
 * `test/budget.test.js` asks each budget to stay quiet on a night 1.2 times
 * faster than the cheapest on record — the geometric middle of the 1.00 the
 * whole-second cut recorded and the 1.44 the cut beside it left — and
 * `RESOLUTION` asks a tick to stand under 0.019 of what its corpus costs, the
 * middle of DITA-OT's half and its 1424th. The row those two replace asked
 * for one tick of margin, which a millisecond grid turns into a question no
 * tree can fail; and since both are written in ticks, a third row reads the
 * workflow for the `date +%s%3N` that makes a tick what `TICK` says it is. On
 * the tree #827 found, all three redden — every corpus fails `RESOLUTION`,
 * DocBook-XSL fails `MARGIN`, and the step spells `date +%s`.
 *
 * Three questions #827 parked are answered by that table rather than by a
 * change. A median of several runs narrows nothing a fourfold window cannot
 * already carry, and would cost the tier a clone a night to defend a margin
 * that is 1.26 at its worst. `SLACK` at four is a span the widest observed
 * spread fills half of, leaving 1.26 under and 1.59 over at their worst, so
 * it holds for a wall clock as it does for a share, and a bar raised on
 * nobody's failure is a bar loosened. And DITA-OT is not too small to gate:
 * at 1424 ms a tick is one part in 1424, and its margin is no worse than
 * TEI's. The corpus was never what was too small.
 */

const {verdict, TICK} = require('../scripts/budget')
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
 * The dearest milliseconds each corpus has read on the runner, over the six
 * runs #811's wildcard phase dispatched and the six before them, one tree's
 * own spread being an order above what a cut moves. A budget answers to this
 * and not to a developer machine, a share cancelling a machine's speed where
 * a wall clock carries it, and each stands at the middle of its window (#811).
 * @type {{[name: string]: number}}
 */
const RUNS = {docbook: 5459, tei: 5656, ditaot: 2636}

/**
 * The cheapest of that record, which is the side a ratchet can turn red
 * from. A budget of `SLACK` times a reading fires on everything below a quarter
 * of it, so one must stand above the dearest night and leave `MARGIN` under the
 * cheapest, or a fast night reddens a tree nobody has touched (#827, #811).
 * @type {{[name: string]: number}}
 */
const CHEAPEST = {docbook: 3204, tei: 2846, ditaot: 1424}

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
    spent: 41000, budget: 40000,
    said: 'linting docbook took 41000ms, past its 40000ms budget',
  },
  {
    name: 'says nothing about a run standing exactly at its budget',
    spent: 40000, budget: 40000, said: '',
  },
  {
    name: 'says nothing about a run one tick inside its budget',
    spent: 39999, budget: 40000, said: '',
  },
  {
    name: 'reports a budget standing further than SLACK above its run',
    spent: 9000, budget: 40000,
    said: 'linting docbook took 9000ms where its budget allows 40000ms, ' +
      'which is over 4 times the run: the budget has stopped being a bar ' +
      'and wants re-cutting from a measurement',
  },
  {
    name: 'says nothing about a budget standing exactly SLACK above it',
    spent: 10000, budget: 40000, said: '',
  },
  {
    name: 'says nothing about a reading of no milliseconds at all',
    spent: 0, budget: 40000, said: '',
  },
]

/**
 * The largest share of a corpus's own reading one tick of the tier's clock may
 * stand at. A reading is true to within a tick, so a clock coarse beside what
 * it times spends the window on quantisation before the runner's own variance
 * is paid for: whole seconds put a tick at half of what DITA-OT costs where
 * milliseconds put it at a 1424th, and this is the middle (#827, #811).
 * @type {number}
 */
const RESOLUTION = 0.019

/**
 * How much faster than the cheapest night on record a run may be before the
 * ratchet under it fires. Whole seconds left DocBook-XSL none at all — the
 * budget fired at the cheapest reading itself, so what stood under it was the
 * clock and not a margin — where milliseconds left 1.44, and this cut 1.26 at
 * worst (#827, #811).
 * @type {number}
 */
const MARGIN = 1.2

/**
 * The `date` format the tier's step has to time with, so that `TICK` states the
 * clock the workflow keeps rather than one this suite believes it does.
 * @type {string}
 */
const CLOCK = '%s%3N'

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
    it(`keeps a margin under the cheapest ${one.name} on record`, function() {
      assert.equal(
        verdict(one.name, CHEAPEST[one.name] / MARGIN, one.budget),
        '',
        'a nightly budget fires its own ratchet a margin under a reading its ' +
          'corpus has already given, so a fast night reddens a build on a ' +
          'tree nobody has touched',
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
  CORPORA.forEach((one) => {
    it(`resolves ${one.name} finely enough to measure it`, function() {
      assert.ok(
        TICK / CHEAPEST[one.name] <= RESOLUTION,
        'the tier times a corpus with a clock too coarse to resolve it, so a ' +
          'reading of it is quantisation before it is a measurement',
      )
    })
  })
  it('times each corpus with the clock a tick is written in', function() {
    assert.ok(
      fs.readFileSync(WORKFLOW, 'utf-8').includes(`date +${CLOCK}`),
      'the nightly step times its run with a clock other than the one ' +
        'scripts/budget.js states a tick of, so every bar written in ticks ' +
        'stands on a unit nothing holds it to',
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
