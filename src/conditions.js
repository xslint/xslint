/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * What a `use-when` does to an element, in the four spellings and at the two
 * floors — 2.0 for the plain attribute, 3.0 for the shadow — asked in one
 * place so the pruning and the checks cannot part on which spelling counts
 * where. `excluded` is certain, and `src/validators/xsl-validator.js` prunes
 * what it answers for; `conditional` is the doubt left over, so a check whose
 * defect a `use-when` can take away stays quiet rather than guessing. It
 * never reads the condition: a literal true is too rare to earn a reading of
 * its own, and every other one is a processor's to answer (#1060).
 */

const {DECIMAL, MODERN, XSLT, since, versionOf} = require('./xsl-version')
const {staticOf} = require('./expressions')
const {TOKENS, TRIVIA, tokenized} = require('./tokens')

/**
 * Whether a condition is false with nothing evaluated: the call `false()`,
 * the empty sequence `()`, a numeric literal equal to zero, or a string
 * literal holding nothing, whatever gap stands between the tokens (#1057).
 * @param {string} condition - The text of a `use-when`
 * @return {boolean} - True when its effective boolean value is false
 */
const falsy = function(condition) {
  const solid = tokenized(condition)
    .filter((token) => !TRIVIA.includes(token.type))
  const [only] = solid
  let answer = ['false()', '()']
    .includes(solid.map((token) => token.value).join(''))
  if (solid.length === 1 && only.type === TOKENS.NUMBER) {
    answer = Number(only.value) === 0
  } else if (solid.length === 1 && only.type === TOKENS.STRING) {
    answer = only.value.length === 2
  }
  return answer
}

/**
 * The `use-when` an element carries, plain and shadowed: an XSLT element
 * spells it unprefixed, any other element under the XSLT namespace (#1048).
 * @param {Element} element - The element to read
 * @return {{plain: string, shadowed: string}} - Both spellings, empty if absent
 */
const spellings = function(element) {
  let plain = element.getAttributeNS(XSLT, 'use-when')
  let shadowed = element.getAttributeNS(XSLT, '_use-when')
  if (element.namespaceURI === XSLT) {
    plain = element.getAttribute('use-when')
    shadowed = element.getAttribute('_use-when')
  }
  return {plain: plain || '', shadowed: shadowed || ''}
}

/**
 * Whether a version is known to stand below a floor, so a processor of it
 * ignores what the floor introduced; a version nobody can place is not.
 * @param {string} version - The version in force
 * @param {string} floor - The version the attribute arrived in
 * @return {boolean} - True when the version is declared and lower
 */
const beneath = function(version, floor) {
  return DECIMAL.test(version) && Number(version) < Number(floor)
}

/**
 * Whether a processor leaves the element out at compile time: its `use-when`
 * is a literal `falsy` answers for. XSLT reads it from 2.0 on and a shadow
 * from 3.0, at the version in force, so a 1.0 processor compiles what the
 * attribute would drop.
 * @param {Element} element - The element to judge
 * @return {boolean} - True when no processor compiles it
 */
const excluded = function(element) {
  const {plain, shadowed} = spellings(element)
  const version = versionOf(element)
  let condition = ''
  if (plain && since(version, MODERN)) {
    condition = plain
  } else if (shadowed && since(version, '3.0')) {
    condition = staticOf(shadowed)
  }
  return falsy(condition)
}

/**
 * Whether a processor may leave the element out: it carries a `use-when` in
 * a spelling its version is not known to ignore. What the condition says is
 * never read, a literal false being pruned before a check looks and anything
 * else being a processor's answer; a version nobody can place ignores nothing.
 * @param {Element} element - The element to judge
 * @return {boolean} - True when whether it is compiled is not ours to say
 */
const conditional = function(element) {
  const {plain, shadowed} = spellings(element)
  const version = versionOf(element)
  return Boolean(plain && !beneath(version, MODERN)) ||
    Boolean(shadowed && !beneath(version, '3.0'))
}

module.exports = {
  conditional,
  excluded,
}
