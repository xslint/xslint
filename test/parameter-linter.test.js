/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByParameter} = require('../src/linters/parameter-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml parameter linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'parameter-packs'),
)

describe('parameter-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} unused parameters`, function() {
        const defects = lintByParameter(
          [{file: 'test.xsl', content: yml.input, xsl: input}],
        )
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
  it('cannot report a parameter check that is suppressed', function() {
    const yml = yaml.parsedFromFile(
      path.resolve(
        __dirname, 'resources', 'parameter-packs', 'three-unused-parameters.yaml',
      ),
    )
    assert.equal(
      lintByParameter(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['unused-function'],
      ).length,
      0,
    )
  })
})
