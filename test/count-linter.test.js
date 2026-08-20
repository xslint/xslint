/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByCount} = require('../src/linters/count-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('count-linter', function() {
  harness({
    dir: 'count-packs',
    noun: 'count comparisons',
    run: (corpus, off) => lintByCount(validate(corpus).expressions, off),
  })
})
