/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {EVERY, named} = require('../src/tree')
const {xml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The XSLT namespace, the one a prefixed wildcard names on the axis today.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * The stylesheet these cases walk. It is the one fixture holding elements of
 * three namespaces at once — XSLT's, `urn:my` and none — which is what a
 * bucket standing under a namespace alone has to tell apart.
 * @type {Document}
 */
const SHEET = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'candidates.xsl'),
    'utf-8',
  ),
)

describe('tree', function() {
  it('buckets a namespace under the key a split reads back', function() {
    assert.deepStrictEqual(
      (named(SHEET).buckets.get(`${XSLT} ${EVERY}`) ?? []).map(
        (one) => one.localName,
      ),
      Array.from(SHEET.getElementsByTagNameNS(XSLT, '*')).map(
        (one) => one.localName,
      ),
      [
        'the walk writes the every-element bucket of a namespace under a key',
        'EVERY does not spell, so the two have to agree by hand and the',
        'wildcard a split reads back finds nothing (#893)',
      ].join(' '),
    )
  })
})
