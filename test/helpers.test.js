/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {xml, yaml} = require('../src/helpers')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * Sources `xml.parsedFromString` refuses. Each is a well-formedness error that
 * `@xmldom/xmldom` does not throw on — it grades the first a `warning` and says
 * nothing at all about the second — and repairs, so parsing either one would
 * hand every stage downstream a document the parser invented (#574).
 * @type {Array.<{name: string, content: string}>}
 */
const REFUSED = [
  {
    name: 'refuses an attribute value the parser only warns about',
    content: '<a b=c></a>',
  },
  {
    name: 'refuses an ampersand in text that opens no reference',
    content: '<a>Tom & Jerry</a>',
  },
  {
    name: 'refuses a section close in text that closes no section',
    content: '<a>Tom ]]> Jerry</a>',
  },
]

describe('helpers', function() {
  it('refuses to parse a file that does not exist', function() {
    assert.throws(() => xml.parsedFromFile(path.join(os.tmpdir(), 'no.xml')))
  })
  it('refuses to parse a directory', function() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-help-'))
    let threw = false
    try {
      xml.parsedFromFile(dir)
    } catch {
      threw = true
    }
    fs.rmSync(dir, {recursive: true, force: true})
    assert.ok(threw)
  })
  it('reports YAML that does not parse', function() {
    assert.throws(() => yaml.parsedFromString('"unterminated'))
  })
  REFUSED.forEach(({name, content}) => {
    it(name, function() {
      assert.throws(() => xml.parsedFromString(content))
    })
  })
})
