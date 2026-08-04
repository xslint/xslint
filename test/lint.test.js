/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {lint, fixed} = require('../src/xslint')
const fs = require('fs')
const path = require('path')
const assert = require('assert')

/**
 * Content of a committed stylesheet, read as an in-memory source.
 * @param {string} name - Fixture path under test/resources
 * @return {{file: string, content: string}} - A source for the linter
 */
const source = function(name) {
  return {
    file: name,
    content: fs.readFileSync(path.resolve(__dirname, 'resources', name), 'utf-8'),
  }
}

describe('lint (programmatic API)', function() {
  it('returns defects for in-memory sources', function() {
    const defects = lint([source('stylesheets/xsl-with-some-violations.xsl')])
    assert.ok(defects.some((defect) => defect.name === 'short-names'))
  })
  it('finds nothing wrong with a clean stylesheet', function() {
    assert.deepEqual(
      lint([source('stylesheets/xsl-with-no-violations.xsl')]),
      [],
    )
  })
  it('honors a suppression', function() {
    assert.ok(
      !lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {suppress: ['short-names']},
      ).some((defect) => defect.name === 'short-names'),
    )
  })
  it('re-grades a severity through overrides', function() {
    assert.equal(
      lint(
        [source('stylesheets/xsl-with-some-violations.xsl')],
        {overrides: {'short-names': 'error'}},
      ).find((defect) => defect.name === 'short-names').severity,
      'error',
    )
  })
  it('exposes the fix engine for callers to apply', function() {
    const sources = [source('stylesheets/xsl-with-no-violations.xsl')]
    assert.equal(fixed(sources, lint(sources)).contents.size, 0)
  })
  it('offers no fix on the refused axis or the refused comparison', function() {
    assert.deepEqual(
      lint([source('refused/refused-expressions.xsl')])
        .filter((defect) => [9, 10].includes(defect.line) && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  it('still reports the verbose axis it refused to shorten', function() {
    assert.ok(
      lint([source('refused/refused-expressions.xsl')]).some(
        (defect) => defect.name === 'unabbreviated-axis' && defect.line === 9,
      ),
    )
  })
  it('keeps the fix on the two valid axes beside the refused ones', function() {
    assert.deepEqual(
      lint([source('refused/refused-expressions.xsl')])
        .filter((defect) => [13, 14].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
  it('offers no declarative fix on a refused pattern or expression', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => [8, 9].includes(defect.line) && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  it('still reports the double slash it refused to drop', function() {
    assert.ok(
      lint([source('refused/refused-by-a-declarative-fix.xsl')]).some(
        (defect) =>
          defect.name === 'starts-with-double-slash' && defect.line === 8,
      ),
    )
  })
  it('offers no declarative fix beside a refused text value template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => defect.line === 14 && defect.fix)
        .map((defect) => defect.name),
      [],
    )
  })
  it('keeps both declarative fixes on the valid template', function() {
    assert.deepEqual(
      lint([source('refused/refused-by-a-declarative-fix.xsl')])
        .filter((defect) => [11, 12].includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
})
