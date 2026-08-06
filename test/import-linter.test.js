/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByImports} = require('../src/import-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml import linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(path.resolve(__dirname, 'resources', 'import-packs'))

describe('import-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const corpus = yml.inputs.map((input, index) => ({
      file: `file${index}.xsl`,
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
      xsl: xml.parsedFromString(input),
    }))
    assert.equal(lintByImports(corpus, ['import']).length, 0)
  })
})
