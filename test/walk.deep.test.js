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
 * How many files stand in the wide directory. It is not the 125,000 a walk
 * needs to die at full stack — the child is given a small one, where the
 * ceiling falls to some twelve thousand, so this stands about two and a half
 * times above it and the test costs a second rather than a minute.
 * @type {number}
 */
const WIDE = 30000

/**
 * The JavaScript stack the child walks with, in kilobytes. Node needs about
 * seventy to start at all, so this is as low as the trap can be set with room
 * for the interpreter to boot on every platform the suite runs on.
 * @type {number}
 */
const STACK = 100

/**
 * A directory holding `amount` files, all of them inside one subdirectory, so
 * the walk has a subtree to join onto its own answer — which is the moment
 * #758 died, and a flat directory never reaches it.
 * @param {number} amount - How many files to write
 * @return {string} - The directory holding that subdirectory
 */
const crowded = function(amount) {
  const yard = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-walk-'))
  const inner = path.join(yard, 'inner')
  fs.mkdirSync(inner)
  for (let at = 0; at < amount; at++) {
    fs.writeFileSync(path.join(inner, `f${at}.xsl`), '')
  }
  return yard
}

describe('walk', function() {
  it('cannot lose a directory wider than one spread carries', function() {
    const answer = walkedWith(STACK, crowded(WIDE))
    assert.deepEqual(
      [answer.found, answer.ceiling < WIDE],
      [WIDE, true],
      'the walk dropped a wide directory, or the stack was large enough to ' +
        'carry it and the test proved nothing',
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
