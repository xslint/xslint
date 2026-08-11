/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {walkedWith} = require('./helpers')
const {allFilesFrom} = require('../src/helpers')
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
      'the walk dropped a wide directory, or the stack carried it after all ' +
        'and the test proved nothing',
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
})
