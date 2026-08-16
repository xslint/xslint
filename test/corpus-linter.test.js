/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {anchoring, lintByCorpus} = require('../src/linters/corpus-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml corpus test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(path.resolve(__dirname, 'resources', 'corpus-packs'))

/**
 * Reference templates no check may carry, the name having to stand against
 * fixed text at exactly one end. Against text at neither end the mark is the
 * empty string, which `indexOf` finds at every offset and, past the end, goes
 * on answering the length rather than -1 — so the scan never advances and the
 * whole run hangs before a defect is reported. Against text at both ends only
 * the near side is read, so the far one is never matched and a declaration
 * that is used is reported as dead (#783).
 * @type {Array.<string>}
 */
const UNANCHORED = ['{name}', 'x{name}y', '${name}(']

describe('corpus-linter', function() {
  UNANCHORED.forEach((reference) => {
    it(`cannot take the unanchored reference template ${reference}`, function() {
      assert.throws(
        () => anchoring(reference),
        /anchors the name against text at neither end or at both/,
        `the template ${reference} was taken, where it anchors the name ` +
          'against text at neither end or at both, and one of those hangs ' +
          'the scan while the other reports a declaration that is used',
      )
    })
  })
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const corpus = yml.inputs.map((input, index) => ({
      file: `file${index}.xsl`,
      xsl: xml.parsedFromString(input),
    }))
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} defects by check ${yml.pack}`, function() {
        const defects = lintByCorpus(corpus)
        assert.equal(defects.length, yml.found.amount)
        yml.found.positions.forEach((pos, index) => {
          assert.equal(defects[index].file, `file${pos[0]}.xsl`)
          assert.equal(defects[index].line, pos[1])
          assert.equal(defects[index].pos, pos[2])
        })
      })
    })
  })
})
