/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {walkedWith} = require('./helpers')
const {allFilesFrom, SEALED} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')

/**
 * The smallest JavaScript stack worth asking a child for, in kilobytes. Node
 * needs some seventy to start at all, and the lower the stack the fewer files
 * it takes to spring the trap: the largest spread a stack carries is roughly
 * 125 arguments per kilobyte of it.
 * @type {number}
 */
const STACK = 80

/**
 * How far above that spread the wide directory stands. The walk spreads a frame
 * or two deeper than the measurement does, so its own ceiling is the lower of
 * the two and a fifth is margin enough — and the number of files is what this
 * test costs, most of it on the platform whose file system answers slowest.
 * @type {number}
 */
const MARGIN = 1.2

/**
 * A directory holding that many files, all of them inside one subdirectory, so
 * the walk has a subtree to join onto its own answer — which is where #758
 * died, and a flat directory never reaches it. The writes go out in batches
 * rather than one at a time, because a file system that answers slowly answers
 * many at once.
 * @param {number} amount - How many files to write
 * @return {Promise<string>} - The directory holding that subdirectory
 */
const crowded = async function(amount) {
  const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-walk-'))
  const inner = path.join(yard, 'inner')
  fs.mkdirSync(inner)
  for (let at = 0; at < amount; at += 500) {
    await Promise.all(
      Array.from(
        {length: Math.min(500, amount - at)},
        (one, index) => fs.promises.writeFile(
          path.join(inner, `f${at + index}.xsl`), '',
        ),
      ),
    )
  }
  return yard
}

/**
 * The directories a walk leaves shut whatever it was asked for, spelled here
 * rather than taken from `SEALED`: a table derived from the list loses a row
 * when the list loses an entry, so the one mutation these rows exist to catch
 * would leave them green (#924). The gate below holds the two together.
 * @type {Array.<string>}
 */
const UNOPENED = ['.git', 'node_modules']

/**
 * The one module of `src` that reads a directory, so the floor stands in one
 * place rather than in whichever module reaches for `readdir` next.
 * @type {string}
 */
const WALKS = path.resolve(__dirname, '..', 'src', 'helpers.js')

/**
 * How a module asks the file system what a directory holds, which is the call
 * and not the word: the note atop `src/xslint.js` says what order readdir
 * answers in, and a gate reading prose would have that module walking.
 * @type {RegExp}
 */
const READDIR = /\breaddir\w*\(/

describe('walk', function() {
  it('cannot lose a directory wider than one spread carries', async function() {
    this.timeout(120000)
    const probe = walkedWith(
      fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-empty-')), STACK,
    )
    const wide = Math.ceil(probe.ceiling * MARGIN)
    const answer = walkedWith(await crowded(wide), probe.stack)
    assert.deepEqual(
      [answer.found, answer.ceiling < wide],
      [wide, true],
      [
        'the walk dropped a wide directory, or the stack carried it after all',
        'and the test proved nothing',
      ].join(' '),
    )
  })
  it('keeps a subtree standing where its directory stands', function() {
    const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-order-'))
    fs.mkdirSync(path.join(yard, 'inner'))
    for (const name of ['one.xsl', 'inner/two.xsl', 'inner/three.xsl']) {
      fs.writeFileSync(path.join(yard, name), '')
    }
    const found = allFilesFrom(yard).map((file) => path.basename(file))
    assert.equal(
      Math.abs(found.indexOf('two.xsl') - found.indexOf('three.xsl')),
      1,
      'a subtree came back scattered through its parent rather than whole',
    )
  })
  UNOPENED.forEach((name) => {
    it(`cannot open a directory named ${name}`, function() {
      const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-shut-'))
      fs.mkdirSync(path.join(yard, name))
      fs.writeFileSync(path.join(yard, name, 'buried.xsl'), '')
      fs.writeFileSync(path.join(yard, 'kept.xsl'), '')
      assert.deepEqual(
        allFilesFrom(yard).map((file) => path.basename(file)),
        ['kept.xsl'],
        [
          `the walk opened a ${name}, which holds no stylesheet anybody`,
          'wrote and 445,643 of the 482,562 entries a walk over this',
          'very checkout visits (#923)',
        ].join(' '),
      )
    })
  })
  it('cannot let a caller take that floor away', function() {
    const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-floor-'))
    fs.mkdirSync(path.join(yard, '.git'))
    fs.writeFileSync(path.join(yard, '.git', 'buried.xsl'), '')
    fs.writeFileSync(path.join(yard, 'kept.xsl'), '')
    assert.deepEqual(
      allFilesFrom(yard, () => false).map((file) => path.basename(file)),
      ['kept.xsl'],
      [
        'a caller putting a question of its own to the walk took the floor',
        'away with it, so configuring one exclusion started reading the',
        'history of the repository being linted (#923)',
      ].join(' '),
    )
  })
  it('cannot open a directory the caller refuses', function() {
    const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-refused-'))
    fs.mkdirSync(path.join(yard, 'shut'))
    fs.mkdirSync(path.join(yard, 'shut', 'deeper'))
    fs.writeFileSync(path.join(yard, 'shut', 'deeper', 'buried.xsl'), '')
    fs.writeFileSync(path.join(yard, 'kept.xsl'), '')
    const asked = []
    const found = allFilesFrom(yard, function(dir) {
      asked.push(path.basename(dir))
      return path.basename(dir) === 'shut'
    })
    assert.deepEqual(
      [found.map((file) => path.basename(file)), asked],
      [['kept.xsl'], ['shut']],
      [
        'the walk read a refused subtree and dropped its files afterwards,',
        'which is the whole of what an exclusion cost while it was a filter:',
        'the question was put again below what had already answered it (#923)',
      ].join(' '),
    )
  })
  it('cannot let a second walk stand beside it', function() {
    assert.deepEqual(
      allFilesFrom(path.resolve(__dirname, '..', 'src'))
        .filter((file) => /\.m?js$/.test(file))
        .filter((file) => file !== WALKS)
        .filter((file) => READDIR.test(fs.readFileSync(file, 'utf-8')))
        .map((file) => path.basename(file)),
      [],
      [
        'a module reading a directory of its own walks around this floor,',
        'which is the whole of what stops a run descending a .git or a',
        'node_modules, and around the question a caller puts beside it,',
        'which is the whole of what stops one descending an excluded',
        'directory (#923)',
      ].join(' '),
    )
  })
  it('cannot keep a floor no row here names', function() {
    assert.deepEqual(
      SEALED,
      UNOPENED,
      [
        'the walk leaves shut a directory these rows do not name, or has',
        'stopped leaving one they do, so the rows asserting a directory is',
        'never opened judge a list the code no longer holds (#923)',
      ].join(' '),
    )
  })
})
