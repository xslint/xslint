/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByXpath} = require('../src/linters/xpath-linter')
const {harness} = require('./packs')

describe('xpath-linter', function() {
  harness({
    dir: 'xpath-packs',
    noun: 'defects by declarative checks',
    run: (corpus, off) => lintByXpath(corpus, off),
  })
})
