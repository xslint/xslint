/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const {describe, it} = require('mocha')
const {predicateOf} = require('../src/predicates')

/**
 * Predicate spellings the vocabulary reaches, each of which a check in
 * `checks/xpath/` writes or is one construct away from writing. A row here is
 * a claim that the walk answers it without the engine; whether it answers it
 * correctly is `test/selectors.test.js`'s question, which asks fontoxpath
 * what the same spelling selects.
 * @type {Array.<string>}
 */
const COMPILED = [
  '@name',
  '@select',
  'not(@name)',
  'not(@select)',
  '@select and @as',
  '@select or @as',
  'not(@match) and (@mode or @priority)',
  'not(@name) and not(@match)',
  '@disable-output-escaping = "yes"',
  '@name = ("one", "three")',
  'normalize-space(@test) = ("\'true\'", \'"false"\')',
  'string-length(@name) = 1',
  'count(xsl:when) = 1',
  'count(xsl:when) >= 2',
  'not(xsl:otherwise) and count(xsl:when) >= 2',
  'count(xsl:when) = 1 and not(xsl:otherwise)',
  'count(*) = 1',
  'not(*)',
  'not(xsl:when)',
  'self::xsl:variable',
  'parent::xsl:choose',
  'not(parent::xsl:choose)',
  'parent::*[not(self::xsl:template)]',
  '(@select)',
  'xsl:value-of[not(@separator)]',
  '@name = preceding-sibling::xsl:param/@name',
  'following-sibling::*',
  'not(ancestor::xsl:override)',
  'not(contains(@name, \'{\'))',
  'string-length(substring-after(@name, ":")) = 1',
  'preceding-sibling::*[not(self::xsl:sort) and not(self::xsl:with-param)]',
  'parent::*[not(self::xsl:*)]',
  'not(*) or (count(*) = 1 and xsl:value-of[not(@separator)])',
  'count(*) != 1',
  'count(*) < 2',
  'count(*) <= 1',
  '@name/@x',
  'substring-after(@name, "o") = "ne"',
  'string-length(substring-after(@nope, @also)) = 0',
  'not(contains(@name, @nope))',
]

/**
 * Spellings the vocabulary refuses, each beside what puts it out of reach, so
 * an entry that becomes reachable turns red rather than sitting here reading
 * like a limit still in force. Refusing is never wrong, only dearer: the
 * engine answers what this cannot, and over-acceptance is the one failure a
 * split may not commit.
 * @type {Array.<{text: string, why: string}>}
 */
const REFUSED = [
  {
    text: 'matches(@name, \'^[0-9]\')',
    why: 'a regex, whose XPath flavour is not JavaScript\'s',
  },
  {
    text: 'count(.//xsl:*) > 100',
    why: 'a descending axis, which wants each element\'s subtree extent',
  },
  {
    text: 'following::*',
    why: 'a document-order axis, whose candidates nobody has counted',
  },
  {
    text: 'substring-before(@name, ":") = "xsl"',
    why: 'a string function outside the vocabulary',
  },
  {
    text: '@x > 1',
    why: 'a number compared against what an attribute holds as a string',
  },
  {
    text: '@name != "one"',
    why: 'a negated existential, the comparison easiest to answer wrongly',
  },
  {
    text: 'not(text()[normalize-space()])',
    why: 'a kind test, which xml:space decides the meaning of',
  },
  {
    text: 'normalize-space() = ""',
    why: 'a call taking the context node, which no step names',
  },
  {
    text: 'count(node()) = count(text())',
    why: 'a comparison whose far side is computed per candidate',
  },
  {
    text: 'not(@as and (if (/xsl:stylesheet) then /*/@version else 1))',
    why: 'a conditional, and a path anchored at the root',
  },
  {
    text: 'position() = 1',
    why: 'a position, which no candidate can answer on its own',
  },
  {
    text: 'a',
    why: 'an unprefixed element name, which a default namespace may reach',
  },
]

describe('predicates', function() {
  COMPILED.forEach((one) => {
    it(`answers [${one}] without the engine`, function() {
      assert.notStrictEqual(
        predicateOf(one),
        undefined,
        `the vocabulary does not reach [${one}], so every candidate of every ` +
          'selector spelling it still costs one fontoxpath call for a ' +
          'question the walk holds the answer to',
      )
    })
  })
  REFUSED.forEach((one) => {
    it(`refuses [${one.text}], holding ${one.why}`, function() {
      assert.strictEqual(
        predicateOf(one.text),
        undefined,
        `[${one.text}] is compiled although it holds ${one.why}, and an ` +
          'answer this vocabulary cannot give correctly is worse than the ' +
          'engine call it saves',
      )
    })
  })
})
