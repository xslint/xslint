/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByFormat} = require('../src/linters/xpath-format-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('xpath-format-linter', function() {
  harness({
    dir: 'xpath-format-packs',
    noun: 'redundant whitespace runs',
    run: (corpus, off) => lintByFormat(validate(corpus).expressions, off),
  })
})
