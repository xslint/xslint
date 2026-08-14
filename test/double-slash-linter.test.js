/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByDoubleSlash} = require('../src/linters/double-slash-linter')
const {validate} = require('../src/validators/xpath-validator')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml double slash linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'double-slash-packs'),
)

describe('double-slash-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} double slashes`, function() {
        const {expressions} = validate([
          {file: 'test.xsl', content: yml.input, xsl: input},
        ])
        const defects = lintByDoubleSlash(expressions)
        assert.equal(defects.length, yml.found.amount)
        yml.found.positions.forEach((pos, index) => {
          assert.equal(defects[index].line, pos[0])
          assert.equal(defects[index].pos, pos[1])
          assert.equal(defects[index].name, pos[2] ?? yml.pack)
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
  it('cannot report a double slash check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'double-slash-packs', 'use-double-slash.yaml',
    ))
    const {expressions} = validate([{
      file: 'test.xsl', content: yml.input,
      xsl: xml.parsedFromString(yml.input),
    }])
    assert.equal(lintByDoubleSlash(expressions, ['double-slash']).length, 0)
  })
})
