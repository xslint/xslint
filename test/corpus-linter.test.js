/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {kinded, lintByCorpus} = require('../src/linters/corpus-linter')
const {harness} = require('./packs')
const assert = require('assert')

/**
 * References no check may carry, a `reference` naming the kind of reference
 * the scan is to read rather than a template it is to find: the old spelling
 * of one, a word the scan answers nothing for, and nothing at all. An index
 * built for any of those holds no name, so every declaration in the corpus
 * is reported dead (#498).
 * @type {Array.<string>}
 */
const UNREAD = ['{name}(', '${name}', 'template', '']

describe('corpus-linter', function() {
  UNREAD.forEach((reference) => {
    it(`cannot read "${reference}" as a kind of reference`, function() {
      assert.throws(
        () => kinded(reference),
        /is none of call, variable/,
        [
          `the reference "${reference}" was taken as a kind, where this`,
          'linter reads no such kind, so the index built for it holds no',
          'name and every declaration in the corpus is reported as dead',
        ].join(' '),
      )
    })
  })
  harness({
    dir: 'corpus-packs',
    noun: 'cross-file defects',
    run: (corpus, off) => lintByCorpus(corpus, off),
  })
})
