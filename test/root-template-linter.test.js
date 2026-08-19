/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByRootTemplate} = require('../src/linters/root-template-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml root template linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'root-template-packs'),
)

describe('root-template-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} root template faults`, function() {
        const defects = lintByRootTemplate(
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
  it('cannot report a root template check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'root-template-packs',
      'use-output-method-xml-for-html-1.yaml',
    ))
    assert.equal(
      lintByRootTemplate(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['output-method'],
      ).length,
      0,
    )
  })
  it('cannot report a null output check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'root-template-packs',
      'null-output-from-stylesheet.yaml',
    ))
    assert.equal(
      lintByRootTemplate(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['null-output'],
      ).length,
      0,
    )
  })
})
