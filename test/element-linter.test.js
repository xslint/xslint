/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByElement} = require('../src/linters/element-linter')
const {harness} = require('./packs')

describe('element-linter', function() {
  harness({
    dir: 'element-packs',
    noun: 'static element names',
    run: (corpus, off) => lintByElement(corpus, off),
  })
})
