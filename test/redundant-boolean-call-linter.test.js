/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByBooleanCall} = require('../src/linters/redundant-boolean-call-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('redundant-boolean-call-linter', function() {
  harness({
    dir: 'redundant-boolean-call-packs',
    noun: 'redundant boolean calls',
    run: (corpus, off) => lintByBooleanCall(validate(corpus).expressions, off),
  })
})
