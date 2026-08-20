/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByNamespaceAxis} = require('../src/linters/using-namespace-axis-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('using-namespace-axis-linter', function() {
  harness({
    dir: 'using-namespace-axis-packs',
    noun: 'namespace axes',
    run: (corpus, off) =>
      lintByNamespaceAxis(validate(corpus).expressions, off),
  })
})
