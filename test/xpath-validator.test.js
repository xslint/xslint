/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('xpath-validator', function() {
  harness({
    dir: 'xpath-validator-packs',
    noun: 'invalid expressions',
    run: (corpus, off) => validate(corpus, off).defects,
  })
})
