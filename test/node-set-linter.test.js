/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByNodeSet} = require('../src/linters/node-set-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('node-set-linter', function() {
  harness({
    dir: 'node-set-packs',
    noun: 'node-set extensions',
    run: (corpus, off) => lintByNodeSet(validate(corpus).expressions, off),
  })
})
