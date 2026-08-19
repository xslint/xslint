/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const {splitOf} = require('../src/selectors')
const {kinds} = require('../src/resources/checks.json')

/**
 * The XSLT namespace, which is the only one a declarative selector names on the
 * axis today.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * Selectors an index can serve, each with the local names its axis yields and
 * the tail left for the predicate. A union is one entry rather than several,
 * since what the axis answers is one sequence in document order.
 * @type {Array.<{xpath: string, locals: Array.<string>, tail: string}>}
 */
const SPLIT = [
  {xpath: '//xsl:variable', locals: ['variable'], tail: ''},
  {xpath: '//xsl:variable[@name]', locals: ['variable'], tail: '[@name]'},
  {
    xpath: '//(xsl:variable | xsl:template)[string-length(@name) = 1]',
    locals: ['variable', 'template'],
    tail: '[string-length(@name) = 1]',
  },
  {
    xpath: '//xsl:param[parent::xsl:template][preceding-sibling::*]',
    locals: ['param'],
    tail: '[parent::xsl:template][preceding-sibling::*]',
  },
  {
    xpath: `//xsl:template[contains(@match, '[')]`,
    locals: ['template'],
    tail: `[contains(@match, '[')]`,
  },
  {
    xpath: '//(xsl:if|xsl:when)[normalize-space(@test) = "x"]',
    locals: ['if', 'when'],
    tail: '[normalize-space(@test) = "x"]',
  },
  {
    xpath: '//xsl:variable[ancestor::xsl:template[1]]',
    locals: ['variable'],
    tail: '[ancestor::xsl:template[1]]',
  },
]

/**
 * Selectors no index may serve, each with why. A wildcard names no bucket; a
 * root-anchored path is not a descendant sweep; an attribute is not an element;
 * a step behind the predicate reaches past what the axis answered; a prefix
 * this project does not bind cannot be resolved to a namespace; and a
 * positional predicate reads the position of the whole descendant sequence,
 * which one candidate at a time cannot supply.
 * @type {Array.<{xpath: string, why: string}>}
 */
const WHOLE = [
  {xpath: '//xsl:*', why: 'a wildcard names no one bucket'},
  {xpath: '//*', why: 'every element is not a name'},
  {xpath: '//(xsl:variable | xsl:*)', why: 'a wildcard inside a union'},
  {xpath: '/*[not(@version)]', why: 'anchored at the root, not a sweep'},
  {xpath: '//xsl:template[@match]/xsl:param', why: 'a step behind the tail'},
  {xpath: '//mine:thing[@a]', why: 'a prefix nothing binds'},
  {xpath: '//xsl:template[1]', why: 'a positional predicate'},
  {
    xpath: '//xsl:template[1][@match]',
    why: 'a positional predicate ahead of another',
  },
  {
    xpath: '//xsl:template[@match][1]',
    why: 'a positional predicate behind another',
  },
  {xpath: '//xsl:variable[2 - 1]', why: 'arithmetic worth a position'},
  {xpath: '//xsl:variable[1 + 1]', why: 'arithmetic worth another position'},
  {xpath: '//xsl:variable[1.0]', why: 'a position spelled as a decimal'},
  {xpath: '//xsl:variable[- 1]', why: 'a position behind a sign'},
  {xpath: '//xsl:variable[number("2")]', why: 'a call answering a number'},
  {xpath: '//xsl:variable[count(@name)]', why: 'a count answering a number'},
  {
    xpath: '//xsl:variable[@name][2 - 1]',
    why: 'arithmetic behind another predicate',
  },
  {
    xpath: '//xsl:variable[@name = position()]',
    why: 'position() inside a comparison',
  },
  {
    xpath: '//xsl:variable[not(@name = last())]',
    why: 'last() buried two calls deep',
  },
  {
    xpath: '//xsl:variable[Q{http://www.w3.org/2005/xpath-functions}not(@a)]',
    why: 'a call naming its namespace inline',
  },
  {xpath: '//xsl:variable[(@name)]', why: 'a bracket of the author own'},
  {xpath: '//xsl:variable[@name and]', why: 'a predicate that cannot parse'},
  {xpath: '//xsl:template[position() = 1]', why: 'position() in the tail'},
  {xpath: '//xsl:template[last()]', why: 'last() in the tail'},
  {xpath: '//xsl:template[@a] | //xsl:variable', why: 'a union of paths'},
  {xpath: 'xsl:template[@a]', why: 'no descendant axis at all'},
]

describe('selectors', function() {
  SPLIT.forEach((one) => {
    it(`splits ${one.xpath} into an axis and a tail`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        {
          names: one.locals.map((local) => ({uri: XSLT, local: local})),
          tail: one.tail,
        },
        `the selector ${one.xpath} is not split the way an index needs it`,
      )
    })
  })
  it('refuses the attribute-anchored selector a real check is written in', function() {
    assert.deepStrictEqual(
      splitOf(kinds.xpath['using-disable-output-escaping'].xpath).names,
      [],
      'a selector anchored on an attribute rather than an element is served ' +
        'from a bucket of elements, which cannot hold the attribute it selects',
    )
  })
  WHOLE.forEach((one) => {
    it(`refuses ${one.xpath}, being ${one.why}`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath).names,
        [],
        `the selector ${one.xpath} is served from an index though it is ` +
          `${one.why}, so the index answers a question the selector never put`,
      )
    })
  })
})
