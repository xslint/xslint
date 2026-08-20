/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByResultNamespace} = require('../src/linters/result-namespace-linter')
const {harness} = require('./packs')

describe('result-namespace-linter', function() {
  harness({
    dir: 'result-namespace-packs',
    noun: 'leaking result namespaces',
    run: (corpus, off) => lintByResultNamespace(corpus, off),
  })
})
