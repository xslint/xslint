/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByImports} = require('../src/linters/import-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')

/**
 * Yaml import linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(path.resolve(__dirname, 'resources', 'import-packs'))

/**
 * Stylesheets in the small chain. Two hundred rather than forty, which is what
 * `test/scaling.test.js` builds: a quadratic whose constant is small is
 * invisible at the size where the per-edge cost still dominates, and this one
 * read a flat 1.0 to 1.6 there while it cost the square of the chain (#769).
 * @type {number}
 */
const CHAIN = 200

/**
 * How many times longer the second chain is than the first.
 * @type {number}
 */
const STEP = 4

/**
 * How many times more the longer chain may cost. The bar stands between two
 * measured distributions, the way the one ceiling of `test/scaling.test.js`
 * that has a defect to catch does. A cycle check answering one edge at a time
 * by walking the whole graph costs the square of a chain and so reads `STEP`
 * squared: 13.74 to 15.36 over ten runs of this test, against the 16.0 the
 * arithmetic predicts. One that answers every edge in a single pass costs the
 * edges themselves and so reads `STEP`: 3.10 to 4.56 over ten more, against
 * 4.0.
 *
 * Eight is the geometric middle of those two distributions — 1.75 times the
 * dearest reading the one pass gives and 1.72 times below the cheapest the
 * walk-per-edge gives — and of the two arithmetics as well, four and sixteen.
 * Geometric rather than arithmetic because the risk is multiplicative on either
 * side: a growth ratio is taken inside one process and so cancels a machine's
 * speed, but not its character, and a runner charging half again for the
 * allocation a walk does would read 6.8 for the pass and 9.2 for the square,
 * both of them still on their own side of the bar.
 * @type {number}
 */
const GROWTH = 8

/**
 * How many times the work is timed, the lowest reading answering. Noise only
 * ever inflates a reading, so the floor of several is the honest one. A whole
 * measurement is taken before them and thrown away, on the one principle a
 * warm-up has — warm the code with the work about to be timed. The first
 * spelling of this warmed on the longer chain alone and read the ratio 3.09 to
 * 8.20 over ten runs, a spread wide enough to reach the bar below on its own,
 * where a measurement of both chains discarded reads 3.10 to 4.56.
 * @type {number}
 */
const ATTEMPTS = 3

/**
 * The one stylesheet the chain is built out of, read once. It is a committed
 * resource rather than a string spelled here, the way every test stylesheet in
 * this repository is.
 * @type {string}
 */
const SHEET = fs.readFileSync(
  path.join(__dirname, 'resources', 'imports', 'stylesheet.xsl'), 'utf-8',
)

/**
 * A chain of stylesheets numbered from one file on, each importing the one
 * before it. The first one's import resolves to a file the corpus does not
 * hold, so it is external and yields no edge, which is what leaves the chain
 * open rather than closed into a cycle.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many to build
 * @return {Array.<{file: string, content: string, xsl: Document}>} - Corpus
 */
const chained = function(from, files) {
  const corpus = []
  for (let at = 0; at < files; at++) {
    const content = SHEET
      .replaceAll('PREVIOUS', String(from + at - 1))
      .replaceAll('SEED', String(from + at))
    corpus.push({
      file: `s${from + at}.xsl`,
      content: content,
      xsl: xml.parsedFromString(content),
    })
  }
  return corpus
}

/**
 * Processor time spent so far, in microseconds. The wall clock charges the
 * check for every slice the scheduler hands to something else, which is what
 * made the wall-clock spelling of `test/scaling.test.js` unusable on a busy
 * machine.
 * @return {number} - Microseconds of processor time
 */
const charged = function() {
  const spent = process.cpuUsage()
  return spent.user + spent.system
}

/**
 * Processor time one import linting of a corpus costs.
 * @param {Array.<{file: string, content: string, xsl: Document}>} corpus -
 *  Parsed stylesheets
 * @return {number} - Microseconds spent
 */
const spentOn = function(corpus) {
  const began = charged()
  lintByImports(corpus)
  return charged() - began
}

/**
 * The lowest reading each corpus gives over `ATTEMPTS` rounds, the rounds
 * interleaved so the two meet the same machine rather than one of them meeting
 * it first.
 * @param {Array.<Array.<{file: string, content: string, xsl: Document}>>}
 *  corpora - Parsed stylesheets, in corpora
 * @return {Array.<number>} - Microseconds spent, one reading per corpus
 */
const judged = function(corpora) {
  const low = corpora.map(() => Infinity)
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    corpora.forEach((corpus, at) => {
      low[at] = Math.min(low[at], spentOn(corpus))
    })
  }
  return low
}

describe('import-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const corpus = yml.inputs.map((input, index) => ({
      file: `file${index}.xsl`,
      content: input,
      xsl: xml.parsedFromString(input),
    }))
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} circular imports`, function() {
        const defects = lintByImports(corpus)
        assert.equal(defects.length, yml.found.amount)
        yml.found.positions.forEach((pos, index) => {
          assert.equal(defects[index].file, `file${pos[0]}.xsl`)
          assert.equal(defects[index].line, pos[1])
          assert.equal(defects[index].pos, pos[2])
        })
        yml.found.fixes.forEach((expected, index) => {
          assert.equal(
            defects[index].fix?.replacement ?? null,
            expected,
          )
        })
      })
    })
  })
  it('cannot report an import check that is suppressed', function() {
    const yml = yaml.parsedFromFile(
      path.resolve(__dirname, 'resources', 'import-packs', 'circular-import.yaml'),
    )
    const corpus = yml.inputs.map((input, index) => ({
      file: `file${index}.xsl`,
      content: input,
      xsl: xml.parsedFromString(input),
    }))
    assert.equal(lintByImports(corpus, ['import']).length, 0)
  })
  it('cannot cost the square of the chain it is handed', function() {
    const chains = [chained(0, CHAIN), chained(CHAIN, CHAIN * STEP)]
    judged(chains)
    const readings = judged(chains)
    const grew = readings[1] / readings[0]
    assert.ok(
      grew < GROWTH,
      `growing ${grew.toFixed(2)} times over a chain ${STEP} times longer ` +
      `is not under ${GROWTH}`,
    )
  })
})
