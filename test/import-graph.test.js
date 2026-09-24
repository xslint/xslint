/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {graphOf} = require('../src/import-graph')
const {xml} = require('../src/helpers')
const fs = require('fs')
const path = require('path')
const assert = require('assert')

/**
 * A corpus entry reading a committed fixture, placed at the path given.
 * @param {string} fixture - Basename of the fixture under `import-graph`
 * @param {Array.<string>} parts - Segments of the path it stands at
 * @return {{file: string, content: string, xsl: Document}} - The entry
 */
const placed = function(fixture, parts) {
  const content = fs.readFileSync(
    path.resolve(__dirname, 'resources', 'import-graph', fixture), 'utf-8',
  )
  return {
    file: path.join(...parts),
    content: content,
    xsl: xml.parsedFromString(content),
  }
}

/**
 * Where the module a `plugin:org.lagrange:xsl/topic.xsl` names is placed, and
 * whether the importer's href is to reach it there.
 * @type {Array.<{title: string, parts: Array.<string>, reached: boolean}>}
 */
const PLACES = [
  {
    title: 'the module under the plugin of that id',
    parts: ['ot', 'plugins', 'org.lagrange', 'xsl', 'topic.xsl'],
    reached: true,
  },
  {
    title: 'a plugin of that id standing first in the path',
    parts: ['org.lagrange', 'xsl', 'topic.xsl'],
    reached: true,
  },
  {
    title: 'a directory only ending in the id',
    parts: ['ot', 'plugins', 'xorg.lagrange', 'xsl', 'topic.xsl'],
    reached: false,
  },
]

describe('import-graph', function() {
  PLACES.forEach(function({title, parts, reached}) {
    it(`resolves a plugin href to ${title} only where it is meant to`, function() {
      assert.equal(
        graphOf([
          placed(
            'plugin-importer.xsl',
            ['ot', 'plugins', 'org.fermat', 'xsl', 'main.xsl'],
          ),
          placed('plugin-module.xsl', parts),
        ]).some((edge) => edge.to === path.join(...parts)),
        reached,
        `a plugin href did not answer ${reached} for ${title}`,
      )
    })
  })
})
