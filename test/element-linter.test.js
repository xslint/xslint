/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByElement} = require('../src/linters/element-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml element linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'element-packs'),
)

describe('element-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} static element names`, function() {
        const defects = lintByElement(
          [{file: 'test.xsl', content: yml.input, xsl: input}],
        )
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
  it('cannot report an element check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'element-packs',
      'not-creating-element-correctly.yaml',
    ))
    assert.equal(
      lintByElement(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['not-creating-element'],
      ).length,
      0,
    )
  })
})
