/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {
  DIVERTED, HTML, lintByRootTemplate,
} = require('../src/linters/root-template-linter')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const {XSLT} = require('../src/xsl-version')
const path = require('path')
const assert = require('assert')

/**
 * Yaml root template linter test packs.
 * @type {Array<string>}
 */
const PACKS = allFilesFrom(
  path.resolve(__dirname, 'resources', 'root-template-packs'),
)

/**
 * The `DIVERTED` names standing between an element and the template holding it,
 * or nothing at all where a literal result element stands there. Such an
 * element is not outermost whatever the list holds, so the zero a pack asserts
 * around it is produced by the wrapper rather than by any name — which is what
 * the gate below is for.
 * @param {Element} element - The element to walk up from
 * @return {?Array.<string>} - The diverted names above it, or null when masked
 */
const between = function(element) {
  let names = []
  let node = element.parentNode
  while (
    names !== null &&
    !(node.namespaceURI === XSLT && node.localName === 'template')
  ) {
    if (node.namespaceURI === XSLT) {
      if (DIVERTED.includes(node.localName)) {
        names = names.concat([node.localName])
      }
    } else {
      names = null
    }
    node = node.parentNode
  }
  return names
}

/**
 * The `DIVERTED` names the packs isolate: those standing alone above an `html`
 * of no namespace, so that the pack's zero is attributable to that name and to
 * nothing else standing in the way.
 * @return {Set.<string>} - The names isolated by some pack
 */
const isolated = function() {
  const found = new Set()
  PACKS.forEach((pack) => {
    const held = xml.parsedFromString(yaml.parsedFromFile(pack).input)
    HTML.forEach((name) => {
      Array.from(held.getElementsByTagName(name))
        .filter((element) => element.namespaceURI === null)
        .forEach((element) => {
          const names = between(element)
          if (names !== null && names.length === 1) {
            found.add(names[0])
          }
        })
    })
  })
  return found
}

describe('root-template-linter', function() {
  PACKS.forEach((pack) => {
    const yml = yaml.parsedFromFile(pack)
    const input = xml.parsedFromString(yml.input)
    describe(`testing ${path.basename(pack)} pack`, function() {
      it(`should find ${yml.found.amount} root template faults`, function() {
        const defects = lintByRootTemplate(
          [{file: 'test.xsl', content: yml.input, xsl: input}],
        )
        assert.equal(defects.length, yml.found.amount)
        yml.found.positions.forEach((pos, index) => {
          assert.equal(defects[index].line, pos[0])
          assert.equal(defects[index].pos, pos[1])
          assert.equal(defects[index].name, pos[2] ?? yml.pack)
        })
        yml.found.fixes.forEach((expected, index) => {
          assert.equal(
            defects[index].fix?.replacement ?? null,
            expected,
          )
        })
      })
    })
  })
  it('isolates every diverted name in a pack that pins it alone', function() {
    const pinned = isolated()
    assert.deepStrictEqual(
      DIVERTED.filter((one) => !pinned.has(one)),
      [],
      'a name on DIVERTED that no pack isolates is asserted by nothing: drop ' +
        'it from the list and every test still passes, because the zero those ' +
        'packs assert comes from a literal result element or another diverted ' +
        'name standing in the way rather than from the name under test',
    )
  })
  it('cannot report a root template check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'root-template-packs',
      'use-output-method-xml-for-html-1.yaml',
    ))
    assert.equal(
      lintByRootTemplate(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['output-method'],
      ).length,
      0,
    )
  })
  it('cannot report a null output check that is suppressed', function() {
    const yml = yaml.parsedFromFile(path.resolve(
      __dirname, 'resources', 'root-template-packs',
      'null-output-from-stylesheet.yaml',
    ))
    assert.equal(
      lintByRootTemplate(
        [{
          file: 'test.xsl',
          content: yml.input,
          xsl: xml.parsedFromString(yml.input),
        }],
        ['null-output'],
      ).length,
      0,
    )
  })
})
