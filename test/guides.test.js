/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom} = require('../src/helpers')
const {
  ROOT, GUIDES, LOADED, slashed, sized, chained, loaded, indexed, noted,
  globbed,
} = require('./guides')
const path = require('path')
const assert = require('assert')

describe('guides', function() {
  it('walks the tree for the guides standing beside the code', function() {
    assert.ok(
      GUIDES.length > 1,
      'cannot find a guide beside the code it is about, this walk having ' +
        `found ${GUIDES.join(', ')} and nothing else — the derivation behind ` +
        'a module lives in the CLAUDE.md of its own directory since #821, so ' +
        'a walk reaching only the root one leaves every claim in the others ' +
        'judged by nobody',
    )
  })
  it('cannot fill a turn with the guides one directory loads', function() {
    assert.deepEqual(
      GUIDES.filter((one) => loaded(one) > LOADED).map(
        (one) => `${one} loads ${loaded(one)} in ${
          chained(one).map((each) => `${each} at ${sized(each)}`).join(' + ')}`,
      ),
      [],
      `cannot load a chain of guides past the ${LOADED} characters the ` +
        'harness warns at, a turn touching a file loading the root guide and ' +
        'the guide of every directory over it — what answers this is the ' +
        'derivation moving one directory further down, into the docblocks of ' +
        'the module it is about, and never a bar widened to fit what has ' +
        'grown past it',
    )
  })
  it('names in its index only files the tree holds', function() {
    for (const row of indexed()) {
      assert.ok(
        allFilesFrom(path.join(ROOT, path.dirname(row)))
          .map(slashed).some((one) => globbed(row).test(one)),
        `the index names ${row}, which the tree holds nothing of — a path ` +
          'that has moved or gone takes its reader nowhere, and the index is ' +
          'the whole of what the root guide keeps in place of the notes',
      )
    }
  })
  it('names every module of src somewhere in its index', function() {
    const rows = indexed()
    assert.deepEqual(
      allFilesFrom(path.join(ROOT, 'src')).map(slashed)
        .filter((one) => /\.m?js$/.test(one))
        .filter((one) => !rows.some((row) => globbed(row).test(one))),
      [],
      'cannot leave a module out of the index, one line naming what it is ' +
        'being the whole of what the root guide says about it — a module ' +
        'named nowhere is one a reader meets first in the code',
    )
  })
  it('holds every note a guide carries to a row of the index', function() {
    const rows = indexed()
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !rows.some((row) => globbed(row).test(one))),
        [],
        `${guide} notes a file the index does not name — the two are one map, ` +
          'so a note reachable only by opening the guide it sits in is a ' +
          'derivation the root has stopped pointing at',
      )
    }
  })
  it('cannot note a file the guide does not stand above', function() {
    for (const guide of GUIDES) {
      assert.deepEqual(
        noted(guide)
          .filter((one) => !one.startsWith(`${path.dirname(guide)}/`)),
        [],
        `${guide} notes a file outside its own directory, where a reader ` +
          'opening that file loads some other guide — a note arrives with ' +
          'the directory it sits in, so it goes where its own code goes',
      )
    }
  })
})
