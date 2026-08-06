/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf, wholeOf} = require('../src/attributes')
const {xml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The stylesheet whose XSLT attributes, literal result elements, and attribute
 * value templates the spans are read from.
 * @type {Document}
 */
const SHEET = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(
      __dirname, 'resources', 'attributes', 'literal-result-and-templates.xsl',
    ),
    'utf-8',
  ),
)

/**
 * A 3.0 stylesheet whose text value templates and shadow attributes carry
 * expressions alongside the ordinary attributes.
 * @type {Document}
 */
const TEMPLATED = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(
      __dirname, 'resources', 'attributes', 'text-value-templates.xsl',
    ),
    'utf-8',
  ),
)

describe('attributes', function() {
  it('reads every bare and enclosed expression in document order', function() {
    assert.deepEqual(
      expressionsOf(SHEET).map(
        (found) => [found.node.nodeName, found.start, found.expression],
      ),
      [
        ['match', 0, 'section'],
        ['label', 1, 'count(item) = 0'],
        ['name', 1, 'name(.)'],
        ['select', 0, '@x'],
      ],
      'cannot read the expressions of the stylesheet',
    )
  })
  it('reads a narrowed attribute as the walk reads the same one', function() {
    const whole = expressionsOf(SHEET).find((found) => found.start === 0)
    assert.deepEqual(
      wholeOf(whole.node),
      whole,
      'builds a different record for an attribute a linter narrowed to',
    )
  })
  it('cannot read a literal result attribute as an expression', function() {
    assert.ok(
      expressionsOf(SHEET).every((found) => found.node.nodeName !== 'test'),
      'reads output text on a literal result element as an expression',
    )
  })
  it('reads a text value template and a shadow attribute too', function() {
    assert.deepEqual(
      expressionsOf(TEMPLATED).map(
        (found) => [found.node.nodeName, found.start, found.expression],
      ),
      [
        ['match', 0, 'section'],
        ['#text', 1, 'count(item) = 0'],
        ['_select', 0, 'name(.)'],
        ['select', 0, '@x'],
      ],
      'cannot read a text value template or a shadow attribute',
    )
  })
})
