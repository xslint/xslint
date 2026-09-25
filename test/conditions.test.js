/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const conditions = require('../src/conditions')
const {xml, yaml} = require('../src/helpers')
const {nodes} = require('../src/xpath')
const path = require('path')
const assert = require('assert')

/**
 * Stylesheets paired with what one of the two questions answers of the
 * element an `at` selector picks out, the first parameter where none does.
 * @type {Array.<{name: string, asked: string, input: string, at: string,
 *  answer: boolean}>}
 */
const JUDGED = yaml.parsedFromFile(
  path.resolve(__dirname, 'resources', 'conditions', 'judged.yaml'),
)

describe('conditions', function() {
  JUDGED.forEach((row) => {
    it(row.name, function() {
      assert.equal(
        conditions[row.asked](
          nodes(xml.parsedFromString(row.input), row.at ?? '//xsl:param')[0],
        ),
        row.answer,
        `cannot answer ${row.answer} to ${row.asked} here`,
      )
    })
  })
})
