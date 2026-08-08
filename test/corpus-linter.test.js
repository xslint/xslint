/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByCorpus} = require('../src/linters/corpus-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml corpus test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(path.resolve(__dirname, 'resources', 'corpus-packs'))

describe('corpus-linter', function() {
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
