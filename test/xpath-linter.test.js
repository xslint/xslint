/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {evaluateXpath, lintByXpath} = require('../src/linters/xpath-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')

/**
 * Yaml test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(path.resolve(__dirname, 'resources', 'xpath-packs'))

describe('xpath-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const lint = yaml.parsedFromFile(
      path.resolve(__dirname, '../src/resources/checks/xpath', `${yml.pack}.yaml`),
    )
    const input = xml.parsedFromString(yml.input)
    const other = yml.found.positions.filter((pos) => pos.length === 3).length
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount - other} defects by check ${yml.pack}`, function() {
        const evaluated = evaluateXpath(input, lint.xpath)
        assert.equal(
          evaluated.length,
          yml.found.amount - other,
        )
        yml.found.positions
          .filter((pos) => pos.length === 2)
          .forEach((pos, index) => {
            assert.equal(evaluated[index].line, yml.found.positions[index][0])
            assert.equal(evaluated[index].pos, yml.found.positions[index][1])
          })
      })
      it(`should find ${yml.found.amount} defects by all checks`, function() {
        const defects = lintByXpath([{file: 'test.xsl', content: yml.input, xsl: input}])
        assert.equal(defects.length, yml.found.amount)
        defects.forEach((defect, index) => {
          let severity = lint.severity
          let message = lint.message
          let name = yml.pack
          if (yml.found.positions[index].length == 3) {
            const temp = yaml.parsedFromFile(
              path.resolve(__dirname, '../src/resources/checks/xpath', `${yml.found.positions[index][2]}.yaml`),
            )
            severity = temp.severity
            message = temp.message
            name = yml.found.positions[index][2]
          }
          assert.equal(defect.severity, severity)
          assert.equal(defect.message, message)
          assert.equal(defect.line, yml.found.positions[index][0])
          assert.equal(defect.pos, yml.found.positions[index][1])
          assert.equal(defect.name, name)
        })
      })
    })
  })
})
