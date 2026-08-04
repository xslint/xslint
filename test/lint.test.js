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

/**
 * Lines of `refused/refused-expressions.xsl` whose expression the XPath
 * validator refuses. A code-based linter still reads them, so it still reports
 * what it finds there, but a fix it offered would rewrite text no processor
 * parses — `select="child::"` shortened to `select=""` — so none may carry one.
 * @type {Array.<number>}
 */
const REFUSED = [9, 10]

/**
 * Lines of the same stylesheet whose expression parses, one of them spaced
 * inside its own step (#615). Their fixes are the ones a validity gate must not
 * take with it.
 * @type {Array.<number>}
 */
const KEPT = [13, 14]

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
  it('offers no fix on an expression the validator refused', function() {
    assert.deepEqual(
      lint([source('refused/refused-expressions.xsl')])
        .filter((defect) => REFUSED.includes(defect.line) && defect.fix)
        .map((defect) => `${defect.name} at ${defect.line}:${defect.pos}`),
      [],
    )
  })
  it('still reports what it finds on a refused expression', function() {
    assert.ok(
      lint([source('refused/refused-expressions.xsl')]).some(
        (defect) => defect.name === 'unabbreviated-axis' &&
          defect.line === REFUSED[0],
      ),
    )
  })
  it('keeps the fix on a valid expression beside a refused one', function() {
    assert.deepEqual(
      lint([source('refused/refused-expressions.xsl')])
        .filter((defect) => KEPT.includes(defect.line))
        .map((defect) => Boolean(defect.fix)),
      [true, true],
    )
  })
})
