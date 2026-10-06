/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByImports} = require('../src/linters/import-linter')
const {harness} = require('./packs')

describe('import-linter', function() {
  harness({
    dir: 'import-packs',
    noun: 'import defects',
    run: (corpus, off) => lintByImports(corpus, off),
  })
})
