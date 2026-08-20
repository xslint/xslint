/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByParameter} = require('../src/linters/parameter-linter')
const {harness} = require('./packs')

describe('parameter-linter', function() {
  harness({
    dir: 'parameter-packs',
    noun: 'unused parameters',
    run: (corpus, off) => lintByParameter(corpus, off),
  })
})
