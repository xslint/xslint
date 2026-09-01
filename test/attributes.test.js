/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {expressionsOf, whole} = require('../src/attributes')
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

/**
 * A stylesheet raising the version twice below a 1.0 root — on a literal result
 * element and on an XSLT one — so the version in force differs from record to
 * record and reading the root's would answer four of the six wrongly.
 * @type {Document}
 */
const VERSIONS = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(
      __dirname, 'resources', 'attributes', 'versions-in-force.xsl',
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
  it('narrows to the whole value of an attribute of that name', function() {
    assert.ok(
      expressionsOf(SHEET).some((found) => whole(found, 'select')),
      'cannot narrow to the select a linter reads alone',
    )
  })
  it('cannot narrow to an expression a template encloses', function() {
    assert.ok(
      expressionsOf(SHEET).every((found) => !whole(found, 'label')),
      'narrows to a template of the result tree as if it were an attribute',
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
  it('carries the version in force where each expression stands', function() {
    assert.deepEqual(
      expressionsOf(VERSIONS).map(
        (found) => [found.expression, found.version],
      ),
      [
        ['section', '1.0'],
        ['@x', '1.0'],
        ['count(item)', '2.0'],
        ['@y', '2.0'],
        ['@z', '3.0'],
        ['@w', '3.0'],
      ],
      'cannot read the version in force where an expression stands',
    )
  })
})
