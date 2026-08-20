/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByDoubleSlash} = require('../src/linters/double-slash-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('double-slash-linter', function() {
  harness({
    dir: 'double-slash-packs',
    noun: 'double slashes',
    run: (corpus, off) => lintByDoubleSlash(validate(corpus).expressions, off),
  })
})
