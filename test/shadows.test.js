/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The third way a declarative selector meets a shadow attribute, after the
 * presence test #849 fixed and the version gate #851 did: a selector reading
 * an attribute's **value**. `SUPPLIED` in `test/conformance.test.js` cannot
 * see one — it matches a presence clause closing on a bracket, an `and`, an
 * `or` or a union bar, and `@x = 'y'` closes on none of them — which is how
 * `using-disable-output-escaping` came to report the 1.0 spelling of an
 * attribute and miss the 3.0 one Saxon honours identically (#992).
 *
 * It stands in a file of its own because `test/conformance.test.js` is at the
 * 1000-line `max-lines` cap, and because the checks are read here the way
 * `predicates`, `tiers` and `readme` read them — off `checks.json`, which
 * that file's own gate holds to the YAML authoring it.
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
 * An attribute a selector reads the *value* of: `@x` standing on the left of a
 * comparison, with any call wrapping it closed first. A step tail is not one —
 * `../@x` reads what the document supplies where a clause spells the attribute
 * it wants, the same difference `SUPPLIED` turns on (#992).
 * @type {RegExp}
 */
const COMPARED = new RegExp(`(^|[^/])@([\\w:.-]+)${GAP}*\\)*${GAP}*!?=`, 'g')

/**
 * Every attribute a selector compares the value of. Comparing the shadow
 * spelling beside it is no remedy here, that value being an attribute value
 * template rather than the value, so what this finds is refused outright
 * rather than asked for a second clause (#992).
 * @param {string} selector - The XPath a declarative check is written in
 * @return {Array.<string>} - The attributes whose value it compares
 */
const compared = function(selector) {
  return Array.from(selector.matchAll(COMPARED))
    .map((found) => found[2])
    .filter((named) => !named.split(':').pop().startsWith('_'))
}

/**
 * The checks still comparing a shadowable attribute's value in one spelling,
 * beside the issue reporting each. `xslint:attribute` is the reading that
 * reaches both, and `using-disable-output-escaping` was the first to ask it
 * (#992, #997). A ratchet both ways, the gate failing an unlisted comparison
 * and this table an entry that has stopped making one.
 * @type {{[name: string]: string}}
 */
const COMPARING = {
  'duplicate-param-name': '#997, a shadow name duplicating one already taken',
  'duplicate-with-param-name': '#997, the same over xsl:with-param',
  'incorrect-use-of-boolean-constants': '#997, a shadow test spelling true',
  'missing-or-empty-href': '#997, a shadow href naming nothing',
  'missing-or-empty-name': '#997, a shadow name naming nothing',
  'short-names': '#997, a shadow name one character long',
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

describe('shadows', function() {
  it('asks both spellings of an attribute a selector compares the value of',
    function() {
      for (const {name, key, kind, selector} of selectors()) {
        let asked = compared(selector)
        if (COMPARING[name]) {
          asked = []
        }
        assert.deepStrictEqual(
          asked, [],
          `${kind}/${name} compares the value of an attribute in its ${key} ` +
            'and reads one of the two spellings XSLT gives it, so a ' +
            'stylesheet writing the shadow form draws nothing. Ask ' +
            'xslint:attribute, whose answer is either spelling',
        )
      }
    })
  it('exempts a check from that gate only while it compares one spelling',
    function() {
      const asked = selectors()
        .filter((one) => compared(one.selector).length > 0)
        .map((one) => one.name)
      assert.deepStrictEqual(
        Object.keys(COMPARING).filter((name) => !asked.includes(name)),
        [],
        'a check in the COMPARING table of test/shadows.test.js compares no ' +
          'attribute value any more, so its entry is asserting nothing and ' +
          'reads like a limit still in force: delete the row with the ' +
          'selector that earned it',
      )
    })
})
