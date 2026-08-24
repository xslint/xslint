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
 * and xmldom emits the raw character. Six packs spell that one, one per linter,
 * and each is named here: an entry keyed on the basename alone covered all six
 * at once, and covered anything else taking the name too (#693). Excluded from
 * the formatting check, as the fix fixtures are in the xcop workflow.
 *
 * The two prefix-list packs are here for the same reason, one step further in:
 * xcop counts a namespace used only by a QName, so a declaration whose sole
 * mention is an `exclude-result-prefixes` is canonicalized away exactly as a
 * dead one is — which is the reading #553 is about, in another tool.
 *
 * The three `xml:space` packs are the same collision one convention over.
 * xcop reads everything under a `preserve` ancestor as significant and asks
 * for it compacted, and it does not honour the nearer `xml:space="default"`
 * that cancels one — which is the very reading two of these packs exist to
 * pin, so their indentation has to survive being looked at. The third goes
 * further: xcop would spread a comment onto a line of its own inside the
 * preserve scope, and the whitespace that rewrite introduces is text a
 * processor keeps, so the file it asks for is a stylesheet binding
 * something else and one the check is right to report. A formatter with no
 * opinion about `xml:space` cannot be given the last word on a fixture that
 * is about it.
 *
 * Each entry is the path a pack stands at, under `test/resources`, because a
 * basename names two packs as readily as one: `namespace-packs/x.yaml` and
 * `result-namespace-packs/x.yaml` are two files and were one name, so listing
 * either unchecked both (#693). And every one of them is *asserted* rather than
 * merely skipped — the fixture is written and asked about like any other, and
 * an entry whose pack xcop accepts turns red. Four did. Two of the prefix-list
 * packs, a spaced declaration and `a-wrap-written-as-a-reference` had all
 * stopped needing the exemption and the list went on carrying them, which is
 * the ratchet shape this repository holds every other exemption list to. The
 * last of those four was excluded on a reason #694 has since removed: its
 * refusal would have cost every other fixture its verdict. It costs nobody
 * anything now, and it is not refused either.
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
 * Every fixture, written out before the first assertion: the pack it came from,
 * its index inside that pack, and the file now holding it. They are all on disk
 * up front so that xcop can be asked about the whole set at once, and each
 * under a directory named for the one its pack sits in, since two packs may
 * share a basename and six do — one fixture overwriting another leaves two
 * assertions reading one file, and the fixture that lost written nowhere
 * (#693). xcop walks a directory to its leaves, so the nesting costs nothing.
 * The ones `UNFORMATTED` names are written with the rest rather than left out,
 * since an exemption nobody asks about is one nobody can see go stale.
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
