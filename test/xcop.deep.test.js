/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')
const fs = require('fs')
const {runXcop, cmdAvailable} = require('./helpers')

/**
 * Directory holding every test pack.
 * @type {string}
 */
const RESOURCES = path.resolve(__dirname, 'resources')

/**
 * Yaml packs holding inline XSL, auto-discovered from every `*-packs` directory
 * so a new pack directory is formatting-checked without being registered here.
 * @type {Array<string>}
 */
const PACKS = fs.readdirSync(RESOURCES)
  .filter((entry) => entry.endsWith('-packs'))
  .flatMap((dir) => allFilesFrom(path.resolve(RESOURCES, dir)))

/**
 * Whether xcop runs here, asked with the same command the tests run it by, so
 * the probe cannot answer a different question from theirs.
 * @type {boolean}
 */
const available = cmdAvailable('xcop', ['--version'], false)

/**
 * Packs whose fixture must carry a construct xcop rejects, so it cannot also be
 * canonical XML — an unused namespace declaration is the very thing
 * `redundant-namespace-declarations` exists to flag, and the gap a
 * `no-break-space-before-the-bracket` pack puts before a bracket is the very
 * character #643 is about: xcop insists on seeing it written `&#xA0;`, which is
 * how the pack does write it, but the check re-serializes through xmldom first
 * and xmldom emits the raw character. One name covers all six such packs, one
 * per linter. Excluded from the formatting check, as the fix fixtures are in
 * the xcop workflow.
 * @type {Array.<string>}
 */
const UNFORMATTED = [
  'redundant-namespace-declarations.yaml',
  'no-break-space-before-the-bracket.yaml',
]

/**
 * Packs whose inline XSL is well-formed and worth formatting-checking.
 * @type {Array.<string>}
 */
const CHECKED = PACKS.filter(
  (pack) => !UNFORMATTED.includes(path.basename(pack)),
)

if (!available) {
  console.warn(
    'xcop does not run here, so its fixtures are pending, not passing',
  )
}

describe('xcop', function() {
  CHECKED.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const inputs = yml.inputs || [yml.input]
    inputs.forEach((input, index) => {
      it(`should find 0 xcop errors in xsl #${index} of ${path.basename(pack)}`, function() {
        if (!available) {
          this.skip()
        }
        const xsl = path.resolve(
          __dirname, `temp-${path.basename(pack, '.yaml')}-${index}.xsl`,
        )
        fs.writeFileSync(xsl, `${xml.parsedFromString(input)}\n`)
        const stdout = runXcop(xsl)
        fs.unlinkSync(xsl)
        assert.ok(stdout.includes(`${xsl} looks good`))
      })
    })
  })
})
