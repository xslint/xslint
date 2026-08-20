/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lintByPredicatePosition} = require('../src/linters/predicate-position-linter')
const {validate} = require('../src/validators/xpath-validator')
const {harness} = require('./packs')

describe('predicate-position-linter', function() {
  harness({
    dir: 'predicate-position-packs',
    noun: 'positional predicates',
    run: (corpus, off) =>
      lintByPredicatePosition(validate(corpus).expressions, off),
  })
})
