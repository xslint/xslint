/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The third way a declarative selector meets a shadow attribute, after the
 * presence test #849 fixed and the version gate #851 did: a selector reading
 * an attribute's value. `SUPPLIED` in `test/conformance.test.js` cannot see
 * one, `@x = 'y'` closing on no bracket, `and`, `or` or union bar, which is
 * how `using-disable-output-escaping` came to miss the 3.0 spelling Saxon
 * honours (#992). It stands in a file of its own because that one is at the
 * `max-lines` cap, and reads the checks off `checks.json`.
 */

const {kinds} = require('../src/resources/checks.json')
const {GAP} = require('../src/tokens')
const assert = require('assert')

/**
 * The keys of a check that hold a selector, per kind — the same pair
 * `test/conformance.test.js` walks, a per-file rule carrying one and a
 * cross-file rule the two ends of its reference.
 * @type {{[kind: string]: Array.<string>}}
 */
const SELECTORS = {xpath: ['xpath'], corpus: ['declaration', 'usage']}

/**
 * An attribute a selector reads the *value* of, on the left of a comparison
 * with any call wrapping it closed first, or on the right with a path in
 * front of it: `preceding-sibling::x/@name = @name` reads it twice, and the
 * first spelling of this gate saw neither, a slash standing before the one and
 * the sign before the other (#997).
 * @type {Array.<RegExp>}
 */
const COMPARED = [
  new RegExp(`@([\\w:.-]+)${GAP}*\\)*${GAP}*!?=`, 'g'),
  new RegExp(`=${GAP}*[\\w:./*()-]*?@([\\w:.-]+)`, 'g'),
]

/**
 * Every attribute a selector compares the value of. Comparing the shadow
 * spelling beside it is no remedy here, that value being an attribute value
 * template rather than the value, so what this finds is refused outright
 * rather than asked for a second clause (#992). Only the `xml:` namespace
 * has no shadow, so `xml:space` is left and `xsl:expand-text` is not (#997).
 * @param {string} selector - The XPath a declarative check is written in
 * @return {Array.<string>} - The attributes whose value it compares
 */
const compared = function(selector) {
  return COMPARED.flatMap((pattern) => Array.from(selector.matchAll(pattern)))
    .map((found) => found[1])
    .filter((named) => !named.startsWith('xml:'))
    .filter((named) => !named.split(':').pop().startsWith('_'))
}

/**
 * Every selector of every declarative check, with the check it belongs to.
 * @return {Array.<{name: string, key: string, kind: string,
 *  selector: string}>} - One entry per selector in the tree
 */
const selectors = function() {
  return Object.entries(SELECTORS).flatMap(
    ([kind, keys]) => Object.entries(kinds[kind]).flatMap(
      ([name, check]) => keys.map(
        (key) => ({name, key, kind, selector: check[key] ?? ''}),
      ),
    ),
  )
}

/**
 * Selectors the gate must refuse, each beside the attribute it names: an
 * attribute in the XSLT namespace has a shadow as much as one in no namespace
 * does, `xsl:_expand-text` on a literal result element being how the 3.0 idiom
 * spells `xsl:expand-text`, so the prefix alone exempts nothing (#997).
 * @type {Array.<[string, Array.<string>]>}
 */
const REFUSED = [
  [`//*[@xsl:expand-text = 'yes']`, ['xsl:expand-text']],
  [`//xsl:if[normalize-space(@test) != 'q']`, ['test']],
  [`//xsl:param[../xsl:param/@name = @name]`, ['name', 'name']],
]

/**
 * Selectors the gate must leave, those reading an attribute no shadow spelling
 * reaches or reading the shadow itself (#997).
 * @type {Array.<string>}
 */
const LEFT = [
  `//*[ancestor::*[@xml:space][1]/@xml:space = 'preserve']`,
  `//*[@xsl:_expand-text = '{true()}']`,
  `//xsl:if[@_test = '{$q}']`,
]

describe('shadows', function() {
  for (const [selector, named] of REFUSED) {
    it(`refuses the one spelling ${selector} compares`, function() {
      assert.deepStrictEqual(
        compared(selector), named,
        `the gate does not refuse ${selector}, which compares one spelling`,
      )
    })
  }
  for (const selector of LEFT) {
    it(`leaves ${selector}, which has no other spelling to ask`, function() {
      assert.deepStrictEqual(
        compared(selector), [],
        `the gate refuses ${selector}, whose attribute has no other spelling`,
      )
    })
  }
  it('asks both spellings of an attribute a selector compares the value of',
    function() {
      for (const {name, key, kind, selector} of selectors()) {
        assert.deepStrictEqual(
          compared(selector), [],
          [
            `${kind}/${name} compares the value of an attribute in its ${key}`,
            'and reads one of the two spellings XSLT gives it, so a',
            'stylesheet writing the shadow form draws nothing. Ask',
            'xslint:attribute, whose answer is either spelling',
          ].join(' '),
        )
      }
    })
})
