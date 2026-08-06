/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {versionOf} = require('../src/xsl-version')
const {xml, yaml} = require('../src/helpers')
const {nodes} = require('../src/xpath')
const path = require('path')
const assert = require('assert')

/**
 * Stylesheets paired with the version in force, at the root or at the node an
 * `at` selector picks out.
 * @type {Array.<{name: string, input: string, at: string, version: string}>}
 */
const ROOTS = yaml.parsedFromFile(
  path.resolve(__dirname, 'resources', 'xsl-version', 'roots.yaml'),
)

describe('xsl-version', function() {
  ROOTS.forEach((root) => {
    it(root.name, function() {
      const xsl = xml.parsedFromString(root.input)
      let node = xsl
      if (root.at !== undefined) {
        node = nodes(xsl, root.at)[0]
      }
      assert.equal(versionOf(node), root.version)
    })
  })
})
