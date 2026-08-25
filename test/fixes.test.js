/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {substitution} = require('../src/fixes')
const {xml} = require('../src/helpers')
const {walked} = require('../src/tree')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The stylesheet these cases read an attribute out of. It is the one fixture
 * holding a value in each delimiter, which is what the cases need: the
 * delimiter decides which quote has to be written as a reference, and
 * {@link substitution} reads it from the source rather than assuming one.
 * @type {string}
 */
const CONTENT = fs.readFileSync(
  path.resolve(
    __dirname, 'resources', 'fix', 'entity-in-a-rewritten-value.xsl',
  ),
  'utf-8',
)

/**
 * Every `select` the fixture carries, in document order.
 * @type {Array.<Node>}
 */
const SELECTS = walked(xml.parsedFromString(CONTENT)).filter(
  (node) => node.nodeType === 2 && node.nodeName === 'select',
)

/**
 * Which of them stands in which delimiter, so a case names the quote it is
 * about rather than an index nobody can read.
 * @type {{[quote: string]: number}}
 */
const QUOTED = {'"': 0, '\'': 2}

/**
 * What a value holding a character XML forbids inside an attribute must be
 * written as, one row per character and per delimiter. A `>` is left bare on
 * purpose, an attribute value being allowed one (#718). The last row is why
 * the `&` goes first: escaping the delimiter introduces an `&` of its own,
 * which a later pass would spell `&amp;quot;`.
 * @type {Array.<{name: string, quote: string, value: string, spelt: string}>}
 */
const CASES = [
  {
    name: 'writes an ampersand a value holds as a reference',
    quote: '"', value: 'alpha & beta', spelt: 'alpha &amp; beta',
  },
  {
    name: 'writes a less-than a value holds as a reference',
    quote: '"', value: '@x < 1', spelt: '@x &lt; 1',
  },
  {
    name: 'leaves a greater-than a value holds as it stands',
    quote: '"', value: '@x > 1', spelt: '@x > 1',
  },
  {
    name: 'writes the double quote a double-quoted value stands in',
    quote: '"', value: '@x = "gamma"', spelt: '@x = &quot;gamma&quot;',
  },
  {
    name: 'leaves a single quote inside a double-quoted value alone',
    quote: '"', value: '@x = \'gamma\'', spelt: '@x = \'gamma\'',
  },
  {
    name: 'writes the single quote a single-quoted value stands in',
    quote: '\'', value: '@x = \'delta\'', spelt: '@x = &apos;delta&apos;',
  },
  {
    name: 'leaves a double quote inside a single-quoted value alone',
    quote: '\'', value: '@x = "delta"', spelt: '@x = "delta"',
  },
  {
    name: 'writes an ampersand once where the delimiter needs one too',
    quote: '"', value: 'a & "b"', spelt: 'a &amp; &quot;b&quot;',
  },
]

describe('fixes', function() {
  CASES.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        substitution(
          SELECTS[QUOTED[row.quote]], row.value, CONTENT,
        ).replacement,
        row.spelt,
        'a value written back into an attribute cannot spell a character ' +
          'XML forbids there as itself',
      )
    })
  })
})
