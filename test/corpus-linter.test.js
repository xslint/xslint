/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {anchoring, lintByCorpus} = require('../src/linters/corpus-linter')
const {harness} = require('./packs')
const assert = require('assert')

/**
 * Reference templates no check may carry, the name having to stand against
 * fixed text at exactly one end. Against text at neither end the mark is the
 * empty string, which `indexOf` answers past the end with the length rather
 * than -1, so the scan never advances and the run hangs; against text at both
 * ends the far side is never matched (#783).
 * @type {Array.<string>}
 */
const UNANCHORED = ['{name}', 'x{name}y', '${name}(']

describe('corpus-linter', function() {
  UNANCHORED.forEach((reference) => {
    it(`cannot take the unanchored reference template ${reference}`, function() {
      assert.throws(
        () => anchoring(reference),
        /anchors the name against text at neither end or at both/,
        `the template ${reference} was taken, where it anchors the name ` +
          'against text at neither end or at both, and one of those hangs ' +
          'the scan while the other reports a declaration that is used',
      )
    })
  })
  harness({
    dir: 'corpus-packs',
    noun: 'cross-file defects',
    run: (corpus, off) => lintByCorpus(corpus, off),
  })
})
