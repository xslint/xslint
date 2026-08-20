/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByAxis} = require('../src/linters/xpath-axis-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('xpath-axis-linter', function() {
  harness({
    dir: 'axis-packs',
    noun: 'unabbreviated axes',
    run: (corpus, off) => lintByAxis(validate(corpus).expressions, off),
  })
})
