/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByDoubleNegation} = require('../src/linters/redundant-double-negation-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('redundant-double-negation-linter', function() {
  harness({
    dir: 'redundant-double-negation-packs',
    noun: 'double negations',
    run: (corpus, off) =>
      lintByDoubleNegation(validate(corpus).expressions, off),
  })
})
