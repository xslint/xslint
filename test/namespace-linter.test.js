/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByNamespace} = require('../src/linters/namespace-linter')
const {harness} = require('./packs')

describe('namespace-linter', function() {
  harness({
    dir: 'namespace-packs',
    noun: 'redundant declarations',
    run: (corpus, off) => lintByNamespace(corpus, off),
  })
})
