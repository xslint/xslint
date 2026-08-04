/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByAxis} = require('../src/xpath-axis-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml axis linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'axis-packs'),
)

describe('xpath-axis-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} unabbreviated axes`, function() {
        const defects = lintByAxis([{file: 'test.xsl', content: yml.input, xsl: input}])
        assert.equal(defects.length, yml.found.amount)
        yml.found.positions.forEach((pos, index) => {
          assert.equal(defects[index].line, pos[0])
          assert.equal(defects[index].pos, pos[1])
        })
        yml.found.fixes.forEach((expected, index) => {
          assert.equal(
            defects[index].fix ? defects[index].fix.replacement : null,
            expected,
          )
        })
        const values = yml.found.values || []
        values.forEach((expected, index) => {
          assert.equal(
            defects[index].fix ? defects[index].fix.value : null,
            expected,
          )
        })
      })
    })
  })
})
