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
 * empty string, which `indexOf` finds at every offset and, past the end, goes
 * on answering the length rather than -1 — so the scan never advances and the
 * whole run hangs before a defect is reported. Against text at both ends only
 * the near side is read, so the far one is never matched and a declaration
 * that is used is reported as dead (#783).
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
