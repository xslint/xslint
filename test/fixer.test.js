/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {fixed} = require('../src/fixer')
const assert = require('assert')

/**
 * Cases where two fixes contend for one span, with the text the winner leaves
 * behind. The loser is listed first, so a run that merely keeps the order it
 * was given fails.
 * @type {Array.<{name: string, content: string, fixes: Array.<object>,
 *  after: string}>}
 */
const CONTENDING = [
  {
    name: 'cannot apply a fix that overlaps an accepted one',
    content: 'XYZ',
    fixes: [
      {name: 'inner', fix: {line: 1, col: 2, value: 'YZ', replacement: 'W'}},
      {name: 'outer', fix: {line: 1, col: 1, value: 'XYZ', replacement: 'Q'}},
    ],
    after: 'Q',
  },
  {
    name: 'should prefer the wider of two fixes that start together',
    content: 'XYZ',
    fixes: [
      {name: 'narrow', fix: {line: 1, col: 1, value: 'X', replacement: 'Q'}},
      {name: 'wider', fix: {line: 1, col: 1, value: 'XYZ', replacement: 'W'}},
    ],
    after: 'W',
  },
]
describe('fixer', function() {
  it('should collapse a run whose span it can verify', function() {
    assert.equal(
      fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{file: 'a.xsl', fix: {line: 1, col: 2, value: '  ', replacement: ' '}}],
      ).contents.get('a.xsl'),
      'X Y',
    )
  })
  it('cannot fix a run whose span no longer matches', function() {
    assert.ok(
      !fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{
          file: 'a.xsl',
          name: 'redundant-whitespace',
          fix: {line: 1, col: 2, value: 'ZZ', replacement: ' '},
        }],
      ).contents.has('a.xsl'),
    )
  })
  it('cannot fix a defect that belongs to another file', function() {
    assert.deepEqual(
      fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{file: 'b.xsl', fix: {line: 1, col: 2, value: '  ', replacement: ' '}}],
      ).applied,
      [],
    )
  })
  it('cannot fix a run that reaches past the end of the file', function() {
    assert.ok(
      !fixed(
        [{file: 'a.xsl', content: 'X'}],
        [{file: 'a.xsl', fix: {line: 1, col: 1, value: 'XY', replacement: 'Z'}}],
      ).contents.has('a.xsl'),
    )
  })
  CONTENDING.forEach(({name, content, fixes, after}) => {
    it(name, function() {
      assert.equal(
        fixed(
          [{file: 'a.xsl', content: content}],
          fixes.map((defect) => ({file: 'a.xsl', ...defect})),
        ).contents.get('a.xsl'),
        after,
      )
    })
  })
  it('cannot count a skipped overlapping fix as applied', function() {
    assert.deepEqual(
      fixed(
        [{file: 'a.xsl', content: 'XYZ'}],
        CONTENDING[0].fixes.map((defect) => ({file: 'a.xsl', ...defect})),
      ).applied.map((defect) => defect.name),
      ['outer'],
    )
  })
})
