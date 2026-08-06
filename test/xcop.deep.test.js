/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const {xcopped, cmdAvailable} = require('./helpers')

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

/**
 * Where the fixtures are written. It is a temporary directory, not the suite's
 * own, because a scratch file inside the working tree is a hazard and not only
 * a mess: `should test default directory` lints the repository, so a file this
 * suite creates and deletes under `test/` can vanish from beneath that walk and
 * take its file count with it (#687).
 * @type {string}
 */
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-xcop-'))

/**
 * Every fixture, written out before the first assertion: the pack it came from,
 * its index inside that pack, and the file now holding it. They are all on disk
 * up front so that xcop can be asked about the whole set at once.
 * @type {Array.<{pack: string, index: number, file: string}>}
 */
const FIXTURES = CHECKED.flatMap((pack) => {
  const yml = yaml.parsedFromFile(pack)
  return (yml.inputs || [yml.input]).map((input, index) => {
    const file = path.join(
      SCRATCH, `${path.basename(pack, '.yaml')}-${index}.xsl`,
    )
    fs.writeFileSync(file, `${xml.parsedFromString(input)}\n`)
    return {pack: path.basename(pack), index: index, file: file}
  })
})

if (!available) {
  console.warn(
    'xcop does not run here, so its fixtures are pending, not passing',
  )
}

/**
 * What xcop made of all of them, from the single run every assertion below
 * reads its own line out of.
 * @type {string}
 */
let verdict = ''
if (available) {
  verdict = xcopped(SCRATCH)
}

describe('xcop', function() {
  FIXTURES.forEach((fixture) => {
    it(`should find 0 xcop errors in xsl #${fixture.index} of ${fixture.pack}`, function() {
      if (!available) {
        this.skip()
      }
      assert.ok(verdict.includes(`${fixture.file} looks good`))
    })
  })
})
