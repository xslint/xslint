/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByStringLength} = require('../src/linters/string-length-linter')
const {validate} = require('../src/validators/xpath-validator')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml string-length linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'string-length-packs'),
)

describe('string-length-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} string-length comparisons`,
        function() {
          const {expressions} = validate([{file: 'test.xsl', content: yml.input, xsl: input}])
          const defects = lintByStringLength(expressions)
          assert.equal(defects.length, yml.found.amount)
          yml.found.positions.forEach((pos, index) => {
            assert.equal(defects[index].line, pos[0])
            assert.equal(defects[index].pos, pos[1])
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
})
