/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByName} = require('../src/linters/name-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('name-linter', function() {
  harness({
    dir: 'name-packs',
    noun: 'name comparisons',
    run: (corpus, off) => lintByName(validate(corpus).expressions, off),
  })
})
