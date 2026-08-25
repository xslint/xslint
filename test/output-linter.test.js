/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByOutput} = require('../src/linters/output-linter')
const {harness} = require('./packs')

describe('output-linter', function() {
  harness({
    dir: 'output-packs',
    noun: 'missing serializations',
    run: (corpus, off) => lintByOutput(corpus, off),
  })
})
