/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {compiles} = require('../src/xpath')
const assert = require('assert')

describe('xpath', function() {
  it('compiles a syntactically valid expression', function() {
    assert.ok(compiles('count(//o) = 2'))
  })
  it('cannot compile a syntactically invalid expression', function() {
    assert.ok(!compiles('1 +'))
  })
  it('resolves a standard namespace prefix', function() {
    assert.ok(compiles('xsl:thing'))
  })
  it('resolves a non-standard namespace prefix rather than failing', function() {
    assert.ok(compiles('zq:thing'))
  })
  it('counts a static type failure as compiling', function() {
    assert.ok(compiles('substring-before(a, "b") - 1'))
  })
})
