/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByBareName} = require('../src/linters/bare-name-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('bare-name-linter', function() {
  harness({
    dir: 'bare-name-packs',
    noun: 'bare names',
    run: (corpus, off) => lintByBareName(validate(corpus).expressions, off),
  })
})
