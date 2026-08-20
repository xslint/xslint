/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByStringLength} = require('../src/linters/string-length-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('string-length-linter', function() {
  harness({
    dir: 'string-length-packs',
    noun: 'string-length comparisons',
    run: (corpus, off) => lintByStringLength(validate(corpus).expressions, off),
  })
})
