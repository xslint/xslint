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
 * Packs whose fixture must carry what xcop rejects, so it cannot also be
 * canonical XML: an unused namespace declaration, a prefix list naming one,
 * the no-break space of #643, and the indentation a nearer `xml:space` frees
 * (#553, #693, #817). Each entry is the path a pack stands at, a basename
 * naming two as readily as one, and each is asserted rather than skipped.
 * @type {Array.<string>}
 */
const UNFORMATTED = [
  'count-packs/no-break-space-before-the-bracket.yaml',
  'name-packs/no-break-space-before-the-bracket.yaml',
  'namespace-packs/all-prefixes-excluded-at-once.yaml',
  'namespace-packs/excluded-result-prefixes.yaml',
  'namespace-packs/redundant-namespace-declarations.yaml',
  'namespace-packs/spaced-namespace-declarations.yaml',
  'redundant-boolean-call-packs/no-break-space-before-the-bracket.yaml',
  'redundant-double-negation-packs/no-break-space-before-the-bracket.yaml',
  'string-length-packs/no-break-space-before-the-bracket.yaml',
  'translate-packs/no-break-space-before-the-bracket.yaml',
  'xpath-packs/blank-nested-if-cancelled-preserve.yaml',
  'xpath-packs/setting-value-of-variable-cancelled-preserve.yaml',
  'xpath-packs/variable-or-param-preserved-inert-content.yaml',
]

/**
 * Where a pack stands, as `UNFORMATTED` names one and as its fixtures are
 * written out: the path under `test/resources`, spelled with the separator a
 * name here is spelled with whatever the platform uses on disk.
 * @param {string} pack - Absolute path of the pack
 * @return {string} - Its path relative to the resources directory
 */
const stands = function(pack) {
  return path.relative(RESOURCES, pack).split(path.sep).join('/')
}

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
 * Every fixture, written out before the first assertion: the pack it came
 * from, its index inside that pack, and the file now holding it. All on disk
 * up front so xcop is asked about the whole set at once, each under a
 * directory named for its own pack's, since two packs may share a basename and
 * six do (#693). The ones `UNFORMATTED` names are written with the rest.
 * @type {Array.<{pack: string, index: number, file: string}>}
 */
const FIXTURES = PACKS.flatMap((pack) => {
  const yml = yaml.parsedFromFile(pack)
  const held = path.join(SCRATCH, path.dirname(stands(pack)))
  fs.mkdirSync(held, {recursive: true})
  return (yml.inputs || [yml.input]).map((input, index) => {
    const file = path.join(held, `${path.basename(pack, '.yaml')}-${index}.xsl`)
    fs.writeFileSync(file, `${xml.parsedFromString(input)}\n`)
    return {
      pack: stands(pack),
      index: index,
      file: file,
      formatted: !UNFORMATTED.includes(stands(pack)),
    }
  })
})

if (!available) {
  console.warn(
    'xcop does not run here, so its fixtures are pending, not passing',
  )
}

/**
 * What xcop made of each of them, which every assertion below reads its own
 * verdict out of.
 * @type {Map.<string, {good: boolean, refused: boolean, said: string}>}
 */
let verdicts = new Map()
if (available) {
  verdicts = xcopped(SCRATCH, FIXTURES.map((fixture) => fixture.file))
}

/**
 * The two committed stylesheets a mixed directory is built out of: one xcop
 * accepts and one it refuses. They are files under `test/resources` rather
 * than strings here, the way every test stylesheet in this repository is, and
 * the refused one is excluded from the repo-wide sweep in the xcop workflow —
 * being written the way xcop refuses is the whole of what it is for.
 * @type {string}
 */
const SOUND = path.resolve(RESOURCES, 'xcop', 'sound.xsl')

/**
 * The one it refuses, whose content is the same stylesheet on one line.
 * @type {string}
 */
const REFUSED = path.resolve(RESOURCES, 'xcop', 'refused.xsl')

/**
 * A directory of three stylesheets, the middle one written the way xcop
 * refuses, so a run over the directory stops before it reaches the third. They
 * are named so that they sort in that order, xcop globbing what a directory
 * holds and sorting it.
 * @return {{dir: string, files: Array.<string>}} - The directory and its three
 *  stylesheets, in the order xcop reads them
 */
const mixed = function() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-mixed-'))
  return {
    dir: dir,
    files: [
      {name: 'alpha', from: SOUND},
      {name: 'beta', from: REFUSED},
      {name: 'gamma', from: SOUND},
    ].map((one) => {
      const file = path.join(dir, `${one.name}.xsl`)
      fs.copyFileSync(one.from, file)
      return file
    }),
  }
}

describe('xcop', function() {
  it('judges a stylesheet standing behind one it refuses', function() {
    if (!available) {
      this.skip()
    }
    const held = mixed()
    assert.ok(
      xcopped(held.dir, held.files).get(held.files[2]).good,
      'xcop stopped at the stylesheet it refuses and never reached the sound ' +
        'one behind it, so that one failed for a neighbour fault and with a ' +
        'message naming neither — 204 tests at once, and the one real ' +
        'complaint printed by nobody (#694)',
    )
  })
  it('says what xcop said of a stylesheet it refuses', function() {
    if (!available) {
      this.skip()
    }
    const held = mixed()
    assert.ok(
      xcopped(held.dir, held.files).get(held.files[1]).said.includes(
        held.files[1],
      ),
      'the verdict on a refused stylesheet does not name it, so a run reports ' +
        'that something is wrong without saying what or where (#694)',
    )
  })
  it('names a pack that is there in every unformatted entry', function() {
    assert.deepEqual(
      UNFORMATTED.filter(
        (entry) => !PACKS.some((pack) => stands(pack) === entry),
      ),
      [],
      'an entry naming no pack excludes nothing, and stands ready to exclude ' +
        'whatever takes the name next: a pack renamed or deleted leaves one ' +
        'behind and nothing else says so',
    )
  })
  it('writes each fixture to a file of its own', function() {
    assert.equal(
      new Set(FIXTURES.map((fixture) => fixture.file)).size,
      FIXTURES.length,
      'two fixtures share a path, so one overwrote the other and two ' +
        'assertions read one verdict while the fixture that lost is checked ' +
        'by nobody (#693)',
    )
  })
  FIXTURES.filter((fixture) => fixture.formatted).forEach((fixture) => {
    it(`should find 0 xcop errors in xsl #${fixture.index} of ${fixture.pack}`, function() {
      if (!available) {
        this.skip()
      }
      assert.ok(
        verdicts.get(fixture.file).good,
        `xcop refused xsl #${fixture.index} of ${fixture.pack}, and said:\n` +
          verdicts.get(fixture.file).said,
      )
    })
  })
  FIXTURES.filter((fixture) => !fixture.formatted).forEach((fixture) => {
    it(`should still need the exemption of xsl #${fixture.index} of ${fixture.pack}`, function() {
      if (!available) {
        this.skip()
      }
      assert.ok(
        !verdicts.get(fixture.file).good,
        `xcop accepts xsl #${fixture.index} of ${fixture.pack}, so its entry ` +
          'in UNFORMATTED exempts a fixture that needs no exemption and hides ' +
          'whatever it may come to hold: drop the entry',
      )
    })
  })
})
