/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByTranslate} = require('../src/linters/translate-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('translate-linter', function() {
  harness({
    dir: 'translate-packs',
    noun: 'translate case folds',
    run: (corpus, off) => lintByTranslate(validate(corpus).expressions, off),
  })
})
